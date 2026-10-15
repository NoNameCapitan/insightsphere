import copy
import json
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor
from core import Store, assess, validate_item, canonical_url, now
from app import make_server


def example(url="https://example.org/job/1"):
    return {"title":"Проверяемая задача","url":url,"summary":"Нужна автоматизация таблицы",
            "source_kind":"primary","source_opened":True,"checked_at":now(),
            "status":"open","status_evidence":"Приём открыт на первичной странице",
            "reviewer":"Тестовая фикстура, не реальное объявление", "deadline":"",
            "deadline_display":"Срок не указан", "eligibility":"unknown","fit_gate":"match",
            "budget":{"text":"100 USD","basis":"client","evidence":"Бюджет в описании заказчика"},
            "ratings":{"fit":4,"scope":5,"portfolio":3},"fit_reason":"Совпадает с выбранными навыками",
            "next_action":"Уточнить объём","caution":"Доступность отклика не проверена"}


class CoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=Path(self.tmp.name)/"state.sqlite3"
        self.store=Store(self.db)

    def tearDown(self):
        self.tmp.cleanup()

    def prepared(self,items=None,max_steps=8):
        t=self.store.create_task("Подборка",max_steps)
        self.store.run(t["id"])
        self.store.ingest(t["id"],{"schema_version":1,"items":items or [example()]})
        return t["id"]

    def test_checkpoint_survives_restart(self):
        tid=self.prepared()
        first=self.store.advance(tid)
        self.assertEqual(first["cursor"],2)
        resumed=Store(self.db).run(tid)
        self.assertEqual(resumed["status"],"completed")
        self.assertIn("100 USD",resumed["report"])

    def test_import_merges_and_keeps_snapshots(self):
        tid=self.prepared()
        self.store.ingest(tid,{"schema_version":1,"items":[example("https://example.org/job/2")]})
        task=self.store.task(tid)
        self.assertEqual(len(task["items"]),2)
        imports=[e for e in task["events"] if e["action"]=="materials_imported"]
        self.assertEqual(imports[0]["detail"]["imported_snapshot"][0]["url"],"https://example.org/job/1")

    def test_hash_routes_are_distinct_and_original_url_retained(self):
        a=example("https://example.org/#/jobs/123")
        b=example("https://example.org/#/jobs/456")
        tid=self.prepared([a,b])
        self.assertEqual(len(self.store.task(tid)["items"]),2)
        self.assertEqual(self.store.task(tid)["items"][0]["url"],a["url"])

    def test_tracking_deduplication_and_cross_task_memory(self):
        a=example("https://example.org/job/1?utm_source=ad")
        tid=self.prepared([a,example()])
        self.assertEqual(len(self.store.task(tid)["items"]),1)
        self.store.run(tid)
        another=self.prepared([a])
        self.assertTrue(self.store.task(another)["items"][0]["seen_before"])

    def test_invalid_import_is_atomic(self):
        tid=self.prepared()
        bad=example("javascript:alert(1)")
        with self.assertRaises(ValueError):
            self.store.ingest(tid,{"schema_version":1,"items":[example("https://example.org/2"),bad]})
        self.assertEqual(len(self.store.task(tid)["items"]),1)

    def test_source_snippet_does_not_pass(self):
        item=example();item["source_kind"]="snippet";item["decision"]="candidate"
        self.assertEqual(assess(validate_item(item))["decision"],"needs_review")

    def test_bid_is_not_client_budget(self):
        item=example();item["budget"]["basis"]="bid"
        result=assess(validate_item(item))
        self.assertNotIn("100",result["budget_display"])
        self.assertEqual(result["decision"],"needs_review")

    def test_unknown_budget_remains_unknown(self):
        item=example();item["budget"]={"text":"99999 USD","basis":"unknown","evidence":""}
        tid=self.prepared([item]);out=self.store.run(tid)
        self.assertNotIn("99999",out["report"])
        self.assertIn("не подтверждён",out["report"])

    def test_stale_and_future_checks_are_not_current(self):
        for delta in [timedelta(days=-3),timedelta(days=1)]:
            item=example();item["checked_at"]=(datetime.now(timezone.utc)+delta).isoformat()
            self.assertEqual(assess(validate_item(item))["decision"],"needs_review")

    def test_deadline_rechecked_after_resume(self):
        item=example();item["deadline"]=(datetime.now(timezone.utc)+timedelta(days=1)).date().isoformat()
        tid=self.prepared([item]);self.store.advance(tid);self.store.advance(tid)
        future=datetime.now(timezone.utc)+timedelta(days=3)
        original=assess
        with patch("core.assess",side_effect=lambda i:original(i,at=future)):
            out=self.store.run(tid)
        self.assertEqual(out["analysis"][0]["decision"],"excluded")
        self.assertIn("дата приёма заявок прошла",out["report"])

    def test_deadline_today_uses_kyiv_date(self):
        item=example();item["checked_at"]="2026-09-25T22:00:00+00:00";item["deadline"]="2026-09-26"
        at=datetime(2026,9,25,23,0,tzinfo=timezone.utc)
        self.assertEqual(assess(validate_item(item),at=at)["decision"],"needs_review")

    def test_step_limit_does_not_produce_success_report(self):
        tid=self.prepared(max_steps=1)
        result=self.store.run(tid)
        self.assertEqual(result["status"],"budget_exhausted")
        self.assertEqual(result["report"],"")

    def test_concurrent_resume_is_idempotent(self):
        tid=self.prepared()
        with ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(lambda _:Store(self.db).run(tid),range(3)))
        out=self.store.task(tid)
        self.assertEqual(sum(e["action"]=="report_created" for e in out["events"]),1)
        self.assertEqual(out["steps_used"],4)

    def test_profile_snapshot_survives_later_edits(self):
        tid=self.store.create_task("Первая")["id"]
        self.store.update_notes("Новый контекст")
        second=self.store.create_task("Вторая")
        self.assertNotEqual(self.store.task(tid)["profile"]["notes"],second["profile"]["notes"])
        self.assertEqual(Store(self.db).profile()["notes"],"Новый контекст")

    def test_cancel_prevents_execution(self):
        tid=self.prepared();self.store.cancel(tid)
        self.assertEqual(self.store.run(tid)["status"],"cancelled")
        with self.assertRaises(ValueError):
            self.store.ingest(tid,{"schema_version":1,"items":[example()]})

    def test_forged_ranking_and_nonfinite_numbers_rejected(self):
        item=example();item["score"]=999;item["issues"]=[]
        self.assertNotIn("score",validate_item(item))
        item["ratings"]["fit"]=float("nan")
        with self.assertRaises(ValueError):validate_item(item)


class HTTPTests(unittest.TestCase):
    setUp = CoreTests.setUp
    tearDown = CoreTests.tearDown
    def test_cross_origin_and_missing_token_blocked(self):
        server=make_server(self.store,0)
        worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
        root=f"http://127.0.0.1:{server.server_port}"
        try:
            with urlopen(root+"/api/state") as r:self.assertEqual(r.status,200)
            req=Request(root+"/api/tasks",data=b'{"objective":"fake"}',headers={"Content-Type":"application/json","Origin":"https://example.com"})
            with self.assertRaises(HTTPError) as raised:urlopen(req)
            self.assertEqual(raised.exception.code,403)
            req=Request(root+"/api/tasks",data=b'{"objective":"fake"}',headers={"Content-Type":"application/json"})
            with self.assertRaises(HTTPError) as raised:urlopen(req)
            self.assertEqual(raised.exception.code,403)
            self.assertEqual(self.store.tasks(),[])
        finally:
            server.shutdown();server.server_close();worker.join()


if __name__=="__main__":unittest.main(verbosity=2)
