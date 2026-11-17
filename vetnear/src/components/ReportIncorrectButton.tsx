"use client";
// "Повідомити про неточність" — тепер через єдиний createReport() потік
// (src/lib/reports/store.ts): локальна копія в localStorage + автоматичний
// push у /api/reports, коли бекенд увімкнено. Офлайн-поведінка збережена.
import { useId, useRef, useState } from "react";
import { createReport, REPORT_REASON_LABELS } from "@/lib/reports/store";
import type { ReportIssue } from "@/lib/types";

// Причини, які показуємо у формі (UI-лейбл береться з REPORT_REASON_LABELS).
const FORM_REASONS: ReportIssue["reason"][] = [
  "wrong_phone",
  "wrong_address",
  "closed_permanently",
  "wrong_hours",
  "other",
];

export function ReportIncorrectButton({
  placeId,
}: {
  placeId: string;
  placeName?: string; // збережено для сумісності викликів; ім'я резолвиться за placeId
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportIssue["reason"]>(FORM_REASONS[0]);
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof createReport>> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const id = useId();

  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      setResult(await createReport(placeId, reason, comment.trim() || undefined));
    } catch {
      setError("Не вдалося зберегти повідомлення. Текст залишився у формі — спробуйте ще раз.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mt-4 rounded-2xl bg-brand-50 px-3 py-3 text-sm text-brand-700">
      <p role="status">
        {result.delivery.status === "sent"
          ? "Дякуємо — повідомлення передано на модерацію."
          : result.delivery.status === "local"
            ? result.localSaved ? "Повідомлення збережено лише в цьому браузері. Серверне надсилання вимкнено; модератор його ще не отримав." : "Надсилання вимкнено, а браузер не дозволив зберегти повідомлення. Залиште сторінку відкритою, щоб скопіювати текст."
            : `Сервер не підтвердив отримання. ${result.localSaved ? "Локальна копія збережена в цьому браузері." : "Залиште сторінку відкритою: локальну копію зберегти не вдалося."} Повторне надсилання може створити дублікат.`}
      </p>
      {result.delivery.status !== "sent" && <button type="button" className="mt-3 underline underline-offset-4" onClick={() => setResult(null)}>Повернутися до повідомлення</button>}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 text-sm text-ink/50 underline hover:text-ink/70"
      >
        Повідомити про неточність
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-brand-100 p-4">
      <p className="text-sm font-medium text-ink">Повідомити про неточність</p>
      <label htmlFor={`${id}-reason`} className="mt-3 block text-sm text-ink/70">Що потрібно виправити?</label>
      <select
        id={`${id}-reason`}
        className="mt-2 w-full rounded-xl border border-brand-100 px-3 py-2 text-sm text-ink"
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportIssue["reason"])}
      >
        {FORM_REASONS.map((r) => (
          <option key={r} value={r}>{REPORT_REASON_LABELS[r]}</option>
        ))}
      </select>
      <label htmlFor={`${id}-comment`} className="mt-3 block text-sm text-ink/70">Деталі (необовʼязково)</label>
      <textarea
        id={`${id}-comment`}
        className="mt-2 w-full rounded-xl border border-brand-100 px-3 py-2 text-sm text-ink"
        rows={2}
        placeholder="Деталі (необовʼязково)"
        value={comment}
        maxLength={1000}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p role="alert" className="mt-2 text-sm text-emergency-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={submitting} aria-busy={submitting} onClick={() => void submit()} className="btn btn-brand flex-1 py-2 text-sm">{submitting ? "Надсилаємо…" : "Надіслати"}</button>
        <button type="button" disabled={submitting} onClick={() => setOpen(false)} className="btn btn-ghost py-2 text-sm">Скасувати</button>
      </div>
    </div>
  );
}
