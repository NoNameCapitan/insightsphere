"use client";

import { TdvContext } from "@/components/vlk/tdv-context";
import { VlkDialogContent } from "@/components/vlk/dialog-content";

import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TDV_DOCX_URL, TDV_URL } from "@/lib/vlk-links";
import { ARTICLE_RULES } from "@/lib/vlk-rules";
import { ARTICLES, type VlkArticle } from "@/lib/vlk-sample-data";
import { TDV_COLUMNS, TDV_RULES } from "@/lib/vlk-tdv";
import { getPointTdv } from "@/lib/vlk-point-tdv";
import { TDV_GENERAL_ROWS } from "@/lib/vlk-tdv-general";
import { scrollOffsetToReveal, tdvColumnsForView } from "@/lib/vlk-reading-navigation";

type TdvRow = {
  key: string;
  article: string;
  title: string;
  point: string;
  condition: string;
  marks: Record<number, string>;
};

function pointTitle(point: string) {
  return point === "—" ? "уся стаття" : `пункт «${point}»`;
}

/** Родовий відмінок для формулювань «позначки для…». */
function pointTitleGenitive(point: string) {
  return point === "—" ? "статті без поділу на пункти" : `пункту «${point}»`;
}

/**
 * Усі рядки Додатка 3 у порядку статей: ключ «49» стосується статті загалом,
 * ключ «49-б» — конкретного пункту.
 */
function buildRows(): TdvRow[] {
  const rows: TdvRow[] = [];
  for (const [key, marks] of Object.entries(TDV_RULES)) {
    const [articleNumber, point = "—"] = key.split("-");
    const article = ARTICLES.find((item) => item.article === articleNumber);
    const rule = (ARTICLE_RULES[articleNumber] ?? []).find((item) => item.point === point);
    rows.push({
      key,
      article: articleNumber,
      title: article?.title ?? "",
      point,
      condition: rule?.condition ?? "",
      marks,
    });
  }
  return rows.sort(
    (a, b) => Number(a.article) - Number(b.article) || a.point.localeCompare(b.point, "uk"),
  );
}

const TDV_ROWS = buildRows();
const TDV_ARTICLE_COUNT = new Set(TDV_ROWS.map((row) => row.article)).size;

/**
 * Сітка таблиці: чорні лінії малюються на кожній клітинці окремо
 * (border-separate), щоб вони не зникали під час прокручування під
 * закріпленою шапкою та закріпленим першим стовпцем.
 */
const CELL_GRID = "border-b border-r border-black";
/** Потовщена лінія під шапкою та між статтями. */
const HEAD_GRID = "border-b-2 border-r border-black";
const GROUP_GRID = "border-t-2 border-black";

function tdvRowFor(article: string, point: string) {
  return getPointTdv(article, point)?.marks;
}

/**
 * Повна таблиця додаткових вимог на весь екран.
 *
 * Показує всі рядки Додатка 3. Якщо призначення обрано, спочатку показує
 * його графу; інша графа або всі 12 доступні через поле перегляду. Вибраний рядок і графа
 * підсвічені; повна назва призначення доступна без горизонтального скролу.
 */
export function TdvDialog({
  article,
  selectedPoint,
  selectedColumn,
  trigger,
}: {
  /** Стаття, рядок якої треба підсвітити. Без неї таблиця відкривається повністю. */
  article?: VlkArticle;
  selectedPoint?: string;
  selectedColumn?: number;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [viewColumn, setViewColumn] = useState<number | undefined>(selectedColumn);
  const viewId = useId();
  const selectedDestination = TDV_COLUMNS.find((column) => column.id === viewColumn);
  const visibleColumns = tdvColumnsForView(viewColumn);
  const focusedColumn = visibleColumns.length === 1;
  const tableRef = useRef<HTMLTableElement>(null);
  const activeRowRef = useRef<HTMLTableRowElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeMarks =
    article && selectedPoint ? tdvRowFor(article.article, selectedPoint) : undefined;
  const articleRows = article ? TDV_ROWS.filter((row) => row.article === article.article) : [];
  const articleRowCount = articleRows.length;
  // Прокручуємо до рядка вибраного пункту, а якщо пункт ще не обраний —
  // до першого рядка відкритої статті.
  const scrollKey =
    (article && selectedPoint ? getPointTdv(article.article, selectedPoint)?.sourceRowKey : undefined) ?? articleRows[0]?.key;

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const row = activeRowRef.current;
      const container = scrollRef.current;
      if (!container) return;
      // Scroll only this region, never the page or a dialog's ancestors.
      if (row) {
        const offset = row.getBoundingClientRect().top - container.getBoundingClientRect().top;
        container.scrollTop += offset - (container.clientHeight - row.clientHeight) / 2;
      }
      const column = tableRef.current?.querySelector<HTMLTableCellElement>('thead [data-context-column="true"]');
      const firstColumn = tableRef.current?.querySelector<HTMLTableCellElement>("thead th");
      if (column && firstColumn && !focusedColumn) {
        const start = column.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
        container.scrollLeft = scrollOffsetToReveal({ start, end: start + column.offsetWidth,
          viewportSize: container.clientWidth, scrollOffset: container.scrollLeft,
          scrollSize: container.scrollWidth, leadingInset: firstColumn.offsetWidth + 8 });
      } else {
        container.scrollLeft = 0;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, scrollKey, selectedColumn, viewColumn, focusedColumn]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) setViewColumn(selectedColumn);
      setOpen(nextOpen);
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <VlkDialogContent variant="fullscreen" className="table-fullscreen flex flex-col gap-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="relative shrink-0 border-b border-[var(--foreground)]/10 p-3 pr-32 text-left">
          <DialogClose asChild><Button variant="outline" className="absolute right-3 top-3 min-h-11"><X />Закрити</Button></DialogClose>
          <DialogTitle className="text-base">
            Таблиця додаткових вимог · Додаток 3 до Наказу №402
          </DialogTitle>
          <DialogDescription>
            Загальні вимоги (зріст, вага, зір, слух) та всі {TDV_ROWS.length} рядків для{" "}
            {TDV_ARTICLE_COUNT} статей Розкладу хвороб.
            {article
              ? ` Підсвічено статтю ${article.article}${articleRowCount ? "" : " (окремого рядка ТДВ не має)"}.`
              : ""}{" "}
            Порожня клітинка не є автоматичним підтвердженням придатності.
          </DialogDescription>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button asChild variant="outline" size="sm" className="h-9 text-[11px]">
              <a href={TDV_URL} target="_blank" rel="noreferrer">
                Офіційна таблиця <ExternalLink />
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-9 text-[11px]">
              <a href={TDV_DOCX_URL} target="_blank" rel="noreferrer">
                DOCX <ExternalLink />
              </a>
            </Button>
          </div>
        </DialogHeader>

        <div className="tdv-view-toolbar">
          <div className="tdv-view-picker">
            <label htmlFor={viewId}>Графа для перегляду</label>
            <select id={viewId} value={viewColumn ?? "all"} onChange={(event) => setViewColumn(event.target.value === "all" ? undefined : Number(event.target.value))}>
              <option value="all">Усі 12 граф</option>
              {TDV_COLUMNS.map((column) => <option key={column.id} value={column.id}>Графа {column.id} · {column.label}</option>)}
            </select>
            <span>Лише перегляд · призначення огляду: {selectedColumn ? `ТДВ ${selectedColumn}` : "не уточнено"}</span>
          </div>
          {selectedDestination ? <details className="tdv-destination">
            <summary>Призначення · графа {selectedDestination.id}</summary>
            <p>{selectedDestination.label}</p>
          </details> : null}
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-2 sm:p-4 scrollbar-thin" role="region"
          aria-label={focusedColumn ? `ТДВ · обрана графа ${selectedDestination?.id}` : "Повна таблиця ТДВ"} tabIndex={0}>
          <table ref={tableRef} data-focused-column={focusedColumn || undefined} className="tdv-table w-full min-w-[760px] table-fixed border-separate border-spacing-0 border-l border-t border-black text-left">
            <caption className="sr-only">
              {focusedColumn ? `Графа ${selectedDestination?.id} Додатка 3. Усі рядки; решта граф доступна у полі «Графа для перегляду».` : "Позначки «НП» за 12 графами Додатка 3 для кожної статті та пункту"}
            </caption>
            <thead className="sticky top-0 z-20">
              <tr className="bg-[var(--surface-sunken)]">
                <th
                  scope="col"
                  className={`sticky left-0 z-30 w-[190px] min-w-[190px] bg-[var(--surface-sunken)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--accent-ink)] ${HEAD_GRID}`}
                >
                  Стаття · пункт
                </th>
                {visibleColumns.map((column) => (
                  <th
                    key={column.id}
                          data-context-column={column.id === (viewColumn ?? selectedColumn) || undefined}
                    scope="col"
                    title={column.label}
                    className={`bg-[var(--surface-sunken)] px-2 py-2 text-center text-[11px] font-black text-[var(--accent-ink)] ${HEAD_GRID}`}
                  >
                    <TdvContext columnId={column.id}>{focusedColumn ? `Графа ${column.id}` : column.id}</TdvContext>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={visibleColumns.length + 1}
                  className={`sticky left-0 bg-[var(--surface-sunken)] px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.1em] text-[var(--accent-ink)] ${CELL_GRID} ${GROUP_GRID}`}
                >
                  Загальні вимоги до стану здоров’я · передують статті 1
                </th>
              </tr>
              {TDV_GENERAL_ROWS.map((row, index) => {
                const startsGroup =
                  index === 0 ||
                  (TDV_GENERAL_ROWS[index - 1].group ?? TDV_GENERAL_ROWS[index - 1].label) !==
                    (row.group ?? row.label);
                const groupBorder = startsGroup ? GROUP_GRID : "";
                return (
                  <tr key={row.id} className="bg-card">
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 w-[190px] min-w-[190px] bg-card px-3 py-2 text-left align-top text-[11px] font-bold ${CELL_GRID} ${groupBorder}`}
                    >
                      {row.group ? (
                        <span className="block text-[var(--accent-ink)]">{row.group}</span>
                      ) : null}
                      <span className="block font-bold">{row.label}</span>
                      {row.note ? (
                        <span className="mt-0.5 block text-[10px] font-normal leading-4 text-[var(--warning-ink)]">
                          {row.note}
                        </span>
                      ) : null}
                    </th>
                    {visibleColumns.map((column) => {
                      const value = row.values[column.id];
                      return (
                        <td
                          key={column.id}
                          data-context-column={column.id === (viewColumn ?? selectedColumn) || undefined}
                          className={`px-2 py-2 text-center align-middle text-[11px] leading-4 ${CELL_GRID} ${groupBorder} ${value ? "font-bold text-[var(--accent-ink-strong)]" : "text-[var(--ink-muted)]"}`}
                        >
                          {value ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr>
                <th
                  scope="colgroup"
                  colSpan={visibleColumns.length + 1}
                  className={`sticky left-0 bg-[var(--surface-sunken)] px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.1em] text-[var(--accent-ink)] ${CELL_GRID} ${GROUP_GRID}`}
                >
                  Статті Розкладу хвороб
                </th>
              </tr>
              {TDV_ROWS.map((row, index) => {
                const sameArticle = Boolean(article) && row.article === article?.article;
                // Кожна стаття відокремлена від попередньої потовщеною лінією.
                const startsArticle = index === 0 || TDV_ROWS[index - 1].article !== row.article;
                const groupBorder = startsArticle ? GROUP_GRID : "";
                const active = sameArticle && Boolean(activeMarks) && row.key === scrollKey;
                const background = active ? "bg-[var(--warning-bg)]" : sameArticle ? "bg-[var(--positive-bg)]" : "bg-card";
                return (
                  <tr
                    key={row.key}
                    ref={row.key === scrollKey ? activeRowRef : undefined}
                    aria-current={active ? "true" : undefined}
                    className={background}
                  >
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 w-[190px] min-w-[190px] px-3 py-2 text-left align-top text-[11px] font-bold ${background} ${CELL_GRID} ${groupBorder}`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-black ${sameArticle ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--accent-ink-strong)]"}`}
                        >
                          {row.article}
                        </span>
                        <span>{pointTitle(row.point)}</span>
                      </span>
                    </th>
                    {visibleColumns.map((column) => {
                      const mark = row.marks[column.id];
                      return (
                        <td
                          key={column.id}
                          data-context-column={column.id === (viewColumn ?? selectedColumn) || undefined}
                          className={`px-2 py-2 text-center text-[11px] font-black ${CELL_GRID} ${groupBorder} ${mark ? "text-[var(--critical-ink)]" : "text-[var(--ink-muted)]"}`}
                        >
                          {mark ? <TdvContext columnId={column.id} mark={mark}>{mark}</TdvContext> : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-3 text-[10px] leading-4 text-[var(--warning-ink)]">
            Загальні вимоги (зріст, вага, гострота зору, кольоровідчуття, поля зору, рефракція,
            слух) внесені дослівно з наданого фрагмента Додатка 3 редакції від 22.08.2025.
            Перед використанням у постанові звірте їх з офіційною таблицею за посиланням угорі.
          </p>

          <h3 className="mt-5 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ink-soft)]">
            {focusedColumn ? "Призначення обраної графи" : "Повні назви граф"}{selectedPoint ? ` · позначки для ${pointTitleGenitive(selectedPoint)}` : ""}
          </h3>
          <div className="mt-2.5 grid gap-2 lg:grid-cols-2">
            {visibleColumns.map((column) => {
              const mark = activeMarks?.[column.id];
              return (
                <div
                  key={column.id}
                          data-context-column={column.id === (viewColumn ?? selectedColumn) || undefined}
                  className={`flex items-start gap-2 border border-black p-2 ${mark ? "bg-[var(--critical-bg)]" : "bg-card"}`}
                >
                  <span className="grid size-6 shrink-0 place-items-center border border-black bg-[var(--secondary)] text-[10px] font-black">
                    {column.id}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] leading-4">{column.label}</p>
                    {selectedPoint ? (
                      <p className={`mt-1 text-[10px] font-black ${mark ? "text-[var(--critical-ink)]" : "text-[var(--ink-muted)]"}`}>
                        {mark ?? "Окремої позначки НП немає"}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </VlkDialogContent>
    </Dialog>
  );
}
