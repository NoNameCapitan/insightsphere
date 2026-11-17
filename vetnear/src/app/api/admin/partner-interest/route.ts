import { NextResponse } from "next/server";
import { authenticateModerator } from "@/lib/server/moderatorAuth";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Internal read-only intake queue; no email, payment or activation actions. */
export async function GET(request: Request) {
  const identity = await authenticateModerator(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "Backend disabled" }, { status: 503 });
  const url = new URL(request.url);
  const pageValue = Number(url.searchParams.get("page") ?? "0");
  if (!Number.isInteger(pageValue) || pageValue < 0 || pageValue > 10000) return NextResponse.json({ error: "Invalid page" }, { status: 422 });
  const pageSize = 50;
  const { data, error } = await db.from("partner_plan_requests")
    .select("id,organization,contact_name,contact_email,locality,official_website,requested_plan,founding_partner,message,status,created_at")
    .order("created_at", { ascending: false }).order("id", { ascending: true })
    .range(pageValue * pageSize, pageValue * pageSize + pageSize);
  if (error) return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  return NextResponse.json({ requests: (data ?? []).slice(0, pageSize), nextPage: (data?.length ?? 0) > pageSize ? pageValue + 1 : null }, { headers: { "Cache-Control": "no-store" } });
}
