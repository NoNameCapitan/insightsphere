"""Protocol/lifecycle tests. No real model or subscription requests are made."""
import copy
import json
import os
import re
import sys
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch, Mock
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from core import Store
from agents import AgentService, validate_result, prompt_for
from providers import bounded_process, ProviderError, local_model, claude_environment, run_claude, run_ollama, discover
from app import make_server
from test_core import example


def answer(item=None):
    item = item or example()
    return {"summary": "Есть возможность автоматизировать таблицу.",
            "findings": [{"source_url": item["url"], "kind": "observation",
                          "claim": "В описании указана автоматизация таблицы.",
                          "evidence": [{"field": "summary", "quote": item["summary"]}]}],
            "next_steps": ["Уточнить объём"],
            "limitations": ["Проверены переданные материалы; внешняя страница не открывалась."]}


def no_local():
    return {"hardware": {"os": "Test", "architecture": "test", "memory_gb": None},
            "providers": [{"id": "ollama", "models": [], "status": "unavailable"}]}


def has_local():
    result = no_local()
    result["providers"][0].update(status="ready", models=[{"name": "fixture:small", "size_bytes": 10000000}])
    return result


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name)/"state.sqlite3")
        self.task = self.store.create_task("Проанализировать возможности")
        self.store.run(self.task["id"])
        self.store.ingest(self.task["id"], {"schema_version": 1, "items": [example()]})
        self.service = AgentService(self.store, discovery=no_local)

    def tearDown(self):
        self.service.close()
        self.tmp.cleanup()

    def manual(self, role="analyst"):
        return self.service.start(self.task["id"], "chatgpt", role)

    def wait_done(self, run_id):
        deadline = time.monotonic()+3
        while time.monotonic() < deadline:
            run = self.service.get(run_id)
            if run["status"] != "running":
                return run
            threading.Event().wait(.01)
        self.fail("Test worker did not finish")

    def test_auto_falls_back_to_manual_without_cloud_call(self):
        forbidden = Mock(side_effect=AssertionError("A paid runner must not be called"))
        self.service.runners = {"claude_code": forbidden, "ollama": forbidden}
        run = self.service.start(self.task["id"])
        self.assertEqual((run["provider"], run["status"]), ("chatgpt", "waiting_manual"))
        forbidden.assert_not_called()
        self.assertIn(run["id"], self.service.manual_prompt(run["id"]))

    def test_valid_manual_result_keeps_source_and_profile_unchanged(self):
        before = self.store.task(self.task["id"])
        run = self.manual()
        self.service.finish(run["id"], answer(), manual=True)
        after = self.store.task(self.task["id"])
        self.assertEqual(before["items"], after["items"])
        self.assertEqual(before["profile"], after["profile"])
        self.assertEqual(after["agent_runs"][0]["status"], "completed")
        self.assertFalse(after["events"][-1]["detail"]["external_truth_verified"])

    def test_invented_source_and_quote_and_control_fields_rejected(self):
        run = self.manual()
        variants = []
        a = answer(); a["findings"][0]["source_url"] = "https://invented.example/job"; variants.append(a)
        a = answer(); a["findings"][0]["evidence"][0]["quote"] = "Гарантированный миллион"; variants.append(a)
        a = answer(); a["approved"] = True; variants.append(a)
        a = answer(); a["limitations"] = []; variants.append(a)
        for data in variants:
            with self.subTest(data=data), self.assertRaises(ValueError):
                self.service.finish(run["id"], data, manual=True)
        self.assertEqual(self.service.get(run["id"])["status"], "waiting_manual")

    def test_completed_and_in_flight_results_become_stale_on_import(self):
        first = self.manual()
        self.service.finish(first["id"], answer(), manual=True)
        second = self.manual()
        self.store.ingest(self.task["id"], {"schema_version": 1, "items": [example("https://example.org/job/2")]})
        self.assertEqual(self.service.get(first["id"])["status"], "stale")
        self.service.finish(second["id"], answer(), manual=True)
        self.assertEqual(self.service.get(second["id"])["status"], "stale")

    def test_reviewer_gets_saved_draft_and_cannot_rewrite_it(self):
        run = self.manual()
        self.service.finish(run["id"], answer(), manual=True)
        review = self.manual("reviewer")
        self.assertEqual(review["input"]["draft"], answer())
        self.service.finish(review["id"], answer(), manual=True)
        self.assertEqual(self.service.get(run["id"])["result"], answer())

    def test_team_automatically_prepares_separate_reviewer(self):
        first = self.service.start(self.task["id"], "chatgpt", "team")
        self.service.finish(first["id"], answer(), manual=True)
        runs = self.store.task(self.task["id"])["agent_runs"]
        self.assertEqual([(r["role"], r["status"]) for r in runs], [("analyst", "completed"), ("reviewer", "waiting_manual")])
        self.assertEqual(self.service.get(runs[1]["id"])["input"]["draft"], answer())

    def test_team_requires_budget_for_both_roles(self):
        for _ in range(3):
            self.service.cancel(self.manual()["id"])
        with self.assertRaises(ValueError):
            self.service.start(self.task["id"], "chatgpt", "team")
        self.assertEqual(len(self.store.task(self.task["id"])["agent_runs"]), 3)

    def test_local_team_runs_two_bounded_calls_in_order(self):
        self.service.discovery = has_local
        calls = []
        def runner(_model, prompt, *_):
            calls.append(prompt.splitlines()[0])
            return answer(), {"api_cost_usd": 0}
        self.service.runners["ollama"] = runner
        run = self.service.start(self.task["id"], "auto", "team")
        self.wait_done(run["id"])
        deadline = time.monotonic()+3
        while time.monotonic() < deadline:
            runs = self.store.task(self.task["id"])["agent_runs"]
            if len(runs) == 2 and all(r["status"] == "completed" for r in runs):
                break
            threading.Event().wait(.01)
        self.assertEqual([r["status"] for r in runs], ["completed", "completed"])
        self.assertIn("analyst", calls[0]); self.assertIn("reviewer", calls[1])

    def test_new_team_review_is_bound_to_new_analyst(self):
        first = self.manual()
        self.service.finish(first["id"], answer(), manual=True)
        old_review = self.manual("reviewer")
        new = self.service.start(self.task["id"], "chatgpt", "team")
        revised = answer(); revised["summary"] = "Новый вывод аналитика"
        self.service.finish(new["id"], revised, manual=True)
        runs = self.store.task(self.task["id"])["agent_runs"]
        self.assertEqual(self.service.get(old_review["id"])["status"], "cancelled")
        reviewer = self.service.get(runs[-1]["id"])
        self.assertEqual(reviewer["input"]["parent_run_id"], new["id"])
        self.assertEqual(reviewer["input"]["draft"], revised)

    def test_task_cancel_blocks_followup_and_signals_current_workers(self):
        self.service.discovery = has_local
        entered = threading.Event()
        def runner(_model, _prompt, _system, _schema, cancel):
            entered.set()
            cancel.wait(2)
            return answer(), {"api_cost_usd": 0}
        self.service.runners["ollama"] = runner
        run = self.service.start(self.task["id"], "auto", "team")
        self.assertTrue(entered.wait(2))
        self.service.cancel_task(self.task["id"])
        self.service.close()
        self.assertEqual(self.service.get(run["id"])["status"], "cancelled")
        self.assertEqual(len(self.store.task(self.task["id"])["agent_runs"]), 1)

    def test_cancelled_result_cannot_be_applied(self):
        run = self.manual()
        self.service.cancel(run["id"])
        with self.assertRaises(ValueError):
            self.service.finish(run["id"], answer(), manual=True)

    def test_duplicate_click_is_idempotent_and_call_budget_is_enforced(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            runs = list(pool.map(lambda _: self.manual(), range(4)))
        self.assertEqual(len({r["id"] for r in runs}), 1)
        self.service.cancel(runs[0]["id"])
        for _ in range(3):
            self.service.cancel(self.manual()["id"])
        with self.assertRaises(ValueError):
            self.manual()

    def test_local_runner_completion_and_restart_context(self):
        self.service.discovery = has_local
        self.service.runners["ollama"] = lambda *_: (answer(), {"api_cost_usd": 0})
        run = self.service.start(self.task["id"])
        self.assertEqual(self.wait_done(run["id"])["status"], "completed")
        reopened = Store(self.store.path).task(self.task["id"])
        self.assertEqual(reopened["agent_runs"][0]["result"], answer())
        exported = self.store.export()
        self.assertEqual(exported["agent_inputs"][0]["input"]["items"][0]["url"], example()["url"])

    def test_model_failure_is_not_replayed_or_hidden_by_fallback(self):
        self.service.discovery = has_local
        self.service.runners["ollama"] = Mock(side_effect=ProviderError("Тестовый сбой"))
        run = self.service.start(self.task["id"])
        self.assertEqual(self.wait_done(run["id"])["status"], "failed")
        self.assertEqual(self.service.runners["ollama"].call_count, 1)
        self.assertEqual(len(self.store.task(self.task["id"])["agent_runs"]), 1)

    def test_rejected_result_keeps_known_usage(self):
        self.service.discovery = has_local
        invalid = answer(); invalid["findings"][0]["evidence"][0]["quote"] = "Выдуманная цитата"
        self.service.runners["ollama"] = lambda *_: (invalid, {"input_tokens": 200, "api_cost_usd": 0})
        run = self.service.start(self.task["id"])
        saved = self.wait_done(run["id"])
        self.assertEqual(saved["status"], "failed")
        self.assertEqual(saved["usage"]["input_tokens"], 200)

    def test_restart_marks_incomplete_call_without_replay(self):
        run = self.manual()
        with self.store.transaction() as db:
            db.execute("UPDATE agent_runs SET status='running' WHERE id=?", (run["id"],))
        restarted = AgentService(self.store, discovery=no_local)
        try:
            self.assertEqual(restarted.get(run["id"])["status"], "interrupted")
        finally:
            restarted.close()

    def test_shutdown_waits_for_child_cleanup(self):
        self.service.discovery = has_local
        started = threading.Event()
        cleaned = threading.Event()
        def runner(_model, _prompt, _system, _schema, cancel):
            started.set()
            try:
                bounded_process([sys.executable, "-c", "import time; time.sleep(20)"], cancel=cancel)
            finally:
                cleaned.set()
        self.service.runners["ollama"] = runner
        self.service.start(self.task["id"])
        self.assertTrue(started.wait(2))
        self.service.close()
        self.assertTrue(cleaned.is_set())
        self.assertFalse(self.service.workers)

    def test_oversized_context_is_rejected_without_truncation_or_call(self):
        items = [example("https://example.org/"+str(i)) for i in range(20)]
        for item in items: item["summary"] = "Длинный текст "*100
        self.store.ingest(self.task["id"], {"schema_version": 1, "items": items})
        with self.assertRaises(ValueError):
            self.manual()
        self.assertEqual(len(self.store.task(self.task["id"])["agent_runs"]), 0)


class ProviderTests(unittest.TestCase):
    def test_shell_metacharacters_are_literal_input(self):
        payload = "`echo unsafe` $(uname)\nПривет"
        code, result, _ = bounded_process([sys.executable, "-c", "import sys; print(sys.stdin.read(),end='')"], payload)
        self.assertEqual((code, result), (0, payload))

    def test_precancelled_does_not_start_process(self):
        cancel = threading.Event(); cancel.set()
        with patch("providers.subprocess.Popen") as popen, self.assertRaises(ProviderError):
            bounded_process([sys.executable, "-c", "pass"], cancel=cancel)
        popen.assert_not_called()

    def test_wall_time_and_output_caps(self):
        with self.assertRaises(ProviderError):
            bounded_process([sys.executable, "-c", "import time; time.sleep(20)"], timeout=.2)
        with self.assertRaises(ProviderError):
            bounded_process([sys.executable, "-c", "print('x'*2100000)"], timeout=3)

    def test_cloud_models_and_unknown_metadata_are_blocked(self):
        with self.assertRaises(ProviderError):
            local_model("fixture:cloud")
        tags = {"models": [{"name": "fixture:local", "size": 1_000_000_000}]}
        for info in ({"remote_host": "cloud.example", "model_info": {"general.architecture": "llama"}}, {}):
            with patch("providers.ollama_request", side_effect=[tags, info]), self.assertRaises(ProviderError):
                local_model("fixture:local")

    def test_embedding_model_is_excluded_before_auto_selection(self):
        tags = {"models": [{"name": "embed:small", "size": 2_000_000}, {"name": "chat:small", "size": 10_000_000}]}
        infos = [{"model_info": {"general.architecture": "bert"}, "capabilities": ["embedding"]},
                 {"model_info": {"general.architecture": "llama"}, "capabilities": ["completion"]}]
        with patch("providers.ollama_request", side_effect=[tags]+infos), patch("providers.claude_info", return_value={"id": "claude_code", "status": "unavailable"}):
            found = discover()["providers"][0]["models"]
        self.assertEqual([m["name"] for m in found], ["chat:small"])
        with patch("providers.ollama_request", side_effect=[tags, infos[0]]), self.assertRaises(ProviderError):
            local_model("embed:small")

    def test_paid_provider_environment_is_not_inherited(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "fixture-only", "ANTHROPIC_BASE_URL": "https://example.org",
                                    "CLAUDE_CODE_USE_BEDROCK": "1", "CLAUDE_CODE_OAUTH_TOKEN": "fixture-only"}):
            env = claude_environment()
        self.assertFalse(any(k.startswith(("ANTHROPIC", "CLAUDE")) for k in env))
        self.assertEqual(env.get("HOME"), os.environ.get("HOME"))

    def test_claude_flags_and_result_envelope_contract(self):
        envelope = {"result": json.dumps(answer()), "total_cost_usd": .01, "is_error": False}
        with patch("providers.claude_info", return_value={"status": "ready"}), patch("providers.executable", return_value="/fixture/claude"), patch("providers.bounded_process", return_value=(0, json.dumps(envelope), "")) as process:
            result, usage = run_claude("fixture prompt", "fixture system")
        argv = process.call_args.args[0]
        self.assertEqual(argv[argv.index("--tools")+1], "")
        self.assertIn("--safe-mode", argv)
        self.assertNotIn("--dangerously-skip-permissions", argv)
        self.assertNotIn("--bare", argv)
        self.assertEqual(result, answer())
        self.assertIsNone(usage["api_cost_usd"])

    def test_claude_api_or_unknown_login_cannot_run_model(self):
        for status in ("billing_unknown", "sign_in_required", "incompatible"):
            with patch("providers.claude_info", return_value={"status": status}), patch("providers.bounded_process") as process, self.assertRaises(ProviderError):
                run_claude("prompt", "system")
            process.assert_not_called()

    def test_claude_error_preserves_available_cost_estimate(self):
        envelope = {"is_error": True, "total_cost_usd": .12}
        with patch("providers.claude_info", return_value={"status": "ready"}), patch("providers.executable", return_value="/fixture/claude"), patch("providers.bounded_process", return_value=(1, json.dumps(envelope), "")), self.assertRaises(ProviderError) as ctx:
            run_claude("prompt", "system")
        self.assertEqual(ctx.exception.usage["reported_cost_estimate_usd"], .12)

    def test_ollama_envelope_is_parsed_without_real_model(self):
        envelope = {"message": {"content": json.dumps(answer())}, "prompt_eval_count": 50, "eval_count": 20}
        with patch("providers.bounded_process", return_value=(0, json.dumps(envelope), "")):
            result, usage = run_ollama("fixture:model", "prompt", "system", {})
        self.assertEqual(result, answer())
        self.assertEqual(usage["api_cost_usd"], 0)

    def test_ollama_worker_uses_real_http_against_fixture_only(self):
        requests = []
        class Fixture(BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_GET(self):
                self.reply({"models": [{"name": "fixture:model", "size": 10000000, "digest": "fixture-digest"}]})
            def do_POST(self):
                data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                requests.append((self.path, data))
                if self.path == "/api/show":
                    self.reply({"model_info": {"general.architecture": "fixture"}, "capabilities": ["completion"]})
                elif self.path == "/api/chat":
                    self.reply({"message": {"content": json.dumps(answer())}, "done": True, "eval_count": 20})
                else:
                    self.send_error(404)
            def reply(self, value):
                data = json.dumps(value).encode()
                self.send_response(200); self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
        try:
            server = ThreadingHTTPServer(("127.0.0.1", 11434), Fixture)
        except OSError:
            self.skipTest("Port occupied: never call an existing Ollama in a protocol test")
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            result, usage = run_ollama("fixture:model", "fixture prompt", "fixture system", {"type": "object"})
            self.assertEqual(result, answer())
            self.assertEqual(usage["model_identity"], "fixture-digest")
            self.assertEqual([p for p, _ in requests], ["/api/show", "/api/chat"])
            body = requests[1][1]
            self.assertFalse(body["stream"])
            self.assertEqual(body["messages"][0]["role"], "system")
            self.assertNotIn("tools", body)
        finally:
            server.shutdown(); server.server_close(); thread.join()


class HttpAgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name)/"state.sqlite3")
        self.discovery = Mock(side_effect=no_local)
        self.service = AgentService(self.store, discovery=self.discovery)
        self.server = make_server(self.store, 0, self.service)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = "http://127.0.0.1:"+str(self.server.server_port)
        with urlopen(self.url) as response:
            self.token = re.search(r'name="app-token" content="([^"]+)"', response.read().decode()).group(1)

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        self.tmp.cleanup()

    def post(self, path, value):
        req = Request(self.url+path, data=json.dumps(value).encode(), headers={"Content-Type": "application/json", "X-Orchestrator-Token": self.token})
        with urlopen(req) as response:
            return json.load(response)

    def test_discovery_requires_token_and_is_cached(self):
        with self.assertRaises(HTTPError) as ctx:
            urlopen(Request(self.url+"/api/providers", headers={"Sec-Fetch-Site": "cross-site"}))
        self.assertEqual(ctx.exception.code, 403)
        self.discovery.assert_not_called()
        for _ in range(2):
            with urlopen(Request(self.url+"/api/providers", headers={"X-Orchestrator-Token": self.token})) as response:
                self.assertIn("providers", json.load(response))
        self.assertEqual(self.discovery.call_count, 1)

    def test_second_instance_cannot_corrupt_active_jobs(self):
        task = self.store.create_task("Test")
        self.store.run(task["id"])
        self.store.ingest(task["id"], {"schema_version": 1, "items": [example()]})
        run = self.service.start(task["id"], "chatgpt")
        with self.store.transaction() as db:
            db.execute("UPDATE agent_runs SET status='running' WHERE id=?", (run["id"],))
        for port in (self.server.server_port, 0):
            with self.assertRaises(OSError):
                make_server(self.store, port)
            self.assertEqual(self.service.get(run["id"])["status"], "running")

    def test_manual_bridge_through_http_and_wrong_run_rejection(self):
        task = self.post("/api/tasks", {"objective": "HTTP scenario"})
        self.post("/api/tasks/"+task["id"]+"/import", {"schema_version": 1, "items": [example()]})
        run = self.post("/api/tasks/"+task["id"]+"/agents", {"provider": "chatgpt"})
        with urlopen(self.url+"/api/agents/"+run["id"]+"/prompt") as response:
            self.assertIn(run["id"], response.read().decode())
        with self.assertRaises(HTTPError) as ctx:
            self.post("/api/agents/"+run["id"]+"/import", {"run_id": "wrong", "result": answer()})
        self.assertEqual(ctx.exception.code, 400)
        accepted = self.post("/api/agents/"+run["id"]+"/import", {"run_id": run["id"], "result": answer()})
        self.assertEqual(accepted["status"], "completed")

    def test_comparison_lifecycle_through_http(self):
        task = self.post("/api/tasks", {"objective": "Проверка полного пути сравнения"})
        self.post("/api/tasks/"+task["id"]+"/import", {"schema_version": 1, "items": [example()]})
        cfg = self.post("/api/configs", {"title": "Кандидат HTTP", "instructions": "Явно перечисляй неизвестное."})
        exp = self.post("/api/experiments", {"title": "Проба HTTP", "candidate": cfg["id"], "provider": "chatgpt", "mode": "trial", "cases": [{"task_id": task["id"], "kind": "ordinary"}]})
        case = exp["cases"][0]
        path = "/api/experiments/"+exp["id"]
        for side in ("baseline", "candidate"):
            for repetition in (1, 2):
                run = self.post(path+"/run", {"case_id": case["id"], "side": side})
                self.post("/api/agents/"+run["id"]+"/import", {"run_id": run["id"], "result": answer()})
                verdict = self.post(path+"/grade", {"case_id": case["id"], "side": side, "repetition": repetition, "run_id": run["id"], "checks": {r["id"]: True for r in case["rubric"]}, "assessor": "Тестовый оператор", "evidence": "Синтетический ответ для проверки HTTP-механизма."})
        self.assertEqual(verdict["grades_done"], 4)
        self.assertTrue(verdict["operator_reviewed"])
        self.assertFalse(verdict["eligible"])
        with urlopen(self.url+path+"/report") as response:
            self.assertIn("Кандидат", response.read().decode())
        with urlopen(self.url+"/api/export") as response:
            exported = json.load(response)
            self.assertEqual(len(exported["quality"]["experiments"][0]["grades"]), 4)
        with self.assertRaises(HTTPError) as ctx:
            self.post(path+"/promote", {"generation": 0})
        self.assertEqual(ctx.exception.code, 400)
        self.assertEqual(self.service.quality.state()["generation"], 0)
        self.discovery.assert_not_called()

    def test_quality_mutations_require_local_token(self):
        for path in ("/api/configs", "/api/experiments", "/api/quality/rollback", "/api/experiments/missing/promote"):
            with self.subTest(path=path), self.assertRaises(HTTPError) as ctx:
                urlopen(Request(self.url+path, data=b"{}", headers={"Content-Type": "application/json"}))
            self.assertEqual(ctx.exception.code, 403)
        with urlopen(self.url+"/quality.js") as response:
            self.assertIn("refreshQuality", response.read().decode())

    def test_owner_feedback_and_checkpoint_http_workflow(self):
        p=self.post('/api/workloop/projects',{'title':'HTTP-проєкт','client_alias':'Клієнт тесту'})
        task=self.post('/api/tasks',{'objective':'HTTP-відгук'})
        self.post('/api/tasks/'+task['id']+'/import',{'schema_version':1,'items':[example()]})
        self.post('/api/workloop/link',{'project_id':p['id'],'task_id':task['id']})
        f=self.post('/api/workloop/feedback',{'task_id':task['id'],'source':'client','author':'Власник записав','tags':['communication','requirements'],'rating':3,'observation':'Потрібно коротше й точніше.'})
        with urlopen(self.url+'/api/workloop') as response:
            record=json.load(response)['feedback'][0]
        self.post('/api/workloop/feedback-decision',{'feedback_id':f['id'],'decision':'lesson','text':'Починай із короткого результату.','note':'Власник перевірив доречність побажання.','expected_hash':record['subject_hash']})
        run=self.post('/api/tasks/'+task['id']+'/agents',{'provider':'chatgpt'})
        self.assertEqual(len(run['input']['project_memory']),1)
        c=self.post('/api/workloop/checkpoints',{'project_id':p['id'],'packet':{'recipient':'Клієнт тесту','deliverable':'План прототипу','amount_minor':0,'currency':'UAH','deadline':'За погодженням','evidence':'Власник перевірив опис.'}})
        result=self.post('/api/workloop/checkpoint-decision',{'checkpoint_id':c['id'],'decision':'approve','checks':{k:True for k in ('recipient','scope','price','deadline','evidence','permissions')},'note':'Погоджено внутрішній план.','expected_hash':c['packet_hash']})
        self.assertFalse(result['external_action_performed'])
        with urlopen(self.url+'/api/export') as response:
            self.assertEqual(len(json.load(response)['workloop']['lessons']),1)
        with urlopen(self.url+'/workloop.js') as response:
            self.assertIn('refreshWorkLoop',response.read().decode())

    def test_workloop_mutations_cannot_bypass_token(self):
        for route in ('projects','link','feedback','feedback-decision','revoke-lesson','checkpoints','checkpoint-decision'):
            with self.subTest(route=route),self.assertRaises(HTTPError) as ctx:
                urlopen(Request(self.url+'/api/workloop/'+route,data=b'{}',headers={'Content-Type':'application/json'}))
            self.assertEqual(ctx.exception.code,403)


if __name__ == "__main__":
    unittest.main()
