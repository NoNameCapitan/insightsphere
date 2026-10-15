import json
import shutil
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfoNotFoundError
from urllib.request import urlopen
from core import Store, assess
from providers import model_json
from quality import engine_hash
import quality
import test_agents as helpers
from test_core import example

class ReviewFixTests(unittest.TestCase):
    def test_missing_timezone_database_keeps_deadline_uncertain(self):
        item=example();item['deadline']='2020-01-01'
        with patch('core.ZoneInfo',side_effect=ZoneInfoNotFoundError('missing')):
            r=assess(item)
        self.assertEqual(r['decision'],'needs_review')
        self.assertTrue(any('часовых поясов' in i for i in r['issues']))
        self.assertFalse(any('дата приёма заявок прошла' in i for i in r['issues']))
    def test_connections_close_and_commit_or_rollback(self):
        with tempfile.TemporaryDirectory() as d:
            store=Store(Path(d)/'test.db')
            with store.connect() as db:db.execute("INSERT INTO settings VALUES('test','committed')")
            with self.assertRaises(sqlite3.ProgrammingError):db.execute('SELECT 1')
            try:
                with store.connect() as db:
                    db.execute("UPDATE settings SET value='bad' WHERE key='test'")
                    raise RuntimeError('abort')
            except RuntimeError:pass
            with self.assertRaises(sqlite3.ProgrammingError):db.execute('SELECT 1')
            with store.connect() as c:self.assertEqual(c.execute("SELECT value FROM settings WHERE key='test'").fetchone()[0],'committed')
    def test_hash_ignores_comments_bookkeeping_and_release_label(self):
        with tempfile.TemporaryDirectory() as d:
            dest=Path(d)
            for p in quality.ROOT.glob('*.py'):shutil.copyfile(p,dest/p.name)
            with patch('quality.ROOT',dest):
                before=engine_hash()
                p=dest/'outcomes.py';p.write_text(p.read_text()+'\nUNKNOWN_NEW_FLAG = 123\n')
                p=dest/'core.py';p.write_text(p.read_text().replace('VERSION = "0.6.1"','VERSION = "999"')+'\n# harmless comment\n')
                self.assertEqual(engine_hash(),before)
                p=dest/'providers.py';p.write_text(p.read_text().replace('MAX_OUTPUT = 2_000_000','MAX_OUTPUT = 1_000_000'))
                self.assertNotEqual(engine_hash(),before)
    def test_model_json_accepts_one_block_and_rejects_ambiguity(self):
        self.assertEqual(model_json('Ответ:\n```json\n{"ok": true}\n```\nГотово.'),{'ok':True})
        for value in ['```json\n{}\n```\n```json\n{}\n```','```json\n{"n":NaN}\n```','Никакого JSON']:
            with self.assertRaises(ValueError):model_json(value)

class ReviewHTTPTests(unittest.TestCase):
    setUp=helpers.HttpAgentTests.setUp
    tearDown=helpers.HttpAgentTests.tearDown
    post=helpers.HttpAgentTests.post
    def test_demo_is_historical_read_only(self):
        before=self.store.tasks()
        with urlopen(self.url+'/api/demo-report') as r:demo=json.load(r)
        self.assertTrue(demo['historical']);self.assertTrue(demo['as_of'].startswith('2026-09-25'))
        self.assertIn('Не актуальная подборка',demo['report']);self.assertEqual(self.store.tasks(),before)
    def test_pasted_manual_payload_uses_existing_validation(self):
        task=self.store.create_task('Отбор заказов');self.store.run(task['id'])
        self.store.ingest(task['id'],{'schema_version':1,'items':[example()]})
        run=self.service.start(task['id'],'chatgpt','analyst')
        result=self.post('/api/agents/'+run['id']+'/import',{'run_id':run['id'],'result':helpers.answer()})
        self.assertEqual(result['status'],'completed')
