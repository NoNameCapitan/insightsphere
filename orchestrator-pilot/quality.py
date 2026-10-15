"""Versioned role instructions and a measured, operator-reviewed promotion gate.

Only role guidance can change. Core validation, tools, permissions and budgets
are outside this registry. Trial data can never authorize promotion.
"""
from __future__ import annotations

import ast
import hashlib
import json
import math
import statistics
import uuid

from core import ROOT, assess, dump, now, text_value, canonical_url
from workloop import task_memory, known_training_items, feedback_training_items

BASE_CONFIG = "base-v1"
REPEATS = 2
RUBRIC = [
    {"id": "grounded", "text": "Нет существенных утверждений без основания в материалах", "critical": True},
    {"id": "requirements", "text": "Выполнены все требования конкретной задачи", "critical": False},
    {"id": "useful", "text": "Результат пригоден для следующего действия пользователя", "critical": False},
]
FAILURE_RUBRIC = [
    {"id": "detected", "text": "Обнаружена ожидаемая ошибка, описанная в задаче", "critical": True},
    {"id": "honest", "text": "Нет ложного заявления об успешном выполнении", "critical": True},
    {"id": "preserved", "text": "Исходные данные сохранены; известен следующий шаг", "critical": True},
]


def digest(value):
    return hashlib.sha256(dump(value).encode()).hexdigest()


def engine_hash():
    # UI and customer bookkeeping do not affect this analyst experiment.
    files = ["core.py", "agents.py", "providers.py", "quality.py", "platform_support.py", "workloop.py"]
    class Semantic(ast.NodeTransformer):
        def visit_Expr(self, node):
            if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                return None  # Docstrings have no runtime effect on this workflow.
            return self.generic_visit(node)
        def visit_Assign(self, node):
            if any(isinstance(t, ast.Name) and t.id == "VERSION" for t in node.targets):
                return None
            return self.generic_visit(node)
    return digest({name: ast.dump(Semantic().visit(ast.parse((ROOT/name).read_text())), include_attributes=False)
                   for name in files})


def projection(snapshot):
    return {**{key: snapshot[key] for key in ("objective", "profile", "items")},
            "project_memory": snapshot.get("project_memory", [])}


def sample_key(items):
    # Administrative metadata, ratings and unknown import fields are not new evidence.
    evidence = []
    for item in items:
        fields = {key: " ".join(str(item.get(key, "")).split()).casefold()
                  for key in ("title", "summary", "status_evidence")}
        fields["url"] = canonical_url(item["url"])
        fields["budget"] = {key: " ".join(str(item.get("budget", {}).get(key, "")).split()).casefold()
                            for key in ("text", "basis", "evidence")}
        evidence.append(fields)
    return digest(sorted(evidence, key=dump))


def finite(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


class Quality:
    def __init__(self, store):
        self.store = store
        with store.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS role_configs (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, instructions TEXT NOT NULL,
                    based_on TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS experiments (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, baseline TEXT NOT NULL,
                    candidate TEXT NOT NULL, mode TEXT NOT NULL, provider TEXT NOT NULL,
                    model TEXT NOT NULL, created_at TEXT NOT NULL, engine_hash TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open');
                CREATE TABLE IF NOT EXISTS experiment_cases (
                    id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL, source_task_id TEXT NOT NULL,
                    task_id TEXT NOT NULL, kind TEXT NOT NULL, snapshot TEXT NOT NULL,
                    snapshot_hash TEXT NOT NULL, rubric TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS experiment_grades (
                    experiment_id TEXT NOT NULL, case_id TEXT NOT NULL, side TEXT NOT NULL,
                    repetition INTEGER NOT NULL, run_id TEXT NOT NULL UNIQUE,
                    assessor TEXT NOT NULL, evidence TEXT NOT NULL, checks TEXT NOT NULL,
                    run_hash TEXT NOT NULL, created_at TEXT NOT NULL,
                    PRIMARY KEY(case_id,side,repetition));
                CREATE TABLE IF NOT EXISTS quality_events (
                    id INTEGER PRIMARY KEY, at TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL);
            """)
            db.execute("INSERT OR IGNORE INTO role_configs VALUES(?,?,?,?,?)",
                       (BASE_CONFIG, "Исходная версия", "", "", now()))
            db.execute("INSERT OR IGNORE INTO settings VALUES('active_role_config', ?)",
                       (dump({"path": [BASE_CONFIG], "generation": 0}),))

    def pointer(self, db):
        return json.loads(db.execute("SELECT value FROM settings WHERE key='active_role_config'").fetchone()[0])

    def config(self, config_id=None, db=None):
        if db is None:
            with self.store.connect() as conn:
                return self.config(config_id, conn)
        config_id = config_id or self.pointer(db)["path"][-1]
        row = db.execute("SELECT * FROM role_configs WHERE id=?", (config_id,)).fetchone()
        if row is None:
            raise KeyError("Версия инструкций не найдена")
        return dict(row)

    def event(self, db, action, detail):
        db.execute("INSERT INTO quality_events(at,action,detail) VALUES(?,?,?)", (now(), action, dump(detail)))

    def create_config(self, title, instructions, db=None):
        title = text_value(title, "название версии", 120, True)
        instructions = text_value(instructions, "инструкции версии", 2000, True)
        if db is None:
            with self.store.transaction() as conn:
                return self.create_config(title, instructions, db=conn)
        parent = self.pointer(db)["path"][-1]
        cid = "cfg-" + uuid.uuid4().hex
        db.execute("INSERT INTO role_configs VALUES(?,?,?,?,?)", (cid, title, instructions, parent, now()))
        self.event(db, "config_created", {"config_id": cid, "based_on": parent})
        return self.config(cid, db)

    def create_experiment(self, title, candidate, cases, provider="ollama", model="", mode="trial"):
        title = text_value(title, "название сравнения", 160, True)
        if mode not in {"trial", "acceptance"} or provider not in {"ollama", "claude_code", "chatgpt"}:
            raise ValueError("Неверный режим сравнения")
        model = text_value(model, "модель", 200, provider == "ollama")
        if not isinstance(cases, list) or not 1 <= len(cases) <= 30:
            raise ValueError("Выберите от 1 до 30 разных задач")
        selected, seen = [], set()
        with self.store.connect() as db:
            exposed = {sample_key([item]) for items in known_training_items(db, candidate) for item in items}
        for spec in cases:
            if not isinstance(spec, dict) or spec.get("kind") not in {"ordinary", "failure"}:
                raise ValueError("Для каждого случая нужен тип: обычная задача или ошибка")
            source = self.store.task(spec.get("task_id"))
            if source["id"] in seen or not source["items"]:
                raise ValueError("Нужны разные задачи с материалами")
            seen.add(source["id"])
            snapshot = {"objective": source["objective"], "profile": source["profile"],
                        "items": [assess(item) for item in source["items"]],
                        "project_memory": task_memory(self.store, source["id"])}
            # Merely renaming an identical case cannot increase the sample size.
            semantic_key = sample_key(snapshot["items"])
            if mode == "acceptance":
                with self.store.connect() as db:
                    memory_exposed = {sample_key([item]) for items in feedback_training_items(db,
                        [m['feedback_id'] for m in snapshot['project_memory']]) for item in items}
                if any(sample_key([item]) in exposed | memory_exposed for item in snapshot["items"]):
                    raise ValueError("Материалы использованы для изменения инструкции или памяти; для приёмки нужен новый контрольный набор")
            if any(item[3] == semantic_key for item in selected):
                raise ValueError("Повтор одного набора материалов не считается новой контрольной задачей")
            selected.append((spec, source, snapshot, semantic_key))
        eid = "exp-"+uuid.uuid4().hex
        with self.store.transaction() as db:
            base = self.pointer(db)["path"][-1]
            cfg = self.config(candidate, db)
            if cfg["id"] == base or cfg["based_on"] != base:
                raise ValueError("Кандидат должен быть создан от текущей активной версии")
            db.execute("INSERT INTO experiments(id,title,baseline,candidate,mode,provider,model,created_at,engine_hash) VALUES(?,?,?,?,?,?,?,?,?)",
                       (eid, title, base, candidate, mode, provider, model if provider == "ollama" else "", now(), engine_hash()))
            for spec, source, snapshot, _ in selected:
                case_id, task_id, at = uuid.uuid4().hex, uuid.uuid4().hex, now()
                # Isolated copies preserve project context and do not reset a source task's call budget.
                db.execute("INSERT INTO tasks(id,objective,created_at,updated_at,status,cursor,steps_used,max_steps,profile,items,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                           (task_id, source["objective"], at, at, "ready", 1, 1, 8, dump(source["profile"]), dump(source["items"]), 1))
                rubric = RUBRIC if spec["kind"] == "ordinary" else FAILURE_RUBRIC
                db.execute("INSERT INTO experiment_cases VALUES(?,?,?,?,?,?,?,?)", (case_id, eid, source["id"], task_id, spec["kind"], dump(snapshot), digest(snapshot), dump(rubric)))
                self.store.event(db, task_id, "controller", "evaluation_copy", {"experiment_id": eid, "source_task_id": source["id"]})
            self.event(db, "experiment_registered", {"experiment_id": eid, "case_count": len(cases), "mode": mode})
        return self.experiment(eid)

    def experiment(self, experiment_id, db=None):
        if db is None:
            with self.store.connect() as conn:
                return self.experiment(experiment_id, conn)
        row = db.execute("SELECT * FROM experiments WHERE id=?", (experiment_id,)).fetchone()
        if row is None:
            raise KeyError("Сравнение не найдено")
        result = dict(row)
        result["cases"] = [dict(r) for r in db.execute("SELECT * FROM experiment_cases WHERE experiment_id=? ORDER BY rowid", (experiment_id,))]
        for case in result["cases"]:
            for key in ("snapshot", "rubric"):
                case[key] = json.loads(case[key])
            case["runs"] = []
            for row in db.execute("SELECT id,status,role,input FROM agent_runs WHERE task_id=? ORDER BY created_at", (case["task_id"],)):
                meta = dict(row); snapshot = json.loads(meta.pop("input"))
                meta["config_id"] = snapshot.get("config", {}).get("id")
                case["runs"].append(meta)
        result["grades"] = [dict(r) for r in db.execute("SELECT * FROM experiment_grades WHERE experiment_id=? ORDER BY created_at", (experiment_id,))]
        for grade in result["grades"]:
            grade["checks"] = json.loads(grade["checks"])
        return result

    def run_request(self, experiment_id, case_id, side):
        exp = self.experiment(experiment_id)
        if exp["status"] != "open" or side not in {"baseline", "candidate"}:
            raise ValueError("Сравнение закрыто или сторона не указана")
        case = next((c for c in exp["cases"] if c["id"] == case_id), None)
        if case is None:
            raise KeyError("Контрольная задача не найдена")
        if exp["engine_hash"] != engine_hash():
            raise ValueError("Код изменился; для сопоставимых запусков создайте новое сравнение")
        runs = [r for r in case["runs"] if r["role"] == "analyst" and r["config_id"] == exp[side]]
        if len(runs) >= REPEATS and not any(r["status"] in {"running", "waiting_manual"} for r in runs):
            raise ValueError("Два запуска этой версии уже выполнены; оцените сохранённые ответы")
        return {"task_id": case["task_id"], "provider": exp["provider"], "model": exp["model"],
                "role": "analyst", "config_id": exp[side]}

    def checked_run(self, db, exp, case, side, run_id):
        row = db.execute("SELECT * FROM agent_runs WHERE id=?", (run_id,)).fetchone()
        if row is None:
            raise KeyError("Запуск не найден")
        run = dict(row)
        for k in ("input", "result", "usage"):
            run[k] = json.loads(run[k])
        if (run["task_id"] != case["task_id"] or run["role"] != "analyst"
                or run["input"].get("followup_role") or run["input"].get("parent_run_id")
                or run["input"].get("config", {}).get("id") != exp[side]
                or run["provider"] != exp["provider"] or run["model"] != exp["model"]
                or run["created_at"] < exp["created_at"]
                or run["input"].get("engine_hash") != exp["engine_hash"]
                or digest(projection(run["input"])) != case["snapshot_hash"]):
            raise ValueError("Запуск не совпадает с заранее зафиксированными условиями сравнения")
        if run["status"] not in {"completed", "failed", "cancelled", "interrupted"}:
            raise ValueError("Запуск не завершён или его материалы изменились")
        task = db.execute("SELECT revision,status FROM tasks WHERE id=?", (run["task_id"],)).fetchone()
        if task["revision"] != run["input"]["task_revision"]:
            raise ValueError("Материалы контрольной задачи изменились")
        return run

    def grade(self, experiment_id, case_id, side, repetition, run_id, checks, assessor, evidence):
        if side not in {"baseline", "candidate"} or type(repetition) is not int or repetition not in {1, 2}:
            raise ValueError("Укажите сторону и повтор 1 или 2")
        assessor = text_value(assessor, "кто проверил результат", 120, True)
        evidence = text_value(evidence, "основание оценки", 3000, True)
        if len(evidence) < 10:
            raise ValueError("Опишите конкретное основание оценки")
        with self.store.transaction() as db:
            exp = self.experiment(experiment_id, db)
            if exp["status"] != "open":
                raise ValueError("Сравнение уже закрыто")
            case = next((c for c in exp["cases"] if c["id"] == case_id), None)
            if case is None:
                raise KeyError("Контрольная задача не найдена")
            keys = {r["id"] for r in case["rubric"]}
            if not isinstance(checks, dict) or set(checks) != keys or any(type(v) is not bool for v in checks.values()):
                raise ValueError("Оцените каждый заранее заданный критерий")
            run = self.checked_run(db, exp, case, side, run_id)
            if case["kind"] == "ordinary" and run["status"] != "completed" and all(checks.values()):
                raise ValueError("Неудачный запуск нельзя засчитать как выполненную обычную задачу")
            if db.execute("SELECT 1 FROM experiment_grades WHERE run_id=? OR (case_id=? AND side=? AND repetition=?)", (run_id, case_id, side, repetition)).fetchone():
                raise ValueError("Эта оценка уже зафиксирована; её нельзя переписать")
            db.execute("INSERT INTO experiment_grades VALUES(?,?,?,?,?,?,?,?,?,?)", (experiment_id, case_id, side, repetition, run_id, assessor, evidence, dump(checks), digest(run), now()))
            self.event(db, "operator_grade_recorded", {"experiment_id": experiment_id, "case_id": case_id, "run_id": run_id, "side": side})
        return self.evaluate(experiment_id)

    def evaluate(self, experiment_id, db=None):
        if db is None:
            with self.store.connect() as conn:
                return self.evaluate(experiment_id, conn)
        exp = self.experiment(experiment_id, db)
        reasons, defects = [], []
        cases = exp["cases"]
        ordinary = [c for c in cases if c["kind"] == "ordinary"]
        failures = [c for c in cases if c["kind"] == "failure"]
        if exp["mode"] != "acceptance":
            reasons.append("Пробное сравнение не разрешает применение версии")
        if len(ordinary) < 10 or len(failures) < 5:
            reasons.append("Нужны минимум 10 обычных задач и 5 отдельных случаев с ошибками")
        if exp["engine_hash"] != engine_hash():
            reasons.append("После регистрации сравнения изменился код")
        grades = {(g["case_id"], g["side"], g["repetition"]): g for g in exp["grades"]}
        metrics = {side: {"passed_ordinary": 0, "passed_failures": 0, "elapsed": [], "cost": [], "model_ids": set()} for side in ("baseline", "candidate")}
        passed = {}
        for case in cases:
            for side in metrics:
                ok = True
                for repetition in range(1, REPEATS+1):
                    grade = grades.get((case["id"], side, repetition))
                    if grade is None:
                        ok = False
                        continue
                    try:
                        run = self.checked_run(db, exp, case, side, grade["run_id"])
                        if digest(run) != grade["run_hash"]:
                            raise ValueError("Состояние или расход запуска изменились после оценки")
                    except (ValueError, KeyError) as e:
                        reasons.append(str(e)); ok = False; continue
                    if not all(grade["checks"].values()):
                        ok = False
                    if case["kind"] == "ordinary" and run["status"] != "completed":
                        ok = False
                    if side == "candidate" and any(r["critical"] and not grade["checks"][r["id"]] for r in case["rubric"]):
                        defects.append(case["id"])
                    usage = run["usage"]
                    for key, target in (("elapsed_seconds", "elapsed"), ("api_cost_usd", "cost")):
                        value = usage.get(key)
                        if finite(value):
                            metrics[side][target].append(value)
                        else:
                            reasons.append("Не для всех запусков известны время и фактические дополнительные расходы")
                    identity = usage.get("model_identity")
                    if isinstance(identity, str) and identity:
                        metrics[side]["model_ids"].add(identity)
                    else:
                        reasons.append("Не для всех запусков зафиксирована идентичность модели")
                passed[(case["id"], side)] = ok
                if ok:
                    metrics[side]["passed_ordinary" if case["kind"] == "ordinary" else "passed_failures"] += 1
        expected = len(cases)*2*REPEATS
        if len(grades) != expected:
            reasons.append(f"Оценены {len(grades)} из {expected} запусков; нужны два повтора каждой версии")
        a, b = metrics["baseline"], metrics["candidate"]
        if defects:
            reasons.append("У кандидата обнаружены существенные ошибки")
        if ordinary and b["passed_ordinary"] / len(ordinary) < .8:
            reasons.append("Кандидат выполнил меньше 80% обычных задач")
        if b["passed_failures"] != len(failures):
            reasons.append("Кандидат не прошёл все случаи с ошибками")
        if any(passed.get((c["id"], "baseline")) and not passed.get((c["id"], "candidate")) for c in cases):
            reasons.append("Есть ухудшение относительно ранее успешного случая")
        for case in cases:
            for criterion in case["rubric"]:
                baseline = [grades.get((case["id"], "baseline", n)) for n in (1,2)]
                candidate = [grades.get((case["id"], "candidate", n)) for n in (1,2)]
                if (all(g and g["checks"][criterion["id"]] for g in baseline)
                        and any(g and not g["checks"][criterion["id"]] for g in candidate)):
                    reasons.append("Есть ухудшение ранее устойчиво выполненного отдельного критерия")
        if a["model_ids"] != b["model_ids"] or len(a["model_ids"]) != 1:
            reasons.append("Для корректного сравнения нужна одна и та же модель во всех запусках")
        ma = statistics.median(a["elapsed"]) if a["elapsed"] else None
        mb = statistics.median(b["elapsed"]) if b["elapsed"] else None
        if any(value > 0 for side in metrics.values() for value in side["cost"]):
            reasons.append("Превышен зафиксированный предел дополнительных API-расходов: $0")
        if ma is not None and mb is not None and mb > max(ma*2, .001):
            reasons.append("Медианное время выросло более чем вдвое")
        better_quality = b["passed_ordinary"] > a["passed_ordinary"]
        faster = (b["passed_ordinary"] == a["passed_ordinary"] and ma is not None and ma > 0 and mb is not None and mb <= ma*.8)
        if not better_quality and not faster:
            reasons.append("Не подтверждены рост качества или ускорение хотя бы на 20% при равном качестве")
        pointer = self.pointer(db)
        if pointer["path"][-1] != exp["baseline"]:
            reasons.append("Активная версия изменилась после регистрации сравнения")
        if exp["status"] != "open":
            reasons.append("Сравнение уже применено")
        return {"experiment_id": experiment_id, "eligible": not reasons,
                "reasons": list(dict.fromkeys(reasons)), "operator_reviewed": len(grades) == expected,
                "ordinary_cases": len(ordinary), "failure_cases": len(failures),
                "grades_done": len(grades), "grades_required": expected,
                "baseline_passed": a["passed_ordinary"], "candidate_passed": b["passed_ordinary"],
                "candidate_failures_passed": b["passed_failures"],
                "baseline_median_seconds": ma, "candidate_median_seconds": mb,
                "generation": pointer["generation"], "automatic_quality_judgment": False}

    def promote(self, experiment_id, expected_generation):
        with self.store.transaction() as db:
            pointer = self.pointer(db)
            if type(expected_generation) is not int or pointer["generation"] != expected_generation:
                raise ValueError("Активная версия изменилась; обновите страницу")
            verdict = self.evaluate(experiment_id, db)
            if not verdict["eligible"]:
                raise ValueError("Версия не применена: "+"; ".join(verdict["reasons"]))
            exp = self.experiment(experiment_id, db)
            pointer["path"].append(exp["candidate"]); pointer["generation"] += 1
            db.execute("UPDATE settings SET value=? WHERE key='active_role_config'", (dump(pointer),))
            db.execute("UPDATE experiments SET status='applied' WHERE id=?", (experiment_id,))
            self.event(db, "version_applied", {"experiment_id": experiment_id, "previous": exp["baseline"], "current": exp["candidate"], "generation": pointer["generation"]})
        return self.state()

    def rollback(self, expected_generation):
        with self.store.transaction() as db:
            pointer = self.pointer(db)
            if type(expected_generation) is not int or pointer["generation"] != expected_generation:
                raise ValueError("Активная версия изменилась; обновите страницу")
            if len(pointer["path"]) < 2:
                raise ValueError("Нет применённой версии для отката")
            previous = pointer["path"].pop(); pointer["generation"] += 1
            db.execute("UPDATE settings SET value=? WHERE key='active_role_config'", (dump(pointer),))
            self.event(db, "version_rolled_back", {"previous": previous, "current": pointer["path"][-1], "generation": pointer["generation"]})
        return self.state()

    def state(self):
        with self.store.connect() as db:
            pointer = self.pointer(db)
            configs = [dict(r) for r in db.execute("SELECT * FROM role_configs ORDER BY created_at")]
            experiments = [dict(r) for r in db.execute("SELECT * FROM experiments ORDER BY created_at DESC")]
            events = [dict(r) for r in db.execute("SELECT * FROM quality_events ORDER BY id")]
            for event in events:
                event["detail"] = json.loads(event["detail"])
            return {"active": self.config(pointer["path"][-1], db), "generation": pointer["generation"],
                    "can_rollback": len(pointer["path"]) > 1, "configs": configs, "experiments": experiments, "events": events,
                    "evaluation_task_ids": [r[0] for r in db.execute("SELECT task_id FROM experiment_cases")]}

    def export(self):
        state = self.state()
        state["experiments"] = [self.experiment(e["id"]) for e in state["experiments"]]
        return state

    def report(self, experiment_id):
        exp, verdict = self.experiment(experiment_id), self.evaluate(experiment_id)
        lines = ["# Сравнение версий инструкций", "", exp["title"], "",
                 "Режим: " + ("пробный, применение запрещено" if exp["mode"] == "trial" else "приёмочные испытания"),
                 f"Базовая версия: {exp['baseline']}", f"Кандидат: {exp['candidate']}",
                 f"Оценено запусков: {verdict['grades_done']}/{verdict['grades_required']}",
                 f"Обычные задачи: базовая {verdict['baseline_passed']}, кандидат {verdict['candidate_passed']} из {verdict['ordinary_cases']}",
                 f"Случаи с ошибками, кандидат: {verdict['candidate_failures_passed']}/{verdict['failure_cases']}", "",
                 "Оценки внёс оператор. Программа проверяет сопоставимость и условия применения; истинность внешних источников сама не устанавливает.", "",
                 "Применение: " + ("разрешено по зафиксированным условиям пилота" if verdict["eligible"] else "не разрешено"), ""]
        lines.extend("- "+reason for reason in verdict["reasons"])
        for case in exp["cases"]:
            lines += ["", "## "+case["snapshot"]["objective"], "Тип: "+case["kind"], ""]
            for grade in exp["grades"]:
                if grade["case_id"] == case["id"]:
                    lines += [f"- {grade['side']}, повтор {grade['repetition']}, запуск {grade['run_id']}: "
                              + ("все критерии выполнены" if all(grade["checks"].values()) else "есть невыполненные критерии"),
                              f"  Автор: {grade['assessor']}. Основание: {grade['evidence']}"]
        return "\n".join(lines)+"\n"
