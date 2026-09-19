import "server-only";
import { db } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "./errors";
import {
  type Actor,
  hasRole,
  registryRoles,
  coordinatorRoles,
  clinicalRoles,
  type PatientSnapshot,
  type DocumentPayload,
  type Specialty,
  canonicalJson,
  copyFields,
  personName,
} from "@/lib/domain";
import { registration, examInput, decisionInput } from "./validation";
import { createHash, randomUUID } from "node:crypto";
const digest = (v: unknown) =>
  createHash("sha256").update(canonicalJson(v)).digest("hex");
export const sessionInclude = {
  requirements: true,
  examinations: {
    include: { additional_diagnoses: true },
    orderBy: { revision: "desc" as const },
  },
  documents: { orderBy: { created_at: "desc" as const } },
  replaced_by: { select: { id: true, ticket_number: true } },
} satisfies Prisma.VlkSessionInclude;
export type SessionRecord = Prisma.VlkSessionGetPayload<{
  include: typeof sessionInclude;
}>;
function allowed(a: Actor, roles: Parameters<typeof hasRole>[1]) {
  if (!hasRole(a, roles)) throw new AppError("Недостатньо прав.");
}
function editable(s: { status: string }) {
  if (["FINALIZED", "CANCELLED"].includes(s.status))
    throw new AppError(
      "Сесію закрито. Для виправлення створіть нове проходження.",
    );
}
export function latestExams(s: SessionRecord) {
  const seen = new Set<string>();
  return s.examinations.filter((e) => {
    if (seen.has(e.specialty)) return false;
    seen.add(e.specialty);
    return true;
  });
}
export function completeRequirements(s: SessionRecord) {
  const current = latestExams(s);
  return s.requirements
    .filter((r) => r.is_required)
    .every((r) =>
      current.some(
        (e) => e.specialty === r.specialty && e.status === "COMPLETED",
      ),
    );
}
export function payloadFor(s: SessionRecord, finalizer = ""): DocumentPayload {
  return {
    schemaVersion: 1,
    sessionId: s.id,
    ticket: s.ticket_number,
    patient: s.patient_snapshot as PatientSnapshot,
    date: s.session_date,
    commission: s.commission_name,
    rank: s.rank,
    unit: s.military_unit_or_tck,
    referral: {
      number: s.referral_number,
      date: s.referral_date,
      issuer: s.referral_issuer,
    },
    decision: s.final_decision || "",
    diagnosis: s.final_diagnosis || "",
    article: s.order_402_article || "",
    orderRevision: s.order_402_revision,
    protocol: s.protocol_number || "",
    decisionDate: s.decision_date || s.session_date,
    finalizer,
    examinations: latestExams(s).map((e) => ({
      id: e.id,
      revision: e.revision,
      specialty: e.specialty,
      status: e.status,
      doctor: e.doctor_name_snapshot,
      complaints: e.complaints,
      anamnesis: e.anamnesis,
      objective_data: e.objective_data,
      icd10_code: e.icd10_code,
      icd10_version: e.icd10_version,
      no_icd_reason: e.no_icd_reason,
      fitness_category: e.fitness_category,
      examined_at: e.examined_at?.toISOString() || null,
      completed_at: e.completed_at?.toISOString() || null,
      diagnosis_text: e.diagnosis_text,
      order_402_article: e.order_402_article,
      doctor_conclusion: e.doctor_conclusion,
      recommendations: e.recommendations,
      additional_diagnoses: e.additional_diagnoses,
    })),
  };
}
export async function readSession(a: Actor, id: string) {
  allowed(a, [...registryRoles, "DOCTOR"]);
  const s = await db.vlkSession.findUnique({
    where: { id },
    include: sessionInclude,
  });
  if (!s) throw new AppError("Картку не знайдено.");
  if (
    !hasRole(a, registryRoles) &&
    (!a.specialty || !s.requirements.some((r) => r.specialty === a.specialty))
  )
    throw new AppError("Цей пацієнт не направлений до вашої спеціальності.");
  await db.auditLog.create({
    data: {
      actor_id: a.id,
      session_id: id,
      action: "READ_RECORD",
      entity_type: "VlkSession",
      entity_id: id,
    },
  });
  return s;
}
export async function queue(a: Actor, date: string, query = "") {
  if (!hasRole(a, [...registryRoles, "DOCTOR"])) return [];
  const rows = await db.vlkSession.findMany({
    where: {
      session_date: date,
      search_text: query
        ? { contains: query.normalize("NFKC").toLocaleLowerCase("uk") }
        : undefined,
      ...(!hasRole(a, registryRoles)
        ? { requirements: { some: { specialty: a.specialty || "DENTIST" } } }
        : {}),
      replaced_by: null,
    },
    include: {
      requirements: true,
      examinations: {
        select: { specialty: true, status: true, revision: true },
        orderBy: { revision: "desc" },
      },
      documents: {
        select: {
          sync_logs: {
            orderBy: { created_at: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: 300,
  });
  return rows.map((s) => {
    const seen = new Set<string>();
    const latest = s.examinations.filter((e) => {
      if (seen.has(e.specialty)) return false;
      seen.add(e.specialty);
      return true;
    });
    return {
      id: s.id,
      ticket: s.ticket_number,
      name: personName(s.patient_snapshot as PatientSnapshot),
      birth: (s.patient_snapshot as PatientSnapshot).birth_date,
      status: s.status,
      completed: latest.filter((e) => e.status === "COMPLETED").length,
      total: s.requirements.filter((r) => r.is_required).length,
      transfer: s.documents[0]?.sync_logs[0]?.status || null,
    };
  });
}
// Особа і проходження створюються атомарно; повтор UUID із тим самим змістом повертає той самий талон.
export async function register(a: Actor, input: unknown) {
  allowed(a, registryRoles);
  const d = registration.parse(input),
    fingerprint = digest(d);
  return db.$transaction(
    async (tx) => {
      const previous = await tx.vlkSession.findUnique({
        where: { creation_key: d.creation_key },
      });
      if (previous) {
        if (
          previous.created_by_id !== a.id ||
          previous.creation_hash !== fingerprint
        )
          throw new AppError("Повторний запит має інші дані. Оновіть форму.");
        return { id: previous.id };
      }
      const old = d.patient_id
        ? await tx.patient.findUnique({ where: { id: d.patient_id } })
        : d.rnokpp
          ? await tx.patient.findUnique({ where: { rnokpp: d.rnokpp } })
          : null;
      if (d.patient_id && !old)
        throw new AppError("Обраного пацієнта не знайдено.");
      if (
        old &&
        (old.birth_date !== d.birth_date ||
          old.rnokpp !== (d.rnokpp || null) ||
          (!d.patient_id &&
            (old.last_name !== d.last_name || old.first_name !== d.first_name)))
      )
        throw new AppError(
          "РНОКПП уже є з іншими даними. Знайдіть пацієнта та звірте його особу.",
        );
      const snapshot: PatientSnapshot = {
        schemaVersion: 1,
        rnokpp: d.rnokpp || null,
        rnokpp_absence_reason: d.rnokpp_absence_reason || null,
        last_name: d.last_name,
        first_name: d.first_name,
        middle_name: d.middle_name || null,
        birth_date: d.birth_date,
      };
      const { schemaVersion: _schemaVersion, ...patientFields } = snapshot;
      const p =
        old ||
        (await tx.patient.create({
          data: {
            ...patientFields,
            search_text: (personName(snapshot) + " " + d.rnokpp)
              .normalize("NFKC")
              .toLocaleLowerCase("uk"),
            rank: d.rank || null,
            military_unit_or_tck: d.military_unit_or_tck,
            referral_number: d.referral_number,
            referral_date: d.referral_date,
            referral_issuer: d.referral_issuer,
          } as Prisma.PatientCreateInput,
        }));
      const ticket =
        d.session_date.replaceAll("-", "") +
        "-" +
        randomUUID().slice(0, 8).toUpperCase();
      const s = await tx.vlkSession.create({
        data: {
          patient_id: p.id,
          patient_snapshot: snapshot,
          creation_key: d.creation_key,
          creation_hash: fingerprint,
          ticket_number: ticket,
          session_date: d.session_date,
          commission_name: d.commission_name,
          rank: d.rank || null,
          military_unit_or_tck: d.military_unit_or_tck,
          referral_number: d.referral_number,
          referral_date: d.referral_date,
          referral_issuer: d.referral_issuer,
          order_402_revision: d.order_402_revision,
          created_by_id: a.id,
          search_text: (personName(snapshot) + " " + d.rnokpp + " " + ticket)
            .normalize("NFKC")
            .toLocaleLowerCase("uk"),
          requirements: {
            create: [...new Set(d.required_specialties)].map((specialty) => ({
              specialty,
            })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actor_id: a.id,
          session_id: s.id,
          action: "CREATE_RECORD",
          entity_type: "VlkSession",
          entity_id: s.id,
        },
      });
      return { id: s.id };
    },
    { timeout: 15000 },
  );
}
// Якщо довідник ще не імпортовано, лікар може явно ввести код з документа.
// Такі позиції мають окрему версію USER-ENTERED і не видаються за перевірений класифікатор.
async function ensureCode(
  tx: Prisma.TransactionClient,
  code: string,
  version: string,
  title: string,
) {
  if (!code) return { icd10_code: null, icd10_version: null };
  if (version && version !== "USER-ENTERED") {
    const hit = await tx.icd10Entry.findUnique({
      where: { code_catalog_version: { code, catalog_version: version } },
    });
    if (!hit?.is_selectable)
      throw new AppError("Код відсутній в обраному довіднику.");
    return { icd10_code: code, icd10_version: version };
  }
  const record = await tx.icd10Entry.upsert({
    where: { code_catalog_version: { code, catalog_version: "USER-ENTERED" } },
    create: {
      code,
      catalog_version: "USER-ENTERED",
      title_uk: title || code,
      search_text: (code + " " + title).toLocaleLowerCase("uk"),
      source_uri: "local:manual-entry",
      source_sha256: digest({ code, title }),
      is_selectable: true,
    },
    update: {},
  });
  return { icd10_code: record.code, icd10_version: record.catalog_version };
}
// Версія сесії є оптимістичним блокуванням. Невдалий CAS відкочує всі зміни транзакції.
// Підтверджений огляд не змінюємо: створюємо наступну ревізію із причиною.
export async function saveExam(a: Actor, input: unknown) {
  allowed(a, ["DOCTOR"]);
  if (!a.specialty) throw new AppError("Спеціальність лікаря не налаштована.");
  const d = examInput.parse(input);
  return db.$transaction(
    async (tx) => {
      const s = await tx.vlkSession.findUnique({
        where: { id: d.session_id },
        include: sessionInclude,
      });
      if (!s) throw new AppError("Картку не знайдено.");
      editable(s);
      if (!s.requirements.some((r) => r.specialty === a.specialty))
        throw new AppError("Немає направлення до вашої спеціальності.");
      const locked = await tx.vlkSession.updateMany({
        where: {
          id: s.id,
          version: d.session_version,
          status: { notIn: ["FINALIZED", "CANCELLED"] },
        },
        data: { version: { increment: 1 } },
      });
      if (locked.count !== 1)
        throw new AppError(
          "Картку вже змінив інший працівник. Натисніть «Оновити стан» і повторіть збереження.",
        );
      const old = latestExams(s).find((e) => e.specialty === a.specialty);
      if (
        old?.status === "DRAFT" &&
        (old.id !== d.exam_id ||
          old.version !== d.version ||
          old.doctor_id !== a.id)
      )
        throw new AppError(
          "Цю чернетку змінив або веде інший лікар. Оновіть стан.",
        );
      if (old && old.status !== "DRAFT" && d.amendment_reason.length < 3)
        throw new AppError("Для нової версії вкажіть причину виправлення.");
      const icd = await ensureCode(
        tx,
        d.icd10_code,
        d.icd10_version,
        d.diagnosis_text,
      );
      const additions = [];
      for (const item of d.additional_diagnoses) {
        const code = await ensureCode(
          tx,
          item.icd10_code,
          item.icd10_version,
          item.diagnosis_text,
        );
        additions.push({
          ...code,
          diagnosis_text: item.diagnosis_text,
          order_402_article: item.order_402_article || null,
        });
      }
      const data = {
        ...icd,
        complaints: d.complaints,
        anamnesis: d.anamnesis,
        objective_data: d.objective_data,
        diagnosis_text: d.diagnosis_text,
        no_icd_reason: d.no_icd_reason || null,
        order_402_article: d.order_402_article || null,
        fitness_category: d.fitness_category || null,
        doctor_conclusion: d.doctor_conclusion,
        recommendations: d.recommendations,
        amendment_reason: d.amendment_reason || null,
        status: "DRAFT" as const,
        completed_at: null,
        examined_at: new Date(),
      };
      let exam;
      if (old?.status === "DRAFT") {
        await tx.additionalDiagnosis.deleteMany({
          where: { examination_id: old.id },
        });
        const updated = await tx.medicalExamination.updateMany({
          where: {
            id: old.id,
            version: d.version,
            status: "DRAFT",
            doctor_id: a.id,
          },
          data: { ...data, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new AppError("Конфлікт версій огляду.");
        exam = await tx.medicalExamination.findUniqueOrThrow({
          where: { id: old.id },
        });
      } else
        exam = await tx.medicalExamination.create({
          data: {
            ...data,
            session_id: s.id,
            doctor_id: a.id,
            specialty: a.specialty!,
            revision: (old?.revision || 0) + 1,
            doctor_name_snapshot: a.full_name,
          },
        });
      for (const [position, item] of additions.entries())
        await tx.additionalDiagnosis.create({
          data: {
            ...item,
            icd10_code: item.icd10_code!,
            icd10_version: item.icd10_version!,
            examination_id: exam.id,
            position,
          },
        });
      if (d.complete)
        exam = await tx.medicalExamination.update({
          where: { id: exam.id },
          data: { status: "COMPLETED", completed_at: new Date() },
        });
      const after = await tx.vlkSession.findUniqueOrThrow({
        where: { id: s.id },
        include: sessionInclude,
      });
      await tx.vlkSession.update({
        where: { id: s.id },
        data: {
          status: completeRequirements(after)
            ? "READY_FOR_REVIEW"
            : "IN_PROGRESS",
        },
      });
      await tx.auditLog.create({
        data: {
          actor_id: a.id,
          session_id: s.id,
          action: d.complete
            ? "COMPLETE_EXAMINATION"
            : old && old.status !== "DRAFT"
              ? "CREATE_REVISION"
              : "UPDATE_DRAFT",
          entity_type: "MedicalExamination",
          entity_id: exam.id,
          metadata: { revision: exam.revision },
        },
      });
      return { id: exam.id, version: exam.version };
    },
    { timeout: 15000 },
  );
}
// Тільки голова або заступник закриває сесію після всіх обов’язкових оглядів.
// Документ фіксує історичний знімок, незалежний від майбутніх змін довідників.
export async function saveDecision(a: Actor, input: unknown) {
  allowed(a, coordinatorRoles);
  const d = decisionInput.parse(input);
  if (d.finalize) allowed(a, ["CHAIRPERSON", "DEPUTY_CHAIRPERSON"]);
  return db.$transaction(
    async (tx) => {
      const s = await tx.vlkSession.findUnique({
        where: { id: d.session_id },
        include: sessionInclude,
      });
      if (!s) throw new AppError("Картку не знайдено.");
      editable(s);
      if (d.finalize && !completeRequirements(s))
        throw new AppError("Не всі обов’язкові огляди підтверджено.");
      const changed = await tx.vlkSession.updateMany({
        where: {
          id: s.id,
          version: d.version,
          status: { notIn: ["FINALIZED", "CANCELLED"] },
        },
        data: {
          final_diagnosis: d.final_diagnosis,
          final_decision: d.final_decision,
          order_402_article: d.order_402_article,
          protocol_number: d.protocol_number,
          decision_date: d.decision_date,
          fitness_category: d.fitness_category,
          version: { increment: 1 },
          ...(d.finalize
            ? {
                status: "FINALIZED",
                finalized_by_id: a.id,
                finalized_at: new Date(),
              }
            : {}),
        },
      });
      if (changed.count !== 1)
        throw new AppError(
          "Картку змінено. Оновіть стан перед підтвердженням.",
        );
      let documentId = "";
      if (d.finalize) {
        const final = await tx.vlkSession.findUniqueOrThrow({
          where: { id: s.id },
          include: sessionInclude,
        });
        const payload = payloadFor(final, a.full_name);
        const doc = await tx.vlkDocument.create({
          data: {
            session_id: s.id,
            kind: "VLK_CERTIFICATE",
            document_number: d.protocol_number,
            template_version: "working-summary-v1",
            template_source: "local:working-summary-not-official-form",
            payload: payload as unknown as Prisma.InputJsonValue,
            payload_sha256: digest(payload),
            created_by_id: a.id,
          },
        });
        documentId = doc.id;
      }
      await tx.auditLog.create({
        data: {
          actor_id: a.id,
          session_id: s.id,
          action: d.finalize ? "FINALIZE_SESSION" : "UPDATE_DRAFT",
          entity_type: "VlkSession",
          entity_id: s.id,
        },
      });
      return { id: s.id, documentId };
    },
    { timeout: 15000 },
  );
}
// Перенесення підтверджує оператор після звірки. Копіювання не пише SyncLog.
export async function recordTransfer(
  a: Actor,
  input: {
    document_id: string;
    keys: string[];
    confirmed: boolean;
    notes: string;
    request_key: string;
  },
) {
  allowed(a, coordinatorRoles);
  return db.$transaction(async (tx) => {
    const doc = await tx.vlkDocument.findUnique({
      where: { id: input.document_id },
      include: {
        session: { select: { replaced_by: { select: { id: true } } } },
      },
    });
    if (!doc) throw new AppError("Документ не знайдено.");
    if (doc.session.replaced_by)
      throw new AppError(
        "Для цієї сесії створено виправлення. Використайте новий документ.",
      );
    if (digest(doc.payload) !== doc.payload_sha256)
      throw new AppError("Контроль цілісності документа не пройдено.");
    const allowedKeys = copyFields(doc.payload as DocumentPayload).map(
        (f) => f.key,
      ),
      keys = [...new Set(input.keys)];
    if (keys.some((k) => !allowedKeys.includes(k)))
      throw new AppError("Невідомі поля перенесення.");
    if (input.confirmed && keys.length !== allowedKeys.length)
      throw new AppError("Позначте всі поля після звірки в Helsi.");
    const existing = await tx.syncLog.findUnique({
      where: { request_key: input.request_key },
    });
    if (existing) {
      if (
        existing.operator_id !== a.id ||
        existing.document_id !== doc.id ||
        canonicalJson(existing.transferred_fields) !== canonicalJson(keys) ||
        existing.status !== (input.confirmed ? "CONFIRMED" : "PARTIAL")
      )
        throw new AppError("Конфлікт повторного підтвердження.");
      return { id: existing.id };
    }
    const log = await tx.syncLog.create({
      data: {
        session_id: doc.session_id,
        document_id: doc.id,
        operator_id: a.id,
        request_key: input.request_key,
        status: input.confirmed ? "CONFIRMED" : "PARTIAL",
        synced_at: input.confirmed ? new Date() : null,
        transferred_fields: keys,
        notes: input.notes,
      },
    });
    await tx.auditLog.create({
      data: {
        actor_id: a.id,
        session_id: doc.session_id,
        action: "RECORD_TRANSFER",
        entity_type: "SyncLog",
        entity_id: log.id,
        metadata: { fieldCount: keys.length, confirmed: input.confirmed },
      },
    });
    return { id: log.id };
  });
}
