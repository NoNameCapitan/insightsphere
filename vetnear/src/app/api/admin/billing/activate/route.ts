import { NextResponse } from "next/server";
import { ACTIVATION_ERROR_TEXT, validateActivation } from "@/lib/billing/plans";
import { activatePlan } from "@/lib/server/billing/service";
import { authenticateModerator, requireRole } from "@/lib/server/moderatorAuth";
import { readJsonBody } from "@/lib/server/requestBody";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/billing/activate — { placeId, planCode, amountUah, paymentRef?, note? }
 * "Payment received": records the prepayment and switches the plan on for its
 * period. Admin only. With a paymentRef a repeated submit changes nothing.
 */
export async function POST(req: Request): Promise<Response> {
  const identity = await authenticateModerator(req);
  if (!identity || !requireRole(identity, "admin")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });

  const body = await readJsonBody(req);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = validateActivation(body.value);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });

  const result = await activatePlan(db, {
    placeId: parsed.value.placeId,
    plan: parsed.value.plan,
    amountUah: parsed.value.amountUah,
    provider: "manual",
    providerPaymentId: parsed.value.paymentRef,
    actorId: identity.actorId,
    note: parsed.value.note,
  });
  if (!result.ok) {
    const status = result.error === "storage_error" ? 500 : result.error === "place_not_found" ? 404 : 422;
    return NextResponse.json({ error: result.error, message: ACTIVATION_ERROR_TEXT[result.error] ?? "Не вдалося активувати тариф." }, { status });
  }
  return NextResponse.json(result);
}
