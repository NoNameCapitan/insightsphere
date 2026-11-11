// Bounded JSON body reader for public API routes (v1.26 hardening).
// `req.json()` buffers an arbitrarily large body; this caps it so a single
// request cannot exhaust memory or be used to push huge prompts to the LLM.
export const DEFAULT_MAX_BODY_BYTES = 16 * 1024;

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

export async function readJsonBody(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<JsonBodyResult> {
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  // Requiring JSON forces a CORS preflight for cross-origin callers, which
  // blocks "simple request" CSRF against the public write endpoints.
  if (!type.includes("application/json")) {
    return { ok: false, status: 415, error: "Content-Type must be application/json" };
  }
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, error: "Payload too large" };
  }
  try {
    const reader = req.body?.getReader();
    if (!reader) return { ok: false, status: 400, error: "Invalid JSON" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: "Payload too large" };
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
}
