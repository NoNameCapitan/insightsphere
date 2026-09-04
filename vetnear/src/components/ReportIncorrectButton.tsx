"use client";
// "Повідомити про неточність" — тепер через єдиний createReport() потік
// (src/lib/reports/store.ts): локальна копія в localStorage + автоматичний
// push у /api/reports, коли бекенд увімкнено. Офлайн-поведінка збережена.
import { useState } from "react";
import { isBackendEnabled } from "@/lib/api/backendClient";
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
  const [done, setDone] = useState(false);

  const submit = () => {
    createReport(placeId, reason, comment.trim() || undefined);
    setDone(true);
  };

  if (done) {
    return (
      <p className="mt-4 rounded-2xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
        {isBackendEnabled()
          ? "Дякуємо — повідомлення передано на модерацію."
          : "Дякуємо — повідомлення збережено для модерації (демо: локально у вашому браузері)."}
      </p>
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
      <select
        className="mt-2 w-full rounded-xl border border-brand-100 px-3 py-2 text-sm text-ink"
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportIssue["reason"])}
      >
        {FORM_REASONS.map((r) => (
          <option key={r} value={r}>{REPORT_REASON_LABELS[r]}</option>
        ))}
      </select>
      <textarea
        className="mt-2 w-full rounded-xl border border-brand-100 px-3 py-2 text-sm text-ink"
        rows={2}
        placeholder="Деталі (необовʼязково)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button onClick={submit} className="btn btn-brand flex-1 py-2 text-sm">Надіслати</button>
        <button onClick={() => setOpen(false)} className="btn btn-ghost py-2 text-sm">Скасувати</button>
      </div>
    </div>
  );
}
