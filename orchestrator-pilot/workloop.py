"""Local owner-reviewed learning and client-plan checkpoints. No external actions."""
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from core import dump, now, text_value

TAGS = {
    'accuracy': 'Точність і джерела', 'requirements': 'Виконання вимог',
    'design': 'Дизайн і зручність', 'speed': 'Швидкість',
    'cost': 'Витрати', 'communication': 'Комунікація',
    'scope': 'Обсяг робіт', 'reliability': 'Надійність',
}
PROPOSALS = {
    'accuracy': 'Відокремлюй підтверджені джерелами факти від припущень; явно позначай невідоме.',
    'requirements': 'Перед відповіддю звір кожну вимогу задачі з конкретним результатом.',
    'design': 'Подавай результат компактно, з чіткими діями та без зайвих повторів.',
    'speed': 'Спочатку використовуй достатні наявні дані; повторюй перевірку лише за конкретної потреби.',
    'cost': 'Пояснюй невідомі витрати; не прирівнюй їх до нуля.',
    'communication': 'Починай із результату, потім називай обмеження та наступну дію.',
    'scope': 'Відокремлюй погоджений обсяг від додаткових побажань і нерозв’язаних питань.',
    'reliability': 'Перевіряй стан виконання; не називай заплановану дію виконаною.',
}
STAGES = ['lead', 'offer', 'scope', 'build', 'review', 'delivery', 'retrospective', 'plan_complete']
STAGE_NAMES = dict(zip(STAGES, ['Вибір клієнта', 'Пропозиція', 'Умови й оплата', 'Розробка',
                               'Перевірка', 'Передача результату', 'Підсумок і досвід', 'План погоджено']))
CHECKS = {'recipient': 'Кому і для чого', 'scope': 'Результат та межі робіт',
          'price': 'Сума й валюта', 'deadline': 'Термін',
          'evidence': 'Підстави та перевірки', 'permissions': 'Доступи й дозволені дії'}
TERMINAL = ('completed', 'failed', 'cancelled', 'interrupted')


def fingerprint(value):
    return hashlib.sha256(dump(value).encode()).hexdigest()


def exists(db, table):
    return db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() is not None


def task_memory(store, task_id, db=None):
    if db is None:
        with store.connect() as conn:
            return task_memory(store, task_id, conn)
    if exists(db, 'experiment_cases'):
        row = db.execute('SELECT snapshot FROM experiment_cases WHERE task_id=?', (task_id,)).fetchone()
        if row:
            return json.loads(row[0]).get('project_memory', [])
    if not exists(db, 'wf_lessons'):
        return []
    rows = db.execute('''SELECT l.id,l.project_id,l.text,l.feedback_id FROM wf_lessons l
        JOIN wf_task_projects t ON t.project_id=l.project_id
        WHERE t.task_id=? AND l.status='active' ORDER BY l.rowid DESC LIMIT 5''', (task_id,))
    return [dict(r) for r in rows]


def feedback_training_items(db, feedback_ids):
    if not exists(db, 'wf_feedback'):
        return []
    result, seen, pending = [], set(), list(feedback_ids)
    while pending:
        fid = pending.pop()
        if fid in seen:
            continue
        seen.add(fid)
        row = db.execute('SELECT subject FROM wf_feedback WHERE id=?', (fid,)).fetchone()
        if row:
            subject = json.loads(row[0])
            result.append(subject['items'])
            pending.extend(m['feedback_id'] for m in subject.get('input', {}).get('project_memory', []) if m.get('feedback_id'))
    return result


def known_training_items(db, config_id):
    if not exists(db, 'wf_feedback'):
        return []
    feedback_ids, seen = [], set()
    while config_id and config_id not in seen:
        seen.add(config_id)
        feedback_ids.extend(row[0] for row in db.execute('SELECT id FROM wf_feedback WHERE config_id=?', (config_id,)))
        row = db.execute('SELECT based_on FROM role_configs WHERE id=?', (config_id,)).fetchone()
        config_id = row[0] if row else ''
    return feedback_training_items(db, feedback_ids)


class WorkLoop:
    def __init__(self, store, quality):
        self.store, self.quality = store, quality
        with store.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS wf_projects (
                    id TEXT PRIMARY KEY,title TEXT NOT NULL,client_alias TEXT NOT NULL,
                    stage TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS wf_task_projects (
                    task_id TEXT PRIMARY KEY,project_id TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS wf_feedback (
                    id TEXT PRIMARY KEY,task_id TEXT NOT NULL,run_id TEXT NOT NULL,
                    project_id TEXT NOT NULL,subject TEXT NOT NULL,subject_hash TEXT NOT NULL,
                    source TEXT NOT NULL,author TEXT NOT NULL,tags TEXT NOT NULL,rating INTEGER NOT NULL,
                    observation TEXT NOT NULL,suggestion TEXT NOT NULL,created_at TEXT NOT NULL,
                    decision TEXT NOT NULL DEFAULT 'pending',decision_note TEXT NOT NULL DEFAULT '',
                    decided_at TEXT NOT NULL DEFAULT '',config_id TEXT NOT NULL DEFAULT '');
                CREATE TABLE IF NOT EXISTS wf_lessons (
                    id TEXT PRIMARY KEY,project_id TEXT NOT NULL,feedback_id TEXT NOT NULL UNIQUE,
                    text TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS wf_checkpoints (
                    id TEXT PRIMARY KEY,project_id TEXT NOT NULL,stage TEXT NOT NULL,
                    project_revision INTEGER NOT NULL,packet TEXT NOT NULL,packet_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL,expires_at TEXT NOT NULL,status TEXT NOT NULL,
                    checks TEXT NOT NULL DEFAULT '{}',note TEXT NOT NULL DEFAULT '');
                CREATE TABLE IF NOT EXISTS wf_events (
                    id INTEGER PRIMARY KEY,at TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL);
            ''')

    def event(self, db, action, detail):
        db.execute('INSERT INTO wf_events(at,action,detail) VALUES(?,?,?)', (now(), action, dump(detail)))

    def project(self, db, project_id):
        row = db.execute('SELECT * FROM wf_projects WHERE id=?', (project_id,)).fetchone()
        if row is None:
            raise KeyError('Проєкт не знайдено')
        return dict(row)

    def create_project(self, title, client_alias):
        title = text_value(title, 'назва проєкту', 160, True)
        client_alias = text_value(client_alias, 'позначення клієнта', 160, True)
        pid = 'project-'+uuid.uuid4().hex
        with self.store.transaction() as db:
            db.execute('INSERT INTO wf_projects VALUES(?,?,?,?,?,?)', (pid,title,client_alias,'lead',0,now()))
            self.event(db, 'project_created', {'project_id': pid})
            return self.project(db, pid)

    def link_task(self, project_id, task_id):
        with self.store.transaction() as db:
            self.project(db, project_id)
            if not db.execute('SELECT 1 FROM tasks WHERE id=?', (task_id,)).fetchone():
                raise KeyError('Задачу не знайдено')
            if db.execute('SELECT 1 FROM experiment_cases WHERE task_id=?', (task_id,)).fetchone():
                raise ValueError('Копію контрольного випадку не можна прив’язати до клієнта')
            row = db.execute('SELECT project_id FROM wf_task_projects WHERE task_id=?', (task_id,)).fetchone()
            if row:
                if row[0] != project_id:
                    raise ValueError('Задача вже належить іншому проєкту')
                return {'task_id': task_id, 'project_id': project_id}
            if db.execute('SELECT 1 FROM wf_feedback WHERE task_id=?', (task_id,)).fetchone():
                raise ValueError('Проєкт потрібно вибрати до запису відгуку; створіть нову задачу')
            db.execute('INSERT INTO wf_task_projects VALUES(?,?)', (task_id,project_id))
            self.event(db, 'task_linked', {'project_id': project_id, 'task_id': task_id})
        return {'task_id': task_id, 'project_id': project_id}

    def subject(self, db, task_id, run_id, allow_historical=False):
        task = db.execute('SELECT objective,revision,items,report FROM tasks WHERE id=?', (task_id,)).fetchone()
        if task is None:
            raise KeyError('Задачу не знайдено')
        if run_id:
            row = db.execute('SELECT task_id,status,input,result,error FROM agent_runs WHERE id=?', (run_id,)).fetchone()
            allowed = TERMINAL + (('stale',) if allow_historical else ())
            if row is None or row['task_id'] != task_id or row['status'] not in allowed:
                raise ValueError('Потрібен завершений актуальний запуск саме цієї задачі')
            snapshot = json.loads(row['input'])
            if not allow_historical and snapshot['task_revision'] != task['revision']:
                raise ValueError('Матеріали змінилися після цього запуску')
            return {'task_id':task_id,'run_id':run_id,'revision':snapshot['task_revision'],
                    'items':snapshot['items'],'input':snapshot,'result':json.loads(row['result']),
                    'status':row['status'],'error':row['error']}
        return {'task_id':task_id,'run_id':'','revision':task['revision'],'objective':task['objective'],
                'items':json.loads(task['items']),'report':task['report']}

    def feedback(self, task_id, run_id, source, author, tags, rating, observation, suggestion):
        if source not in {'owner','client','reviewer'}:
            raise ValueError('Оберіть джерело відгуку')
        if not isinstance(tags,list) or not tags or len(tags)>8 or any(t not in TAGS for t in tags) or len(set(tags))!=len(tags):
            raise ValueError('Оберіть від 1 до 8 різних напрямів оцінки')
        if type(rating) is not int or rating not in range(1,6):
            raise ValueError('Оцінка має бути від 1 до 5')
        author=text_value(author,'автор відгуку',120,True)
        observation=text_value(observation,'що спрацювало або ні',3000,True)
        suggestion=text_value(suggestion,'пропозиція',2000)
        if not suggestion:
            suggestion='Чернетка за категоріями; потребує перевірки:\n'+'\n'.join(PROPOSALS[t] for t in tags)
        fid='feedback-'+uuid.uuid4().hex
        with self.store.transaction() as db:
            subject=self.subject(db,task_id,run_id or '',allow_historical=True)
            row=db.execute('SELECT project_id FROM wf_task_projects WHERE task_id=?',(task_id,)).fetchone()
            project_id=row[0] if row else ''
            db.execute('''INSERT INTO wf_feedback(id,task_id,run_id,project_id,subject,subject_hash,
                source,author,tags,rating,observation,suggestion,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                (fid,task_id,run_id or '',project_id,dump(subject),fingerprint(subject),source,author,dump(tags),rating,observation,suggestion,now()))
            self.event(db,'feedback_recorded',{'feedback_id':fid,'project_id':project_id,'source_identity_verified':False})
        return {'id':fid,'decision':'pending','automatic_improvement':False}

    def decide_feedback(self, feedback_id, decision, text, note, expected_hash):
        if decision not in {'lesson','candidate','reject'}:
            raise ValueError('Оберіть урок проєкту, кандидата інструкцій або відхилення')
        note=text_value(note,'обґрунтування рішення власника',2000,True)
        if len(note)<10:
            raise ValueError('Потрібне конкретне обґрунтування рішення')
        text=text_value(text,'перевірене формулювання',1000 if decision=='lesson' else 2000,decision!='reject')
        with self.store.transaction() as db:
            row=db.execute('SELECT * FROM wf_feedback WHERE id=?',(feedback_id,)).fetchone()
            if row is None:
                raise KeyError('Відгук не знайдено')
            if row['decision']!='pending':
                raise ValueError('Рішення вже записане')
            if expected_hash!=row['subject_hash'] or (decision!='reject' and fingerprint(self.subject(db,row['task_id'],row['run_id']))!=row['subject_hash']):
                raise ValueError('Результат змінився; потрібен новий відгук')
            config_id=''
            if decision=='lesson':
                if not row['project_id']:
                    raise ValueError('Для уроку потрібен проєкт, прив’язаний до задачі до відгуку')
                lid='lesson-'+uuid.uuid4().hex
                db.execute('INSERT INTO wf_lessons VALUES(?,?,?,?,?,?)',(lid,row['project_id'],feedback_id,text,'active',now()))
            elif decision=='candidate':
                cfg=self.quality.create_config('З відгуку '+feedback_id[-8:],text,db=db)
                config_id=cfg['id']
            db.execute('UPDATE wf_feedback SET decision=?,decision_note=?,decided_at=?,config_id=? WHERE id=?',
                       (decision,note,now(),config_id,feedback_id))
            self.event(db,'owner_feedback_decision',{'feedback_id':feedback_id,'decision':decision,'config_id':config_id,'note':note})
        return {'id':feedback_id,'decision':decision,'config_id':config_id,'global_version_applied':False}

    def revoke_lesson(self, lesson_id, note):
        note=text_value(note,'причина відкликання',2000,True)
        with self.store.transaction() as db:
            if not db.execute("UPDATE wf_lessons SET status='revoked' WHERE id=? AND status='active'",(lesson_id,)).rowcount:
                raise ValueError('Активний урок не знайдено')
            self.event(db,'lesson_revoked',{'lesson_id':lesson_id,'note':note})
        return {'id':lesson_id,'status':'revoked'}

    def checkpoint(self, project_id, packet):
        keys={'recipient','deliverable','amount_minor','currency','deadline','evidence'}
        if not isinstance(packet,dict) or set(packet)!=keys:
            raise ValueError('Потрібен повний пакет: адресат, результат, сума, валюта, термін, підстави')
        packet=dict(packet)
        for key,limit in (('recipient',200),('deliverable',3000),('deadline',120),('evidence',3000)):
            packet[key]=text_value(packet[key],key,limit,True)
        if type(packet['amount_minor']) is not int or not 0<=packet['amount_minor']<=100_000_000:
            raise ValueError('Сума має бути цілим числом у копійках/центах від 0 до 100000000')
        if packet['currency'] not in {'UAH','USD','EUR'}:
            raise ValueError('Оберіть UAH, USD або EUR')
        cid='checkpoint-'+uuid.uuid4().hex
        with self.store.transaction() as db:
            p=self.project(db,project_id)
            if p['stage']=='plan_complete':
                raise ValueError('План уже погоджено; для нового циклу створіть окремий проєкт')
            rev=p['revision']+1
            snapshot={'project_id':project_id,'project_revision':rev,'stage':p['stage'],'packet':packet}
            h=fingerprint(snapshot)
            db.execute("UPDATE wf_checkpoints SET status='superseded' WHERE project_id=? AND status='pending'",(project_id,))
            db.execute('UPDATE wf_projects SET revision=? WHERE id=?',(rev,project_id))
            db.execute('''INSERT INTO wf_checkpoints(id,project_id,stage,project_revision,packet,packet_hash,
                created_at,expires_at,status) VALUES(?,?,?,?,?,?,?,?,?)''',
                (cid,project_id,p['stage'],rev,dump(packet),h,now(),(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat(),'pending'))
            self.event(db,'checkpoint_requested',{'checkpoint_id':cid,'packet_hash':h})
        return {'id':cid,'packet_hash':h,'external_action_performed':False}

    def decide_checkpoint(self, checkpoint_id, decision, checks, note, expected_hash):
        if decision not in {'approve','revise','reject'}:
            raise ValueError('Оберіть погодження, зміни або відхилення')
        if not isinstance(checks,dict) or set(checks)!=set(CHECKS) or any(type(x) is not bool for x in checks.values()):
            raise ValueError('Оцініть усі шість пунктів опитувальника')
        if decision=='approve' and not all(checks.values()):
            raise ValueError('Для погодження потрібні всі шість підтверджень')
        note=text_value(note,'коментар власника',2000,True)
        with self.store.transaction() as db:
            row=db.execute('SELECT * FROM wf_checkpoints WHERE id=?',(checkpoint_id,)).fetchone()
            if row is None:
                raise KeyError('Контрольну точку не знайдено')
            p=self.project(db,row['project_id'])
            snapshot={'project_id':p['id'],'project_revision':row['project_revision'],'stage':row['stage'],'packet':json.loads(row['packet'])}
            if (row['status']!='pending' or p['revision']!=row['project_revision'] or p['stage']!=row['stage']
                    or expected_hash!=row['packet_hash'] or fingerprint(snapshot)!=row['packet_hash']
                    or datetime.fromisoformat(row['expires_at'])<=datetime.now(timezone.utc)):
                raise ValueError('Рішення застаріле, прострочене або вже використане; сформуйте новий пакет')
            db.execute('UPDATE wf_checkpoints SET status=?,checks=?,note=? WHERE id=?',(decision,dump(checks),note,checkpoint_id))
            stage=STAGES[STAGES.index(p['stage'])+1] if decision=='approve' else p['stage']
            db.execute('UPDATE wf_projects SET stage=?,revision=revision+1 WHERE id=?',(stage,p['id']))
            self.event(db,'owner_checkpoint_decision',{'checkpoint_id':checkpoint_id,'decision':decision,'packet_hash':row['packet_hash'],'external_action_performed':False})
        return {'id':checkpoint_id,'decision':decision,'next_stage':stage,'external_action_performed':False,'payment_verified':False}

    def state(self):
        with self.store.connect() as db:
            result={key:[dict(r) for r in db.execute('SELECT * FROM '+table+' ORDER BY rowid DESC')]
                    for key,table in [('projects','wf_projects'),('links','wf_task_projects'),('feedback','wf_feedback'),
                                     ('lessons','wf_lessons'),('checkpoints','wf_checkpoints'),('events','wf_events')]}
            for f in result['feedback']:
                f['tags']=json.loads(f['tags']); f['subject']=json.loads(f['subject'])
                try:
                    f['stale'] = fingerprint(self.subject(db,f['task_id'],f['run_id'])) != f['subject_hash']
                except (ValueError, KeyError):
                    f['stale'] = True
            for c in result['checkpoints']:
                c['packet']=json.loads(c['packet']);c['checks']=json.loads(c['checks'])
            for e in result['events']:
                e['detail']=json.loads(e['detail'])
            result['pending_iterations']=[dict(r) for r in db.execute('''SELECT a.id,a.task_id,a.role,a.status,a.updated_at,
                t.objective FROM agent_runs a JOIN tasks t ON t.id=a.task_id
                WHERE a.status IN ('completed','failed','cancelled','interrupted','stale') AND NOT EXISTS
                (SELECT 1 FROM wf_feedback f WHERE f.run_id=a.id) ORDER BY a.updated_at DESC''')]
            result.update(tags=TAGS,stages=STAGE_NAMES,checks=CHECKS,autonomy_level='assisted',
                          external_actions_enabled=False,payments_connected=False,source_identity_verified=False)
            return result
