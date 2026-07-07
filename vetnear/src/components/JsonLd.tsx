import { safeJsonLd } from "@/lib/security/jsonLd";

/** Renders a JSON-LD <script> block with XSS-safe escaping. Server-safe. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

/** Compact, always-visible disclaimer. Required on result/detail surfaces. */
export function Disclaimer({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      role="note"
      className={`rounded-2xl border border-amber/30 bg-amber/5 px-4 py-3 text-sm text-ink/70 ${className}`}
    >
      <span aria-hidden className="mr-1.5">⚠️</span>
      {text}
    </p>
  );
}
