"use client";

import { useEffect, useRef, useState } from "react";
import { hasFreshActiveAlert, hasFreshAlertStatus, OFFICIAL_SHELTER_MAP } from "@/lib/safety/client";
import { resolveNearestShelterRoute, ShelterRouteError, type ShelterRoutePhase } from "@/lib/safety/nearestShelter";
import type { KyivAlertStatus } from "@/lib/safety/types";
import { BombShelterIcon } from "@/components/icons/ServiceIcons";

const PHASE_TEXT: Record<ShelterRoutePhase, string> = {
  checking: "Перевіряємо тривогу…", locating: "Визначаємо місце…", searching: "Шукаємо укриття…",
};

/** Separate manual action; deliberately independent of the automatic overlay toggle. */
export function NearestShelterButton({ alert, onAlertStatus, onRefresh }: {
  alert: KyivAlertStatus | null;
  onAlertStatus: (value: KyivAlertStatus) => void;
  onRefresh?: () => void;
}) {
  const [phase, setPhase] = useState<ShelterRoutePhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const active = hasFreshActiveAlert(alert);
  useEffect(() => {
    if (!active) { request.current?.abort(); request.current = null; setPhase(null); }
    setError(null);
  }, [active]);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  const navigate = async () => {
    // Also guard the handler against a stale render, keyboard repetition or double tap.
    if (!hasFreshActiveAlert(alert) || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    setPhase("checking");
    const timeout = window.setTimeout(() => controller.abort("timeout"), 35_000);
    try {
      const route = await resolveNearestShelterRoute({ signal: controller.signal, onPhase: setPhase, onAlertStatus });
      if (!controller.signal.aborted) {
        // Same-tab navigation avoids asynchronous popup blocking on mobile browsers.
        // The system Back action returns to VetNear without changing the overlay preference.
        window.location.assign(route.url);
      }
    } catch (cause) {
      if (request.current === controller && (!controller.signal.aborted || controller.signal.reason === "timeout")) {
        setError(controller.signal.reason === "timeout"
          ? "Пошук триває занадто довго. Спробуйте ще раз або відкрийте офіційну карту."
          : cause instanceof ShelterRouteError ? cause.message : "Не вдалося побудувати маршрут. Перевірте з’єднання й спробуйте ще раз.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setPhase(null); }
    }
  };

  const hint = active ? "Піший маршрут у Google Maps · потрібна геолокація"
    : !alert ? "Перевіряємо статус тривоги…"
      : alert.state === "inactive" && hasFreshAlertStatus(alert) ? "Активна лише під час тривоги"
        : "Статус тривоги недоступний — кнопка вимкнена";
  if (!active) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-brand-100/80 bg-white px-2.5 py-1.5">
        <button
          type="button"
          aria-label="Укриття"
          disabled
          aria-describedby="nearest-shelter-hint"
          className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-xs font-semibold text-ink/45 disabled:cursor-not-allowed"
        >
          <BombShelterIcon className="h-7 w-7" /> Укриття
        </button>
        <p id="nearest-shelter-hint" role="status" aria-live="polite" className="min-w-0 flex-1 truncate text-[11px] text-ink/50">{hint}</p>
        {onRefresh && alert?.state === "unavailable" && (
          <button type="button" onClick={onRefresh} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand">Оновити</button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-label="Укриття"
          aria-describedby="nearest-shelter-hint"
          aria-busy={phase !== null}
          disabled={!active || phase !== null}
          onClick={() => { void navigate(); }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emergency px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emergency-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emergency disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/45 motion-reduce:transition-none"
        >
          <BombShelterIcon className="h-7 w-7" />
          Укриття
        </button>
        <p id="nearest-shelter-hint" role="status" aria-live="polite" className="min-w-0 flex-1 text-xs text-ink/65">
          {phase ? PHASE_TEXT[phase] : hint}
        </p>
        {phase && <button type="button" className="btn btn-ghost min-h-11 py-2 text-xs" onClick={() => {
          request.current?.abort(); request.current = null; setPhase(null);
        }}>Скасувати</button>}
      </div>
      {active && <p className="mt-2 text-[11px] text-ink/60">Найближче за прямою відстанню серед актуальних цілодобових записів у радіусі 10 км. Фізичний доступ не гарантовано.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-emergency-700">{error}</p>}
      {error && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="font-semibold text-brand underline underline-offset-2">
              Оновити статус
            </button>
          )}
          <a href={OFFICIAL_SHELTER_MAP} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2">Офіційна карта укриттів ↗</a>
        </div>
      )}
    </div>
  );
}
