import { db, ready, configurationProblem } from "@/db";
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
    // Помилку конфігурації показуємо явно: вона не містить даних установи,
    // зате одразу пояснює адміністратору, чого бракує після розгортання.
    return Response.json(
      configurationProblem
        ? { status: "misconfigured", detail: configurationProblem }
        : { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
