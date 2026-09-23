import { NextResponse } from "next/server";
import { generateAiDraft } from "@/lib/ai";
import { outreachSchema } from "@/lib/validation";
import { ApiError, apiFailure, guardRequest, readJson } from "@/lib/apiGuard";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const rejected = guardRequest(request, "ai", 10);
  if (rejected) return rejected;
  try {
    const parsed = outreachSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError("Некоректні дані для чернетки.");
    return NextResponse.json({
      text: await generateAiDraft(parsed.data),
      source: "ai",
    });
  } catch (e) {
    return apiFailure(e);
  }
}
