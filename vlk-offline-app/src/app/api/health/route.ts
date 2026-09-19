import { db, ready } from "@/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ready();
    await db.user.count();
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
