import type { SpecialtyId, VlkArticle } from "./vlk-sample-data.ts";
import { TDV_COLUMNS } from "./vlk-tdv.ts";

/** Preserve a compatible doctor's context; an explicit destination takes priority. */
export function articleNavigationSpecialty(
  article: Pick<VlkArticle, "specialties">,
  current: SpecialtyId | "" = "",
  preferred?: SpecialtyId,
): SpecialtyId {
  if (preferred && article.specialties.includes(preferred)) return preferred;
  if (current && article.specialties.includes(current)) return current;
  return article.specialties[0];
}

/** A presentation-only projection. It never changes the examination context. */
export function tdvColumnsForView(selectedColumn?: number, showAll = false) {
  const selected = TDV_COLUMNS.find((column) => column.id === selectedColumn);
  return selected && !showAll ? [selected] : TDV_COLUMNS;
}

/**
 * Reveal a cell or row inside its own scroll container, accounting for a sticky
 * leading column. Inputs use content coordinates; the page is never scrolled.
 */
export function scrollOffsetToReveal({
  start, end, viewportSize, scrollOffset, scrollSize, leadingInset = 0,
}: {
  start: number;
  end: number;
  viewportSize: number;
  scrollOffset: number;
  scrollSize: number;
  leadingInset?: number;
}) {
  const maximum = Math.max(0, scrollSize - viewportSize);
  const clamp = (value: number) => Math.max(0, Math.min(maximum, value));
  const current = clamp(scrollOffset);
  if (viewportSize <= leadingInset || end <= start) return current;
  const visibleStart = current + leadingInset;
  const visibleEnd = current + viewportSize;
  if (start < visibleStart || end - start > viewportSize - leadingInset) {
    return clamp(start - leadingInset);
  }
  if (end > visibleEnd) return clamp(end - viewportSize);
  return current;
}
