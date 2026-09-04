"use client";

import { useState } from "react";
import { SocialRow } from "@/components/SocialRow";
import { track } from "@/lib/analytics";
import { googleMapsRoute } from "@/lib/maps";
import { getActivePetId } from "@/lib/pets/store";
import { createReport } from "@/lib/reports/store";
import { createRequest } from "@/lib/requests/store";
import { EXTERNAL_LINK_PROPS, safeUrl } from "@/lib/security/url";
import type { Place, ReportIssue } from "@/lib/types";

const REPORT_REASONS: { value: ReportIssue["reason"]; label: string }[] = [
  { value: "wrong_phone", label: "Невірний телефон" },
  { value: "wrong_address", label: "Невірна адреса" },
  { value: "wrong_hours", label: "Невірний графік" },
  { value: "closed_permanently", label: "Заклад закрито" },
  { value: "duplicate", label: "Дублікат" },
  { value: "other", label: "Інше" },
];

export function PlaceActions({ place }: { place: Place }) {
  const website = safeUrl(place.website);
  const email = place.email;
  const [reqOpen, setReqOpen] = useState(false);
  const [reqDone, setReqDone] = useState(false);
  const [repOpen, setRepOpen] = useState(false);
  const [repDone, setRepDone] = useState(false);
  const [reason, setReason] = useState<ReportIssue["reason"]>("wrong_phone");
  const [reqMsg, setReqMsg] = useState("");

  const submitRequest = () => {
    createRequest({
      petId: getActivePetId() ?? undefined,
      placeId: place.id,
      serviceType: place.category,
      message: reqMsg.trim() || undefined,
    });
    setReqDone(true);
    setReqOpen(false);
  };

  const submitReport = () => {
    createReport(place.id, reason);
    setRepDone(true);
    setRepOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <a
          href={`tel:${place.phone}`}
          onClick={() => track("call_clicked", { placeId: place.id })}
          className="btn btn-brand"
        >
          Зателефонувати
        </a>
        <a
          href={googleMapsRoute(place)}
          {...EXTERNAL_LINK_PROPS}
          onClick={() => track("route_clicked", { placeId: place.id })}
          className="btn btn-ghost"
        >
          Маршрут
        </a>
        {website && (
          <a
            href={website}
            {...EXTERNAL_LINK_PROPS}
            onClick={() => track("website_clicked", { placeId: place.id })}
            className="btn btn-ghost"
          >
            Сайт
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="btn btn-ghost">
            Email
          </a>
        )}
      </div>

      <SocialRow links={place.socialLinks} placeId={place.id} />

      {/* Request service (Module 7) */}
      <div className="rounded-2xl border border-brand-100 p-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-ink">Записатися / запит послуги</p>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/50">
            інтеграція бронювання — скоро
          </span>
        </div>
        {reqDone ? (
          <p className="mt-2 text-sm text-brand">
            Запит збережено локально. Заклад зможе підтвердити його в майбутньому.
          </p>
        ) : reqOpen ? (
          <div className="mt-3 space-y-2">
            <textarea
              className="w-full rounded-xl border border-brand-100 px-3 py-2 text-sm"
              rows={2}
              placeholder="Коротко опишіть запит (необов'язково)"
              value={reqMsg}
              onChange={(e) => setReqMsg(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="btn btn-brand flex-1 py-2 text-sm" onClick={submitRequest}>
                Надіслати запит
              </button>
              <button className="btn btn-ghost py-2 text-sm" onClick={() => setReqOpen(false)}>
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost mt-3 w-full py-2 text-sm" onClick={() => setReqOpen(true)}>
            Запит послуги
          </button>
        )}
      </div>

      {/* Report issue (Module 4 + 12) */}
      <div className="rounded-2xl border border-brand-100 p-4">
        <p className="font-medium text-ink">Повідомити про неточність</p>
        {repDone ? (
          <p className="mt-2 text-sm text-brand">Дякуємо! Повідомлення збережено для модерації.</p>
        ) : repOpen ? (
          <div className="mt-3 space-y-2">
            <select
              className="w-full rounded-xl border border-brand-100 px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportIssue["reason"])}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button className="btn btn-brand flex-1 py-2 text-sm" onClick={submitReport}>
                Надіслати
              </button>
              <button className="btn btn-ghost py-2 text-sm" onClick={() => setRepOpen(false)}>
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost mt-3 w-full py-2 text-sm" onClick={() => setRepOpen(true)}>
            Повідомити про проблему
          </button>
        )}
      </div>

      {/* Sticky bottom actions (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-100 bg-canvas/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl gap-2">
          <a href={`tel:${place.phone}`} className="btn btn-brand flex-1 py-2.5">
            Зателефонувати
          </a>
          <a href={googleMapsRoute(place)} {...EXTERNAL_LINK_PROPS} className="btn btn-ghost flex-1 py-2.5">
            Маршрут
          </a>
        </div>
      </div>
    </div>
  );
}
