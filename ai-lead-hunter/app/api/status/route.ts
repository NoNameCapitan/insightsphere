import { NextResponse } from "next/server";
import { aiConfiguration } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function GET() {
  const ai = aiConfiguration();
  return NextResponse.json(
    {
      googlePlaces: !!process.env.GOOGLE_PLACES_API_KEY?.trim(),
      mapsBrowserKey: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim(),
      aiProvider: ai.provider,
      aiKeyConfigured: !!ai.key,
      aiModelConfigured: !!ai.model,
      aiModel: ai.model ?? null,
      aiReady: ai.ready,
      demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
      passwordProtected: !!process.env.APP_PASSWORD,
      defaultCity: process.env.NEXT_PUBLIC_DEFAULT_CITY || "Київ",
      defaultCountry: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || "Україна",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
