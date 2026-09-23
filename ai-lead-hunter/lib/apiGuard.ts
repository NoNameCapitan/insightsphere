import { NextResponse } from "next/server";

import { ApiError } from "./errors";
export { ApiError } from "./errors";
// A per-process budget, deliberately not advertised as a distributed rate limiter.
const windows = new Map<string, { count: number; until: number }>();
export function guardRequest(
  request: Request,
  group: string,
  limit = 30,
): NextResponse | null {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  const protocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const publicOrigin = host
    ? `${protocol === "https" ? "https:" : protocol === "http" ? "http:" : requestUrl.protocol}//${host}`
    : requestUrl.origin;
  if (origin && origin !== requestUrl.origin && origin !== publicOrigin) {
    return NextResponse.json(
      { error: "Запит дозволено лише з цього застосунку." },
      { status: 403 },
    );
  }
  const now = Date.now();
  let bucket = windows.get(group);
  if (!bucket || bucket.until <= now) {
    bucket = { count: 0, until: now + 60000 };
    windows.set(group, bucket);
  }
  if (++bucket.count > limit)
    return NextResponse.json(
      { error: "Забагато запитів. Спробуйте за хвилину." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  return null;
}
export async function readJson(
  request: Request,
  max = 64_000,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError("Очікується JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Порожній запит.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        throw new ApiError("Запит завеликий.", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Некоректний JSON.");
  } finally {
    reader.releaseLock();
  }
}
export function apiFailure(error: unknown): NextResponse {
  return NextResponse.json(
    {
      error:
        error instanceof ApiError
          ? error.message
          : "Сервіс тимчасово недоступний. Спробуйте ще раз.",
    },
    { status: error instanceof ApiError ? error.status : 502 },
  );
}
