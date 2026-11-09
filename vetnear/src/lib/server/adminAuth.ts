// Admin auth for moderation API routes (MVP): a single ADMIN_TOKEN env secret,
// compared in constant time. Documented limitation: replace with real auth
// (Supabase Auth + roles) before multi-moderator production use.
import { timingSafeEqual } from "node:crypto";

export function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false; // no token configured => admin API disabled
  const got = req.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
