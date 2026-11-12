import { NextResponse } from "next/server";
import { getBillingPlan } from "@/lib/billing/plans";
import { clientKeyFromRequest, createServerRateLimiter } from "@/lib/security/serverRateLimit";
import { getBillingProvider } from "@/lib/server/billing/provider";
import { activatePlan } from "@/lib/server/billing/service";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const limit = createServerRateLimiter({ namespace: "billing-webhook", limit: 120, windowMs: 60_000 });

/**
 * POST /api/billing/webhook — payment notifications from the provider.
 *
 * Fails closed: with no provider connected (the launch state) nothing can be
 * activated from here. When a provider is connected, only a correctly signed
 * "paid" event activates a plan, and the provider's payment id makes a
 * repeated delivery a no-op.
 */
export async function POST(req: Request): Promise<Response> {
  const provider = getBillingProvider();
  if (provider.id === "manual") {
    return NextResponse.json({ error: "No payment provider is connected" }, { status: 501 });
  }
  const rl = await limit(clientKeyFromRequest(req));
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  const event = await provider.verifyWebhook(req, rawBody).catch(() => null);
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const plan = getBillingPlan(event.planCode);
  if (!plan || !event.providerPaymentId || !event.placeId) return NextResponse.json({ error: "Unknown plan" }, { status: 422 });
  // Never activate a priced plan for less than it costs.
  if (plan.listPriceUah !== null && event.amountUah < plan.listPriceUah) {
    console.error("[billing/webhook] underpaid:", event.providerPaymentId);
    return NextResponse.json({ error: "Amount does not match the plan" }, { status: 422 });
  }

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });
  const result = await activatePlan(db, {
    placeId: event.placeId,
    plan,
    amountUah: event.amountUah,
    provider: provider.id,
    providerPaymentId: event.providerPaymentId,
    actorId: `webhook:${provider.id}`,
    note: null,
  });
  // A 5xx makes the provider retry; idempotency makes the retry safe.
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "storage_error" ? 500 : 422 });
  return NextResponse.json({ ok: true, duplicate: result.duplicate });
}
