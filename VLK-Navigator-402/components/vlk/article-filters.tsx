"use client";

import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { OUTCOME_FILTERS, type OutcomeFilterId } from "@/lib/vlk-outcomes";

type Props = {
  outcome: OutcomeFilterId;
  point: string;
  points: readonly string[];
  onOutcomeChange: (value: OutcomeFilterId) => void;
  onPointChange: (value: string) => void;
  showReset?: boolean;
};

export function ArticleFilters({ outcome, point, points, onOutcomeChange, onPointChange, showReset = true }: Props) {
  const id = useId();
  const active = outcome !== "all" || point !== "all";
  // Keep a chosen value available when the doctor opens a different article.
  const options = point === "all" || points.includes(point) ? points : [...points, point];
  return <fieldset className="article-filters">
    <legend className="sr-only">Фільтри нормативних пунктів</legend>
    <div>
      <label htmlFor={`${id}-outcome`}>Норма для категорії</label>
      <select id={`${id}-outcome`} value={outcome}
        onChange={(event) => onOutcomeChange(event.target.value as OutcomeFilterId)}>
        {OUTCOME_FILTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor={`${id}-point`}>Пункт статті</label>
      <select id={`${id}-point`} value={point} onChange={(event) => onPointChange(event.target.value)}>
        <option value="all">Усі пункти</option>
        {options.map((item) => <option key={item} value={item}>{item === "—" ? "Без поділу" : `Пункт «${item}»`}</option>)}
      </select>
    </div>
    {active && showReset ? <button type="button" className="filter-reset" onClick={() => {
      onOutcomeChange("all"); onPointChange("all");
    }}><RotateCcw className="size-3.5" aria-hidden="true" />Скинути фільтри</button> : null}
  </fieldset>;
}
