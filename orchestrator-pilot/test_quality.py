"""Synthetic gate/lifecycle tests in temporary databases, not model quality results."""
import copy
import json
import tempfile
import threading
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from core import Store, now, dump
from agents import AgentService, system_for, SYSTEM
from quality import BASE_CONFIG, engine_hash, sample_key
from test_core import example
from test_agents import answer, no_local


class QualityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name)/"state.sqlite3")
        self.agents = AgentService(self.store, discovery=no_local)
        self.q = self.agents.quality

    def tearDown(self):
        self.agents.close()
        self.tmp.cleanup()

    def source(self, n=0):
        task = self.store.create_task("Синтетический контрольный случай "+str(n))
        self.store.run(task["id"])
        self.store.ingest(task["id"], {"schema_version": 1, "items": [example("https://example.org/case/"+str(n))]})
        return task

    def plan(self, count=1, mode="trial"):
        cfg = self.q.create_config("Тестовая инструкция", "Явно перечисляй неизвестные условия.")
        cases = [{"task_id": self.source(n)["id"], "kind": "ordinary" if n < 10 else "failure"} for n in range(count)]
        return self.q.create_experiment("Синтетический тест механизма", cfg["id"], cases, "chatgpt", mode=mode)

    def recorded_run(self, exp, case, side, *, status="completed", usage=None):
        # The test injects recorded execution metadata; it never invokes a model.
        rid, at = uuid.uuid4().hex, now()
        snapshot = {**copy.deepcopy(case["snapshot"]), "role": "analyst", "task_revision": 1,
                    "draft": None, "parent_run_id": None, "followup_role": None, "created_at": at,
                    "config": self.q.config(exp[side]), "engine_hash": exp["engine_hash"]}
        usage = usage if usage is not None else {"api_cost_usd": 0, "elapsed_seconds": 10,
                                                "model_identity": "synthetic-test-model"}
        with self.store.transaction() as db:
            db.execute("INSERT INTO agent_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                       (rid, case["task_id"], "analyst", exp["provider"], exp["model"], status, at, at,
                        dump(snapshot), dump(answer(case["snapshot"]["items"][0])), dump(usage), ""))
        return rid

    def grade_run(self, exp, case, side, repetition=1, checks=None, **run_args):
        rid = self.recorded_run(exp, case, side, **run_args)
        checks = checks or {r["id"]: True for r in case["rubric"]}
        result = self.q.grade(exp["id"], case["id"], side, repetition, rid, checks,
                              "Автор тестовой фикстуры", "Синтетическое основание; проверяется механизм, а не качество настоящей модели.")
        return rid, result

    def measured(self, *, mode="acceptance", quality_gain=True, critical=False, unknown_cost=False, partial_regression=False):
        exp = self.plan(15, mode)
        for index, case in enumerate(exp["cases"]):
            for side in ("baseline", "candidate"):
                for repetition in (1, 2):
                    checks = {r["id"]: True for r in case["rubric"]}
                    if case["kind"] == "ordinary":
                        passed = 8 if side == "baseline" or not quality_gain else 9
                        if index >= passed:
                            checks["requirements"] = False
                    if critical and index == 0 and side == "candidate":
                        checks["grounded"] = False
                    if partial_regression and index == 9 and side == "candidate":
                        checks["useful"] = False
                    usage = {"api_cost_usd": None if unknown_cost else 0, "elapsed_seconds": 10,
                             "model_identity": "synthetic-test-model"}
                    self.grade_run(exp, case, side, repetition, checks=checks, usage=usage)
        return exp

    def test_config_is_draft_and_cannot_change_active_pointer(self):
        cfg = self.q.create_config("Новая версия", "Сначала перечисли пробелы в источниках.")
        self.assertEqual(self.q.config()["id"], BASE_CONFIG)
        self.assertEqual(cfg["based_on"], BASE_CONFIG)
        self.assertNotIn("tools", cfg)

    def test_case_copy_preserves_context_and_sources_without_running_models(self):
        exp = self.plan()
        case = exp["cases"][0]
        source = self.store.task(case["source_task_id"])
        cloned = self.store.task(case["task_id"])
        self.assertNotEqual(source["id"], cloned["id"])
        self.assertEqual(source["items"], cloned["items"])
        self.assertEqual(source["profile"], cloned["profile"])
        self.assertEqual(cloned["agent_runs"], [])

    def test_config_and_engine_are_frozen_in_real_manual_handoff(self):
        exp = self.plan()
        request = self.q.run_request(exp["id"], exp["cases"][0]["id"], "candidate")
        run = self.agents.start(**request)
        self.assertEqual(run["input"]["config"]["id"], exp["candidate"])
        self.assertIn("Явно перечисляй", system_for(run["input"]))
        self.assertEqual(run["input"]["engine_hash"], engine_hash())
        self.agents.finish(run["id"], answer(exp["cases"][0]["snapshot"]["items"][0]), manual=True)
        self.assertEqual(self.agents.get(run["id"])["status"], "completed")

    def test_renamed_duplicate_inputs_do_not_inflate_cases(self):
        a, b = self.source(1), self.source(1)
        cfg = self.q.create_config("Кандидат", "Проверяй ограничения.")
        with self.assertRaises(ValueError):
            self.q.create_experiment("Дубликаты", cfg["id"], [{"task_id": t["id"], "kind": "ordinary"} for t in (a,b)], "chatgpt")

    def test_administrative_metadata_cannot_inflate_sample(self):
        first = example()
        changed = copy.deepcopy(first)
        changed.update(checked_at="2030-01-01T00:00:00Z", nonce="different", ratings={"fit": 999}, seen_before=True)
        changed["summary"] = "  " + changed["summary"].upper() + "   "
        self.assertEqual(sample_key([first]), sample_key([changed]))

    def test_two_attempts_per_side_preserve_other_side_budget(self):
        exp = self.plan(); case = exp["cases"][0]
        for _ in range(2):
            request = self.q.run_request(exp["id"], case["id"], "baseline")
            run = self.agents.start(**request)
            self.assertEqual(self.agents.start(**self.q.run_request(exp["id"], case["id"], "baseline"))["id"], run["id"])
            self.agents.finish(run["id"], answer(case["snapshot"]["items"][0]), manual=True)
        with self.assertRaises(ValueError):
            self.q.run_request(exp["id"], case["id"], "baseline")
        self.assertEqual(self.q.run_request(exp["id"], case["id"], "candidate")["config_id"], exp["candidate"])

    def test_wrong_config_or_changed_snapshot_cannot_be_graded(self):
        exp = self.plan(); case = exp["cases"][0]
        rid = self.recorded_run(exp, case, "baseline")
        with self.assertRaises(ValueError):
            self.q.grade(exp["id"], case["id"], "candidate", 1, rid, {r["id"]: True for r in case["rubric"]}, "Оператор", "Основание достаточно длинное")
        self.store.ingest(case["task_id"], {"schema_version": 1, "items": [example("https://example.org/new")]})
        with self.assertRaises(ValueError):
            self.q.grade(exp["id"], case["id"], "baseline", 1, rid, {r["id"]: True for r in case["rubric"]}, "Оператор", "Основание достаточно длинное")

    def test_grades_and_run_ids_are_single_use(self):
        exp = self.plan(); case = exp["cases"][0]
        rid, _ = self.grade_run(exp, case, "baseline")
        with self.assertRaises(ValueError):
            self.q.grade(exp["id"], case["id"], "baseline", 2, rid, {r["id"]: True for r in case["rubric"]}, "Оператор", "Основание достаточно длинное")
        with self.assertRaises(ValueError):
            self.grade_run(exp, case, "baseline")

    def test_incomplete_and_trial_experiments_cannot_promote(self):
        exp = self.plan(mode="acceptance")
        self.assertFalse(self.q.evaluate(exp["id"])["eligible"])
        self.assertFalse(self.q.evaluate(exp["id"])["operator_reviewed"])
        with self.assertRaises(ValueError):
            self.q.promote(exp["id"], 0)
        trial = self.measured(mode="trial")
        self.assertFalse(self.q.evaluate(trial["id"])["eligible"])

    def test_improvement_can_apply_and_rollback_with_history(self):
        exp = self.measured()
        self.assertTrue(self.q.evaluate(exp["id"])["eligible"])
        state = self.q.promote(exp["id"], 0)
        self.assertEqual(state["active"]["id"], exp["candidate"])
        new_task = self.source(30)
        run = self.agents.start(new_task["id"], "chatgpt")
        self.assertEqual(run["input"]["config"]["id"], exp["candidate"])
        state = self.q.rollback(state["generation"])
        self.assertEqual(state["active"]["id"], BASE_CONFIG)
        self.assertEqual(self.agents.get(run["id"])["input"]["config"]["id"], exp["candidate"])
        self.assertEqual(state["events"][-1]["action"], "version_rolled_back")

    def test_unknown_cost_critical_errors_and_no_gain_block_application(self):
        for options in ({"unknown_cost": True}, {"critical": True}, {"quality_gain": False}):
            with self.subTest(options=options):
                exp = self.measured(**options)
                self.assertFalse(self.q.evaluate(exp["id"])["eligible"])
                with self.assertRaises(ValueError):
                    self.q.promote(exp["id"], 0)

    def test_changed_code_or_run_after_grade_invalidates_gate(self):
        exp = self.measured()
        with patch("quality.engine_hash", return_value="changed"):
            self.assertFalse(self.q.evaluate(exp["id"])["eligible"])
        first = self.q.experiment(exp["id"])["grades"][0]["run_id"]
        with self.store.transaction() as db:
            db.execute("UPDATE agent_runs SET usage=? WHERE id=?", (dump({"api_cost_usd": 99}), first))
        self.assertFalse(self.q.evaluate(exp["id"])["eligible"])

    def test_quality_gain_cannot_hide_individual_criterion_regression(self):
        exp = self.measured(partial_regression=True)
        verdict = self.q.evaluate(exp["id"])
        self.assertEqual((verdict["baseline_passed"], verdict["candidate_passed"]), (8, 9))
        self.assertFalse(verdict["eligible"])
        self.assertTrue(any("отдельного критерия" in reason for reason in verdict["reasons"]))

    def test_failed_ordinary_case_is_not_successful_task(self):
        exp = self.plan(); case = exp["cases"][0]
        with self.assertRaises(ValueError):
            self.grade_run(exp, case, "candidate", status="failed")

    def test_concurrent_promotion_only_changes_pointer_once(self):
        exp = self.measured()
        def promote(_):
            try:
                self.q.promote(exp["id"], 0)
                return True
            except ValueError:
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(promote, [0,1]))
        self.assertEqual(sum(results), 1)
        self.assertEqual(self.q.state()["generation"], 1)
        with self.assertRaises(ValueError):
            self.q.rollback(0)

    def test_review_chain_keeps_parent_configuration_after_pointer_changes(self):
        task = self.source(50)
        cfg = self.q.create_config("Отдельная версия", "Начни с ограничений.")
        run = self.agents.start(task["id"], "chatgpt", "team", config_id=cfg["id"])
        self.agents.finish(run["id"], answer(self.store.task(task["id"])["items"][0]), manual=True)
        runs = self.store.task(task["id"])["agent_runs"]
        reviewer = self.agents.get(runs[-1]["id"])
        self.assertEqual(reviewer["input"]["config"]["id"], cfg["id"])
        self.assertEqual(system_for(reviewer["input"]), SYSTEM)
        self.assertEqual(self.q.config()["id"], BASE_CONFIG)


if __name__ == "__main__":
    unittest.main()
