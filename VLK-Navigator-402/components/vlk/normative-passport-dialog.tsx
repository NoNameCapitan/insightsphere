"use client";

import { Check, ExternalLink, FileCheck2, History, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CommandBrand } from "@/components/vlk/command-brand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  EDITION_MONITOR,
  EXPERT_REVIEWS,
  hasDoubleExpertVerification,
  NORMATIVE_PASSPORT,
  normReferenceId,
  REVISION_LOG,
} from "@/lib/vlk-provenance";

type NormativePassportDialogProps = {
  article?: string;
  point?: string;
  sourceUrl: string;
};

export function NormativePassportDialog({
  article,
  point,
  sourceUrl,
}: NormativePassportDialogProps) {
  const doubleVerified = hasDoubleExpertVerification();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 bg-white text-xs"
        >
          <FileCheck2 /> Паспорт норми
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <div className="flex items-start gap-3 border-b border-[#b58b35]/20 pb-3">
          <CommandBrand size={52} />
          <DialogHeader>
            <DialogTitle>Паспорт нормативної норми</DialogTitle>
            <DialogDescription>
              Походження, редакція та статус перевірки без підміни офіційного джерела.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-[#2c6b63]/20 bg-[#edf3f0] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c6b63]">
                  Джерело норми
                </p>
                <p className="mt-1 font-bold">{NORMATIVE_PASSPORT.order}</p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#1f564f]">
                редакція {NORMATIVE_PASSPORT.edition}
              </span>
            </div>
            {article ? (
              <p className="mt-2 break-all font-mono text-[10px] text-[#55635f]">
                {normReferenceId(article, point)}
              </p>
            ) : null}
            <Button asChild variant="outline" size="sm" className="mt-3 h-8 bg-white text-xs">
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                Відкрити першоджерело <ExternalLink />
              </a>
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--hairline)] p-3">
              <p className="flex items-center gap-2 font-bold">
                <ShieldCheck className="size-4 text-[#2c6b63]" /> Автоматичні перевірки
              </p>
              <p className="mt-1.5 text-xs leading-5 text-[#55635f]">
                87 статей · 87 дослівних рядків · 29 точних наборів МКХ · 86 наборів пояснень · ТДВ.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#e1eee7] px-2 py-1 text-[10px] font-bold text-[#255c49]">
                <Check className="size-3" /> технічні інваріанти перевірено
              </span>
            </div>
            <div className="rounded-xl border border-[var(--hairline)] p-3">
              <p className="flex items-center gap-2 font-bold">
                <History className="size-4 text-[#2c6b63]" /> Моніторинг редакції
              </p>
              <p className="mt-1.5 text-xs leading-5 text-[#55635f]">{EDITION_MONITOR.behavior}</p>
              <span className="mt-2 inline-flex rounded-full bg-[#faf3e4] px-2 py-1 text-[10px] font-bold text-[#6b5423]">
                налаштовано · {EDITION_MONITOR.schedule}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--hairline)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">Подвійна експертна перевірка</p>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${doubleVerified ? "bg-[#e1eee7] text-[#255c49]" : "bg-[#faf3e4] text-[#6b5423]"}`}>
                {doubleVerified ? "завершена" : "очікує підтвердження"}
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EXPERT_REVIEWS.map((review) => (
                <div key={review.role} className="rounded-lg bg-[#faf8f4] p-2.5">
                  <p className="text-xs font-bold">{review.role}</p>
                  <p className="mt-1 text-[11px] text-[#68766f]">
                    {review.status === "verified"
                      ? `${review.reviewer} · ${review.reviewedAt}`
                      : "Іменного висновку ще немає"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--hairline)] p-3">
            <p className="font-bold">Журнал редакцій</p>
            {REVISION_LOG.map((entry) => (
              <div key={entry.edition} className="mt-2 border-l-2 border-[#2c6b63]/30 pl-3">
                <p className="text-xs font-bold">Редакція від {entry.edition}</p>
                <p className="mt-1 text-xs leading-5 text-[#55635f]">{entry.summary}</p>
              </div>
            ))}
          </div>

          <p className="text-xs leading-5 text-[#68766f]">
            Автоматичний монітор лише виявляє розбіжність. Нова редакція не потрапляє до
            застосунку без ручного звірення тексту, тестів і експертного підтвердження.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
