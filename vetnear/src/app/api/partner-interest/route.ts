import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { readJsonBody } from "@/lib/server/requestBody";
import { parsePartnerInterest } from "@/lib/partners/interest";
import { getPublicPlace } from "@/lib/server/placesFeed";
import { clientKeyFromRequest, createServerRateLimiter } from "@/lib/security/serverRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limit = createServerRateLimiter({ namespace: "partner-interest", limit: 5, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  const rl = await limit(clientKeyFromRequest(request));
  if (!rl.allowed) return NextResponse.json({ error: "Забагато спроб. Повторіть пізніше." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  const body = await readJsonBody(request, 8192);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = parsePartnerInterest(body.value);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Приймання заявок ще не підключено. Дані залишаються у вашій формі." }, { status: 503 });
  const p = parsed.value;
  const claimPlace = p.claimPlaceSlug ? await getPublicPlace(p.claimPlaceSlug) : null;
  if (p.claimPlaceSlug && !claimPlace) return NextResponse.json({ error: "Профіль не знайдено. Поверніться до пошуку свого закладу." }, { status: 422 });
  const message = claimPlace
    ? `Запит на перевірку представника. Профіль: ${claimPlace.name} (ID: ${claimPlace.id}; slug: ${claimPlace.slug}). Повноваження ще не підтверджені.\n\n${p.message}`
    : p.message;
  if (message.length > 1500) return NextResponse.json({ error: "Опис разом із даними профілю задовгий. Скоротіть текст до 1000 символів; введені дані залишаються у формі." }, { status: 422 });
  const { error } = await db.from("partner_plan_requests").upsert({
    id: p.requestId, organization: p.organization, contact_name: p.contactName || null,
    contact_email: p.contactEmail, locality: p.locality, official_website: p.officialWebsite || null,
    requested_plan: p.requestedPlan, founding_partner: p.foundingPartner, message: message || null,
    consent_version: "partner-interest-2026-11-17", status: "pending_review",
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    console.error("[partner-interest] storage failed");
    return NextResponse.json({ error: "Не вдалося підтвердити отримання. Заявка не активує платний план; спробуйте повторити." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, id: p.requestId, status: "pending_review", paymentStatus: "unpaid", planActive: false }, { status: 201 });
}
