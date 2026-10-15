import copy
import json
import tempfile
import unittest
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor
from core import Store
from agents import AgentService
from outcomes import Outcomes
import test_agents as helpers


def packet():
    return dict(problem='Ручной недельный отчёт',deliverable='CSV и инструкция',excluded='Без доступа к счетам',deadline='Согласовать дату',currency='UAH',price_minor=50000,budget_minor=10000,hourly_minor=6000,criteria=['Суммы совпадают с исходными','Повторный запуск даёт тот же итог','Есть инструкция'],reason='Начальный бриф')

class OutcomeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.store=Store(Path(self.tmp.name)/'s.db')
        self.service=AgentService(self.store,discovery=helpers.no_local);self.o=self.service.outcomes
        self.project=self.service.workloop.create_project('Отчёт','Клиент А')['id']
        self.b=self.o.brief(self.project,0,packet())
    def tearDown(self):
        self.service.close();self.tmp.cleanup()
    def attempt(self,b=None,passed=True,cost=1000,artifact='Неизменяемый текст результата'):
        b=b or self.b
        return self.o.attempt(b['id'],b['hash'],artifact,[dict(passed=passed,evidence='Сверено с контрольным примером') for _ in range(3)],'Владелец','Личная проверка результата',cost,10)
    def summary(self): return self.o.state()['summaries'][0]
    def test_cost_includes_failed_attempts_and_owner_time(self):
        self.attempt(passed=False,cost=1500,artifact='Первая попытка');self.attempt(cost=2000)
        s=self.summary();self.assertTrue(s['accepted_by_owner']);self.assertEqual(s['total_recorded_cost_minor'],5500)
        self.assertEqual(s['cost_of_accepted_result_minor'],5500);self.assertFalse(s['payment_verified'])
    def test_unknown_cost_does_not_become_zero(self):
        self.attempt(cost=None);s=self.summary()
        self.assertIsNone(s['total_recorded_cost_minor']);self.assertIsNone(s['planned_contribution_minor']);self.assertEqual(s['budget_status'],'unknown')
    def test_scope_change_invalidates_acceptance_and_preserves_cost(self):
        self.attempt();p=packet();p['deliverable']='CSV и новая диаграмма';p['reason']='Дополнительное пожелание'
        b=self.o.brief(self.project,1,p);self.assertFalse(self.summary()['accepted_by_owner'])
        with self.assertRaises(ValueError):self.attempt(artifact='Попытка по старому брифу')
        self.attempt(b=b,artifact='Обновлённый результат');self.assertEqual(self.summary()['total_recorded_cost_minor'],4000)
        self.assertEqual(len(self.o.state()['briefs']),2)
    def test_missing_evidence_or_criterion_never_accepts(self):
        for checks in ([{'passed':True,'evidence':''}]*3,[{'passed':True,'evidence':'ok'}]*2,[{'passed':1,'evidence':'ok'}]*3):
            with self.assertRaises(ValueError):self.o.attempt(self.b['id'],self.b['hash'],'a',checks,'owner','note',0,0)
        self.assertFalse(self.summary()['accepted_by_owner'])
    def test_latest_failed_review_removes_accepted_status(self):
        self.attempt();self.attempt(passed=False,artifact='Позже обнаружен дефект')
        self.assertFalse(self.summary()['accepted_by_owner'])
    def test_duplicate_does_not_double_count(self):
        self.attempt()
        with self.assertRaises(ValueError):self.attempt()
        self.assertEqual(self.summary()['attempts'],1)
    def test_currency_and_numeric_validation(self):
        p=packet();p['currency']='USD'
        with self.assertRaises(ValueError):self.o.brief(self.project,1,p)
        for bad in [-1,True,1.5]:
            with self.assertRaises(ValueError):self.attempt(cost=bad)
        p=packet();p['criteria']=['same','same','third']
        with self.assertRaises(ValueError):self.o.brief(self.project,1,p)
    def test_conflicting_brief_edits_only_one_commits(self):
        def submit(_):
            try:self.o.brief(self.project,1,packet());return True
            except ValueError:return False
        with ThreadPoolExecutor(2) as pool:self.assertEqual(sum(pool.map(submit,range(2))),1)
    def test_project_isolation_restart_and_handoff(self):
        other=self.service.workloop.create_project('Другой','Клиент Б')['id'];self.o.brief(other,0,packet())
        self.attempt();o=Outcomes(self.store);ss={s['project_id']:s for s in o.state()['summaries']}
        self.assertTrue(ss[self.project]['accepted_by_owner']);self.assertFalse(ss[other]['accepted_by_owner'])
        self.assertIn(self.b['hash'],o.handoff(self.project));self.assertIn('Критерии',o.handoff(self.project))
    def test_discovery_is_not_demand_proof_and_dedupes(self):
        args=('Агентства','Респондент 1','interview','28 сентября, заметка','Долго сводить','Вручную',60,'pilot_agreed')
        self.assertFalse(self.o.signal(*args)['demand_proven'])
        with self.assertRaises(ValueError):self.o.signal(*args)
        with self.assertRaises(ValueError):self.o.signal('a','b','public_report','javascript:alert(1)','pain','manual',0,'unknown')

class OutcomeHTTPTests(unittest.TestCase):
    setUp=helpers.HttpAgentTests.setUp
    tearDown=helpers.HttpAgentTests.tearDown
    post=helpers.HttpAgentTests.post
    def test_end_to_end_and_export(self):
        p=self.post('/api/workloop/projects',{'title':'Пилот','client_alias':'Клиент'})
        b=self.post('/api/outcomes/brief',{'project_id':p['id'],'expected_revision':0,'packet':packet()})
        a=self.post('/api/outcomes/attempt',dict(brief_id=b['id'],expected_hash=b['hash'],artifact='Зафиксированный отчёт',checks=[{'passed':True,'evidence':'Проверка по примеру'}]*3,reviewer='Владелец',note='Все пункты выполнены',cost_minor=0,owner_minutes=5))
        self.assertTrue(a['accepted_by_owner'])
        for path in ['/api/outcomes','/api/pain-catalog','/api/export','/outcomes.js','/api/outcome-handoff/'+p['id']]:
            with urlopen(self.url+path) as r:
                body=r.read();self.assertEqual(r.status,200)
                if path=='/api/export':self.assertEqual(len(json.loads(body)['outcomes']['attempts']),1)
    def test_mutations_require_token(self):
        for path in ['brief','attempt','signal']:
            with self.assertRaises(HTTPError) as e:
                urlopen(Request(self.url+'/api/outcomes/'+path,data=b'{}',headers={'Content-Type':'application/json'}))
            self.assertEqual(e.exception.code,403)
