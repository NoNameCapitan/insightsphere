"use client";

import { VlkDialogContent } from "@/components/vlk/dialog-content";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { copyPlainText } from "@/lib/vlk-clipboard";
import { explanationPlainText, explanationSections } from "@/lib/vlk-explanation-sections";
import { highlightParts } from "@/lib/vlk-search";
import { scrollOffsetToReveal } from "@/lib/vlk-reading-navigation";
import { explanationFindMatches, explanationFindParts, explanationPointStart } from "@/lib/vlk-explanation-reader";
import { BookOpen, Copy, ExternalLink, Maximize2, X, ChevronUp, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Highlighted } from "@/components/vlk/highlighted";
import { explanationBlocks, type ExplanationGrid } from "@/lib/vlk-explanation-tables";

function fragmentCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} фрагментів`;
  if (last === 1) return `${count} фрагмент`;
  if (last >= 2 && last <= 4) return `${count} фрагменти`;
  return `${count} фрагментів`;
}

function ExplanationText({ text, query, literalFind = false }: { text: string; query: string; literalFind?: boolean }) {
  if (!literalFind) return <Highlighted text={text} query={query} />;
  return <>{explanationFindParts(text, query).map((part, index) => part.match
    ? <mark key={index} className="search-highlight">{part.text}</mark> : <span key={index}>{part.text}</span>)}</>;
}

function TableGrid({ table, paragraphs, query, literalFind = false }: {
  table: ExplanationGrid; paragraphs: readonly string[]; query: string; literalFind?: boolean;
}) {
  const renderRows = (rows: ExplanationGrid["body"], heading: boolean) => rows.map((row, r) => (
    <tr key={r}>
      {row.map((cell, c) => {
        const rowHeading = !heading && c === 0 &&
          ((cell.colSpan ?? 1) === table.columns || /[\p{L}]/u.test(paragraphs[cell.indices[0]] ?? ""));
        const Tag = heading || rowHeading ? "th" : "td";
        return <Tag key={c} colSpan={cell.colSpan} rowSpan={cell.rowSpan}
          scope={heading ? ((cell.colSpan ?? 1) > 1 ? "colgroup" : "col") : rowHeading ? ((cell.rowSpan ?? 1) > 1 ? "rowgroup" : "row") : undefined}
          className="whitespace-pre-line break-words border border-border p-2 text-left align-top leading-6">
          {cell.indices.map((index) => <div key={index} data-source-index={index}>
            <ExplanationText literalFind={literalFind} text={paragraphs[index]} query={query} />
          </div>)}
        </Tag>;
      })}
    </tr>
  ));
  return <div className="explanation-table-scroll overflow-x-auto overscroll-x-contain" tabIndex={0}
    role="region" aria-label={`Таблиця ${table.number} · прокручування`}>
    <table data-explanation-table={table.number} className="explanation-table w-full border-collapse text-sm text-foreground"
      style={{ minWidth: table.columns > 4 ? 680 : 420 }}>
      <caption className="sr-only">{paragraphs[table.start]} · {paragraphs[table.start + 1]}</caption>
      {table.head.length ? <thead className="bg-muted font-semibold">{renderRows(table.head, true)}</thead> : null}
      <tbody className="bg-card">{renderRows(table.body, false)}</tbody>
    </table>
  </div>;
}

function ExplanationTable({ table, paragraphs, query, expandable = true, literalFind = false }: {
  table: ExplanationGrid; paragraphs: readonly string[]; query: string; expandable?: boolean; literalFind?: boolean;
}) {
  const title = paragraphs[table.start + 1];
  return <section className="my-3 min-w-0 rounded-lg border border-border bg-card p-2">
    <div className="mb-2 flex items-start justify-between gap-2">
      <h4 data-source-index={table.start} className="text-sm font-semibold leading-6 text-foreground">
        <ExplanationText literalFind={literalFind} text={paragraphs[table.start]} query={query} /> · <span data-source-index={table.start + 1}><ExplanationText literalFind={literalFind} text={title} query={query} /></span>
      </h4>
      {expandable ? <Dialog>
        <DialogTrigger asChild><Button size="sm" variant="outline" className="min-h-11 shrink-0"
          aria-label={`Таблиця ${table.number} на весь екран`}><Maximize2 /><span className="hidden sm:inline">Розгорнути</span></Button></DialogTrigger>
        <VlkDialogContent variant="fullscreen" className="table-fullscreen flex flex-col gap-0 overflow-hidden p-0" showCloseButton={false}>
          <DialogHeader className="flex-row items-start justify-between border-b border-border p-3 text-left">
            <div className="min-w-0"><DialogTitle className="text-sm leading-5">Таблиця {table.number} · {title}</DialogTitle>
              <DialogDescription>Дослівні фрагменти Додатка 2 · редакція 22.08.2025</DialogDescription></div>
            <DialogClose asChild><Button variant="outline" className="min-h-11 shrink-0"><X />Закрити</Button></DialogClose>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4"><TableGrid table={table} paragraphs={paragraphs} query={query} literalFind={literalFind} /></div>
        </VlkDialogContent>
      </Dialog> : null}
    </div>
    <TableGrid table={table} paragraphs={paragraphs} query={query} literalFind={literalFind} />
  </section>;
}

export function ExplanationDocument({
  article,
  paragraphs,
  query = "",
  excerpt,
  comfortable = false,
  expandableTables = true,
  collapsible = false,
  focusIndex,
  literalFind = false,
}: {
  article: string; paragraphs: readonly string[]; query?: string; excerpt?: readonly string[];
  comfortable?: boolean; expandableTables?: boolean; collapsible?: boolean; focusIndex?: number; literalFind?: boolean;
}) {
  if (collapsible) return <ExplanationSections key={`${article}-${query}-${focusIndex ?? "start"}`} article={article} paragraphs={paragraphs} query={query} excerpt={excerpt} comfortable={comfortable} expandableTables={expandableTables} focusIndex={focusIndex} literalFind={literalFind} />;
  return <>{explanationBlocks(article, paragraphs, excerpt).map((block) => block.kind === "table"
    ? <ExplanationTable key={`table-${block.table.number}`} table={block.table} paragraphs={paragraphs} query={query} expandable={expandableTables} literalFind={literalFind} />
    : <p key={block.index} className={`vlk-normative whitespace-pre-line text-foreground ${comfortable ? "text-base leading-7" : "text-xs leading-5"}`}><ExplanationText literalFind={literalFind} text={paragraphs[block.index]} query={query} /></p>)} </>;
}

function ExplanationSections({ article, paragraphs, query, excerpt, comfortable, expandableTables, focusIndex, literalFind = false }: {
  article: string; paragraphs: readonly string[]; query: string; excerpt?: readonly string[]; comfortable: boolean; expandableTables: boolean; focusIndex?: number; literalFind?: boolean;
}) {
  const sections = explanationSections(article, paragraphs, excerpt);
  const [expanded, setExpanded] = useState(() => new Set(sections.filter((section, i) => (focusIndex === undefined ? i === 0 : section.indices.includes(focusIndex)) || (query.trim() && section.indices.some(index => (literalFind ? explanationFindParts : highlightParts)(paragraphs[index], query).some(part => part.match)))).map(section => section.id)));
  return <div className="explanation-sections">
    <div className="explanation-controls"><Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={() => setExpanded(new Set(sections.map(section => section.id)))}>Розгорнути все</Button>
      <Button type="button" variant="ghost" className="min-h-11 text-xs" onClick={() => setExpanded(new Set())}>Згорнути все</Button></div>
    {sections.map(section => <details key={section.id} className="explanation-fragment" open={expanded.has(section.id)}>
      <summary onClick={event => { event.preventDefault(); setExpanded(current => { const next = new Set(current); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; }); }}>{section.label}</summary>
      <div className="space-y-3 p-3">{section.blocks.map(block => block.kind === 'table'
        ? <ExplanationTable key={`table-${block.table.number}`} table={block.table} paragraphs={paragraphs} query={query} expandable={expandableTables} literalFind={literalFind} />
        : <p key={block.index} data-source-index={block.index} className={`vlk-normative whitespace-pre-line text-foreground ${comfortable ? 'text-base leading-7' : 'text-sm leading-6'}`}><ExplanationText literalFind={literalFind} text={paragraphs[block.index]} query={query} /></p>)}</div>
    </details>)}
  </div>;
}

export function CopyExplanation({ article, paragraphs }: { article: string; paragraphs: readonly string[] }) {
  const [manual, setManual] = useState(false);
  const copyId = useId();
  const text = explanationPlainText(article, paragraphs);
  return <div className="copy-explanation">
    <Button type="button" variant="outline" className="min-h-11" onClick={async () => {
      if (await copyPlainText(text)) { setManual(false); toast.success('Повний текст пояснення скопійовано'); }
      else setManual(true);
    }}><Copy aria-hidden="true" />Копіювати текст пояснення</Button>
    {manual ? <div className="manual-explanation-copy mt-2">
      <label htmlFor={copyId} className="text-sm">Автоматичне копіювання недоступне. Виділіть і скопіюйте текст:</label>
      <textarea id={copyId} data-manual-explanation-copy autoFocus readOnly value={text} onFocus={event => event.currentTarget.select()} className="mt-2 h-36 w-full rounded-md border border-input bg-background p-2 text-sm" />
      <Button type="button" variant="ghost" className="min-h-11" onClick={() => setManual(false)}>Приховати поле</Button>
    </div> : null}
  </div>;
}

/** Повне, а не скорочене, офіційне пояснення у власному читабельному вікні. */
export function FullExplanationDialog({ article, paragraphs, query = "", sourceUrl, selectedPoint, ariaLabel = "Детальне пояснення" }: {
  article: string;
  paragraphs: readonly string[];
  query?: string;
  sourceUrl: string;
  selectedPoint?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [matchCursor, setMatchCursor] = useState(0);
  const [jumpRequest, setJumpRequest] = useState(0);
  const readerRef = useRef<HTMLDivElement>(null);
  const findId = useId();
  const pointStart = explanationPointStart(paragraphs, selectedPoint);
  const matches = useMemo(() => explanationFindMatches(paragraphs, findQuery), [paragraphs, findQuery]);
  const currentMatch = matches.length ? matchCursor % matches.length : 0;
  const focusIndex = findQuery.trim() ? matches[currentMatch] : pointStart;
  useEffect(() => {
    if (!open || focusIndex === undefined) return;
    const frame = requestAnimationFrame(() => {
      const reader = readerRef.current;
      const fragment = reader?.querySelector<HTMLElement>(`[data-source-index="${focusIndex}"]`);
      if (reader && fragment) {
        reader.scrollTop += fragment.getBoundingClientRect().top - reader.getBoundingClientRect().top - 16;
        const tableScroll = fragment.closest<HTMLElement>(".explanation-table-scroll");
        if (tableScroll) {
          const start = fragment.getBoundingClientRect().left - tableScroll.getBoundingClientRect().left + tableScroll.scrollLeft;
          tableScroll.scrollLeft = scrollOffsetToReveal({ start, end: start + fragment.offsetWidth,
            viewportSize: tableScroll.clientWidth, scrollOffset: tableScroll.scrollLeft, scrollSize: tableScroll.scrollWidth });
        }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, focusIndex, jumpRequest]);
  const moveMatch = (direction: number) => {
    if (matches.length) setMatchCursor((current) => (current + direction + matches.length) % matches.length);
  };
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) { setFindQuery(""); setMatchCursor(0); }
      setOpen(nextOpen);
    }}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="explanation-action h-9 bg-card" aria-label={ariaLabel}>
          <BookOpen />
          <span className="action-full-label">{selectedPoint && selectedPoint !== "—" ? `Пояснення пункту «${selectedPoint}»` : "Пояснення"}</span><span className="action-short-label" aria-hidden="true">Пояснення</span>
        </Button>
      </DialogTrigger>
      <VlkDialogContent variant="reader" className="explanation-reader flex flex-col gap-0 overflow-hidden p-0" showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (findQuery && document.activeElement?.id === findId) {
            event.preventDefault(); setFindQuery(""); setMatchCursor(0);
          }
        }}>
        <DialogHeader className="shrink-0 border-b border-border bg-background p-3 pr-32 text-left sm:p-4 sm:pr-36">
          <DialogTitle className="text-base leading-6">
            Повне офіційне пояснення до статті {article}
          </DialogTitle>
          <DialogDescription>
            Додаток 2 · дослівно · {fragmentCountLabel(paragraphs.length)} · редакція 22.08.2025
          </DialogDescription>
          <DialogClose asChild>
            <Button variant="outline" className="absolute right-3 top-3 min-h-11 shrink-0">
              <X /> Закрити
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="reader-find-toolbar">
          <div className="reader-find-input">
            <label htmlFor={findId} className="sr-only">Знайти в поясненні</label>
            <Search className="size-4" aria-hidden="true" />
            <input id={findId} type="search" value={findQuery} placeholder="Знайти в поясненні…" autoComplete="off"
              onChange={(event) => { setFindQuery(event.target.value); setMatchCursor(0); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); moveMatch(event.shiftKey ? -1 : 1); }
                if (event.key === "Escape" && findQuery) { event.preventDefault(); event.stopPropagation(); setFindQuery(""); setMatchCursor(0); }
              }} />
          </div>
          {findQuery.trim() ? <div className="reader-find-results">
            <span role="status">{matches.length ? `${currentMatch + 1} / ${matches.length} фрагм.` : "Збігів немає"}</span>
            <button type="button" disabled={!matches.length} onClick={() => moveMatch(-1)} aria-label="Попередній збіг"><ChevronUp className="size-4" /></button>
            <button type="button" disabled={!matches.length} onClick={() => moveMatch(1)} aria-label="Наступний збіг"><ChevronDown className="size-4" /></button>
          </div> : selectedPoint ? <p className="reader-point-location">
            {pointStart !== undefined ? (selectedPoint === "—" ? "Стаття без поділу на пункти" : `Відкрито розділ пункту «${selectedPoint}»`) : `Окремий розділ пункту «${selectedPoint}» не виділено; відкрито повний текст`}
          </p> : null}
          {pointStart !== undefined && selectedPoint !== "—" && findQuery ? <button type="button" className="reader-return-point"
            onClick={() => { setFindQuery(""); setMatchCursor(0); setJumpRequest((value) => value + 1); }}>До пункту «{selectedPoint}»</button> : null}
        </div>
        <div ref={readerRef} data-reader-focus-index={focusIndex} className="min-h-0 flex-1 overflow-y-auto bg-background p-3 scrollbar-thin sm:p-5">
          <article className="mx-auto max-w-5xl space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <ExplanationDocument article={article} paragraphs={paragraphs} query={findQuery || query} comfortable collapsible focusIndex={focusIndex} literalFind={Boolean(findQuery.trim())} />
          </article>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-3 py-2 sm:px-4">
          <CopyExplanation key={article} article={article} paragraphs={paragraphs} />
          <p className="text-xs text-muted-foreground">
            Повний текст без переказу. Для постанови звірте офіційне джерело.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              Відкрити в Наказі №402 <ExternalLink />
            </a>
          </Button>
        </footer>
      </VlkDialogContent>
    </Dialog>
  );
}

export function InlineExplanation({ article, paragraphs, query = '', sourceUrl, label }: {
  article: string; paragraphs: readonly string[]; query?: string; sourceUrl: string; label: string;
}) {
  return <section className="inline-explanation" aria-label={label}>
    <details>
      <summary>Офіційне пояснення <span>{fragmentCountLabel(paragraphs.length)}</span></summary>
      <div className="inline-explanation-body"><ExplanationDocument article={article} paragraphs={paragraphs} query={query} comfortable collapsible /></div>
    </details>
    <div className="inline-explanation-actions"><CopyExplanation article={article} paragraphs={paragraphs} />
      <Button asChild variant="ghost" className="min-h-11"><a href={sourceUrl} target="_blank" rel="noreferrer">Джерело <ExternalLink /></a></Button>
    </div>
  </section>;
}
