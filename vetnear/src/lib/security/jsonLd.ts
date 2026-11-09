// Safe JSON-LD serialization (P1 — XSS hardening).
// Escapes characters that could break out of a <script> context or terminate
// the JSON-LD block. Always use this instead of raw JSON.stringify when the
// result is injected via dangerouslySetInnerHTML into an ld+json <script>.
//
// Dev check (example):
//   safeJsonLd({ x: "</script><script>alert(1)</script>" })
//   // => the "<" and ">" are emitted as \u003c / \u003e, so the payload
//   //    cannot close the script tag.
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
