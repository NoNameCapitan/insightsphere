"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  assertOrigin,
  requireActor,
  AppError,
  signIn,
  signOut,
} from "@/server/auth";
import { db } from "@/db";
import {
  register,
  saveExam,
  saveDecision,
  recordTransfer,
  queue,
} from "@/server/records";
import {
  registryRoles,
  clinicalRoles,
  coordinatorRoles,
  today,
  hasRole,
  type Actor,
  type Role,
} from "@/lib/domain";
import { userInput, day } from "@/server/validation";
import { hashPassword } from "@/lib/passwords";
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    await assertOrigin();
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof z.ZodError)
      return {
        ok: false,
        error: e.issues
          .map((x) => x.message)
          .slice(0, 3)
          .join(". "),
      };
    if (e instanceof AppError) return { ok: false, error: e.message };
    const code = (e as { code?: string })?.code;
    if (code === "P2002")
      return {
        ok: false,
        error: "Такий запис уже існує. Звірте дані та оновіть сторінку.",
      };
    return {
      ok: false,
      error:
        "Не вдалося зберегти. Дані форми залишилися на екрані. Перевірте зв’язок із локальним сервером.",
    };
  }
}
export async function loginAction(input: unknown) {
  return run(async () => {
    const d = z
      .object({
        username: z.string().trim().min(1).max(50),
        password: z.string().min(1).max(256),
      })
      .parse(input);
    await signIn(d.username, d.password);
    return {};
  });
}
export async function logoutAction() {
  return run(async () => {
    await signOut();
    return {};
  });
}
export async function registerAction(input: unknown) {
  return run(async () => {
    const a = await requireActor(registryRoles);
    const r = await register(a, input);
    revalidatePath("/");
    return r;
  });
}
export async function examAction(input: unknown) {
  return run(async () => {
    const a = await requireActor(["DOCTOR"]);
    const r = await saveExam(a, input);
    revalidatePath("/sessions");
    return r;
  });
}
export async function decisionAction(input: unknown) {
  return run(async () => {
    const a = await requireActor();
    const r = await saveDecision(a, input);
    revalidatePath("/");
    return r;
  });
}
export async function transferAction(input: unknown) {
  return run(async () => {
    const a = await requireActor();
    const d = z
      .object({
        document_id: z.string().max(100),
        keys: z.array(z.string().max(200)).max(1000),
        confirmed: z.boolean(),
        notes: z.string().trim().max(2000),
        request_key: z.string().min(16).max(100),
      })
      .parse(input);
    return recordTransfer(a, d);
  });
}
export async function queueAction(input: unknown) {
  return run(async () => {
    const a = await requireActor();
    const d = z
      .object({ date: day, query: z.string().trim().max(200) })
      .parse(input);
    return queue(a, d.date, d.query);
  });
}
export async function patientSearchAction(query: string) {
  return run(async () => {
    await requireActor(registryRoles);
    const q = z
      .string()
      .trim()
      .min(2)
      .max(200)
      .parse(query)
      .normalize("NFKC")
      .toLocaleLowerCase("uk");
    return db.patient.findMany({
      where: { search_text: { contains: q } },
      take: 12,
      select: {
        id: true,
        rnokpp: true,
        rnokpp_absence_reason: true,
        last_name: true,
        first_name: true,
        middle_name: true,
        birth_date: true,
        rank: true,
        military_unit_or_tck: true,
      },
    });
  });
}
export async function icdSearchAction(query: string) {
  return run(async () => {
    await requireActor(clinicalRoles);
    const q = z
      .string()
      .trim()
      .min(1)
      .max(200)
      .parse(query)
      .toLocaleLowerCase("uk");
    return db.icd10Entry.findMany({
      where: { search_text: { contains: q }, is_selectable: true },
      select: { code: true, catalog_version: true, title_uk: true },
      take: 30,
      orderBy: { code: "asc" },
    });
  });
}
export async function userAction(input: unknown) {
  return run(async () => {
    const a = await requireActor(["ADMIN"]),
      d = userInput.parse(input),
      roles = [...new Set(d.roles)];
    const password_hash = d.password
      ? await hashPassword(d.password)
      : undefined;
    return db.$transaction(async (tx) => {
      if (d.id === a.id && (!d.is_active || !roles.includes("ADMIN")))
        throw new AppError("Не можна забрати власний адміністративний доступ.");
      const u = d.id
        ? await tx.user.update({
            where: { id: d.id },
            data: {
              username: d.username,
              full_name: d.full_name,
              role: roles[0],
              specialty: d.specialty || null,
              is_active: d.is_active,
              ...(password_hash ? { password_hash } : {}),
            },
          })
        : await tx.user.create({
            data: {
              username: d.username,
              full_name: d.full_name,
              role: roles[0],
              specialty: d.specialty || null,
              is_active: d.is_active,
              password_hash: password_hash!,
            },
          });
      await tx.userRoleGrant.deleteMany({ where: { user_id: u.id } });
      for (const role of roles.slice(1))
        await tx.userRoleGrant.create({ data: { user_id: u.id, role } });
      if (d.id)
        await tx.authSession.updateMany({
          where: { user_id: u.id },
          data: { revoked_at: new Date() },
        });
      await tx.auditLog.create({
        data: {
          actor_id: a.id,
          action: "MANAGE_USER",
          entity_type: "User",
          entity_id: u.id,
        },
      });
      revalidatePath("/admin");
      return { id: u.id };
    });
  });
}
export async function cancelAction(input: unknown) {
  return run(async () => {
    const a = await requireActor(registryRoles);
    const d = z
      .object({
        id: z.string(),
        version: z.number().int(),
        reason: z.string().trim().min(3).max(1000),
      })
      .parse(input);
    return db.$transaction(async (tx) => {
      const r = await tx.vlkSession.updateMany({
        where: {
          id: d.id,
          version: d.version,
          status: { notIn: ["FINALIZED", "CANCELLED"] },
        },
        data: {
          status: "CANCELLED",
          cancelled_at: new Date(),
          cancellation_reason: d.reason,
          version: { increment: 1 },
        },
      });
      if (!r.count) throw new AppError("Картку вже змінено або закрито.");
      await tx.auditLog.create({
        data: {
          actor_id: a.id,
          session_id: d.id,
          action: "CANCEL_SESSION",
          entity_type: "VlkSession",
          entity_id: d.id,
        },
      });
      revalidatePath("/");
      return {};
    });
  });
}

export async function correctionAction(input: unknown) {
  return run(async () => {
    const a = await requireActor(coordinatorRoles);
    const d = z
      .object({
        id: z.string(),
        reason: z.string().trim().min(3).max(1000),
        request_key: z.string().uuid(),
      })
      .parse(input);
    return db.$transaction(async (tx) => {
      const old = await tx.vlkSession.findUnique({
        where: { id: d.id },
        include: { requirements: true, replaced_by: true },
      });
      if (!old || old.status !== "FINALIZED")
        throw new AppError("Виправляти можна завершену сесію.");
      if (old.replaced_by) return { id: old.replaced_by.id };
      const s = await tx.vlkSession.create({
        data: {
          patient_id: old.patient_id,
          patient_snapshot: old.patient_snapshot!,
          ticket_number:
            today().replaceAll("-", "") +
            "-" +
            d.request_key.slice(0, 8).toUpperCase(),
          creation_key: d.request_key,
          creation_hash: d.request_key,
          session_date: today(),
          commission_name: old.commission_name,
          rank: old.rank,
          military_unit_or_tck: old.military_unit_or_tck,
          referral_number: old.referral_number,
          referral_date: old.referral_date,
          referral_issuer: old.referral_issuer,
          order_402_revision: old.order_402_revision,
          created_by_id: a.id,
          replaces_session_id: old.id,
          correction_reason: d.reason,
          search_text: old.search_text,
          requirements: {
            create: old.requirements.map((r) => ({
              specialty: r.specialty,
              is_required: r.is_required,
            })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actor_id: a.id,
          session_id: s.id,
          action: "CREATE_REVISION",
          entity_type: "VlkSession",
          entity_id: s.id,
          metadata: { previousId: old.id },
        },
      });
      revalidatePath("/");
      return { id: s.id };
    });
  });
}
