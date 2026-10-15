"""Learning, scope, approval and holdout tests; no real clients or provider calls."""
import json
import tempfile
import unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from core import Store
from agents import AgentService
from workloop import CHECKS, task_memory
from test_core import example
from test_agents import answer, no_local


class WorkLoopTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.tmp.name)/'state.sqlite3')
        self.service=AgentService(self.store,discovery=no_local)
        self.w=self.service.workloop
        self.project=self.w.create_project('Проєкт А','Клієнт А')
        self.task=self.new_task(1,self.project['id'])

    def tearDown(self):
        self.service.close();self.tmp.cleanup()

    def new_task(self,n,project=None):
        task=self.store.create_task('Контрольна задача '+str(n));self.store.run(task['id'])
        self.store.ingest(task['id'],{'schema_version':1,'items':[example('https://example.org/'+str(n))]})
        if project:self.w.link_task(project,task['id'])
        return task

    def feedback(self,task=None,run_id='',**kw):
        args=dict(task_id=(task or self.task)['id'],run_id=run_id,source='client',author='Запис власника',tags=['accuracy'],rating=2,
                  observation='У результаті бракує позначення невідомого.',suggestion='')
        args.update(kw)
        record=self.w.feedback(**args)
        return next(f for f in self.w.state()['feedback'] if f['id']==record['id'])

    def decide(self,f,decision='lesson',text='Позначай невідомий бюджет явно.'):
        return self.w.decide_feedback(f['id'],decision,text,'Перевірено власником по матеріалах задачі.',f['subject_hash'])

    def packet(self,recipient='Клієнт А'):
        return dict(recipient=recipient,deliverable='Чернетка обсягу робіт',amount_minor=10000,currency='UAH',deadline='Після погодження',evidence='Власник перевірив опис і межі робіт.')

    def approve(self,c,**kw):
        args=dict(checkpoint_id=c['id'],decision='approve',checks={k:True for k in CHECKS},note='Погоджено лише план.',expected_hash=c['packet_hash'])
        args.update(kw)
        return self.w.decide_checkpoint(**args)

    def test_feedback_produces_only_unverified_draft(self):
        f=self.feedback()
        self.assertIn('Чернетка',f['suggestion'])
        self.assertEqual(f['decision'],'pending')
        self.assertEqual(task_memory(self.store,self.task['id']),[])
        self.assertEqual(self.service.quality.config()['id'],'base-v1')
        self.assertFalse(self.w.state()['source_identity_verified'])

    def test_project_memory_is_scoped_snapshotted_and_revocable(self):
        f=self.feedback();self.decide(f)
        other=self.new_task(2)
        self.assertEqual(task_memory(self.store,other['id']),[])
        run=self.service.start(self.task['id'],'chatgpt')
        self.assertEqual(len(run['input']['project_memory']),1)
        lesson=self.w.state()['lessons'][0]
        self.w.revoke_lesson(lesson['id'],'Потрібне уточнення')
        self.assertEqual(task_memory(self.store,self.task['id']),[])
        self.assertEqual(len(self.service.get(run['id'])['input']['project_memory']),1)

    def test_candidate_does_not_apply_and_known_training_cases_are_not_holdout(self):
        f=self.feedback();candidate=self.decide(f,'candidate')['config_id']
        self.assertEqual(self.service.quality.config()['id'],'base-v1')
        same=self.new_task(1)
        with self.assertRaisesRegex(ValueError,'контрольный набор'):
            self.service.quality.create_experiment('Незалежна перевірка',candidate,[{'task_id':same['id'],'kind':'ordinary'}],'chatgpt',mode='acceptance')
        trial=self.service.quality.create_experiment('Проба',candidate,[{'task_id':same['id'],'kind':'ordinary'}],'chatgpt')
        self.assertEqual(trial['mode'],'trial')
        self.store.ingest(same['id'],{'schema_version':1,'items':[example('https://example.org/new-case')]})
        with self.assertRaisesRegex(ValueError,'контрольный набор'):
            self.service.quality.create_experiment('Суміш відомого з новим',candidate,[{'task_id':same['id'],'kind':'ordinary'}],'chatgpt',mode='acceptance')

    def test_experiment_freezes_same_memory_for_both_versions(self):
        f=self.feedback();self.decide(f)
        q=self.service.quality;cfg=q.create_config('Новий підхід','Коротко перелічуй невідоме.')
        exp=q.create_experiment('Заморожена пам’ять',cfg['id'],[{'task_id':self.task['id'],'kind':'ordinary'}],'chatgpt')
        case=exp['cases'][0]
        self.w.revoke_lesson(self.w.state()['lessons'][0]['id'],'Зміна контексту')
        a=self.service.start(**q.run_request(exp['id'],case['id'],'baseline'))
        self.service.finish(a['id'],answer(case['snapshot']['items'][0]),manual=True)
        b=self.service.start(**q.run_request(exp['id'],case['id'],'candidate'))
        self.assertEqual(a['input']['project_memory'],b['input']['project_memory'])
        self.assertEqual(len(b['input']['project_memory']),1)

    def test_holdout_excludes_transitive_memory_provenance(self):
        self.decide(self.feedback())
        second=self.new_task(2,self.project['id'])
        run=self.service.start(second['id'],'chatgpt')
        self.service.finish(run['id'],answer(self.store.task(second['id'])['items'][0]),manual=True)
        f=self.feedback(second,run['id'])
        cfg=self.decide(f,'candidate')['config_id']
        duplicate=self.new_task(1)
        with self.assertRaisesRegex(ValueError,'контрольный набор'):
            self.service.quality.create_experiment('Неявно відомий випадок',cfg,[{'task_id':duplicate['id'],'kind':'ordinary'}],'chatgpt',mode='acceptance')
        independent_cfg=self.service.quality.create_config('Інша інструкція','Явно позначай невідоме.')
        with self.assertRaisesRegex(ValueError,'контрольный набор'):
            self.service.quality.create_experiment('Пам’ять містить відповідь',independent_cfg['id'],[{'task_id':self.task['id'],'kind':'ordinary'}],'chatgpt',mode='acceptance')

    def test_reviewer_keeps_parent_memory_after_revoke(self):
        self.decide(self.feedback())
        run=self.service.start(self.task['id'],'chatgpt','team')
        self.w.revoke_lesson(self.w.state()['lessons'][0]['id'],'Зміна побажань')
        self.service.finish(run['id'],answer(self.store.task(self.task['id'])['items'][0]),manual=True)
        reviewer=self.service.get(self.store.task(self.task['id'])['agent_runs'][-1]['id'])
        self.assertEqual(reviewer['input']['project_memory'],run['input']['project_memory'])

    def test_changed_task_or_duplicate_decision_is_rejected(self):
        f=self.feedback();self.decide(f)
        with self.assertRaises(ValueError):self.decide(f)
        second=self.feedback()
        self.store.ingest(self.task['id'],{'schema_version':1,'items':[example('https://example.org/new')]})
        with self.assertRaises(ValueError):self.decide(second)
        self.assertEqual(self.decide(second,'reject','')['decision'],'reject')

    def test_foreign_run_and_project_reassignment_are_rejected(self):
        other=self.new_task(3)
        run=self.service.start(other['id'],'chatgpt');self.service.finish(run['id'],answer(self.store.task(other['id'])['items'][0]),manual=True)
        with self.assertRaises(ValueError):self.feedback(run_id=run['id'])
        p=self.w.create_project('Б','Клієнт Б')
        with self.assertRaises(ValueError):self.w.link_task(p['id'],self.task['id'])

    def test_pending_iterations_derive_from_persisted_runs(self):
        run=self.service.start(self.task['id'],'chatgpt');self.service.finish(run['id'],answer(self.store.task(self.task['id'])['items'][0]),manual=True)
        self.assertEqual(self.w.state()['pending_iterations'][0]['id'],run['id'])
        self.feedback(run_id=run['id'])
        self.assertEqual(self.w.state()['pending_iterations'],[])
        state=AgentService(self.store,discovery=no_local)
        try:self.assertEqual(len(state.workloop.state()['feedback']),1)
        finally:state.close()

    def test_old_cancelled_iteration_can_be_archived_but_not_applied(self):
        run=self.service.start(self.task['id'],'chatgpt')
        self.service.cancel(run['id'])
        self.store.ingest(self.task['id'],{'schema_version':1,'items':[example('https://example.org/changed')]})
        self.assertEqual(self.w.state()['pending_iterations'][0]['id'],run['id'])
        f=self.feedback(run_id=run['id'])
        self.assertTrue(f['stale'])
        with self.assertRaises(ValueError):self.decide(f)
        self.decide(f,'reject','')
        self.assertEqual(self.w.state()['pending_iterations'],[])

    def test_checkpoint_requires_all_checks_and_never_executes_external_action(self):
        c=self.w.checkpoint(self.project['id'],self.packet())
        with self.assertRaises(ValueError):self.approve(c,checks={k:False for k in CHECKS})
        result=self.approve(c)
        self.assertEqual(result['next_stage'],'offer')
        self.assertFalse(result['external_action_performed'])
        self.assertFalse(result['payment_verified'])
        with self.assertRaises(ValueError):self.approve(c)

    def test_replacement_expiration_and_tampering_invalidate_checkpoint(self):
        first=self.w.checkpoint(self.project['id'],self.packet())
        second=self.w.checkpoint(self.project['id'],self.packet('Інший адресат'))
        with self.assertRaises(ValueError):self.approve(first)
        with self.store.transaction() as db:db.execute("UPDATE wf_checkpoints SET expires_at='2000-01-01T00:00:00+00:00' WHERE id=?",(second['id'],))
        with self.assertRaises(ValueError):self.approve(second)
        third=self.w.checkpoint(self.project['id'],self.packet())
        with self.store.transaction() as db:db.execute('UPDATE wf_checkpoints SET packet=? WHERE id=?',(json.dumps(self.packet('Підміна')),third['id']))
        with self.assertRaises(ValueError):self.approve(third)

    def test_concurrent_approval_only_advances_once(self):
        c=self.w.checkpoint(self.project['id'],self.packet())
        def action(_):
            try:self.approve(c);return True
            except ValueError:return False
        with ThreadPoolExecutor(max_workers=2) as pool:result=list(pool.map(action,[0,1]))
        self.assertEqual(sum(result),1)
        self.assertEqual(self.w.state()['projects'][0]['stage'],'offer')

    def test_invalid_money_rating_and_tags_are_rejected(self):
        for amount in (-1,True,1.5,100_000_001):
            with self.subTest(amount=amount),self.assertRaises(ValueError):self.w.checkpoint(self.project['id'],{**self.packet(),'amount_minor':amount})
        with self.assertRaises(ValueError):self.feedback(tags=['ignore_permissions'])
        with self.assertRaises(ValueError):self.feedback(rating=True)
