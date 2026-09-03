"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TDV_DOCX_URL, TDV_URL } from "@/lib/vlk-links";
import { ARTICLE_RULES } from "@/lib/vlk-rules";
import { ARTICLES, type VlkArticle } from "@/lib/vlk-sample-data";
import { TDV_COLUMNS, TDV_RULES } from "@/lib/vlk-tdv";
import { TDV_GENERAL_ROWS } from "@/lib/vlk-tdv-general";

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
  return TDV_RULES[point === "—" ? article : `${article}-${point}`] ?? TDV_RULES[article];
}

/**
 * Повна таблиця додаткових вимог на весь екран.
 *
 * Показує всі рядки Додатка 3 по всіх статтях із вертикальним прокручуванням;
 * рядок відкритої статті підсвічено й прокручено у видиму зону. Нижче — повні
 * назви 12 граф, тому таблицю не треба гортати вбік, щоб зрозуміти колонки.
 */
export function TdvDialog({
  article,
  selectedPoint,
  trigger,
}: {
  /** Стаття, рядок якої треба підсвітити. Без неї таблиця відкривається повністю. */
  article?: VlkArticle;
  selectedPoint?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const activeRowRef = useRef<HTMLTableRowElement>(null);
  const activeMarks =
    article && selectedPoint ? tdvRowFor(article.article, selectedPoint) : undefined;
  const articleRows = article ? TDV_ROWS.filter((row) => row.article === article.article) : [];
  const articleRowCount = articleRows.length;
  // Прокручуємо до рядка вибраного пункту, а якщо пункт ще не обраний —
  // до першого рядка відкритої статті.
  const scrollKey =
    articleRows.find((row) => row.point === selectedPoint)?.key ?? articleRows[0]?.key;

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      activeRowRef.current?.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]">
        <DialogHeader className="shrink-0 border-b border-[#173f40]/10 p-4 pr-12 text-left">
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

        <div className="min-h-0 flex-1 overflow-auto p-4 scrollbar-thin">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 border-l border-t border-black text-left">
            <caption className="sr-only">
              Позначки «НП» за 12 графами Додатка 3 для кожної статті та пункту
            </caption>
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#eef3f0]">
                <th
                  scope="col"
                  className={`sticky left-0 z-30 w-[190px] min-w-[190px] bg-[#eef3f0] px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#34736d] ${HEAD_GRID}`}
                >
                  Стаття · пункт
                </th>
                {TDV_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    title={column.label}
                    className={`bg-[#eef3f0] px-2 py-2 text-center text-[11px] font-black text-[#34736d] ${HEAD_GRID}`}
                  >
                    {column.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={TDV_COLUMNS.length + 1}
                  className={`sticky left-0 bg-[#f4f7f5] px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.1em] text-[#34736d] ${CELL_GRID} ${GROUP_GRID}`}
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
                  <tr key={row.id} className="bg-white">
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 w-[190px] min-w-[190px] bg-white px-3 py-2 text-left align-top text-[11px] font-bold ${CELL_GRID} ${groupBorder}`}
                    >
                      {row.group ? (
                        <span className="block text-[#34736d]">{row.group}</span>
                      ) : null}
                      <span className="block font-bold">{row.label}</span>
                      {row.note ? (
                        <span className="mt-0.5 block text-[10px] font-normal leading-4 text-[#8a6a2c]">
                          {row.note}
                        </span>
                      ) : null}
                    </th>
                    {TDV_COLUMNS.map((column) => {
                      const value = row.values[column.id];
                      return (
                        <td
                          key={column.id}
                          className={`px-2 py-2 text-center align-middle text-[11px] leading-4 ${CELL_GRID} ${groupBorder} ${value ? "font-bold text-[#123f40]" : "text-[#9aa9a7]"}`}
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
                  colSpan={TDV_COLUMNS.length + 1}
                  className={`sticky left-0 bg-[#f4f7f5] px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.1em] text-[#34736d] ${CELL_GRID} ${GROUP_GRID}`}
                >
                  Статті Розкладу хвороб
                </th>
              </tr>
              {TDV_ROWS.map((row, index) => {
                const sameArticle = Boolean(article) && row.article === article?.article;
                // Кожна стаття відокремлена від попередньої потовщеною лінією.
                const startsArticle = index === 0 || TDV_ROWS[index - 1].article !== row.article;
                const groupBorder = startsArticle ? GROUP_GRID : "";
                const active = sameArticle && (selectedPoint ?? "") === row.point;
                const background = active ? "bg-[#fff8e7]" : sameArticle ? "bg-[#eef7f3]" : "bg-white";
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
                          className={`grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-black ${sameArticle ? "bg-[#123f40] text-white" : "bg-[#e7efeb] text-[#205f59]"}`}
                        >
                          {row.article}
                        </span>
                        <span>{pointTitle(row.point)}</span>
                      </span>
                    </th>
                    {TDV_COLUMNS.map((column) => {
                      const mark = row.marks[column.id];
                      return (
                        <td
                          key={column.id}
                          className={`px-2 py-2 text-center text-[11px] font-black ${CELL_GRID} ${groupBorder} ${mark ? "text-[#8a3030]" : "text-[#9aa9a7]"}`}
                        >
                          {mark ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-3 text-[10px] leading-4 text-[#6d572d]">
            Загальні вимоги (зріст, вага, гострота зору, кольоровідчуття, поля зору, рефракція,
            слух) внесені дослівно з наданого фрагмента Додатка 3 редакції від 22.08.2025.
            Перед використанням у постанові звірте їх з офіційною таблицею за посиланням угорі.
          </p>

          <h3 className="mt-5 text-[11px] font-black uppercase tracking-[0.12em] text-[#50716e]">
            Повні назви граф{selectedPoint ? ` · позначки для ${pointTitleGenitive(selectedPoint)}` : ""}
          </h3>
          <div className="mt-2 grid gap-1.5 lg:grid-cols-2">
            {TDV_COLUMNS.map((column) => {
              const mark = activeMarks?.[column.id];
              return (
                <div
                  key={column.id}
                  className={`flex items-start gap-2 border border-black p-2 ${mark ? "bg-[#fff3f1]" : "bg-white"}`}
                >
                  <span className="grid size-6 shrink-0 place-items-center border border-black bg-[#e7eeea] text-[10px] font-black">
                    {column.id}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] leading-4">{column.label}</p>
                    {selectedPoint ? (
                      <p className={`mt-1 text-[10px] font-black ${mark ? "text-[#8a3030]" : "text-[#5c7773]"}`}>
                        {mark ?? "Окремої позначки НП немає"}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
