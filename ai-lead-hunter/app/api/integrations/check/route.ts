import { NextResponse } from "next/server";
import { ApiError, apiFailure, guardRequest, readJson } from "@/lib/apiGuard";
import { checkAiConnection } from "@/lib/ai";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const rejected = guardRequest(request, "integration", 5);
  if (rejected) return rejected;
  try {
    const body = (await readJson(request)) as { provider?: string } | null;
    if (body?.provider === "ai")
      return NextResponse.json({
        ok: true,
        message: await checkAiConnection(),
        checkedAt: new Date().toISOString(),
      });
    if (body?.provider !== "google")
      throw new ApiError("Оберіть Google Places або AI.");
    const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
    if (!key) throw new ApiError("Ключ Google Places ще не налаштовано.", 503);
    // A minimal user-initiated request. Configuration status alone is not a connectivity test.
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({ textQuery: "Kyiv", pageSize: 1 }),
      },
    );
    await res.body?.cancel();
    if (!res.ok)
      throw new ApiError(
        `Google повернув ${res.status}. Перевірте ключ, Places API (New), білінг та квоту.`,
        502,
      );
    return NextResponse.json({
      ok: true,
      message: "Google Places відповідає. Ключ прийнято.",
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return apiFailure(e);
  }
}
