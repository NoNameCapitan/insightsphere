"use client";

import { useRef, useState } from "react";
import { PLACES } from "@/lib/data/places";
import { isSearchablePublicPlace } from "@/lib/data/provenance";

/**
 * Compact homepage trust strip: one always-visible summary line plus four
 * small disclosure buttons. Desktop shows a floating popover on hover or
 * keyboard focus (no layout shift); mobile expands a full-width panel under
 * the strip on tap. Every panel is reachable without hover (click/tap/focus),
 * buttons carry aria-expanded/aria-controls, and Escape closes the open one.
 */

const PUBLIC = PLACES.filter(isSearchablePublicPlace);
const TOTAL = PUBLIC.length;
const VERIFIED = PUBLIC.filter((p) => p.verificationStatus === "verified").length;
const PENDING = PUBLIC.filter((p) => p.verificationStatus === "needs_review").length;

/** Ukrainian plural form for "місце" (1 місце / 2 місця / 5 місць). */
function placesWord(n: number): string {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return "місце";
  if (d >= 2 && d <= 4 && (h < 10 || h > 20)) return "місця";
  return "місць";
}

const ITEMS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "🛡️",
    title: "Безпечний сервіс",
    body:
      "VetNear не замінює консультацію ветеринара, не ставить діагнози й не " +
      "призначає лікування. Сервіс допомагає швидко знайти найближчий заклад " +
      "та підказує маршрут.",
  },
  {
    emoji: "📊",
    title: "Пілотна база Києва",
    body:
      `Пілотна база Києва містить ${TOTAL} ${placesWord(TOTAL)}, з них ${VERIFIED} ` +
      `перевірено за публічними джерелами. ${PENDING} очікують ручної перевірки. ` +
      "Дані можуть змінюватися, тому перед візитом зателефонуйте.",
  },
  {
    emoji: "💚",
    title: "Чому VetNear",
    body:
      "VetNear створюється як сервіс, який визначає вашу потребу, тип тварини " +
      "та найближчі релевантні заклади, а не просто показує загальний список місць.",
  },
  {
    emoji: "🤝",
    title: "Соціальний внесок",
    body:
      "10% від платних партнерських і рекламних доходів VetNear буде спрямовано " +
      "на реабілітацію та протезування людей, які постраждали внаслідок " +
      "російсько-української війни, після запуску платних планів.",
  },
];

export function TrustStrip({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const hoverable = () =>
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  return (
    <section
      className={`container-px mx-auto max-w-3xl ${className}`}
      onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
    >
      {/* Always-visible trust summary. */}
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs font-medium text-ink/55">
        <span>Пілотна база Києва</span>
        <span aria-hidden>·</span>
        <span>
          {TOTAL} {placesWord(TOTAL)}
        </span>
        <span aria-hidden>·</span>
        <span>{VERIFIED} перевірено</span>
        <span aria-hidden>·</span>
        <span>VetNear не замінює ветеринара</span>
      </p>

      <div ref={stripRef} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ITEMS.map((item, i) => (
          <div
            key={item.title}
            className="relative"
            onMouseEnter={() => hoverable() && setOpen(i)}
            onMouseLeave={() => hoverable() && setOpen((o) => (o === i ? null : o))}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setOpen((o) => (o === i ? null : o));
            }}
          >
            <button
              type="button"
              aria-expanded={open === i}
              aria-controls="trust-strip-panel"
              onClick={() => setOpen((o) => (o === i ? null : i))}
              onFocus={(e) => {
                // Keyboard focus reveals the content; mouse clicks are handled
                // by onClick alone so toggling doesn't fight the focus event.
                if (e.target.matches(":focus-visible")) setOpen(i);
              }}
              className={`flex w-full items-center justify-center gap-1 rounded-2xl border px-1.5 py-2.5 text-xs font-semibold transition ${
                open === i
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-brand-100 bg-surface text-ink/70 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              <span aria-hidden>{item.emoji}</span>
              <span className="truncate">{item.title}</span>
            </button>

            {/* Desktop popover — floats over content, so no layout shift. */}
            {open === i && (
              <div
                aria-hidden
                className="trust-strip__popover absolute left-1/2 top-[calc(100%+8px)] z-30 hidden w-72 max-w-[80vw] -translate-x-1/2 rounded-2xl border border-brand-100 bg-surface p-4 text-left text-xs leading-relaxed text-ink/75 shadow-pop sm:block"
              >
                {item.body}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile inline panel — full width under the strip (layout shift OK). */}
      <div
        id="trust-strip-panel"
        hidden={open === null}
        className="mt-2 rounded-2xl border border-brand-100 bg-surface p-4 text-xs leading-relaxed text-ink/75 sm:sr-only"
      >
        {open !== null && ITEMS[open].body}
      </div>
    </section>
  );
}
