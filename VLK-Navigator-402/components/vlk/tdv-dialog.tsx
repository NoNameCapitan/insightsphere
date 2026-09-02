"use client";

import { ExternalLink, Maximize2 } from "lucide-react";

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
import type { VlkArticle } from "@/lib/vlk-sample-data";
import { TDV_COLUMNS, TDV_RULES } from "@/lib/vlk-tdv";

function tdvRowFor(article: string, point: string) {
  return TDV_RULES[point === "—" ? article : `${article}-${point}`] ?? TDV_RULES[article];
}

function pointTitle(point: string) {
  return point === "—" ? "без поділу" : `пункт «${point}»`;
}

/** Родовий відмінок для формулювань «позначки для…». */
function pointTitleGenitive(point: string) {
  return point === "—" ? "статті без поділу на пункти" : `пункту «${point}»`;
}

/**
 * Повна таблиця додаткових вимог на весь екран.
 *
 * Показує всі 12 граф Додатка 3 для кожного пункту вибраної статті: угорі —
 * матриця «пункт × графа», нижче — повні назви граф із позначками для
 * вибраного пункту, щоб не гортати таблицю вбік.
 */
export function TdvDialog({
  article,
  selectedPoint,
  trigger,
}: {
  article: VlkArticle;
  selectedPoint?: string;
  trigger: React.ReactNode;
}) {
  const rules = ARTICLE_RULES[article.article] ?? [];
  const rows = rules.map((rule) => ({ rule, marks: tdvRowFor(article.article, rule.point) }));
  const activeMarks = selectedPoint ? tdvRowFor(article.article, selectedPoint) : undefined;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        showCloseButton
        className="flex h-[94vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]"
      >
        <DialogHeader className="shrink-0 border-b border-[#173f40]/10 p-4 pr-12 text-left">
          <DialogTitle className="text-base">
            Таблиця додаткових вимог · Додаток 3 до Наказу №402
          </DialogTitle>
          <DialogDescription>
            Стаття {article.article} — {article.title}. Порожня клітинка не є автоматичним
            підтвердженням придатності.
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

        <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
          <div className="overflow-x-auto rounded-lg border border-[#173f40]/12">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <caption className="sr-only">
                Позначки «НП» за графами Додатка 3 для пунктів статті {article.article}
              </caption>
              <thead>
                <tr className="bg-[#eef3f0]">
                  <th scope="col" className="sticky left-0 z-10 bg-[#eef3f0] px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#34736d]">
                    Пункт
                  </th>
                  {TDV_COLUMNS.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      title={column.label}
                      className="px-2 py-2 text-center text-[11px] font-black text-[#34736d]"
                    >
                      {column.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ rule, marks }) => {
                  const active = selectedPoint === rule.point;
                  return (
                    <tr
                      key={`${article.article}-${rule.point}`}
                      className={`border-t border-[#173f40]/10 ${active ? "bg-[#fff8e7]" : "bg-white"}`}
                    >
                      <th
                        scope="row"
                        className={`sticky left-0 z-10 max-w-[240px] px-3 py-2 text-left align-top text-[11px] font-bold ${active ? "bg-[#fff8e7]" : "bg-white"}`}
                      >
                        {pointTitle(rule.point)}
                        <span className="mt-0.5 block max-w-[220px] text-[10px] font-normal leading-4 text-[#5f7573]">
                          {rule.condition}
                        </span>
                      </th>
                      {TDV_COLUMNS.map((column) => {
                        const mark = marks?.[column.id];
                        return (
                          <td
                            key={column.id}
                            className={`px-2 py-2 text-center text-[11px] font-black ${mark ? "bg-[#fff1ef] text-[#8a3030]" : "text-[#9aa9a7]"}`}
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
          </div>

          <h3 className="mt-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#50716e]">
            Повні назви граф{selectedPoint ? ` · позначки для ${pointTitleGenitive(selectedPoint)}` : ""}
          </h3>
          <div className="mt-2 grid gap-1.5 lg:grid-cols-2">
            {TDV_COLUMNS.map((column) => {
              const mark = activeMarks?.[column.id];
              return (
                <div
                  key={column.id}
                  className={`flex items-start gap-2 rounded-md border p-2 ${mark ? "border-[#ba4a4a]/18 bg-[#fff3f1]" : "border-[#173f40]/10 bg-white"}`}
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#e7eeea] text-[10px] font-black">
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

export { Maximize2 as TdvExpandIcon };
