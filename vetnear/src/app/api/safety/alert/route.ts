import { NextResponse } from "next/server";
import { ALERT_SOURCE_URL, parseKyivAlertPayload } from "@/lib/safety/alert";

export const dynamic = "force-dynamic";

const ALERT_API_URL = "https://api.ukrainealarm.com/api/v3/alerts";

// v1.26: every visitor polls this endpoint every 30 s. Without a shared cache
// each poll became an upstream call with our API token, so a small flood could
// get the token throttled and blind the alert banner for everyone.
const CACHE_TTL_MS = 10_000;
let cached: { at: number; body: unknown } | null = null;
let inflight: Promise<unknown> | null = null;

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
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      // checkedAt stays the ORIGINAL check time, so client freshness rules hold.
      return NextResponse.json(cached.body, { headers: { "Cache-Control": "no-store" } });
    }
    inflight ??= (async () => {
      const response = await fetch(ALERT_API_URL, {
        headers: { Accept: "application/json", Authorization: token },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`alert upstream ${response.status}`);
      const payload: unknown = await response.json();
      const body = parseKyivAlertPayload(payload, checkedAt);
      cached = { at: Date.now(), body };
      return body;
    })().finally(() => { inflight = null; });
    return NextResponse.json(await inflight, {
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
