import { NextResponse } from "next/server";
import { analyzeWebsite } from "@/lib/websiteAnalyzer";
import { ApiError, apiFailure, guardRequest, readJson } from "@/lib/apiGuard";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const rejected = guardRequest(request, "website", 20);
  if (rejected) return rejected;
  try {
    const body = (await readJson(request)) as { url?: unknown } | null;
    if (
      !body ||
      typeof body.url !== "string" ||
      body.url.length > 2048 ||
      !body.url.trim()
    )
      throw new ApiError("Передайте коректну адресу сайту.");
    return NextResponse.json({ analysis: await analyzeWebsite(body.url) });
  } catch (error) {
    return apiFailure(error);
  }
}
