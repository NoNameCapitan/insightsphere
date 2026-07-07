"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DemoAdminBanner } from "@/components/DemoBanner";
import { ServerModerationPanel } from "@/components/ServerModerationPanel";
import { CATEGORY_LABELS, DISTRICT_LABELS, STATUS_LABELS } from "@/lib/labels";
import {
  getSubmissions,
  setSubmissionCoords,
  setSubmissionEmergency,
  setSubmissionPhoneConfirmed,
  setSubmissionStatus,
  setSubmissionVerification,
} from "@/lib/partners/store";
import { readJSON } from "@/lib/storage";
import { getReports, REPORT_REASON_LABELS } from "@/lib/reports/store";
import { getPlaces } from "@/lib/store";
import type { PartnerSubmission, ReportIssue } from "@/lib/types";

const FREE_SOCIAL = ["shelter", "animal_volunteer_help"];

export default function ModerationPage() {
  const [subs, setSubs] = useState<PartnerSubmission[]>([]);
  const [reports, setReports] = useState<ReportIssue[]>([]);
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  const [coords, setCoords] = useState<Record<string, { lat: string; lng: string }>>({});

  const refresh = () => {
    setSubs(getSubmissions());
    setReports(getReports());
    setPlaceNames(Object.fromEntries(getPlaces().map((p) => [p.id, p.name])));
  };
  useEffect(refresh, []);

  const hasCoords = (s: PartnerSubmission) =>
    typeof s.latitude === "number" && typeof s.longitude === "number";

  const act = (id: string, status: PartnerSubmission["status"]) => {
    setSubmissionStatus(id, status, "moderator");
    refresh();
  };
  const verifyPublic = (id: string) => { setSubmissionVerification(id, "verified"); refresh(); };
  const confirmPhone = (id: string) => { setSubmissionPhoneConfirmed(id, "moderator"); refresh(); };
  const toggleEmergency = (s: PartnerSubmission) => { setSubmissionEmergency(s.id, !s.emergencyAvailable); refresh(); };

  const saveCoords = (id: string) => {
    const c = coords[id];
    const lat = Number(c?.lat);
    const lng = Number(c?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setSubmissionCoords(id, lat, lng);
    refresh();
  };

  return (
    <div className="container-px mx-auto max-w-3xl py-6">
      <Link href="/admin" className="text-sm text-brand hover:underline">← Адмін</Link>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-ink">Модерація заявок</h1>
      <p className="mt-1 text-ink/60">Заявки партнерів. Схвалені зʼявляються у пошуку поруч лише з координатами.</p>

      <div className="mt-4"><DemoAdminBanner /></div>

      <div className="mt-4"><ServerModerationPanel /></div>

      {subs.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-brand-100 p-10 text-center text-ink/50">
          Заявок ще немає. Додайте заклад через{" "}
          <Link href="/add-place" className="text-brand hover:underline">/add-place</Link>.
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {subs.map((s) => {
            const needsGeo = !hasCoords(s);
            return (
              <li key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">{s.name}</p>
                    <p className="text-sm text-ink/60">
                      {CATEGORY_LABELS[s.category]} · {DISTRICT_LABELS[s.district]}
                    </p>
                    <p className="mt-1 text-sm text-ink/70">{s.address} · {s.phone}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/60">
                      {STATUS_LABELS[s.status]}
                    </span>
                    {s.phoneConfirmedAt ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">Підтверджено дзвінком</span>
                    ) : s.verificationStatus === "verified" ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">Перевірено за джерелами</span>
                    ) : (
                      <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-medium text-amber">Потребує перевірки</span>
                    )}
                    {FREE_SOCIAL.includes(s.category) && (
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] text-ink/60">Безкоштовно (соц.)</span>
                    )}
                    {needsGeo && (
                      <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-medium text-amber">
                        Потрібні координати
                      </span>
                    )}
                  </div>
                </div>

                {needsGeo && (
                  <div className="mt-3 rounded-2xl border border-amber/30 bg-amber/5 p-3">
                    <p className="text-xs text-ink/70">
                      Координати обовʼязкові, перш ніж заклад зможе зʼявитися на публічній карті.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="w-full rounded-xl border border-brand-100 px-3 py-2 text-sm"
                        placeholder="Широта (lat)"
                        inputMode="decimal"
                        value={coords[s.id]?.lat ?? ""}
                        onChange={(e) =>
                          setCoords((c) => ({ ...c, [s.id]: { ...c[s.id], lat: e.target.value } }))
                        }
                      />
                      <input
                        className="w-full rounded-xl border border-brand-100 px-3 py-2 text-sm"
                        placeholder="Довгота (lng)"
                        inputMode="decimal"
                        value={coords[s.id]?.lng ?? ""}
                        onChange={(e) =>
                          setCoords((c) => ({ ...c, [s.id]: { ...c[s.id], lng: e.target.value } }))
                        }
                      />
                      <button className="btn btn-ghost py-2 text-sm" onClick={() => saveCoords(s.id)}>
                        Зберегти
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => act(s.id, "approved")}
                    disabled={needsGeo}
                    className="btn btn-brand py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    title={needsGeo ? "Спершу додайте координати" : undefined}
                  >
                    Схвалити
                  </button>
                  <button onClick={() => act(s.id, "rejected")} className="btn btn-ghost py-2 text-sm">Відхилити</button>
                  <button onClick={() => act(s.id, "suspended")} className="btn btn-ghost py-2 text-sm">Призупинити</button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button onClick={() => verifyPublic(s.id)} className="rounded-full border border-brand-100 px-3 py-1.5 text-ink/70 hover:border-brand hover:text-brand">
                    Перевірено за джерелами
                  </button>
                  <button onClick={() => confirmPhone(s.id)} className="rounded-full border border-brand-100 px-3 py-1.5 text-ink/70 hover:border-brand hover:text-brand">
                    Підтвердити дзвінком
                  </button>
                  <button
                    onClick={() => toggleEmergency(s)}
                    disabled={!s.phoneConfirmedAt}
                    title={!s.phoneConfirmedAt ? "Спершу підтвердіть дзвінком" : undefined}
                    className={`rounded-full px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${
                      s.emergencyAvailable ? "bg-emergency text-white" : "border border-emergency/40 text-emergency-700"
                    }`}
                  >
                    {s.emergencyAvailable ? "Невідкладна: увімкнено" : "Позначити невідкладну"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-bold text-ink">
          Скарги на неточність {reports.length > 0 && <span className="text-ink/40">({reports.length})</span>}
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-ink/50">Повідомлень про неточності немає.</p>
        ) : (
          <ul className="divide-y divide-brand-100/70 rounded-2xl border border-brand-100 text-sm">
            {reports.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <p className="font-medium text-ink/80">{placeNames[r.placeId] ?? r.placeId}</p>
                <p className="text-ink/60">{REPORT_REASON_LABELS[r.reason]}{r.message ? ` — ${r.message}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
