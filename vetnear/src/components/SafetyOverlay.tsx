"use client";

import { useEffect, useState } from "react";
import { useKyivAlert } from "@/hooks/useKyivAlert";
import { hasFreshActiveAlert, OFFICIAL_SHELTER_MAP } from "@/lib/safety/client";
import { shelterWalkingRoute } from "@/lib/safety/nearestShelter";
import type { Coordinates } from "@/lib/types";
import type { KyivShelter, KyivSheltersResponse } from "@/lib/safety/types";

const PREF_KEY = "vetnear:shelter-overlay-enabled";

function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} м` : `${(meters / 1000).toFixed(1)} км`;
}

export function useSafetyOverlay(origin: Coordinates | null) {
  const [enabled, setEnabledState] = useState(true);
  const { alert, acceptAlert, refresh } = useKyivAlert();
  const [shelters, setShelters] = useState<KyivShelter[]>([]);
  const [shelterWarning, setShelterWarning] = useState<string | null>(null);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [loadingShelters, setLoadingShelters] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PREF_KEY);
      if (stored !== null) setEnabledState(stored !== "false");
    } catch { /* Storage may be disabled; the control still works in this tab. */ }
  }, []);

  const active = hasFreshActiveAlert(alert);
  const shouldAutoOpenMap = active && enabled;

  useEffect(() => {
    if (!active || !enabled || !origin) {
      setShelters([]);
      setSelectedShelterId(null);
      setLoadingShelters(false);
      setShelterWarning(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoadingShelters(true);
    const params = new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) });
    void fetch(`/api/safety/shelters?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Shelter source unavailable");
        const value = (await response.json()) as KyivSheltersResponse;
        if (cancelled) return;
        setShelters(value.shelters ?? []);
        setShelterWarning(value.warning ?? null);
        setSelectedShelterId((current) =>
          value.shelters?.some((shelter) => shelter.id === current)
            ? current
            : value.shelters?.[0]?.id ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setShelters([]);
          setShelterWarning("Не вдалося отримати офіційний перелік укриттів.");
        }
      })
      .finally(() => { if (!cancelled) setLoadingShelters(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [active, enabled, origin]);

  const setEnabled = (next: boolean) => {
    setEnabledState(next);
    try { window.localStorage.setItem(PREF_KEY, String(next)); } catch { /* Optional persistence. */ }
  };

  return {
    alert,
    acceptAlert,
    refreshAlert: refresh,
    active,
    enabled,
    setEnabled,
    shelters,
    shelterWarning,
    loadingShelters,
    selectedShelterId,
    setSelectedShelterId,
    shouldAutoOpenMap,
  };
}

export function SafetyControls({
  safety,
  onOpenMap,
}: {
  safety: ReturnType<typeof useSafetyOverlay>;
  onOpenMap: () => void;
}) {
  const {
    alert, active, enabled, setEnabled, shelters, shelterWarning,
    loadingShelters, selectedShelterId, setSelectedShelterId,
  } = safety;
  const levelLabel = alert?.level === "red"
    ? "Червона повітряна загроза у Києві"
    : alert?.level === "yellow"
      ? "Жовта дронова загроза у Києві"
      : "Повітряна тривога у Києві";

  return (
    <>
      {active && (
        <section className="mt-3 rounded-3xl border-2 border-emergency/40 bg-emergency-50 p-4" role="alert">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-extrabold text-emergency-700">{levelLabel}</p>
              <p className="mt-1 max-w-2xl text-sm text-ink/75">
                {enabled
                  ? alert?.level === "yellow"
                    ? "Поруч показані актуальні укриття. Рекомендацію можна вимкнути одним натисканням і продовжити маршрут до потрібного закладу."
                    : "На карті показані найближчі актуальні об’єкти з офіційного набору. Перейдіть в укриття та залишайтеся там до відбою."
                  : "Підказки укриттів вимкнені. Статус тривоги залишається видимим."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={enabled ? "btn btn-ghost py-2 text-sm" : "btn btn-brand py-2 text-sm"}
            >
              {enabled ? "Продовжити без підказок" : "Показати укриття"}
            </button>
          </div>

          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emergency/15 bg-white/70 px-3 py-1.5 text-xs font-medium text-ink/70">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Автоматичні підказки укриттів
          </label>

          {enabled && (
            <div className="mt-4">
              {!shelters.length && (
                <p className="text-sm text-ink/60">
                  {loadingShelters ? "Шукаємо найближчі укриття…" : "Потрібна геолокація або офіційний набір тимчасово недоступний."}
                </p>
              )}
              {shelters.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {shelters.slice(0, 3).map((shelter, index) => (
                    <div
                      key={shelter.id}
                      className={`min-w-[220px] rounded-2xl border p-3 text-left text-sm ${
                        shelter.id === selectedShelterId
                          ? "border-emergency bg-white ring-1 ring-emergency/20"
                          : "border-emergency/20 bg-white/70"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => { setSelectedShelterId(shelter.id); onOpenMap(); }}
                        className="block w-full text-left"
                      >
                        <span className="font-bold text-emergency-700">{index + 1}. {formatDistance(shelter.distanceMeters)}</span>
                        <span className="mt-1 block font-medium text-ink">{shelter.address}</span>
                        <span className="mt-1 block text-xs text-ink/55">
                        {shelter.declaredOpen24h ? "У наборі: цілодобово" : shelter.workingHours ?? "Графік не вказано"}
                        </span>
                      </button>
                      <a
                        href={shelterWalkingRoute(shelter)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-brand underline"
                      >
                        Піший маршрут ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
              {shelterWarning && <p className="mt-2 text-xs text-ink/60">⚠️ {shelterWarning}</p>}
              {shelters.length > 0 && (
                <p className="mt-1 text-xs text-ink/50">
                  Пунктир на карті показує напрямок. Для покрокової навігації відкрийте піший маршрут.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={onOpenMap} className="btn btn-brand py-2 text-sm">
                  Відкрити карту укриттів
                </button>
                <a href={OFFICIAL_SHELTER_MAP} target="_blank" rel="noopener noreferrer" className="btn btn-ghost py-2 text-sm">
                  Офіційна карта ↗
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {alert?.state === "unavailable" && (
        <p className="mt-2 text-xs text-ink/50">
          Онлайн-статус тривоги недоступний. {alert.message}{" "}
          <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand underline">Перевірити офіційну карту</a>
        </p>
      )}
    </>
  );
}
