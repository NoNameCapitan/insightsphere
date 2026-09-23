import { NextResponse } from "next/server";
import { resolveSearchGeo } from "@/lib/geo";
import { getDemoBusinesses } from "@/lib/demoData";
import { geocodeWithPlaces, searchGooglePlaces } from "@/lib/places";
import { analyzeWebsites } from "@/lib/websiteAnalyzer";
import { dedupeBusinesses } from "@/lib/utils";
import { searchSchema } from "@/lib/validation";
import { ApiError, apiFailure, guardRequest, readJson } from "@/lib/apiGuard";
import { assembleResults, businessKey } from "@/lib/searchResults";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const rejected = guardRequest(request, "search", 20);
  if (rejected) return rejected;
  try {
    const parsed = searchSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(
        `Перевірте параметри: ${parsed.error.issues.map((i) => i.path.join(".") || i.message).join(", ")}.`,
      );
    const body = parsed.data;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
    const demo =
      body.demo || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !apiKey;
    let geo = resolveSearchGeo(body);
    // Unknown address/city: one extra Places request turns it into a real
    // center, so the radius and distances work for any location.
    if (!demo && apiKey && !geo.center && geo.approximate) {
      const text =
        body.locationMode === "address"
          ? [body.address, body.city].filter(Boolean).join(", ")
          : body.city;
      const point = text ? await geocodeWithPlaces(text, apiKey) : null;
      if (point)
        geo = {
          center: { lat: point.lat, lng: point.lng },
          source: "geocoded",
          approximate: false,
          radiusKm:
            body.radiusKm > 0
              ? body.radiusKm
              : body.locationMode === "city"
                ? 15
                : geo.radiusKm,
          wholeCity: body.locationMode === "city" && !(body.radiusKm > 0),
          note: point.label
            ? `Центр пошуку визначено через Google: ${point.label}.`
            : undefined,
        };
    }
    const req = {
      ...body,
      radiusKm: geo.radiusKm,
      ...(geo.center
        ? { lat: geo.center.lat, lng: geo.center.lng }
        : { lat: undefined, lng: undefined }),
    };
    const excluded = new Set(body.excludeKeys);
    if (demo) {
      // Demo businesses are fictional Kyiv places: another city would hide them all.
      const demoGeo =
        geo.cityName === "Київ" || geo.source === "near_me"
          ? geo
          : resolveSearchGeo({ locationMode: "city", city: "Київ", radiusKm: body.radiusKm });
      const demoReq = { ...req, radiusKm: demoGeo.radiusKm, lat: demoGeo.center?.lat, lng: demoGeo.center?.lng };
      const raw = getDemoBusinesses(req.niche).filter(
        (b) => !excluded.has(businessKey(b)),
      );
      return NextResponse.json(
        assembleResults(
          raw,
          demoReq,
          demoGeo,
          "demo",
          "Навчальна вибірка вигаданих бізнесів Києва. Для реального пошуку підключіть Google Places у налаштуваннях.",
        ),
      );
    }
    const raw = dedupeBusinesses(
      await searchGooglePlaces(req, apiKey, { widen: body.widen }),
    ).filter((b) => !excluded.has(businessKey(b)));
    const analyses = await analyzeWebsites(
      raw.map((b) => b.website),
      12,
    );
    raw.forEach((b, i) => {
      if (analyses[i]?.checked) b.websiteAnalysis = analyses[i];
    });
    // Empty live results stay empty. Provider errors never turn into fictional leads.
    return NextResponse.json(assembleResults(raw, req, geo, "google_places"));
  } catch (error) {
    return apiFailure(error);
  }
}
