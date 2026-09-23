"use client";
import PlaceAttribution from "./PlaceAttribution";

import { useState } from "react";
import { ConfidenceBadge, ScoreBadge } from "@/components/ScoreBadge";
import type { Lead, LeadSignal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { hasAnyContact } from "@/lib/contactExtractor";

const SEV_STYLE: Record<LeadSignal["severity"], string> = {
  high: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  low: "bg-slate-100 text-slate-600",
};

export default function LeadCard({
  lead,
  onDetails,
  onSave,
  onDismiss,
  dismissed,
  saved,
  selected,
  onSelect,
}: {
  lead: Lead;
  onDetails: (lead: Lead) => void;
  onSave: (lead: Lead) => void;
  onDismiss: (lead: Lead) => void;
  dismissed?: boolean;
  saved?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(lead.outreach.shortMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const contacts = lead.websiteAnalysis?.contacts;
  const topSignals = lead.signals
    .filter((s) => s.severity !== "low")
    .slice(0, 4);

  return (
    <article
      className={cn(
        "card lead-card flex min-w-0 flex-col p-5",
        selected && "border-brand-400 ring-1 ring-brand-300",
        dismissed && "opacity-50 grayscale",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onSelect}
            aria-label={`Обрати ${lead.name}`}
          />
          {lead.source === "demo" ? "Демо-приклад" : "Google Maps"}
        </label>
        {saved && (
          <span className="text-[11px] font-medium text-brand-600">
            ✓ У кампанії
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">{lead.name}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{lead.category}</p>
          <p className="mt-1 line-clamp-1 text-xs text-slate-400">
            {lead.address}
          </p>
        </div>
        <ScoreBadge score={lead.score} compact />
      </div>

      <PlaceAttribution lead={lead} />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <ConfidenceBadge confidence={lead.confidence} />
        {lead.distanceKm != null && (
          <span className="chip bg-slate-100 text-slate-600">
            {lead.distanceKm.toFixed(1)} км
          </span>
        )}
        {lead.rating != null && (
          <span className="chip bg-slate-100 text-slate-600">
            ★ {lead.rating.toFixed(1)} · {lead.reviewCount ?? 0}
          </span>
        )}
        <span
          className={cn(
            "chip",
            lead.hasPhone
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-400",
          )}
        >
          {lead.hasPhone ? "Телефон" : "Без телефону"}
        </span>
        <span
          className={cn(
            "chip",
            lead.hasWebsite
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-600",
          )}
        >
          {lead.hasWebsite ? "Сайт є" : "Без сайту"}
        </span>
      </div>

      {contacts && hasAnyContact(contacts) && (
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]"
          aria-label="Контакти, знайдені на сайті"
        >
          <span className="text-slate-400">З сайту:</span>
          {contacts.emails.length > 0 && (
            <span className="chip bg-sky-50 text-sky-700 ring-1 ring-sky-100">
              ✉ Email
            </span>
          )}
          {contacts.instagram && (
            <span className="chip bg-pink-50 text-pink-700 ring-1 ring-pink-100">
              Instagram
            </span>
          )}
          {contacts.telegram && (
            <span className="chip bg-sky-50 text-sky-700 ring-1 ring-sky-100">
              Telegram
            </span>
          )}
          {contacts.facebook && (
            <span className="chip bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              Facebook
            </span>
          )}
          {contacts.whatsapp && (
            <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              WhatsApp
            </span>
          )}
        </div>
      )}

      {topSignals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topSignals.map((s, i) => (
            <span key={i} className={cn("chip", SEV_STYLE[s.severity])}>
              {s.label}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-600">
        {lead.score.opportunityReason}
      </p>

      <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
        <span className="font-semibold">Пропозиція:</span>{" "}
        {lead.recommendedOffer}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button className="btn-primary btn-sm" onClick={() => onDetails(lead)}>
          Деталі
        </button>
        <button className="btn-ghost btn-sm" onClick={() => onSave(lead)}>
          Зберегти
        </button>
        <button className="btn-ghost btn-sm" onClick={copyMessage}>
          {copied ? "Скопійовано ✓" : "Копіювати"}
        </button>
        {lead.website && (
          <a
            className="btn-ghost btn-sm"
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            Сайт
          </a>
        )}
        {lead.googleMapsUrl && (
          <a
            className="btn-ghost btn-sm"
            href={lead.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Maps
          </a>
        )}
        <button
          className="btn-sm ml-auto text-xs font-medium text-slate-400 hover:text-rose-600"
          onClick={() => onDismiss(lead)}
        >
          {dismissed ? "Повернути" : "Не релевантно"}
        </button>
      </div>
    </article>
  );
}
