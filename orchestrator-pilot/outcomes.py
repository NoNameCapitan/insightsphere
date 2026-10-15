"""Owner-recorded customer discovery and outcome acceptance; no external execution."""
import hashlib
import json
import uuid
from core import dump, now, text_value, canonical_url
from workloop import fingerprint


def integer(v, name, maximum=100_000_000):
    if type(v) is not int or not 0 <= v <= maximum:
        raise ValueError('Некорректное число: '+name)
    return v


def text(v, name, limit=2000):
    return text_value(v, name, limit, True)


class Outcomes:
    def __init__(self, store):
        self.store=store
        with store.connect() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS outcome_briefs(
                id TEXT PRIMARY KEY, project_id TEXT NOT NULL, revision INTEGER NOT NULL,
                packet TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT NOT NULL,
                UNIQUE(project_id,revision));
            CREATE TABLE IF NOT EXISTS outcome_attempts(
                id TEXT PRIMARY KEY, brief_id TEXT NOT NULL, artifact TEXT NOT NULL,
                artifact_hash TEXT NOT NULL, checks TEXT NOT NULL, reviewer TEXT NOT NULL,
                note TEXT NOT NULL, cost_minor INTEGER, owner_minutes INTEGER NOT NULL,
                accepted INTEGER NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS discovery_signals(
                id TEXT PRIMARY KEY, segment TEXT NOT NULL, customer_alias TEXT NOT NULL,
                kind TEXT NOT NULL, source TEXT NOT NULL, pain TEXT NOT NULL,
                workaround TEXT NOT NULL, minutes INTEGER NOT NULL,
                intent TEXT NOT NULL, created_at TEXT NOT NULL);
            ''')

    def current(self, db, project_id):
        row=db.execute('SELECT * FROM outcome_briefs WHERE project_id=? ORDER BY revision DESC LIMIT 1',(project_id,)).fetchone()
        return self.decode(row) if row else None

    def decode(self, row):
        obj=dict(row);obj['packet']=json.loads(obj['packet']);return obj

    def brief(self, project_id, expected_revision, packet):
        integer(expected_revision,'версия')
        required={'problem','deliverable','excluded','deadline','currency','price_minor','budget_minor','hourly_minor','criteria','reason'}
        if not isinstance(packet,dict) or set(packet)!=required:
            raise ValueError('Нужен полный бриф')
        p={k:text(packet[k],k,3000) for k in ['problem','deliverable','excluded','deadline','reason']}
        if packet['currency'] not in ['UAH','USD','EUR']:
            raise ValueError('Выберите валюту')
        p['currency']=packet['currency']
        for k in ['price_minor','budget_minor','hourly_minor']:
            p[k]=integer(packet[k],k)
        criteria=packet['criteria']
        if not isinstance(criteria,list) or not 3<=len(criteria)<=10:
            raise ValueError('Нужны 3–10 критериев приёмки')
        p['criteria']=[text(c,'критерий',500) for c in criteria]
        if len({c.casefold() for c in p['criteria']})!=len(criteria):
            raise ValueError('Критерии не должны повторяться')
        with self.store.transaction() as db:
            if not db.execute('SELECT 1 FROM wf_projects WHERE id=?',(project_id,)).fetchone():
                raise KeyError('Проект не найден')
            prev=self.current(db,project_id)
            if (prev['revision'] if prev else 0)!=expected_revision:
                raise ValueError('Бриф изменился; обновите страницу')
            if prev and prev['packet']['currency']!=p['currency']:
                raise ValueError('Валюта проекта неизменна: создайте отдельный проект для другой валюты')
            bid=uuid.uuid4().hex;rev=expected_revision+1
            h=fingerprint({'project_id':project_id,'revision':rev,'packet':p})
            db.execute('INSERT INTO outcome_briefs(id,project_id,revision,packet,hash,created_at) VALUES(?,?,?,?,?,?)',(bid,project_id,rev,dump(p),h,now()))
            return self.current(db,project_id)

    def attempt(self, brief_id, expected_hash, artifact, checks, reviewer, note, cost_minor, owner_minutes):
        artifact=text(artifact,'текст результата или описание версии и ссылка',20000)
        reviewer=text(reviewer,'проверяющий',120);note=text(note,'основание решения')
        if cost_minor is not None: integer(cost_minor,'фактические прямые затраты')
        integer(owner_minutes,'минуты владельца',100000)
        with self.store.transaction() as db:
            row=db.execute('SELECT * FROM outcome_briefs WHERE id=?',(brief_id,)).fetchone()
            if row is None: raise KeyError('Бриф не найден')
            b=self.decode(row);latest=self.current(db,b['project_id'])
            if latest['id']!=brief_id or expected_hash!=b['hash']:
                raise ValueError('Старая версия брифа: проверьте новый объём')
            if not isinstance(checks,list) or len(checks)!=len(b['packet']['criteria']):
                raise ValueError('Оцените каждый критерий')
            clean=[]
            for c in checks:
                if not isinstance(c,dict) or set(c)!={'passed','evidence'} or type(c['passed']) is not bool:
                    raise ValueError('Нужны результат и доказательство каждого критерия')
                clean.append({'passed':c['passed'],'evidence':text(c['evidence'],'доказательство или описание дефекта')})
            aid=uuid.uuid4().hex;accepted=all(c['passed'] for c in clean)
            ah=hashlib.sha256(artifact.encode()).hexdigest()
            # One submitted packet is recorded once; retries cannot inflate costs or acceptance counts.
            if db.execute('SELECT 1 FROM outcome_attempts WHERE brief_id=? AND artifact_hash=? AND checks=? AND cost_minor IS ? AND owner_minutes=? AND reviewer=? AND note=?',
                          (brief_id,ah,dump(clean),cost_minor,owner_minutes,reviewer,note)).fetchone():
                raise ValueError('Эта проверка уже записана')
            db.execute('INSERT INTO outcome_attempts(id,brief_id,artifact,artifact_hash,checks,reviewer,note,cost_minor,owner_minutes,accepted,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                       (aid,brief_id,artifact,ah,dump(clean),reviewer,note,cost_minor,owner_minutes,int(accepted),now()))
            return {'id':aid,'accepted_by_owner':accepted,'client_identity_verified':False,'payment_verified':False}

    def signal(self, segment, customer_alias, kind, source, pain, workaround, minutes, intent):
        segment=text(segment,'сегмент',160);customer_alias=text(customer_alias,'псевдоним источника/клиента',160)
        if kind not in ['public_report','interview','pilot']: raise ValueError('Некорректный тип сигнала')
        source=text(source,'ссылка или запись разговора',2000)
        if kind=='public_report': source=canonical_url(source)
        if intent not in ['unknown','declined','interested','pilot_agreed']: raise ValueError('Некорректный интерес')
        pain=text(pain,'проблема');workaround=text(workaround,'как решается сейчас')
        integer(minutes,'оценка потерь времени',100000)
        with self.store.transaction() as db:
            if db.execute('SELECT 1 FROM discovery_signals WHERE customer_alias=? AND source=? AND pain=?',(customer_alias,source,pain)).fetchone():
                raise ValueError('Этот сигнал уже сохранён')
            sid=uuid.uuid4().hex
            db.execute('INSERT INTO discovery_signals(id,segment,customer_alias,kind,source,pain,workaround,minutes,intent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
                       (sid,segment,customer_alias,kind,source,pain,workaround,minutes,intent,now()))
        return {'id':sid,'demand_proven':False}

    def state(self):
        with self.store.connect() as db:
            briefs=[self.decode(r) for r in db.execute('SELECT * FROM outcome_briefs ORDER BY rowid DESC')]
            attempts=[dict(r) for r in db.execute('SELECT * FROM outcome_attempts ORDER BY rowid DESC')]
            for a in attempts: a['checks']=json.loads(a['checks'])
            signals=[dict(r) for r in db.execute('SELECT * FROM discovery_signals ORDER BY rowid DESC')]
            projects=[dict(r) for r in db.execute('SELECT * FROM wf_projects ORDER BY rowid DESC')]
        summaries=[]
        for project in projects:
            versions=[b for b in briefs if b['project_id']==project['id']]
            if not versions: continue
            b=versions[0];ids={v['id'] for v in versions};runs=[a for a in attempts if a['brief_id'] in ids]
            current=[a for a in runs if a['brief_id']==b['id']]
            known=all(a['cost_minor'] is not None for a in runs) and bool(runs)
            recorded=sum(a['cost_minor'] or 0 for a in runs)
            minutes=sum(a['owner_minutes'] for a in runs)
            labor=(minutes*b['packet']['hourly_minor']+59)//60
            cost=recorded+labor if known else None
            accepted=bool(current and current[0]['accepted'])
            summaries.append({'project_id':project['id'],'brief_id':b['id'],'revision':b['revision'],
                'attempts':len(runs),'accepted_by_owner':accepted,'known_recorded_direct_minor':recorded,
                'cost_complete':known,'owner_minutes':minutes,'estimated_labor_minor':labor,
                'total_recorded_cost_minor':cost,'cost_of_accepted_result_minor':cost if accepted else None,
                'budget_status':'unknown' if cost is None else ('exceeded' if cost>b['packet']['budget_minor'] else 'within'),
                'planned_contribution_minor':b['packet']['price_minor']-cost if cost is not None else None,
                'payment_verified':False})
        return {'briefs':briefs,'attempts':attempts,'signals':signals,'summaries':summaries,
                'costs_are_owner_recorded':True,'external_execution_enabled':False}

    def handoff(self, project_id):
        with self.store.connect() as db: b=self.current(db,project_id)
        if not b: raise KeyError('Сначала создайте бриф')
        p=b['packet']
        return '\n'.join(['# Пакет задания · версия '+str(b['revision']),
            'Это требования владельца, не разрешение на отправку, расходы или публикацию.',
            'Проблема: '+p['problem'],'Результат: '+p['deliverable'],'За рамками: '+p['excluded'],
            'Срок: '+p['deadline'],'Критерии:']+[f'{i+1}. {c}' for i,c in enumerate(p['criteria'])]+
            ['По каждому критерию предоставь проверяемое доказательство; неизвестное обозначай явно.',
             'Хеш брифа: '+b['hash']])
