"use client";

import { Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Highlighted } from "@/components/vlk/highlighted";
import { explanationBlocks, type ExplanationGrid } from "@/lib/vlk-explanation-tables";

function TableGrid({ table, paragraphs, query }: {
  table: ExplanationGrid; paragraphs: readonly string[]; query: string;
}) {
  const renderRows = (rows: ExplanationGrid["body"], heading: boolean) => rows.map((row, r) => (
    <tr key={r}>
      {row.map((cell, c) => {
        const Tag = heading ? "th" : "td";
        return <Tag key={c} colSpan={cell.colSpan} rowSpan={cell.rowSpan}
          scope={heading ? ((cell.colSpan ?? 1) > 1 ? "colgroup" : "col") : undefined}
          className="whitespace-pre-line break-words border border-border p-2 text-left align-top leading-5">
          {cell.indices.map((index) => <div key={index} data-source-index={index}>
            <Highlighted text={paragraphs[index]} query={query} />
          </div>)}
        </Tag>;
      })}
    </tr>
  ));
  return <div className="explanation-table-scroll overflow-x-auto overscroll-x-contain" tabIndex={0}
    role="region" aria-label={`Таблиця ${table.number} · прокручування`}>
    <table data-explanation-table={table.number} className="explanation-table w-full border-collapse text-xs text-foreground"
      style={{ minWidth: table.columns > 4 ? 680 : 420 }}>
      <caption className="sr-only">{paragraphs[table.start]} · {paragraphs[table.start + 1]}</caption>
      {table.head.length ? <thead className="bg-muted font-semibold">{renderRows(table.head, true)}</thead> : null}
      <tbody className="bg-card">{renderRows(table.body, false)}</tbody>
    </table>
  </div>;
}

function ExplanationTable({ table, paragraphs, query }: {
  table: ExplanationGrid; paragraphs: readonly string[]; query: string;
}) {
  const title = paragraphs[table.start + 1];
  return <section className="my-3 min-w-0 rounded-lg border border-border bg-card p-2">
    <div className="mb-2 flex items-start justify-between gap-2">
      <h4 className="text-xs font-semibold leading-5 text-foreground">
        <Highlighted text={`${paragraphs[table.start]} · ${title}`} query={query} />
      </h4>
      <Dialog>
        <DialogTrigger asChild><Button size="sm" variant="outline" className="min-h-11 shrink-0"
          aria-label={`Таблиця ${table.number} на весь екран`}><Maximize2 /><span className="hidden sm:inline">Розгорнути</span></Button></DialogTrigger>
        <DialogContent className="table-fullscreen flex flex-col gap-0 overflow-hidden p-0" showCloseButton={false}>
          <DialogHeader className="flex-row items-start justify-between border-b border-border p-3 text-left">
            <div className="min-w-0"><DialogTitle className="text-sm leading-5">Таблиця {table.number} · {title}</DialogTitle>
              <DialogDescription>Дослівні фрагменти Додатка 2 · редакція 22.08.2025</DialogDescription></div>
            <DialogClose asChild><Button variant="outline" className="min-h-11 shrink-0"><X />Закрити</Button></DialogClose>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4"><TableGrid table={table} paragraphs={paragraphs} query={query} /></div>
        </DialogContent>
      </Dialog>
    </div>
    <TableGrid table={table} paragraphs={paragraphs} query={query} />
  </section>;
}

export function ExplanationDocument({ article, paragraphs, query = "", excerpt }: {
  article: string; paragraphs: readonly string[]; query?: string; excerpt?: readonly string[];
}) {
  return <>{explanationBlocks(article, paragraphs, excerpt).map((block) => block.kind === "table"
    ? <ExplanationTable key={`table-${block.table.number}`} table={block.table} paragraphs={paragraphs} query={query} />
    : <p key={block.index} className="whitespace-pre-line text-xs leading-5 text-foreground"><Highlighted text={paragraphs[block.index]} query={query} /></p>)} </>;
}
