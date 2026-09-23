"use client";
import PlaceAttribution from "./PlaceAttribution";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfidenceBadge, ScoreBreakdown } from "@/components/ScoreBadge";
import OutreachActions from "@/components/OutreachActions";
import { generateOutreach } from "@/lib/outreach";
import { CHANNEL_OPTIONS, TONE_OPTIONS } from "@/lib/options";
import { CONFIDENCE_LABEL_UK } from "@/lib/confidence";
import { buildTelUrl } from "@/lib/messaging";
import type {
  Campaign,
  LangCode,
  Lead,
  OutreachChannel,
  OutreachMessages,
  OutreachTone,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { useDialog } from "@/lib/useDialog";
import { buildLead } from "@/lib/leads";
import { computeConfidence } from "@/lib/confidence";
import { hasAnyContact } from "@/lib/contactExtractor";
import { Sparkles, RefreshCw } from "lucide-react";

const LANGS: Array<{ code: LangCode; label: string }> = [
  { code: "uk", label: "UA" },
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
];

export default function LeadDetailDrawer({
  lead,
  campaigns,
  onClose,
  onSaveToCampaign,
  onCreateCampaign,
  onMarkContacted,
  onLeadUpdate,
}: {
  lead: Lead | null;
  campaigns: Campaign[];
  onClose: () => void;
  onSaveToCampaign: (campaignId: string, lead: Lead) => void;
  onCreateCampaign: (name: string) => Campaign | undefined;
  onMarkContacted?: (lead: Lead) => void;
  onLeadUpdate?: (lead: Lead) => void;
}) {
  const [lang, setLang] = useState<LangCode>("uk");
  const [tone, setTone] = useState<OutreachTone>("professional");
  const [channel, setChannel] = useState<OutreachChannel>("telegram");
  const [newCampaign, setNewCampaign] = useState("");
  const [draft, setDraft] = useState("");
  const [aiReady, setAiReady] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const ref = useDialog(!!lead, onClose);
  const drafts = useRef(new Map<string, string>());
  const operation = useRef(0);
  const draftKey = `${lead?.id}:${lang}:${tone}:${channel}`;
  const leadId = lead?.id;
  useEffect(() => {
    if (!leadId) return;
    let live = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => {
        if (live) setAiReady(!!s.aiReady);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [leadId]);
  useEffect(() => {
    operation.current++;
    setAiBusy(false);
    setAnalysisBusy(false);
    setFeedback("");
    return () => {
      // This is an operation counter, not a DOM ref. Invalidate in-flight requests.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      operation.current++;
    };
  }, [lead?.id, lang, tone, channel]);
  async function improveDraft() {
    if (!lead) return;
    const id = ++operation.current;
    setAiBusy(true);
    setFeedback("");
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name,
          category: lead.category,
          offerType: lead.offerType,
          lang,
          tone,
          channel,
          evidence: lead.signals
            .filter((s) => s.type !== "demo_data")
            .map((s) => s.evidence)
            .slice(0, 12),
          draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (id !== operation.current) return;
      setDraft(data.text);
      drafts.current.set(draftKey, data.text);
      setFeedback(
        "AI-чернетка готова. Перевірте формулювання перед зверненням.",
      );
    } catch (e) {
      if (id === operation.current) setFeedback((e as Error).message);
    } finally {
      if (id === operation.current) setAiBusy(false);
    }
  }
  async function checkWebsite() {
    if (!lead?.website) return;
    const id = ++operation.current;
    setAnalysisBusy(true);
    setFeedback("");
    try {
      const res = await fetch("/api/website/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lead.website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (id !== operation.current) return;
      const raw = { ...lead, websiteAnalysis: data.analysis };
      const enriched = buildLead(raw, lead.offerType, lang);
      onLeadUpdate?.({
        ...lead,
        websiteAnalysis: data.analysis,
        score: enriched.score,
        signals: enriched.signals,
        confidence: computeConfidence(raw, {
          hasDistance: lead.distanceKm != null,
        }),
      });
      setFeedback(data.analysis.note ?? "Сайт перевірено, оцінку оновлено.");
    } catch (e) {
      if (id === operation.current) setFeedback((e as Error).message);
    } finally {
      if (id === operation.current) setAnalysisBusy(false);
    }
  }

  useEffect(() => {
    setLang("uk");
    setTone("professional");
    setChannel("telegram");
  }, [lead?.id]);

  const outreach: OutreachMessages = useMemo(() => {
    if (!lead)
      return {
        shortMessage: "",
        instagramMessage: "",
        emailMessage: "",
        callScript: "",
      };
    return generateOutreach(lead.name, lead.offerType, lead.signals, lang, {
      tone,
    });
  }, [lead, lang, tone]);

  const channelText: Record<OutreachChannel, { title: string; text: string }> =
    {
      telegram: {
        title: "Telegram / Viber / SMS",
        text: outreach.shortMessage,
      },
      instagram: { title: "Instagram DM", text: outreach.instagramMessage },
      email: { title: "Email / повідомлення", text: outreach.emailMessage },
      call: { title: "Скрипт дзвінка", text: outreach.callScript },
    };

  // Keep the editable draft in sync when language/tone/channel/lead changes.
  useEffect(() => {
    setDraft(drafts.current.get(draftKey) ?? channelText[channel].text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, lang, tone, channel]);

  if (!lead) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-drawer-title"
    >
      <button
        aria-label="Закрити"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-paper shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-paper/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2
              id="lead-drawer-title"
              className="truncate text-lg font-bold text-ink"
            >
              {lead.name}
            </h2>
            <p className="text-sm text-slate-500">{lead.category}</p>
            <PlaceAttribution lead={lead} />
          </div>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            Закрити
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Business data */}
          <section className="card p-4">
            <h3 className="mb-2 text-sm font-bold text-ink">Дані бізнесу</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              <Row label="Адреса" value={lead.address} />
              <Row
                label="Телефон"
                value={
                  lead.source !== "demo" &&
                  !lead.verification?.doNotContact &&
                  buildTelUrl(lead.phone) ? (
                    <a
                      className="text-brand-700 underline"
                      href={buildTelUrl(lead.phone) as string}
                    >
                      {lead.phone}
                    </a>
                  ) : (
                    (lead.phone ?? "—")
                  )
                }
              />
              <Row
                label="Сайт"
                value={
                  lead.website ? (
                    <a
                      className="text-brand-700 underline"
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {lead.website}
                    </a>
                  ) : (
                    "Немає"
                  )
                }
              />
              <Row
                label="Рейтинг"
                value={
                  lead.rating != null
                    ? `★ ${lead.rating.toFixed(1)} (${lead.reviewCount ?? 0})`
                    : "Не вказано"
                }
              />
              <Row
                label="Відстань"
                value={
                  lead.distanceKm != null
                    ? `${lead.distanceKm.toFixed(1)} км`
                    : "—"
                }
              />
              <Row
                label="Статус"
                value={
                  {
                    OPERATIONAL: "Працює",
                    CLOSED_TEMPORARILY: "Тимчасово зачинено",
                    CLOSED_PERMANENTLY: "Зачинено назавжди",
                  }[lead.businessStatus ?? ""] ??
                  lead.businessStatus ??
                  "Невідомо"
                }
              />
            </dl>
            {lead.openingHours && lead.openingHours.length > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                Години: {lead.openingHours.join(" · ")}
              </p>
            )}
          </section>

          {hasAnyContact(lead.websiteAnalysis?.contacts) && (
            <section className="card p-4">
              <h3 className="mb-2 text-sm font-bold text-ink">
                Контакти з сайту
              </h3>
              <ul className="flex flex-wrap gap-2 text-xs">
                {lead.websiteAnalysis!.contacts!.emails.map((e) => (
                  <li key={e} className="chip bg-slate-100 text-slate-700">
                    ✉ {e}
                  </li>
                ))}
                {(
                  [
                    ["Instagram", lead.websiteAnalysis!.contacts!.instagram],
                    ["Facebook", lead.websiteAnalysis!.contacts!.facebook],
                    ["Telegram", lead.websiteAnalysis!.contacts!.telegram],
                    ["WhatsApp", lead.websiteAnalysis!.contacts!.whatsapp],
                    ["TikTok", lead.websiteAnalysis!.contacts!.tiktok],
                    ["YouTube", lead.websiteAnalysis!.contacts!.youtube],
                    ["LinkedIn", lead.websiteAnalysis!.contacts!.linkedin],
                  ] as const
                )
                  .filter(([, url]) => !!url)
                  .map(([label, url]) => (
                    <li key={label}>
                      {lead.source === "demo" ? (
                        <span className="chip bg-slate-100 text-slate-500">
                          {label}
                        </span>
                      ) : (
                        <a
                          className="chip bg-brand-50 text-brand-700 underline"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {label}
                        </a>
                      )}
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-400">
                Знайдено в HTML сайту бізнесу. Перевірте актуальність перед
                зверненням.
              </p>
            </section>
          )}
          {lead.website && (
            <section className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Перевірка сайту</h3>
                <button
                  className="btn-ghost btn-sm"
                  disabled={analysisBusy || aiBusy || lead.source === "demo"}
                  onClick={checkWebsite}
                >
                  <RefreshCw
                    size={13}
                    className={analysisBusy ? "animate-spin" : ""}
                  />
                  {analysisBusy ? "Перевіряємо…" : "Перевірити зараз"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {lead.source === "demo"
                  ? "Демо: аналіз змодельовано. Реальні сайти тут не запитуються."
                  : (lead.websiteAnalysis?.note ??
                    "Перевіримо доступність, HTTPS та ознаки онлайн-запису на головній сторінці.")}
              </p>
            </section>
          )}
          {feedback && (
            <p
              role="status"
              className="rounded-xl bg-brand-50 p-3 text-xs text-brand-800"
            >
              {feedback}
            </p>
          )}
          {/* Score */}
          <section className="card p-4">
            <h3 className="mb-2 text-sm font-bold text-ink">Lead Score</h3>
            <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-900 ring-1 ring-brand-100">
              {lead.score.opportunityReason}
            </div>
            <p className="mb-3 text-xs text-slate-500">
              {lead.score.explanation}
            </p>
            <ScoreBreakdown score={lead.score} />
          </section>

          {/* Confidence (data reliability — separate from Lead Score) */}
          <section className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">
                Впевненість у даних
              </h3>
              <ConfidenceBadge confidence={lead.confidence} />
            </div>
            <p className="text-xs text-slate-500">
              {CONFIDENCE_LABEL_UK[lead.confidence.label]} (
              {lead.confidence.score}/100) — наскільки повні дані по ліду. Це не
              оцінка привабливості (Lead Score).
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-emerald-700">Є дані</p>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {lead.confidence.present.map((p) => (
                    <li key={p}>✓ {p}</li>
                  ))}
                  {lead.confidence.present.length === 0 && <li>—</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Бракує</p>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
                  {lead.confidence.missing.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                  {lead.confidence.missing.length === 0 && <li>—</li>}
                </ul>
              </div>
            </div>
          </section>

          {/* Signals */}
          <section className="card p-4">
            <h3 className="mb-2 text-sm font-bold text-ink">
              Сигнали та докази
            </h3>
            <ul className="space-y-2">
              {lead.signals.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span
                    className={cn(
                      "mt-0.5 h-2 w-2 flex-shrink-0 rounded-full",
                      s.severity === "high"
                        ? "bg-rose-500"
                        : s.severity === "medium"
                          ? "bg-amber-500"
                          : "bg-slate-300",
                    )}
                  />
                  <span>
                    <span className="font-medium text-ink">{s.label}.</span>{" "}
                    <span className="text-slate-500">{s.evidence}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Recommended offer */}
          <section className="rounded-xl2 bg-brand-50 p-4 ring-1 ring-brand-100">
            <h3 className="text-sm font-bold text-brand-800">
              Рекомендована пропозиція
            </h3>
            <p className="mt-1 text-sm text-brand-900">
              {lead.recommendedOffer}
            </p>
          </section>

          {/* Outreach — a 5-step contact flow */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-ink">Контакт із лідом</h3>

            {/* 1. Verify business data */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">
                1. Перевірте дані
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                <span
                  className={
                    buildTelUrl(lead.phone)
                      ? "chip bg-emerald-50 text-emerald-700"
                      : "chip bg-slate-100 text-slate-400"
                  }
                >
                  {buildTelUrl(lead.phone)
                    ? "телефон валідний"
                    : "немає телефону"}
                </span>
                <span
                  className={
                    lead.website
                      ? "chip bg-emerald-50 text-emerald-700"
                      : "chip bg-slate-100 text-slate-400"
                  }
                >
                  {lead.website ? "сайт є" : "без сайту"}
                </span>
                {lead.googleMapsUrl && (
                  <a
                    href={lead.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chip bg-slate-100 text-slate-600 underline"
                  >
                    Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* 2. Choose language / tone / channel */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500">
                  2. Мова, тон, канал
                </p>
                <div
                  className="flex gap-1 rounded-lg bg-slate-100 p-0.5"
                  role="group"
                  aria-label="Мова"
                >
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLang(l.code)}
                      aria-pressed={lang === l.code}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                        lang === l.code
                          ? "bg-white text-ink shadow-sm"
                          : "text-slate-500",
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <div>
                  <span className="label">Тон</span>
                  <div className="flex flex-wrap gap-1">
                    {TONE_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTone(t.value)}
                        aria-pressed={tone === t.value}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                          tone === t.value
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label">Шаблон</span>
                  <div className="flex flex-wrap gap-1">
                    {CHANNEL_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setChannel(c.value)}
                        aria-pressed={channel === c.value}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                          channel === c.value
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Review & edit the message */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <label
                htmlFor="outreach-draft"
                className="text-xs font-semibold text-slate-500"
              >
                3. Переглянути та відредагувати
              </label>
              <textarea
                id="outreach-draft"
                className="input mt-1.5 min-h-[120px] text-sm"
                value={draft}
                disabled={aiBusy}
                onChange={(e) => {
                  setDraft(e.target.value);
                  drafts.current.set(draftKey, e.target.value);
                }}
              />
            </div>

            <div className="rounded-xl border border-brand-100 bg-brand-50 p-3">
              <button
                className="btn-ghost btn-sm"
                disabled={
                  !aiReady ||
                  aiBusy ||
                  analysisBusy ||
                  !!lead.verification?.doNotContact
                }
                onClick={improveDraft}
              >
                <Sparkles size={14} />
                {aiBusy ? "AI готує чернетку…" : "Покращити з AI"}
              </button>
              <p className="mt-2 text-[11px] text-slate-500">
                {aiReady
                  ? "Назва бізнесу, сигнали й чернетка будуть передані налаштованому AI-провайдеру. Повідомлення не надсилається."
                  : "Шаблон працює без AI. Для персоналізації додайте AI-провайдера, ключ і модель у налаштуваннях сервера."}
              </p>
            </div>
            {/* 4. Open the chosen service, 5. Mark the outcome */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">
                4. Відкрити сервіс · 5. Позначити результат
              </p>
              <OutreachActions
                lead={lead}
                message={draft}
                emailSubject={
                  {
                    uk: `Швидке питання щодо «${lead.name}»`,
                    ru: `Короткий вопрос о «${lead.name}»`,
                    en: `Quick question about ${lead.name}`,
                  }[lang]
                }
                emailBody={draft}
                onContacted={
                  onMarkContacted ? () => onMarkContacted(lead) : undefined
                }
              />
            </div>
          </section>

          {/* Save to campaign */}
          <section className="card p-4">
            <h3 className="mb-2 text-sm font-bold text-ink">
              Зберегти в кампанію
            </h3>
            {campaigns.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {campaigns.map((c) => (
                  <button
                    key={c.id}
                    className="btn-ghost btn-sm"
                    onClick={() => onSaveToCampaign(c.id, lead)}
                  >
                    + {c.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Нова кампанія…"
                aria-label="Назва нової кампанії"
                maxLength={200}
                value={newCampaign}
                onChange={(e) => setNewCampaign(e.target.value)}
              />
              <button
                className="btn-primary"
                onClick={() => {
                  const created = onCreateCampaign(
                    newCampaign || "Нова кампанія",
                  );
                  if (created) {
                    onSaveToCampaign(created.id, lead);
                    setNewCampaign("");
                  }
                }}
              >
                Створити
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}
