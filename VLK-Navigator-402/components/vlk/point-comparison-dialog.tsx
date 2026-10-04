"use client";

import { useRef, useState } from "react";
import { Columns3, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VlkDialogContent } from "@/components/vlk/dialog-content";
import { OutcomeBadge } from "@/components/vlk/outcome-badge";
import { Highlighted } from "@/components/vlk/highlighted";
import type { ArticleRule } from "@/lib/vlk-rules";
import type { ScheduleGraph } from "@/lib/vlk-graphs";
import { EDITION } from "@/lib/vlk-sample-data";
import { officialRuleUrl } from "@/lib/vlk-links";
import { ReviewContextResult } from "@/components/vlk/review-context";
import { resolveReviewContext, type ReviewContext } from "@/lib/vlk-review-context";
import { classifyOutcome } from "@/lib/vlk-outcomes";

type Props = {
  article: string;
  title: string;
  included: string;
  rules: readonly ArticleRule[];
  selectedIndex: string;
  graph: ScheduleGraph;
  context: ReviewContext;
  query: string;
  onSelect: (index: string) => void;
};

export function PointComparisonDialog({ article, title, included, rules, selectedIndex, graph, context, query, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const navigateTo = useRef<number | null>(null);
  if (rules.length < 2) return null;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline" className="comparison-action h-9 bg-card" aria-label="Порівняти пункти">
      <Columns3 aria-hidden="true" /><span className="action-full-label">Порівняти пункти</span><span className="action-short-label" aria-hidden="true">Порівняти</span>
    </Button></DialogTrigger>
    <VlkDialogContent variant="reader" className="comparison-dialog flex flex-col gap-0 overflow-hidden p-0"
      showCloseButton={false} onCloseAutoFocus={(event) => {
        if (navigateTo.current === null) return;
        event.preventDefault();
        const index = navigateTo.current;
        navigateTo.current = null;
        requestAnimationFrame(() => {
          const row = document.getElementById(`vlk-point-${index}`);
          row?.focus({ preventScroll: true });
          row?.scrollIntoView({ block: "nearest", behavior: "instant" });
        });
      }}>
      <DialogHeader className="flex-row items-start justify-between gap-3 border-b border-border p-4 text-left">
        <div className="min-w-0">
          <DialogTitle>Стаття {article} · порівняння пунктів</DialogTitle>
          <DialogDescription className="mt-1">{title}</DialogDescription>
        </div>
        <DialogClose asChild><Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label="Закрити порівняння"><X /></Button></DialogClose>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <p className="comparison-context">Редакція {EDITION} · {graph === "all" ? "Графа не обрана" : `Графа ${graph} — контекст перегляду`}</p>
        <p className="mt-1 text-sm text-muted-foreground">Дослівні критерії й результати пунктів. Порівняння не визначає придатність; звірте також офіційне пояснення та ТДВ.</p>
        {included ? <details className="comparison-included my-3 rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Включено до статті · дослівно</summary>
          <p className="vlk-normative mt-2 whitespace-pre-line text-sm leading-6">{included}</p>
        </details> : null}
        <div className="point-comparison-grid" aria-label="Дослівне порівняння пунктів">
          {rules.map((rule, index) => { const resolved = resolveReviewContext(article, rule, context); return <section key={`${rule.point}-${index}`} className="comparison-point"
            data-selected={String(index) === selectedIndex} data-tone={classifyOutcome(resolved.outcome).tone}>
            <div className="comparison-point-heading">
              <h3 className="font-semibold">{rule.point === "—" ? "Без поділу" : `Пункт «${rule.point}»`}</h3>
              {String(index) === selectedIndex ? <span className="text-xs font-medium text-[var(--accent-ink)]">Відкритий пункт</span> : null}
            </div>
            <p className="comparison-label">Критерії · дослівно</p>
            <p className="vlk-normative comparison-condition"><Highlighted text={rule.condition} query={query} /></p>
            <div className="comparison-outcome">
              <p className="comparison-label">Норма для категорії · {context.examineeType}</p>
              <OutcomeBadge outcome={resolved.outcome} label={resolved.label} />
              <ReviewContextResult article={article} rule={rule} context={context} />
              <p className="comparison-label mt-3">Загальний результат Розкладу · {resolved.scheduleNeedsGraph ? "потрібне уточнення графи" : "дослівно"}</p>
              <p className="vlk-normative mt-2 whitespace-pre-line text-sm leading-6">{resolved.scheduleText || "— (клітинка цієї графи порожня)"}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => {
                navigateTo.current = index; onSelect(String(index)); setOpen(false);
              }}>Відкрити пункт {rule.point === "—" ? "" : `«${rule.point}»`}</Button>
              <a href={officialRuleUrl(article, rule)} target="_blank" rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-xs text-[var(--accent-ink)] underline underline-offset-4"
                aria-label={`Джерело пункту ${rule.point} статті ${article}`}>Джерело <ExternalLink className="size-3" aria-hidden="true" /></a>
            </div>
          </section>; })}
        </div>
      </div>
    </VlkDialogContent>
  </Dialog>;
}
