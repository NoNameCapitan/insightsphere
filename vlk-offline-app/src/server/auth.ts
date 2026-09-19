import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { db, ready } from "@/db";
import { tokenHash, verifyPassword } from "@/lib/passwords";
import { type Actor, type Role, hasRole } from "@/lib/domain";
import { AppError } from "./errors";
export { AppError } from "./errors";
export async function assertOrigin() {
  const origin = (await headers()).get("origin");
  const allowed = (
    process.env.ALLOWED_ORIGINS ||
    process.env.APP_ORIGIN ||
    "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((s) => s.trim());
  if (!origin || !allowed.includes(origin))
    throw new AppError(
      "Адреса доступу не дозволена. Перевірте APP_ORIGIN / ALLOWED_ORIGINS на сервері.",
    );
}
export async function currentActor(): Promise<Actor | null> {
  await ready();
  const token = (await cookies()).get("vlk_session")?.value;
  if (!token) return null;
  const s = await db.authSession.findUnique({
    where: { token_hash: tokenHash(token) },
    include: { user: { include: { extra_roles: true } } },
  });
  if (
    !s ||
    s.revoked_at ||
    s.expires_at < new Date() ||
    !s.user.is_active ||
    Date.now() - s.last_seen_at.getTime() > 3600000
  )
    return null;
  if (Date.now() - s.last_seen_at.getTime() > 60000)
    await db.authSession.update({
      where: { id: s.id },
      data: { last_seen_at: new Date() },
    });
  const u = s.user;
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    role: u.role,
    specialty: u.specialty,
    roles: [...new Set([u.role, ...u.extra_roles.map((r) => r.role)])],
  };
}
export async function requireActor(roles?: Role[]) {
  const a = await currentActor();
  if (!a)
    throw new AppError(
      "Сесію завершено. Увійдіть знову; текст форми залишився на екрані.",
    );
  if (roles && !hasRole(a, roles))
    throw new AppError("Недостатньо прав для цієї дії.");
  return a;
}
export async function pageActor(roles?: Role[]) {
  const a = await currentActor();
  if (!a) redirect("/login");
  if (roles && !hasRole(a, roles)) redirect("/?denied=1");
  return a;
}
export async function signIn(username: string, password: string) {
  await ready();
  const key = tokenHash(username.toLowerCase()),
    now = new Date();
  const locks = await db.loginThrottle.findMany({
    where: { key: { in: [key, "global"] } },
  });
  if (locks.some((l) => l.blocked_until && l.blocked_until > now))
    throw new AppError("Забагато невдалих спроб. Спробуйте через 15 хвилин.");
  const u = await db.user.findUnique({
    where: { username: username.toLowerCase() },
  });
  // Однакова вартість перевірки для відсутнього й наявного користувача.
  const correct = await verifyPassword(
    password,
    u?.password_hash ||
      "scrypt:00000000000000000000000000000000:" + "00".repeat(64),
  );
  if (!u || !u.is_active || !correct) {
    await db.$transaction(async (tx) => {
      for (const k of [key, "global"]) {
        const old = await tx.loginThrottle.findUnique({ where: { key: k } }),
          failures =
            old && now.getTime() - old.window_start.getTime() < 900000
              ? old.failures + 1
              : 1,
          limit = k === "global" ? 60 : 5;
        const data = {
          failures,
          window_start: failures === 1 ? now : old!.window_start,
          blocked_until:
            failures >= limit ? new Date(now.getTime() + 900000) : null,
        };
        await tx.loginThrottle.upsert({
          where: { key: k },
          create: { key: k, ...data },
          update: data,
        });
      }
    });
    throw new AppError("Неправильний логін або пароль.");
  }
  await db.loginThrottle.deleteMany({ where: { key } });
  const token = randomBytes(32).toString("base64url"),
    expires = new Date(Date.now() + 8 * 3600000);
  await db.authSession.create({
    data: { user_id: u.id, token_hash: tokenHash(token), expires_at: expires },
  });
  (await cookies()).set("vlk_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.COOKIE_SECURE === "true" ||
      !!process.env.APP_ORIGIN?.startsWith("https:"),
    path: "/",
    expires,
  });
  await db.auditLog.create({
    data: {
      actor_id: u.id,
      action: "LOGIN",
      entity_type: "User",
      entity_id: u.id,
    },
  });
}
export async function signOut() {
  const token = (await cookies()).get("vlk_session")?.value;
  if (token)
    await db.authSession.updateMany({
      where: { token_hash: tokenHash(token) },
      data: { revoked_at: new Date() },
    });
  (await cookies()).delete("vlk_session");
}
