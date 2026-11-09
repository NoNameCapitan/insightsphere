"use client";

import { RADII } from "@/lib/geo/ranking";
import type { RadiusMeters } from "@/lib/types";

const LABEL: Record<RadiusMeters, string> = {
  1000: "1 км",
  2000: "2 км",
  3000: "3 км",
  5000: "5 км",
  10000: "10 км",
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
    <div className="flex items-center gap-3">
      <span aria-hidden className="relative grid h-9 w-9 place-items-center">
        {RADII.map((_, i) => (
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
        className="flex flex-1 overflow-hidden rounded-2xl border border-brand-100"
      >
        {RADII.map((r) => (
          <button
            key={r}
            role="radio"
            aria-checked={r === value}
            onClick={() => onChange(r)}
            className={`flex-1 px-2 py-2 text-sm font-medium transition ${
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
