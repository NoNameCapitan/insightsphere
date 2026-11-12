import { NextResponse } from "next/server";
import { rowToPet, type PetRow } from "@/lib/pets/cloudModel";
import { getUserClient, getUserSession, isAuthConfigured, withSession } from "@/lib/server/userAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pets → the signed-in user's pet cards (RLS: owner only). */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthConfigured()) return NextResponse.json({ error: "Accounts disabled" }, { status: 503 });
  const session = await getUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getUserClient(session.accessToken)!;
  const { data, error } = await db.from("pets").select("*").order("updated_at", { ascending: false }).limit(50);
  if (error) {
    console.error("[api/pets] list failed:", error.message);
    return withSession(NextResponse.json({ error: "Storage error" }, { status: 500 }), session);
  }
  return withSession(NextResponse.json({ pets: (data as PetRow[]).map(rowToPet) }), session);
}
