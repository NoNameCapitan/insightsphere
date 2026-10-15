"""Loopback-only UI for the local research pilot (Python 3.10+)."""
import argparse
import json
import os
import secrets
import signal
import sys
import threading
import webbrowser
from platform_support import lock_file
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from core import Store, ROOT, VERSION, dump, assess, rank_items, render_report
from datetime import datetime
from agents import AgentService
from providers import discover


def default_data_path():
    if sys.platform == 'win32':
        return Path(os.environ.get('LOCALAPPDATA') or Path.home()/'AppData/Local') / 'OrchestratorPilot/state.sqlite3'
    base = Path.home() / ("Library/Application Support" if sys.platform == "darwin" else ".local/share")
    return base / "OrchestratorPilot" / "state.sqlite3"


def make_server(store, port=8765, agents=None):
    token = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def trusted(self):
            allowed = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
            if self.headers.get("Host") not in allowed:
                return False
            origin = self.headers.get("Origin")
            return not origin or origin in {f"http://{host}" for host in allowed}

        def respond(self, value, code=200, content_type="application/json; charset=utf-8", download=None):
            body = (dump(value) if content_type.startswith("application/json") else value).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'")
            if download:
                self.send_header("Content-Disposition", f'attachment; filename="{download}"')
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if not self.trusted():
                return self.respond({"error":"Недопустимый адрес запроса"},403)
            path = urlsplit(self.path).path
            try:
                if path == "/":
                    page=(ROOT / "static/index.html").read_text().replace("__TOKEN__",token)
                    return self.respond(page,content_type="text/html; charset=utf-8")
                if path in {"/app.js","/quality.js","/workloop.js","/outcomes.js","/style.css"}:
                    kind="text/javascript" if path.endswith("js") else "text/css"
                    return self.respond((ROOT / "static" / path[1:]).read_text(),content_type=f"{kind}; charset=utf-8")
                if path == "/api/demo-report":
                    data=json.loads((ROOT / "data/pilot-materials.json").read_text())
                    at=datetime.fromisoformat("2026-09-25T18:00:00+03:00")
                    items=rank_items([assess(item,at=at) for item in data["items"]])
                    report="ИСТОРИЧЕСКОЕ ДЕМО · 25.09.2026. Не актуальная подборка; для отклика проверьте источники заново.\n\n"+render_report("Пример отбора заказов",items,at.isoformat())
                    return self.respond({"as_of":at.isoformat(),"historical":True,"report":report})
                if path == "/api/state":
                    return self.respond({"version":VERSION,"profile":store.profile(),"tasks":store.tasks(),
                                         "role_configs":agents.quality.state()["configs"],"active_config":agents.quality.config(),
                                         "capabilities":json.loads((ROOT / "data/capabilities.json").read_text())})
                if path == "/api/export":
                    return self.respond({**store.export(),"quality":agents.quality.export(),"workloop":agents.workloop.state(),"outcomes":agents.outcomes.state()},download="orchestrator-context.json")
                if path == "/api/outcomes":
                    return self.respond(agents.outcomes.state())
                if path == "/api/pain-catalog":
                    return self.respond(json.loads((ROOT / "data/pain-catalog.json").read_text()))
                if path.startswith("/api/outcome-handoff/"):
                    return self.respond(agents.outcomes.handoff(path.rsplit("/",1)[1]),content_type="text/markdown; charset=utf-8",download="client-brief.md")
                if path == "/api/workloop":
                    return self.respond(agents.workloop.state())
                if path == "/api/quality":
                    return self.respond(agents.quality.state())
                if path.startswith("/api/experiments/"):
                    parts=path.strip("/").split("/")
                    if len(parts)==3:
                        return self.respond({"experiment":agents.quality.experiment(parts[2]),"verdict":agents.quality.evaluate(parts[2])})
                    if len(parts)==4 and parts[3]=="report":
                        return self.respond(agents.quality.report(parts[2]),content_type="text/markdown; charset=utf-8",download="version-comparison.md")
                if path == "/api/materials-template":
                    return self.respond(json.loads((ROOT / "data/materials-template.json").read_text()),download="materials-template.json")
                if path == "/api/providers":
                    if not secrets.compare_digest(self.headers.get("X-Orchestrator-Token", ""), token):
                        return self.respond({"error":"Проверяйте подключения из приложения"},403)
                    return self.respond(agents.inventory())
                if path.startswith("/api/agents/"):
                    parts = path.strip("/").split("/")
                    if len(parts) == 4 and parts[3] == "prompt":
                        return self.respond(agents.manual_prompt(parts[2]), content_type="text/markdown; charset=utf-8", download="chatgpt-request.md")
                    if len(parts) == 3:
                        return self.respond(agents.get(parts[2]))
                if path.startswith("/api/tasks/"):
                    parts=path.strip("/").split("/")
                    task=store.task(parts[2])
                    if len(parts)==4 and parts[3]=="report":
                        if not task["report"]:
                            return self.respond({"error":"Отчёт ещё не создан"},409)
                        return self.respond(task["report"],content_type="text/markdown; charset=utf-8",download="opportunities-report.md")
                    if len(parts)==3:
                        return self.respond(task)
                return self.respond({"error":"Не найдено"},404)
            except KeyError as e:
                self.respond({"error":str(e)},404)
            except Exception:
                self.respond({"error":"Не удалось прочитать данные"},500)

        def do_POST(self):
            if not self.trusted() or not secrets.compare_digest(self.headers.get("X-Orchestrator-Token",""),token):
                return self.respond({"error":"Откройте приложение по локальному адресу"},403)
            if self.headers.get("Content-Type","").split(";")[0] != "application/json":
                return self.respond({"error":"Нужны данные JSON"},415)
            try:
                length=int(self.headers.get("Content-Length","0"))
                if not 0 < length <= 2_000_000:
                    return self.respond({"error":"Размер запроса должен быть от 1 байта до 2 МБ"},413)
                payload=json.loads(self.rfile.read(length),parse_constant=lambda x: (_ for _ in ()).throw(ValueError("Недопустимое число")))
                if not isinstance(payload,dict):
                    raise ValueError("Нужен объект JSON")
                path=urlsplit(self.path).path
                if path=="/api/tasks":
                    task=store.create_task(payload.get("objective"),payload.get("max_steps",8))
                    return self.respond(store.run(task["id"]),201)
                if path=="/api/profile":
                    return self.respond(store.update_notes(payload.get("notes")))
                if path=="/api/workloop/projects":
                    return self.respond(agents.workloop.create_project(payload.get("title"),payload.get("client_alias")),201)
                if path=="/api/workloop/link":
                    return self.respond(agents.workloop.link_task(payload.get("project_id"),payload.get("task_id")))
                if path=="/api/workloop/feedback":
                    return self.respond(agents.workloop.feedback(payload.get("task_id"),payload.get("run_id",""),payload.get("source"),payload.get("author"),payload.get("tags"),payload.get("rating"),payload.get("observation"),payload.get("suggestion","")),201)
                if path=="/api/workloop/feedback-decision":
                    return self.respond(agents.workloop.decide_feedback(payload.get("feedback_id"),payload.get("decision"),payload.get("text",""),payload.get("note"),payload.get("expected_hash")))
                if path=="/api/workloop/revoke-lesson":
                    return self.respond(agents.workloop.revoke_lesson(payload.get("lesson_id"),payload.get("note")))
                if path=="/api/workloop/checkpoints":
                    return self.respond(agents.workloop.checkpoint(payload.get("project_id"),payload.get("packet")),201)
                if path=="/api/workloop/checkpoint-decision":
                    return self.respond(agents.workloop.decide_checkpoint(payload.get("checkpoint_id"),payload.get("decision"),payload.get("checks"),payload.get("note"),payload.get("expected_hash")))
                if path=="/api/outcomes/brief":
                    return self.respond(agents.outcomes.brief(payload.get("project_id"),payload.get("expected_revision"),payload.get("packet")),201)
                if path=="/api/outcomes/attempt":
                    return self.respond(agents.outcomes.attempt(**payload),201)
                if path=="/api/outcomes/signal":
                    return self.respond(agents.outcomes.signal(**payload),201)
                if path=="/api/configs":
                    return self.respond(agents.quality.create_config(payload.get("title"),payload.get("instructions")),201)
                if path=="/api/experiments":
                    return self.respond(agents.quality.create_experiment(payload.get("title"),payload.get("candidate"),payload.get("cases"),payload.get("provider","ollama"),payload.get("model",""),payload.get("mode","trial")),201)
                if path=="/api/quality/rollback":
                    return self.respond(agents.quality.rollback(payload.get("generation")))
                if path=="/api/pilot":
                    data=json.loads((ROOT / "data/pilot-materials.json").read_text())
                    task=store.create_task("Проверить пробную подборку AI-заказов по материалам от 25.09.2026")
                    store.run(task["id"])
                    store.ingest(task["id"],data)
                    return self.respond(store.run(task["id"]),201)
                parts=path.strip("/").split("/")
                if len(parts)==4 and parts[:2]==["api","experiments"]:
                    experiment_id,action=parts[2:]
                    if action=="promote":
                        return self.respond(agents.quality.promote(experiment_id,payload.get("generation")))
                    if action=="run":
                        return self.respond(agents.start(**agents.quality.run_request(experiment_id,payload.get("case_id"),payload.get("side"))),201)
                    if action=="grade":
                        return self.respond(agents.quality.grade(experiment_id,payload.get("case_id"),payload.get("side"),payload.get("repetition"),payload.get("run_id"),payload.get("checks"),payload.get("assessor"),payload.get("evidence")))
                if len(parts)==4 and parts[:2]==["api","agents"]:
                    run_id, action = parts[2:]
                    if action == "cancel":
                        return self.respond(agents.cancel(run_id))
                    if action == "import":
                        if payload.get("run_id") != run_id:
                            raise ValueError("Ответ предназначен для другого запуска агента")
                        return self.respond(agents.finish(run_id, payload.get("result"), manual=True))
                if len(parts)==4 and parts[:2]==["api","tasks"]:
                    task_id,action=parts[2:]
                    if action=="run": return self.respond(store.run(task_id))
                    if action=="step": return self.respond(store.advance(task_id))
                    if action=="import": return self.respond(store.ingest(task_id,payload))
                    if action=="cancel":
                        return self.respond(agents.cancel_task(task_id))
                    if action=="agents":
                        return self.respond(agents.start(task_id, payload.get("provider","auto"), payload.get("role","analyst"), payload.get("model",""),config_id=payload.get("config_id") or None), 201)
                return self.respond({"error":"Не найдено"},404)
            except KeyError as e:
                self.respond({"error":str(e)},404)
            except (ValueError,TypeError) as e:
                self.respond({"error":str(e)},400)
            except Exception:
                self.respond({"error":"Операция не завершена; сохранённые данные не удалены"},500)

    class LocalServer(ThreadingHTTPServer):
        def server_close(self):
            if getattr(self, "agent_service", None):
                self.agent_service.close()
            if getattr(self, "instance_lock", None):
                self.instance_lock.close()
            super().server_close()

    # Bind and acquire the database instance lock before recovering interrupted jobs.
    server = LocalServer(("127.0.0.1",port),Handler)
    try:
        server.instance_lock = lock_file(store.path.with_suffix(".instance-lock"))
        agents = agents or AgentService(store)
        server.agent_service = agents
    except Exception:
        server.server_close()
        raise
    return server


if __name__=="__main__":
    parser=argparse.ArgumentParser(description="Локальный исследовательский оркестратор")
    parser.add_argument("--port",type=int,default=8765)
    parser.add_argument("--data",type=Path,default=default_data_path())
    parser.add_argument("--open",action="store_true")
    args=parser.parse_args()
    store=Store(args.data)
    try:
        server=make_server(store,args.port)
    except OSError as e:
        print(f"Не удалось занять порт {args.port}. Используйте --port 8766.\n{e}",file=sys.stderr)
        raise SystemExit(1)
    url=f"http://127.0.0.1:{server.server_port}"
    print(f"Оркестратор {VERSION}: {url}\nДанные: {args.data}\nОстановить: Ctrl+C",flush=True)
    if args.open:
        threading.Timer(.5,lambda:webbrowser.open(url)).start()
    def stop_service(_signum, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop_service)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
