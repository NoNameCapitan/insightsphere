"use client";

import { RADII } from "@/lib/geo/ranking";
import type { RadiusMeters } from "@/lib/types";

const LABEL: Record<RadiusMeters, string> = {
  1000: "1 км",
  2000: "2 км",
  3000: "3 км",
  5000: "5 км",
  10000: "10 км",
  25000: "25 км",
  50000: "50 км",
  100000: "100 км",
};

/** Concentric-rings glyph + segmented radius control (the VetNear signature). */
export function RadiusSelector({
  value,
  onChange,
}: {
  value: RadiusMeters;
  onChange: (r: RadiusMeters) => void;
}) {
  const activeIdx = RADII.indexOf(value);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="relative hidden h-9 w-9 shrink-0 place-items-center sm:grid">
        {RADII.slice(0, 5).map((_, i) => (
          <span
            key={i}
            className={`absolute rounded-full border ${
              i <= activeIdx ? "border-brand" : "border-brand-100"
            }`}
            style={{ width: 8 + i * 7, height: 8 + i * 7 }}
          />
        ))}
      </span>
      <div
        role="radiogroup"
        aria-label="Радіус пошуку"
        className="flex min-w-0 flex-1 overflow-x-auto rounded-2xl border border-brand-100"
      >
        {RADII.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={r === value}
            tabIndex={r === value ? 0 : -1}
            onKeyDown={(event) => {
              const index = RADII.indexOf(r);
              let next = index;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % RADII.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + RADII.length - 1) % RADII.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = RADII.length - 1;
              else return;
              event.preventDefault();
              onChange(RADII[next]);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
            }}
            onClick={() => onChange(r)}
            className={`min-h-11 min-w-12 shrink-0 flex-1 whitespace-nowrap px-2 py-2 text-xs font-medium transition ${
              r === value ? "bg-brand text-white" : "bg-surface text-ink/70 hover:bg-brand-50"
            }`}
          >
            {LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
