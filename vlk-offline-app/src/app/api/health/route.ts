import { databaseState } from "@/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const state = await databaseState();
  const headers = { "Cache-Control": "no-store" };
  if (state.status === "ok")
    return Response.json(
      { status: "ok", driver: state.driver, migrations: "applied" },
      { headers },
    );
  // Текст не містить даних установи й токенів, зате одразу називає причину.
  return Response.json(
    { status: state.status, driver: state.driver, detail: state.detail },
    { status: 503, headers },
  );
}
