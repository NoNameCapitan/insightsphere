import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import {
  type Actor,
  type DocumentPayload,
  canonicalJson,
  copyFields,
  today,
} from "../src/lib/domain";
import { hashPassword, verifyPassword } from "../src/lib/passwords";
import { csvCell, toCsv, exportRows } from "../src/server/export-data";
import { day, registration } from "../src/server/validation";

// Справжні міграції і транзакції у тимчасовій БД; персональні дані вигадані.
// Цей тест не відкриває та не змінює робочу базу установи.
test("повний локальний процес і захист медичних записів", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "vlk-test-")),
    file = join(folder, "test.sqlite");
  process.env.DATABASE_URL = "file:" + file;
  const sql = new Database(file);
  sql.pragma("foreign_keys=ON");
  for (const dir of readdirSync("prisma/migrations")
    .filter((s) => /^\d/.test(s))
    .sort())
    sql.exec(
      readFileSync(join("prisma/migrations", dir, "migration.sql"), "utf8"),
    );
  sql.close();
  const { db, ready } = await import("../src/db");
  await ready();
  const {
    register,
    saveExam,
    saveDecision,
    recordTransfer,
    readSession,
    sessionInclude,
  } = await import("../src/server/records");
  const password = randomUUID() + randomUUID(),
    password_hash = await hashPassword(password);
  const actor = async (
    username: string,
    role: Actor["role"],
    specialty: Actor["specialty"],
  ): Promise<Actor> => {
    const u = await db.user.create({
      data: {
        username,
        full_name: "ТЕСТ " + username,
        role,
        specialty,
        password_hash,
      },
    });
    return { ...u, roles: [role] };
  };
  const reg = await actor("registry", "REGISTRAR", null),
    dentist = await actor("dentist", "DOCTOR", "DENTIST"),
    therapist = await actor("therapist", "DOCTOR", "THERAPIST"),
    other = await actor("surgeon", "DOCTOR", "SURGEON"),
    secretary = await actor("secretary", "SECRETARY", null),
    chair = await actor("chair", "CHAIRPERSON", null);
  const input = {
    creation_key: randomUUID(),
    rnokpp: "0000000001",
    rnokpp_absence_reason: "",
    last_name: "ТЕСТОВИЙ",
    first_name: "Пацієнт",
    middle_name: "Навчальний",
    birth_date: "1990-02-28",
    rank: "Рядовий",
    military_unit_or_tck: "ТЕСТОВА установа",
    referral_number: "QA-001",
    referral_date: today(),
    referral_issuer: "Навчальний ТЦК",
    session_date: today(),
    commission_name: "Тестова ВЛК",
    order_402_revision: "Тестова редакція",
    required_specialties: ["DENTIST", "THERAPIST"],
  };
  let id = "",
    examId = "",
    documentId = "",
    payload: DocumentPayload;
  try {
    await t.test("паролі, календарні дати, РНОКПП", async () => {
      assert.equal(await verifyPassword(password, password_hash), true);
      assert.equal(await verifyPassword("wrong", password_hash), false);
      assert.equal(day.safeParse("2026-02-30").success, false);
      assert.equal(day.safeParse("2024-02-29").success, true);
      assert.equal(
        registration.safeParse({ ...input, rnokpp: "" }).success,
        false,
      );
    });
    await t.test(
      "реєстрація і повтор запиту не дублюють пацієнта",
      async () => {
        id = (await register(reg, input)).id;
        assert.equal((await register(reg, input)).id, id);
        assert.equal(await db.patient.count(), 1);
        assert.equal(await db.vlkSession.count(), 1);
        await assert.rejects(
          register(reg, { ...input, last_name: "Інший" }),
          /інші дані/,
        );
        await assert.rejects(register(dentist, input), /Недостатньо прав/);
      },
    );
    const data = (version: number) => ({
      session_id: id,
      session_version: version,
      complaints: "ТЕСТ: скарги",
      anamnesis: "ТЕСТ: анамнез",
      objective_data: 'ТЕСТ: рядок 1\nРядок "2"',
      icd10_code: "K02.1",
      icd10_version: "USER-ENTERED",
      diagnosis_text: "Тестовий запис",
      no_icd_reason: "",
      order_402_article: "39-б",
      doctor_conclusion: "ТЕСТОВИЙ висновок",
      recommendations: "ТЕСТ: рекомендації",
      amendment_reason: "",
      fitness_category: "OTHER",
      additional_diagnoses: [
        {
          icd10_code: "K05.1",
          icd10_version: "USER-ENTERED",
          diagnosis_text: "Супутній тестовий діагноз",
          order_402_article: "42-а",
        },
      ],
      complete: false,
    });
    await t.test("доступ лікарів, чернетка, конфлікт версій", async () => {
      await assert.rejects(readSession(other, id), /не направлений/);
      await assert.rejects(saveExam(reg, data(1)), /Недостатньо прав/);
      const e = await saveExam(dentist, data(1));
      examId = e.id;
      await assert.rejects(saveExam(therapist, data(1)), /вже змінив/);
      assert.equal(
        (await db.medicalExamination.findUniqueOrThrow({ where: { id: e.id } }))
          .status,
        "DRAFT",
      );
      assert.equal(await db.additionalDiagnosis.count(), 1);
    });
    await t.test(
      "підтвердження огляду і незмінність додаткових діагнозів",
      async () => {
        await saveExam(dentist, {
          ...data(2),
          exam_id: examId,
          version: 1,
          complete: true,
        });
        const child = await db.additionalDiagnosis.findFirstOrThrow();
        await assert.rejects(
          db.additionalDiagnosis.update({
            where: { id: child.id },
            data: { diagnosis_text: "overwrite" },
          }),
        );
        await assert.rejects(
          db.medicalExamination.update({
            where: { id: examId },
            data: { objective_data: "overwrite" },
          }),
        );
      },
    );
    const decision = (version: number) => ({
      session_id: id,
      version,
      final_diagnosis: "Навчальний підсумок",
      final_decision: "Тестова постанова, не медична рекомендація",
      order_402_article: "39-б; 42-а",
      protocol_number: "QA-01",
      decision_date: today(),
      fitness_category: "OTHER",
      finalize: true,
    });
    await t.test(
      "незавершені огляди та роль секретаря блокують закриття",
      async () => {
        await assert.rejects(saveDecision(chair, decision(3)), /Не всі/);
        await assert.rejects(
          saveDecision(secretary, decision(3)),
          /Недостатньо прав/,
        );
      },
    );
    await t.test("нова версія огляду зберігає попередню", async () => {
      await saveExam(dentist, {
        ...data(3),
        amendment_reason: "Тест виправлення",
        complete: true,
      });
      assert.equal(
        await db.medicalExamination.count({ where: { specialty: "DENTIST" } }),
        2,
      );
      await saveExam(therapist, {
        ...data(4),
        icd10_code: "Z00.0",
        additional_diagnoses: [],
        complete: true,
      });
      assert.equal(
        (await db.vlkSession.findUniqueOrThrow({ where: { id } })).status,
        "READY_FOR_REVIEW",
      );
    });
    await t.test(
      "постанова, контрольний знімок, блокування редагування",
      async () => {
        await saveDecision(secretary, { ...decision(5), finalize: false });
        documentId = (await saveDecision(chair, decision(6))).documentId;
        const doc = await db.vlkDocument.findUniqueOrThrow({
          where: { id: documentId },
        });
        payload = doc.payload as DocumentPayload;
        assert.equal(payload.examinations.length, 2);
        assert.equal(
          payload.examinations.find((e) => e.specialty === "DENTIST")?.revision,
          2,
        );
        await assert.rejects(saveExam(dentist, data(7)), /закрито/);
        await assert.rejects(
          db.vlkSession.update({
            where: { id },
            data: { final_decision: "overwrite" },
          }),
        );
        await assert.rejects(
          db.vlkDocument.update({
            where: { id: documentId },
            data: { document_number: "overwrite" },
          }),
        );
      },
    );
    await t.test(
      "часткове перенесення, звірка всіх полів, ідемпотентність",
      async () => {
        const fields = copyFields(payload);
        assert.equal(
          fields.find((f) => f.key === "patient.rnokpp")?.value,
          "0000000001",
        );
        assert(fields.some((f) => f.value === "K05.1"));
        const common = {
          document_id: documentId,
          notes: "Тест перенесення",
          request_key: randomUUID(),
        };
        await recordTransfer(secretary, {
          ...common,
          keys: [fields[0].key],
          confirmed: false,
        });
        await assert.rejects(
          recordTransfer(secretary, {
            ...common,
            request_key: randomUUID(),
            keys: [fields[0].key],
            confirmed: true,
          }),
          /Позначте всі поля/,
        );
        const final = {
          ...common,
          request_key: randomUUID(),
          keys: fields.map((f) => f.key),
          confirmed: true,
        };
        const r = await recordTransfer(secretary, final);
        assert.equal((await recordTransfer(secretary, final)).id, r.id);
        assert.equal(await db.syncLog.count(), 2);
        await assert.rejects(
          recordTransfer(dentist, final),
          /Недостатньо прав/,
        );
        const log = await db.syncLog.findFirstOrThrow();
        await assert.rejects(db.syncLog.delete({ where: { id: log.id } }));
      },
    );
    await t.test(
      "експорт зберігає додаткові діагнози та блокує CSV-формули",
      () => {
        const rows = exportRows([{ status: "FINALIZED", payload }]);
        assert.equal(rows.length, 3);
        assert.equal(rows[0]["РНОКПП"], "0000000001");
        assert(toCsv(rows).includes('""2""'));
        assert.equal(csvCell(" =HYPERLINK()"), '"\' =HYPERLINK()"');
        assert.equal(csvCell("@SUM(A1)"), '"\'@SUM(A1)"');
        assert.equal(
          canonicalJson({ b: 1, a: 2 }),
          canonicalJson({ a: 2, b: 1 }),
        );
      },
    );
    await t.test(
      "зашифрована WAL-копія та відновлення з відкликанням входів",
      async () => {
        await db.authSession.create({
          data: {
            user_id: reg.id,
            token_hash: randomUUID(),
            expires_at: new Date(Date.now() + 60000),
          },
        });
        const env = { ...process.env, BACKUP_PASSWORD: password };
        const run = (script: string, args: string[] = []) =>
          execFileSync(
            process.execPath,
            [
              "--import",
              resolve("node_modules/tsx/dist/loader.mjs"),
              resolve("scripts/" + script),
              ...args,
            ],
            { env, cwd: folder, encoding: "utf8" },
          );
        run("backup.ts");
        const backup = join(
          folder,
          "backups",
          readdirSync(join(folder, "backups"))[0],
        );
        assert(!readFileSync(backup).includes(Buffer.from("ТЕСТОВИЙ")));
        assert.throws(() =>
          execFileSync(
            process.execPath,
            [
              "--import",
              resolve("node_modules/tsx/dist/loader.mjs"),
              resolve("scripts/restore.ts"),
              backup,
            ],
            {
              cwd: folder,
              env: { ...env, BACKUP_PASSWORD: "wrong-password" },
              stdio: "pipe",
            },
          ),
        );
        run("restore.ts", [backup]);
        const restored = new Database(
          join(folder, "data", readdirSync(join(folder, "data"))[0]),
        );
        assert.equal(
          restored.pragma("integrity_check", { simple: true }),
          "ok",
        );
        assert.equal(
          (
            restored
              .prepare('SELECT count(*) AS n FROM "VlkSession"')
              .get() as { n: number }
          ).n,
          1,
        );
        assert.equal(
          (
            restored
              .prepare(
                'SELECT count(*) AS n FROM "AuthSession" WHERE revoked_at IS NULL',
              )
              .get() as { n: number }
          ).n,
          0,
        );
        restored.close();
      },
    );
    await t.test(
      "історія та аудит збережені, сторонні ключі цілі",
      async () => {
        assert.equal(
          await db.auditLog.count({
            where: { action: "COMPLETE_EXAMINATION" },
          }),
          3,
        );
        assert.equal(
          await db.auditLog.count({ where: { action: "FINALIZE_SESSION" } }),
          1,
        );
        assert.equal(
          await db.auditLog.count({ where: { action: "RECORD_TRANSFER" } }),
          2,
        );
        const audit = await db.auditLog.findFirstOrThrow();
        await assert.rejects(db.auditLog.delete({ where: { id: audit.id } }));
        await assert.rejects(db.vlkSession.delete({ where: { id } }));
        const row = await db.vlkSession.findUniqueOrThrow({
          where: { id },
          include: sessionInclude,
        });
        assert.equal(row.examinations.length, 3);
        assert.deepEqual(
          await db.$queryRawUnsafe("PRAGMA foreign_key_check"),
          [],
        );
      },
    );
  } finally {
    await db.$disconnect();
    rmSync(folder, { recursive: true, force: true });
  }
});
