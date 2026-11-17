"use client";

import { useEffect, useRef, useState } from "react";
import { FilterIcon } from "@/components/icons/ServiceIcons";

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
  { key: "open_now", label: "Відкрито за графіком" },
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
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  const activeCount = [
    filters.category !== "all",
    filters.animal !== "all",
    filters.district !== "all",
    filters.openNow,
    filters.emergency,
    filters.verified,
    filters.sort !== "distance",
  ].filter(Boolean).length;
  const sel =
    "min-h-11 min-w-0 rounded-xl border border-brand-100 bg-surface px-3 py-2 text-sm text-ink";
  return (
    <div ref={panel} className="relative rounded-2xl border border-brand-100 bg-white">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="nearby-advanced-filters"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[50px] w-full items-center gap-2 px-3 text-left text-sm font-semibold text-ink"
      >
        <FilterIcon className="h-5 w-5 shrink-0" />
        <span className="flex-1">Фільтри</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{activeCount}</span>
        )}
        <span aria-hidden className={`text-brand transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      <div id="nearby-advanced-filters" hidden={!open} className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-[70dvh] w-[min(680px,calc(100vw-2rem))] space-y-3 overflow-y-auto rounded-2xl border border-brand-100 bg-white p-3.5 shadow-pop">
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

        {filters.region !== "kyiv_oblast" && <select
          aria-label="Район"
          className={sel}
          value={filters.district}
          onChange={(e) => onChange({ district: e.target.value as FilterState["district"], ...(e.target.value !== "all" ? { region: "kyiv_city", locality: "" } : {}) })}
        >
          <option value="all">Усі райони</option>
          {ALL_DISTRICTS.map((d) => (
            <option key={d} value={d}>{DISTRICT_LABELS[d]}</option>
          ))}
        </select>}

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
          Відкрито за графіком
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
          className="ml-auto min-h-11 rounded-full px-3 py-1.5 text-sm text-ink/60 hover:text-ink"
        >
          Скинути
        </button>
      </div>
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
      className={`min-h-11 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        on
          ? "border-brand bg-brand text-white"
          : "border-brand-100 bg-surface text-ink/70 hover:border-brand"
      }`}
    >
      {children}
    </button>
  );
}
