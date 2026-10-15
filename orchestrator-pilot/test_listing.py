import csv
import io
import json
import sqlite3
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import Mock
from urllib.request import Request, urlopen

from agents import AgentService
from app import make_server
from core import Store, SCHEMA_VERSION, restore_database
from listing import quote_found, validate_reply, MAX_CALLS_PER_VERSION
from providers import ProviderError

TEXT = """Потрібен лендинг для кав'ярні «Зерно» у Києві.
Бюджет замовника: 15000 грн. Прийом заявок відкритий до 2099-12-31.
Обов'язково: досвід з Tilda, портфоліо з 2 сайтами."""
URL = "https://example.com/jobs/landing-1"


def reply(**over):
    value = {
        "fields": {
            "title": {"value": "Лендинг для кав'ярні", "quote": "Потрібен лендинг для кав'ярні"},
            "budget": {"value": "15000 грн", "basis": "client", "quote": "Бюджет замовника: 15000 грн"},
            "deadline": {"value": "2099-12-31", "display": "до 31.12.2099", "quote": "відкритий до 2099-12-31"},
            "status": {"value": "open", "quote": "Прийом заявок відкритий"},
            "requirements": {"value": "Tilda, 2 сайти в портфоліо", "quote": "досвід з Tilda"}},
        "fit": {"fit": 4, "scope": 4, "portfolio": 3, "requirements_match": "match", "reason": "Схожі лендинги"},
        "recommendation": {"action": "apply", "reasons": ["Бюджет вказано"], "unknowns": ["Строки робіт"]},
        "draft_reply": "Добрий день! Готовий зробити лендинг.",
        "limitations": ["Сторінку не відкривав"]}
    for path, v in over.items():
        target = value
        keys = path.split("__")
        for k in keys[:-1]:
            target = target[k]
        target[keys[-1]] = v
    return value


def ollama_inventory():
    return {"hardware": {}, "providers": [{"id": "ollama", "models": [{"name": "fixture:7b"}]}]}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / "state.sqlite3")
        self.runner = Mock()
        self.service = AgentService(self.store, discovery=ollama_inventory, runners={"ollama": self.runner})
        self.listings = self.service.listings

    def tearDown(self):
        self.service.close()
        self.tmp.cleanup()

    def new(self, text=TEXT):
        return self.listings.create(URL, text)

    def manual(self, listing, result):
        run = self.service.start_listing(listing["id"], "chatgpt")
        return self.service.finish(run["id"], result, manual=True)

    def confirm_all(self, listing_id, **values):
        card = self.listings.card(listing_id)
        for group in ["budget", "deadline", "status", "requirements", "fit"]:
            value = values.get(group, card["proposals"][group])
            self.listings.confirm(listing_id, group, value, card["listing"]["version"], card["analysis"])
        return self.listings.card(listing_id)

    def wait_idle(self):
        for _ in range(200):
            with self.store.connect() as db:
                if not db.execute("SELECT 1 FROM agent_runs WHERE status='running'").fetchone():
                    with self.service.lock:
                        if not self.service.workers:
                            return
            time.sleep(.02)
        self.fail("worker did not finish")


class ListingFlowTests(Base):
    def test_pasted_text_to_decision_card(self):
        listing = self.new()
        card = self.listings.card(listing["id"])
        self.assertEqual(card["verdict"]["state"], "pending")
        self.assertLess(card["context_bytes"], card["context_limit"])
        self.manual(listing, reply())
        card = self.listings.card(listing["id"])
        self.assertEqual(card["verdict"]["state"], "confirm")
        self.assertEqual(card["score_source"], "model")
        card = self.confirm_all(listing["id"])
        self.assertEqual(card["verdict"]["state"], "ready")
        self.assertEqual(card["verdict"]["action"], "apply")
        self.assertTrue(card["draft_current"])
        self.assertEqual(card["stale_groups"], [])
        self.assertFalse(card["confirmation"]["source_checked"])
        self.assertIn("НЕ перевірено", self.listings.markdown(listing["id"]))

    def test_bid_is_never_shown_as_client_budget(self):
        listing = self.new()
        self.manual(listing, reply(fields__budget={"value": "15000 грн", "basis": "bid", "quote": "15000 грн"}))
        card = self.confirm_all(listing["id"])
        self.assertEqual(card["budget_display"], "Бюджет заказчика не подтверждён")
        self.assertNotIn("Бюджет замовника: 15000", self.listings.markdown(listing["id"]))

    def test_field_without_evidence_is_unknown(self):
        listing = self.new()
        self.manual(listing, reply(fields__deadline={"value": "2099-12-31", "display": "до кінця року", "quote": ""},
                                   fields__budget={"value": "150000 грн", "basis": "client", "quote": "Бюджет замовника: 150000 грн"}))
        card = self.listings.card(listing["id"])
        problems = {p["field"] for p in card["evidence_problems"]}
        self.assertEqual(problems, {"deadline", "budget"})
        self.assertEqual(card["proposals"]["deadline"]["date"], "")
        self.assertEqual(card["proposals"]["budget"]["basis"], "unknown")

    def test_quote_matching_rules(self):
        self.assertTrue(quote_found('кав\'ярні "Зерно"', TEXT))           # typographic quotes, unambiguous
        self.assertTrue(quote_found("Бюджет   замовника:\n15000", TEXT))   # whitespace
        self.assertFalse(quote_found("Бюджет замовника: 1500 грн", TEXT))  # digits are never rewritten
        self.assertFalse(quote_found("не потрібен", TEXT))
        self.assertFalse(quote_found('"a"', 'текст «a» і ще «a»'))          # ambiguous typographic match

    def test_high_score_does_not_override_blocking_requirement(self):
        listing = self.new()
        self.manual(listing, reply(fit={"fit": 5, "scope": 5, "portfolio": 5, "requirements_match": "match", "reason": "Ідеально"}))
        card = self.confirm_all(listing["id"], status={"value": "closed", "evidence": "закрито"})
        self.assertEqual(card["verdict"]["state"], "blocked")
        self.assertEqual(card["verdict"]["action"], "skip")
        self.assertEqual(card["score"], 100)
        card = self.confirm_all(listing["id"], status={"value": "open", "evidence": "відкритий"},
                                requirements={"match": "mismatch", "eligibility": "unknown", "text": "Потрібен React"})
        self.assertEqual(card["verdict"]["state"], "blocked")

    def test_correction_makes_recommendation_stale_and_rerun_uses_it(self):
        listing = self.new()
        self.manual(listing, reply())
        card = self.confirm_all(listing["id"], budget={"text": "12000 грн", "basis": "client", "evidence": "у чаті"})
        self.assertEqual(card["verdict"]["state"], "stale")
        self.assertFalse(card["draft_current"])
        self.assertEqual(len(card["listing"]["corrections"]), 1)
        run = self.service.start_listing(listing["id"], "chatgpt")
        self.assertEqual(run["input"]["owner_confirmed"]["budget"]["text"], "12000 грн")
        self.service.finish(run["id"], reply(), manual=True)
        self.assertEqual(self.listings.card(listing["id"])["verdict"]["state"], "ready")

    def test_no_false_freshness_and_material_change_invalidates(self):
        listing = self.new()
        self.manual(listing, reply())
        self.listings.mark_source_checked(listing["id"], 1)
        before = self.listings.get(listing["id"])
        same = self.listings.update_text(listing["id"], TEXT)
        self.assertTrue(same["unchanged"])
        self.assertEqual(self.listings.get(listing["id"])["imported_at"], before["imported_at"])
        self.assertEqual(self.listings.get(listing["id"])["source_checked_at"], before["source_checked_at"])
        again = self.listings.create(URL, TEXT)
        self.assertTrue(again["existing"] and again["unchanged"])
        changed = self.listings.update_text(listing["id"], TEXT + "\nОновлено: бюджет 20000 грн.")
        self.assertEqual(changed["version"], 2)
        self.assertEqual(changed["source_checked_at"], "")
        card = self.listings.card(listing["id"])
        self.assertIsNone(card["analysis"])
        self.assertEqual(card["verdict"]["state"], "pending")
        self.assertIn("неактуальні", self.listings.markdown(listing["id"]))
        with self.assertRaises(ValueError):
            self.listings.confirm(listing["id"], "status", {"value": "open"}, 1)
        with self.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM listing_texts").fetchone()[0], 2)

    def test_format_fix_is_automatic_once_and_total_is_capped(self):
        self.runner.return_value = ({"wrong": True}, {"api_cost_usd": 0, "billing": "local_computation"})
        listing = self.new()
        self.service.start_listing(listing["id"], "ollama", "fixture:7b")
        self.wait_idle()
        time.sleep(.05); self.wait_idle()
        card = self.listings.card(listing["id"])
        self.assertEqual([c["kind"] for c in card["calls"]], ["main", "format_fix"])
        self.assertTrue(all(c["status"] == "failed" for c in card["calls"]))
        self.assertIn("Формат відповіді", card["calls"][0]["error"])
        self.assertEqual(self.runner.call_count, 2)
        self.runner.return_value = (reply(), {"api_cost_usd": 0, "billing": "local_computation"})
        self.service.start_listing(listing["id"], "ollama", "fixture:7b")
        self.wait_idle()
        self.assertEqual(self.listings.card(listing["id"])["calls_used"], MAX_CALLS_PER_VERSION)
        with self.assertRaises(ValueError):
            self.service.start_listing(listing["id"], "ollama", "fixture:7b")
        self.assertEqual(self.runner.call_count, 3)

    def test_smallest_model_is_never_picked_implicitly(self):
        listing = self.new()
        with self.assertRaises(ProviderError):
            self.service.start_listing(listing["id"], "ollama", "")

    def test_text_is_kept_when_model_fails(self):
        self.runner.side_effect = ProviderError("Истёк лимит времени исполнителя", {"api_cost_usd": 0})
        listing = self.new()
        self.service.start_listing(listing["id"], "ollama", "fixture:7b")
        self.wait_idle()
        card = self.listings.card(listing["id"])
        self.assertEqual(card["listing"]["text"], TEXT)
        self.assertEqual([c["status"] for c in card["calls"]], ["failed"])  # timeouts are not retried
        self.assertEqual(self.runner.call_count, 1)

    def test_manual_reply_errors_name_the_field_and_keep_run_open(self):
        listing = self.new()
        run = self.service.start_listing(listing["id"], "chatgpt")
        bad = reply(); bad["fit"]["fit"] = 9
        with self.assertRaisesRegex(ValueError, "fit.fit"):
            self.service.finish(run["id"], bad, manual=True)
        self.assertEqual(self.service.get(run["id"])["status"], "waiting_manual")

    def test_oversized_text_is_rejected_not_truncated(self):
        with self.assertRaises(ValueError):
            self.listings.create(URL, "x" * 20_001)
        self.assertEqual(self.listings.summaries(), [])

    def test_decision_outcome_and_pilot_csv(self):
        listing = self.new()
        self.manual(listing, reply())
        self.confirm_all(listing["id"])
        self.listings.decide(listing["id"], "apply", 4, 6, "")
        self.listings.record_outcome(listing["id"], {"applied": True, "replied": None, "won": None, "hours": None, "income": None})
        rows = list(csv.DictReader(io.StringIO(self.listings.pilot_csv())))
        self.assertEqual(rows[0]["owner_action"], "apply")
        self.assertEqual(rows[0]["active_minutes"], "4")
        self.assertEqual(rows[0]["api_cost_usd"], "unknown")  # manual ChatGPT cost is unknown, never zero
        self.assertEqual(rows[0]["replied"], "")
        self.assertTrue(rows[0]["confirmed_at"] and rows[0]["decided_at"] and rows[0]["analysis_received_at"])
        self.assertEqual(self.listings.summaries()[0]["stage"], "done")


class MigrationTests(unittest.TestCase):
    def test_061_database_is_backed_up_migrated_and_restorable(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "state.sqlite3"
            store = Store(path)
            task = store.create_task("Задача з 0.6.1")
            with sqlite3.connect(path) as db:  # shape of a 0.6.1 database
                db.executescript("DROP TABLE listings; DROP TABLE listing_texts; PRAGMA user_version=0;")
            db.close()
            migrated = Store(path)
            self.assertEqual(migrated.schema_version(), SCHEMA_VERSION)
            self.assertTrue(migrated.last_backup and migrated.last_backup.exists())
            self.assertEqual(migrated.task(task["id"])["objective"], "Задача з 0.6.1")
            check = sqlite3.connect(migrated.last_backup)
            self.assertEqual(check.execute("PRAGMA user_version").fetchone()[0], 0)
            check.close()
            replaced = restore_database(migrated.last_backup, path)
            self.assertTrue(replaced.exists())
            restored = sqlite3.connect(path)
            self.assertEqual(restored.execute("PRAGMA user_version").fetchone()[0], 0)
            restored.close()
            again = Store(path)
            self.assertEqual(again.schema_version(), SCHEMA_VERSION)
            self.assertEqual(again.task(task["id"])["objective"], "Задача з 0.6.1")

    def test_fresh_database_needs_no_backup(self):
        with tempfile.TemporaryDirectory() as d:
            store = Store(Path(d) / "state.sqlite3")
            self.assertIsNone(getattr(store, "last_backup", None))
            self.assertEqual(list(Path(d).glob("*.backup-*")), [])


class ListingHTTPTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / "state.sqlite3")
        self.service = AgentService(self.store, discovery=ollama_inventory, runners={})
        self.server = make_server(self.store, 0, self.service)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = "http://127.0.0.1:" + str(self.server.server_port)
        import re
        with urlopen(self.url) as r:
            self.token = re.search(r'name="app-token" content="([^"]+)"', r.read().decode()).group(1)

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.tmp.cleanup()

    def post(self, path, value):
        req = Request(self.url + path, data=json.dumps(value).encode(),
                      headers={"Content-Type": "application/json", "X-Orchestrator-Token": self.token})
        with urlopen(req) as r:
            return json.load(r)

    def get(self, path):
        with urlopen(self.url + path) as r:
            return r.read().decode()

    def test_full_http_path(self):
        listing = self.post("/api/listings", {"url": URL, "text": TEXT})
        run = self.post(f"/api/listings/{listing['id']}/analyze", {"provider": "chatgpt"})
        self.assertIn("Схема результату", self.get(f"/api/agents/{run['id']}/prompt"))
        self.post(f"/api/agents/{run['id']}/import", {"run_id": run["id"], "result": reply()})
        card = json.loads(self.get(f"/api/listings/{listing['id']}"))
        for group in ["budget", "deadline", "status", "requirements", "fit"]:
            self.post(f"/api/listings/{listing['id']}/confirm", {"group": group, "value": card["proposals"][group], "version": 1})
        self.post(f"/api/listings/{listing['id']}/source-checked", {"version": 1})
        card = json.loads(self.get(f"/api/listings/{listing['id']}"))
        self.assertEqual(card["verdict"]["action"], "apply")
        self.post(f"/api/listings/{listing['id']}/decide", {"action": "apply", "active_minutes": 3})
        self.post(f"/api/listings/{listing['id']}/outcome", {"outcome": {"applied": True}})
        self.assertIn("Картка рішення", self.get(f"/api/listings/{listing['id']}/card.md"))
        self.assertIn("owner_action", self.get("/api/pilot.csv"))
        state = json.loads(self.get("/api/listings"))
        self.assertEqual(state["preferred"]["provider"], "chatgpt")
        self.assertEqual(state["listings"][0]["stage"], "done")
        export = json.loads(self.get("/api/export"))
        self.assertEqual(export["listings"]["texts"][0]["text"], TEXT)
        self.assertIn("/listing.js", self.get("/"))


if __name__ == "__main__":
    unittest.main()
