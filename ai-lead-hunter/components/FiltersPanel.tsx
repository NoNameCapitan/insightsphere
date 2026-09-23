"use client";

import type { NicheKey, SearchFilters, SortKey } from "@/lib/types";
import { NICHE_OPTIONS, SORT_OPTIONS } from "@/lib/options";
import { cn } from "@/lib/utils";

export type FilterState = SearchFilters & { sort: SortKey };

const TOGGLES: Array<{ key: keyof SearchFilters; label: string }> = [
  { key: "noWebsite", label: "Без сайту" },
  { key: "hasWebsite", label: "З сайтом" },
  { key: "hasPhone", label: "Є телефон" },
  { key: "hotOnly", label: "Тільки гарячі" },
  { key: "needsManualReview", label: "Потребує перевірки" },
  { key: "openNow", label: "Відкрито зараз" },
];

export default function FiltersPanel({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
}) {
  function toggle(key: keyof SearchFilters) {
    const next: FilterState = { ...filters, [key]: !filters[key] };
    // Avoid impossible combinations: a lead can't be both with and without a site.
    if (key === "noWebsite" && next.noWebsite) next.hasWebsite = false;
    if (key === "hasWebsite" && next.hasWebsite) next.noWebsite = false;
    onChange(next);
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {TOGGLES.map((t) => (
          <button
            key={t.key}
            onClick={() => toggle(t.key)}
            aria-pressed={!!filters[t.key]}
            className={cn(
              "chip border transition",
              filters[t.key]
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <span className="label">Рейтинг від</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="5"
            className="input"
            aria-label="Рейтинг від"
            value={filters.ratingAbove ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                ratingAbove: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </div>
        <div>
          <span className="label">Рейтинг до</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="5"
            className="input"
            aria-label="Рейтинг до"
            value={filters.ratingBelow ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                ratingBelow: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </div>
        <div>
          <span className="label">Мін. відгуків</span>
          <input
            type="number"
            min="0"
            className="input"
            aria-label="Мінімальна кількість відгуків"
            value={filters.minReviews ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                minReviews: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
        <div>
          <span className="label">Категорія</span>
          <select
            className="input"
            aria-label="Категорія бізнесу"
            value={filters.category ?? "all"}
            onChange={(e) =>
              onChange({
                ...filters,
                category: e.target.value as NicheKey | "all",
              })
            }
          >
            <option value="all">Усі</option>
            {NICHE_OPTIONS.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <span className="label">Сортувати за</span>
        <div className="flex flex-wrap gap-1">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange({ ...filters, sort: s.value })}
              aria-pressed={filters.sort === s.value}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                filters.sort === s.value
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
