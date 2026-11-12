import { NextRequest, NextResponse } from "next/server";
import { clientKeyFromRequest, createServerRateLimiter } from "@/lib/security/serverRateLimit";
import { KYIV_SHELTERS_DATASET_URL, loadShelterFeatures, normalizeShelterFeatures } from "@/lib/safety/shelters";

export const dynamic = "force-dynamic";

// Each call fans out to up to 10 upstream ArcGIS pages: bound it per client so
// this endpoint cannot be used to hammer the city GIS server (v1.26).
const limit = createServerRateLimiter({ namespace: "shelters", limit: 20, windowMs: 60_000 });

const DEFAULT_ARCGIS_URL =
  "https://gisserver.kyivcity.gov.ua/mayno/rest/services/KYIV_API/%D0%9A%D0%B8%D1%97%D0%B2_%D0%A6%D0%B8%D1%84%D1%80%D0%BE%D0%B2%D0%B8%D0%B9/MapServer/0/query";
const KYIV_BOUNDS = { minLat: 50.1, maxLat: 50.65, minLng: 30.2, maxLng: 30.9 };

function coordinate(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const rl = await limit(clientKeyFromRequest(request));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Забагато запитів. Спробуйте за хвилину." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec), "Cache-Control": "no-store" } },
    );
  }
  const latitude = coordinate(request.nextUrl.searchParams.get("lat"));
  const longitude = coordinate(request.nextUrl.searchParams.get("lng"));
  if (
    latitude === null || longitude === null ||
    latitude < KYIV_BOUNDS.minLat || latitude > KYIV_BOUNDS.maxLat ||
    longitude < KYIV_BOUNDS.minLng || longitude > KYIV_BOUNDS.maxLng
  ) {
    return NextResponse.json({ error: "Потрібні коректні координати в межах Києва." }, { status: 400 });
  }

  // Env override is accepted only over HTTPS (misconfiguration must not downgrade
  // a safety data source to plaintext or to a non-web scheme).
  const override = process.env.KYIV_SHELTERS_ARCGIS_URL?.trim();
  const source = override && /^https:\/\//i.test(override) ? override : DEFAULT_ARCGIS_URL;
  const params = new URLSearchParams({
    f: "json",
    where: "actual=1 AND working_time LIKE '%Цілодобово%'",
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: "10000",
    units: "esriSRUnit_Meter",
    outFields: "objectid,district,address,type,kind,type_building,invalid,lat,long,globalid,guid,actual,working_time,last_edited_date",
    returnGeometry: "true",
  });

  try {
    const features = await loadShelterFeatures(source, params, AbortSignal.timeout(12_000));
    return NextResponse.json(
      {
        shelters: normalizeShelterFeatures(features, { latitude, longitude }, 5),
        checkedAt: new Date().toISOString(),
        sourceUrl: KYIV_SHELTERS_DATASET_URL,
        warning: "Показані лише актуальні записи з режимом «Цілодобово», але набір даних не гарантує фізичний доступ. Оцініть безпеку на місці та використовуйте офіційну мапу як основне джерело.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        shelters: [],
        checkedAt: new Date().toISOString(),
        sourceUrl: KYIV_SHELTERS_DATASET_URL,
        warning: "Офіційний набір укриттів тимчасово недоступний. Відкрийте мапу Київ Цифровий.",
      },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
}
