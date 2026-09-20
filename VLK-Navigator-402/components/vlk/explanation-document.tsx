"use client";

import { VlkDialogContent } from "@/components/vlk/dialog-content";

import { BookOpen, ExternalLink, Maximize2, X } from "lucide-react";
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

function TableGrid({ table, paragraphs, query }: {
  table: ExplanationGrid; paragraphs: readonly string[]; query: string;
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
            <Highlighted text={paragraphs[index]} query={query} />
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

function ExplanationTable({ table, paragraphs, query, expandable = true }: {
  table: ExplanationGrid; paragraphs: readonly string[]; query: string; expandable?: boolean;
}) {
  const title = paragraphs[table.start + 1];
  return <section className="my-3 min-w-0 rounded-lg border border-border bg-card p-2">
    <div className="mb-2 flex items-start justify-between gap-2">
      <h4 className="text-sm font-semibold leading-6 text-foreground">
        <Highlighted text={`${paragraphs[table.start]} · ${title}`} query={query} />
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
          <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4"><TableGrid table={table} paragraphs={paragraphs} query={query} /></div>
        </VlkDialogContent>
      </Dialog> : null}
    </div>
    <TableGrid table={table} paragraphs={paragraphs} query={query} />
  </section>;
}

export function ExplanationDocument({
  article,
  paragraphs,
  query = "",
  excerpt,
  comfortable = false,
  expandableTables = true,
}: {
  article: string; paragraphs: readonly string[]; query?: string; excerpt?: readonly string[];
  comfortable?: boolean; expandableTables?: boolean;
}) {
  return <>{explanationBlocks(article, paragraphs, excerpt).map((block) => block.kind === "table"
    ? <ExplanationTable key={`table-${block.table.number}`} table={block.table} paragraphs={paragraphs} query={query} expandable={expandableTables} />
    : <p key={block.index} className={`vlk-normative whitespace-pre-line text-foreground ${comfortable ? "text-base leading-7" : "text-xs leading-5"}`}><Highlighted text={paragraphs[block.index]} query={query} /></p>)} </>;
}

/** Повне, а не скорочене, офіційне пояснення у власному читабельному вікні. */
export function FullExplanationDialog({ article, paragraphs, query = "", sourceUrl }: {
  article: string;
  paragraphs: readonly string[];
  query?: string;
  sourceUrl: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" className="min-h-11 bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]">
          <BookOpen />
          Повне роз’яснення
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{paragraphs.length}</span>
        </Button>
      </DialogTrigger>
      <VlkDialogContent variant="reader" className="explanation-reader flex flex-col gap-0 overflow-hidden p-0" showCloseButton={false}>
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
        <div className="min-h-0 flex-1 overflow-y-auto bg-background p-3 scrollbar-thin sm:p-5">
          <article className="mx-auto max-w-5xl space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <ExplanationDocument article={article} paragraphs={paragraphs} query={query} comfortable />
          </article>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-3 py-2 sm:px-4">
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
