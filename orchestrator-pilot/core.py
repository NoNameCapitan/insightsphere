"""Local, resumable research workflow. No network or model calls are made here."""
from __future__ import annotations

import copy
import hashlib
import json
import math
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

VERSION = "0.6.1"
ROOT = Path(__file__).resolve().parent
STEPS = ["План", "Проверка материалов", "Оценка соответствия", "Отчёт"]
TERMINAL = {"completed", "budget_exhausted", "cancelled"}


def now():
    return datetime.now(timezone.utc).isoformat()


def dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def canonical_url(value):
    if not isinstance(value, str) or len(value) > 2000:
        raise ValueError("Нужна корректная ссылка на источник")
    p = urlsplit(value.strip())
    if p.scheme not in {"https", "http"} or not p.hostname or p.username or p.password:
        raise ValueError("Источник должен иметь HTTP(S)-ссылку без логина и пароля")
    query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in {"fbclid", "gclid"}]
    # Keep path, query order and fragment: hash-routed pages can be distinct jobs.
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path or "/",
                      urlencode(query), p.fragment))


def text_value(value, name, limit=4000, required=False):
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValueError(f"Некорректное поле: {name}")
    return value.strip()


def validate_item(raw):
    if not isinstance(raw, dict):
        raise ValueError("Материал должен быть объектом")
    item = copy.deepcopy(raw)
    item["dedupe_key"] = canonical_url(item.get("url"))
    item["url"] = item["url"].strip()
    item["title"] = text_value(item.get("title"), "название", 300, True)
    for key in ["summary", "fit_reason", "next_action", "caution"]:
        item[key] = text_value(item.get(key, ""), key)
    item["source_kind"] = item.get("source_kind", "unknown")
    if item["source_kind"] not in {"primary", "secondary", "snippet", "unknown"}:
        raise ValueError("Неизвестный тип источника")
    if type(item.get("source_opened", False)) is not bool:
        raise ValueError("source_opened должен быть логическим значением")
    item.setdefault("source_opened", False)
    item["status"] = item.get("status", "unknown")
    if item["status"] not in {"open", "closed", "unknown"}:
        raise ValueError("Неизвестный статус объявления")
    for key in ["checked_at", "deadline", "deadline_display", "status_evidence", "reviewer"]:
        item[key] = text_value(item.get(key, ""), key, 500)
    if item["checked_at"]:
        dt = datetime.fromisoformat(item["checked_at"].replace("Z", "+00:00"))
        if dt.tzinfo is None:
            raise ValueError("Дата проверки должна содержать часовой пояс")
    if item["deadline"]:
        date.fromisoformat(item["deadline"])
    if item.get("eligibility", "unknown") not in {"confirmed", "unknown", "ineligible"}:
        raise ValueError("Неизвестное ограничение участия")
    item.setdefault("eligibility", "unknown")
    item.setdefault("fit_gate", "needs_confirmation")
    if item["fit_gate"] not in {"match", "needs_confirmation", "mismatch"}:
        raise ValueError("Неизвестный статус соответствия требованиям")
    item.setdefault("budget", {"text": "Не указан", "basis": "unknown", "evidence": ""})
    if not isinstance(item["budget"], dict):
        raise ValueError("Бюджет должен быть объектом")
    b = item["budget"]
    b["text"] = text_value(b.get("text", "Не указан"), "бюджет", 400)
    b["evidence"] = text_value(b.get("evidence", ""), "основание бюджета", 500)
    if b.get("basis", "unknown") not in {"client", "bid", "unknown"}:
        raise ValueError("Неизвестный источник бюджета")
    b.setdefault("basis", "unknown")
    item.setdefault("ratings", {})
    if not isinstance(item["ratings"], dict):
        raise ValueError("Оценки должны быть объектом")
    for k in ["fit", "scope", "portfolio"]:
        v = item["ratings"].get(k, 0)
        if type(v) not in {int, float} or not math.isfinite(v) or not 0 <= v <= 5:
            raise ValueError("Оценки должны быть числами от 0 до 5")
        item["ratings"][k] = v
    # Imported verdicts and scores never bypass the local checks.
    for k in ["decision", "score", "issues", "budget_display", "seen_before"]:
        item.pop(k, None)
    return item


def assess(item, at=None):
    at = at or datetime.now(timezone.utc)
    try:
        user_date = at.astimezone(ZoneInfo("Europe/Kyiv")).date()
    except ZoneInfoNotFoundError:
        user_date = None
    out = copy.deepcopy(item)
    issues, hard = [], []
    if item["source_kind"] != "primary" or not item["source_opened"]:
        issues.append("Первичная страница не подтверждена в материалах")
    if not item["reviewer"]:
        issues.append("Не указан автор проверки источника")
    if item["checked_at"]:
        checked = datetime.fromisoformat(item["checked_at"].replace("Z", "+00:00"))
        if checked > at + timedelta(minutes=5):
            issues.append("Дата проверки находится в будущем")
        elif at - checked > timedelta(hours=48):
            issues.append("Проверка старше 48 часов; нужно обновить источник")
    else:
        issues.append("Нет даты проверки")
    if item["status"] == "closed":
        hard.append("Приём заявок завершён")
    elif item["status"] != "open" or not item["status_evidence"]:
        issues.append("Нет подтверждения открытого приёма заявок")
    if item["deadline"] and user_date is None:
        issues.append("Нет базы часовых поясов Europe/Kyiv; срок требует ручной проверки. Время проверки хранится в UTC")
    if item["deadline"] and user_date is not None and date.fromisoformat(item["deadline"]) < user_date:
        hard.append("Указанная дата приёма заявок прошла")
    elif item["deadline"] and user_date is not None and date.fromisoformat(item["deadline"]) == user_date:
        issues.append("Дедлайн сегодня: нужно проверить точное время и часовой пояс")
    if item["eligibility"] == "ineligible":
        hard.append("Указано ограничение участия")
    if item["fit_gate"] == "mismatch":
        hard.append("Требования выходят за выбранный стартовый профиль")
    elif item["fit_gate"] == "needs_confirmation":
        issues.append("Нужно подтвердить соответствие обязательным требованиям")
    if not item["summary"] or not item["next_action"]:
        issues.append("Не хватает описания или следующего действия")
    budget = item["budget"]
    if budget["basis"] == "client" and budget["evidence"]:
        out["budget_display"] = budget["text"]
    else:
        out["budget_display"] = "Бюджет заказчика не подтверждён"
        if budget["basis"] == "bid":
            issues.append("Сумма из отклика исполнителя скрыта из бюджета заказчика")
        elif budget["basis"] == "client":
            issues.append("Нет основания для указанного бюджета")
    if not item["fit_reason"]:
        issues.append("Нет обоснования оценки соответствия")
    out["issues"] = hard + issues
    out["decision"] = "excluded" if hard else "needs_review" if issues else "candidate"
    out["eligibility_note"] = ("Доступность отклика для аккаунта не проверена"
                               if item["eligibility"] == "unknown" else "Ограничения участия указаны в материалах")
    return out


class ClosingConnection(sqlite3.Connection):
    """Preserve commit/rollback semantics and always release the connection."""
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


class Store:
    def __init__(self, db_path):
        self.path = Path(db_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY, objective TEXT NOT NULL, created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL, status TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0,
                    steps_used INTEGER NOT NULL DEFAULT 0, max_steps INTEGER NOT NULL,
                    profile TEXT NOT NULL, items TEXT NOT NULL DEFAULT '[]',
                    analysis TEXT NOT NULL DEFAULT '[]', report TEXT NOT NULL DEFAULT '',
                    revision INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY, task_id TEXT NOT NULL, at TEXT NOT NULL,
                    role TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS history (
                    url TEXT PRIMARY KEY, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS agent_runs (
                    id TEXT PRIMARY KEY, task_id TEXT NOT NULL, role TEXT NOT NULL,
                    provider TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    input TEXT NOT NULL, result TEXT NOT NULL DEFAULT '{}',
                    usage TEXT NOT NULL DEFAULT '{}', error TEXT NOT NULL DEFAULT '');
            """)
            profile = json.loads((ROOT / "data/profile.json").read_text())
            db.execute("INSERT OR IGNORE INTO settings VALUES ('profile', ?)", (dump(profile),))
            current = json.loads(db.execute("SELECT value FROM settings WHERE key='profile'").fetchone()[0])
            for key in ("execution_modes", "declared_hardware"):
                if key not in current and key in profile:
                    current[key] = profile[key]
            db.execute("UPDATE settings SET value=? WHERE key='profile'", (dump(current),))

    def connect(self):
        db = sqlite3.connect(self.path, timeout=15, factory=ClosingConnection)
        db.row_factory = sqlite3.Row
        return db

    @contextmanager
    def transaction(self):
        db = self.connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def event(self, db, task_id, role, action, detail):
        db.execute("INSERT INTO events(task_id,at,role,action,detail) VALUES(?,?,?,?,?)",
                   (task_id, now(), role, action, dump(detail)))

    def profile(self):
        with self.connect() as db:
            return json.loads(db.execute("SELECT value FROM settings WHERE key='profile'").fetchone()[0])

    def update_notes(self, notes):
        notes = text_value(notes, "заметки", 10000)
        with self.transaction() as db:
            p = json.loads(db.execute("SELECT value FROM settings WHERE key='profile'").fetchone()[0])
            p["notes"] = notes
            db.execute("UPDATE settings SET value=? WHERE key='profile'", (dump(p),))
        return p

    def create_task(self, objective, max_steps=8):
        objective = text_value(objective, "задача", 2000, True)
        if type(max_steps) is not int or not 1 <= max_steps <= 100:
            raise ValueError("Лимит шагов должен быть целым числом от 1 до 100")
        task_id, timestamp = uuid.uuid4().hex, now()
        with self.transaction() as db:
            p = db.execute("SELECT value FROM settings WHERE key='profile'").fetchone()[0]
            db.execute("INSERT INTO tasks(id,objective,created_at,updated_at,status,max_steps,profile) VALUES(?,?,?,?,?,?,?)",
                       (task_id, objective, timestamp, timestamp, "ready", max_steps, p))
            self.event(db, task_id, "planner", "created", {"workflow": "opportunity_research", "max_steps": max_steps})
        return self.task(task_id)

    def task(self, task_id):
        with self.connect() as db:
            row = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
            if row is None:
                raise KeyError("Задача не найдена")
            result = dict(row)
            for k in ["profile", "items", "analysis"]:
                result[k] = json.loads(result[k])
            result["events"] = [dict(r) for r in db.execute("SELECT * FROM events WHERE task_id=? ORDER BY id", (task_id,))]
            for event in result["events"]:
                event["detail"] = json.loads(event["detail"])
            result["agent_runs"] = [dict(r) for r in db.execute(
                "SELECT id,role,provider,model,status,created_at,updated_at,result,usage,error FROM agent_runs WHERE task_id=? ORDER BY created_at", (task_id,))]
            for run in result["agent_runs"]:
                for key in ("result", "usage"):
                    run[key] = json.loads(run[key])
            return result

    def tasks(self):
        with self.connect() as db:
            return [dict(r) for r in db.execute("SELECT id,objective,created_at,status,cursor,revision,CASE WHEN items='[]' THEN 0 ELSE 1 END AS has_materials FROM tasks ORDER BY created_at DESC")]

    def ingest(self, task_id, payload):
        if not isinstance(payload, dict) or payload.get("schema_version") != 1:
            raise ValueError("Нужен пакет schema_version: 1")
        raw_items = payload.get("items")
        if not isinstance(raw_items, list) or not 1 <= len(raw_items) <= 100:
            raise ValueError("В пакете должно быть от 1 до 100 материалов")
        checked = [validate_item(i) for i in raw_items]
        unique = {i["dedupe_key"]: i for i in checked}
        with self.transaction() as db:
            row = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
            if row is None:
                raise KeyError("Задача не найдена")
            if row["status"] in TERMINAL:
                raise ValueError("Для новой проверки создайте новую задачу")
            previous = json.loads(row["items"])
            merged = {i["dedupe_key"]: i for i in previous}
            merged.update(unique)
            if len(merged) > 100:
                raise ValueError("В одной задаче допускается не больше 100 материалов")
            items = list(merged.values())
            for item in items:
                item["seen_before"] = db.execute("SELECT 1 FROM history WHERE url=?", (item["dedupe_key"],)).fetchone() is not None
            db.execute("UPDATE tasks SET items=?,analysis='[]',report='',cursor=1,status='ready',revision=revision+1,updated_at=? WHERE id=?",
                       (dump(items), now(), task_id))
            db.execute("UPDATE agent_runs SET status='stale',updated_at=? WHERE task_id=? AND status='completed'", (now(), task_id))
            self.event(db, task_id, "research_host", "materials_imported",
                       {"count": len(items), "duplicates_removed": len(checked)-len(unique),
                        "imported_snapshot": checked,
                        "sha256": hashlib.sha256(dump(payload).encode()).hexdigest(),
                        "origin": "supplied_evidence_not_a_live_local_search"})
        return self.task(task_id)

    def advance(self, task_id):
        with self.transaction() as db:
            row = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
            if row is None:
                raise KeyError("Задача не найдена")
            if row["status"] in TERMINAL:
                return self.task(task_id)
            if row["steps_used"] >= row["max_steps"]:
                db.execute("UPDATE tasks SET status='budget_exhausted' WHERE id=?", (task_id,))
                self.event(db, task_id, "controller", "limit_reached", {"max_steps": row["max_steps"]})
            elif row["cursor"] == 0:
                db.execute("UPDATE tasks SET cursor=1,status='awaiting_evidence',steps_used=steps_used+1,updated_at=? WHERE id=?", (now(), task_id))
                self.event(db, task_id, "planner", "plan_ready", {"steps": STEPS, "research": "ChatGPT or another explicitly configured provider"})
            elif not json.loads(row["items"]):
                if row["status"] != "awaiting_evidence":
                    db.execute("UPDATE tasks SET status='awaiting_evidence' WHERE id=?", (task_id,))
                    self.event(db, task_id, "controller", "awaiting_evidence", {})
            elif row["cursor"] == 1:
                assessed = [assess(i) for i in json.loads(row["items"])]
                db.execute("UPDATE tasks SET analysis=?,cursor=2,status='ready',steps_used=steps_used+1,updated_at=? WHERE id=?", (dump(assessed), now(), task_id))
                self.event(db, task_id, "rule_checker", "structure_checked", {"count":len(assessed), "semantic_verification": "not_performed_by_local_core"})
            elif row["cursor"] == 2:
                items = rank_items(json.loads(row["analysis"]))
                db.execute("UPDATE tasks SET analysis=?,cursor=3,steps_used=steps_used+1,updated_at=? WHERE id=?", (dump(items),now(),task_id))
                self.event(db, task_id, "ranker", "ranked", {"weights":{"fit":.5,"scope":.3,"portfolio":.2},"meaning":"subjective_fit_not_probability_of_earning"})
            elif row["cursor"] == 3:
                # A saved checkpoint may be resumed days later. Revalidate before delivery.
                items = rank_items([assess(i) for i in json.loads(row["analysis"])])
                report = render_report(row["objective"], items, row["created_at"])
                db.execute("UPDATE tasks SET report=?,analysis=?,cursor=4,status='completed',steps_used=steps_used+1,updated_at=? WHERE id=?", (report,dump(items),now(),task_id))
                for i in items:
                    db.execute("INSERT INTO history VALUES(?,?,?) ON CONFLICT(url) DO UPDATE SET last_seen=excluded.last_seen", (i["dedupe_key"],now(),now()))
                self.event(db, task_id, "reporter", "report_created", {"materials":len(items),"paid_api_calls":0,"report_status":"supplied_source_review_with_local_structural_checks"})
        return self.task(task_id)

    def run(self, task_id):
        task = self.task(task_id)
        for _ in range(101):
            if task["status"] in TERMINAL or task["status"] == "awaiting_evidence":
                break
            task = self.advance(task_id)
        return task

    def cancel(self, task_id):
        with self.transaction() as db:
            row = db.execute("SELECT status FROM tasks WHERE id=?", (task_id,)).fetchone()
            if row is None:
                raise KeyError("Задача не найдена")
            if row[0] not in TERMINAL:
                db.execute("UPDATE tasks SET status='cancelled',updated_at=? WHERE id=?", (now(),task_id))
                self.event(db,task_id,"controller","cancelled",{})
        return self.task(task_id)

    def export(self):
        with self.connect() as db:
            inputs = [{"id":r["id"],"input":json.loads(r["input"])} for r in db.execute("SELECT id,input FROM agent_runs")]
        return {"schema_version":1,"exported_at":now(),"profile":self.profile(),"agent_inputs":inputs,
                "tasks":[self.task(t["id"]) for t in self.tasks()],
                "notice":"Экспорт контекста; не содержит подключения к ChatGPT или API-ключей"}


def rank_items(items):
    for item in items:
        item["score"] = round((item["ratings"]["fit"]*.5+item["ratings"]["scope"]*.3+item["ratings"]["portfolio"]*.2)*20)
    priority = {"candidate":0,"needs_review":1,"excluded":2}
    items.sort(key=lambda i:(priority[i["decision"]], -i["score"], i["url"]))
    return items


def render_report(objective, items, created):
    names={"candidate":"Кандидат для рассмотрения","needs_review":"Нужно уточнить","excluded":"Исключён"}
    lines=["# Проверяемая подборка возможностей", "", f"Задача: {objective}", f"Создано: {created}", "",
           "Основание отчёта — импортированные материалы с указанными автором и датой проверки. Локальное ядро проверяет поля, даты и правила; страницы повторно не открывает.",
           "Оценка соответствия — суждение, а не вероятность заработка. Подтверждение доступности отклика и надёжности заказчика не подразумевается.", ""]
    for index,item in enumerate(items,1):
        lines += [f"## {index}. {item['title']}","",f"Источник: {item['url']}",f"Проверено: {item['checked_at'] or 'дата не указана'}; автор: {item['reviewer'] or 'не указан'}",
                  f"Статус: {names[item['decision']]}; соответствие: {item['score']}/100",
                  f"Условия оплаты: {item['budget_display']}",f"Приём заявок: {item['deadline_display'] or 'срок не подтверждён'}",
                  f"Ранее встречалось: {'да' if item.get('seen_before') else 'нет'}", "",item['summary'], "",
                  f"Почему подходит (оценка): {item['fit_reason']}",f"Следующее действие: {item['next_action']}",
                  f"Неопределённости: {item['caution']} {item['eligibility_note']}", ""]
        lines += [f"- {issue}" for issue in item['issues']]
        lines.append("")
    lines += ["Новых платных API-вызовов локальное ядро не делает. Стоимость текущей сессии ChatGPT в этом отчёте не измерена.",
              "Отклики и сообщения заказчикам не отправлялись. Проверку актуальности следует повторить перед откликом.", ""]
    return "\n".join(lines)
