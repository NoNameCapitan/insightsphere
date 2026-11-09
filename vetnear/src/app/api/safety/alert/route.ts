import { NextResponse } from "next/server";
import { ALERT_SOURCE_URL, parseKyivAlertPayload } from "@/lib/safety/alert";

export const dynamic = "force-dynamic";

const ALERT_API_URL = "https://api.ukrainealarm.com/api/v3/alerts";

export async function GET() {
  const token = process.env.UKRAINE_ALARM_API_TOKEN?.trim();
  const checkedAt = new Date().toISOString();
  if (!token) {
    return NextResponse.json(
      {
        state: "unavailable",
        checkedAt,
        sourceUrl: ALERT_SOURCE_URL,
        message: "Онлайн-моніторинг очікує серверний UKRAINE_ALARM_API_TOKEN.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(ALERT_API_URL, {
      headers: { Accept: "application/json", Authorization: token },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`alert upstream ${response.status}`);
    const payload: unknown = await response.json();
    return NextResponse.json(parseKyivAlertPayload(payload, checkedAt), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        state: "unavailable",
        checkedAt,
        sourceUrl: ALERT_SOURCE_URL,
        message: "Не вдалося перевірити офіційний статус. Звіртеся з офіційною мапою.",
      },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } },
    );
  }
}
