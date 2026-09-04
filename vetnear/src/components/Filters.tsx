"use client";

import {
  ALL_ANIMALS,
  ALL_CATEGORIES,
  ALL_DISTRICTS,
  ANIMAL_LABELS,
  CATEGORY_LABELS,
  DISTRICT_LABELS,
} from "@/lib/labels";
import { PLACES } from "@/lib/data/places";
import { hasPhoneConfirmedEmergency } from "@/lib/data/verification";
import type { FilterState, SortKey } from "@/lib/types";

// Only surface emergency filters when phone-confirmed emergency providers exist.
const SHOW_EMERGENCY = hasPhoneConfirmedEmergency(PLACES);

// Emergency category is shown only when confirmed providers exist, and labelled honestly.
const FILTER_CATEGORIES = ALL_CATEGORIES.filter((c) => c !== "emergency_vet" || SHOW_EMERGENCY);
const filterCategoryLabel = (c: (typeof ALL_CATEGORIES)[number]) =>
  c === "emergency_vet" ? "Термінова ситуація" : CATEGORY_LABELS[c];

const ALL_SORTS: { key: SortKey; label: string }[] = [
  { key: "distance", label: "За відстанню" },
  { key: "pet_match", label: "Підходить улюбленцю" },
  { key: "open_now", label: "Відкрито зараз" },
  { key: "emergency", label: "Термінова ситуація" },
  { key: "verified", label: "Перевірені" },
  { key: "recent", label: "Нещодавно оновлені" },
  { key: "rating", label: "За рейтингом" },
];
const SORTS = ALL_SORTS.filter((s) => s.key !== "emergency" || SHOW_EMERGENCY);

export function FiltersBar({
  filters,
  onChange,
  onReset,
}: {
  filters: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  onReset: () => void;
}) {
  const sel =
    "rounded-xl border border-brand-100 bg-surface px-3 py-2 text-sm text-ink";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          aria-label="Категорія"
          className={sel}
          value={filters.category}
          onChange={(e) => onChange({ category: e.target.value as FilterState["category"] })}
        >
          <option value="all">Усі категорії</option>
          {FILTER_CATEGORIES.map((c) => (
            <option key={c} value={c}>{filterCategoryLabel(c)}</option>
          ))}
        </select>

        <select
          aria-label="Тварина"
          className={sel}
          value={filters.animal}
          onChange={(e) => onChange({ animal: e.target.value as FilterState["animal"] })}
        >
          <option value="all">Усі тварини</option>
          {ALL_ANIMALS.map((a) => (
            <option key={a} value={a}>{ANIMAL_LABELS[a]}</option>
          ))}
        </select>

        <select
          aria-label="Район"
          className={sel}
          value={filters.district}
          onChange={(e) => onChange({ district: e.target.value as FilterState["district"] })}
        >
          <option value="all">Усі райони</option>
          {ALL_DISTRICTS.map((d) => (
            <option key={d} value={d}>{DISTRICT_LABELS[d]}</option>
          ))}
        </select>

        <select
          aria-label="Сортування"
          className={sel}
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as SortKey })}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle on={filters.openNow} onClick={() => onChange({ openNow: !filters.openNow })}>
          Відкрито зараз
        </Toggle>
        {SHOW_EMERGENCY && (
          <Toggle on={filters.emergency} onClick={() => onChange({ emergency: !filters.emergency })}>
            Термінова ситуація
          </Toggle>
        )}
        <Toggle on={filters.verified} onClick={() => onChange({ verified: !filters.verified })}>
          Перевірені
        </Toggle>
        <button
          onClick={onReset}
          className="ml-auto rounded-full px-3 py-1.5 text-sm text-ink/60 hover:text-ink"
        >
          Скинути
        </button>
      </div>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        on
          ? "border-brand bg-brand text-white"
          : "border-brand-100 bg-surface text-ink/70 hover:border-brand"
      }`}
    >
      {children}
    </button>
  );
}
