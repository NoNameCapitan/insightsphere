"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isValidCoordinates } from "@/lib/geo/coordinates";
import type { Coordinates } from "@/lib/types";

export type GeoStatus =
  | "idle"
  | "prompting"
  | "granted"
  | "denied"
  | "unavailable"
  | "manual";

export interface GeoState {
  status: GeoStatus;
  coords: Coordinates | null;
  error: string | null;
}

const STORAGE_KEY = "vetnear:coords";
const STORED_POINT_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Browser geolocation with graceful fallback:
 *  - request()        -> ask for permission
 *  - setManual(c)     -> use a manually chosen point (denied/unsupported)
 *  - keeps a manual point in this tab's session; restores it only within one hour
 *  - device GPS coordinates are not persisted
 *  - restored points are manual references, never a fresh device position
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    status: "idle",
    coords: null,
    error: null,
  });
  const revision = useRef(0);

  // Forget the old untimed, persistent location; restore only a fresh manual point.
  useEffect(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const age = Date.now() - parsed?.savedAt;
        if (
          isValidCoordinates(parsed?.coords) &&
          typeof parsed.savedAt === "number" && Number.isFinite(age) &&
          age >= 0 && age < STORED_POINT_MAX_AGE_MS
        ) {
          setState({ status: "manual", coords: parsed.coords, error: null });
        } else {
          // Untimed legacy points cannot prove freshness and are not restored.
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    return () => { revision.current += 1; };
  }, []);

  const persist = useCallback((coords: Coordinates) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ coords, savedAt: Date.now() }));
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const request = useCallback(() => {
    const requestRevision = ++revision.current;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState((s) => ({ ...s, status: s.coords ? "manual" : "unavailable", error: "Геолокація недоступна. Оберіть точку вручну." }));
      return;
    }
    setState((s) => ({ ...s, status: "prompting", error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (requestRevision !== revision.current) return;
        const coords: Coordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        if (!isValidCoordinates(coords)) {
          setState((s) => ({ ...s, status: s.coords ? "manual" : "unavailable", error: "Не вдалося визначити коректну позицію. Оберіть точку вручну." }));
          return;
        }
        try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Optional storage. */ }
        setState({ status: "granted", coords, error: null });
      },
      (err) => {
        if (requestRevision !== revision.current) return;
        setState((s) => ({
          status: s.coords ? "manual" : err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
          coords: s.coords,
          error: err.code === err.PERMISSION_DENIED
            ? "Доступ до геолокації вимкнено. Оберіть точку вручну."
            : "Не вдалося оновити позицію. Спробуйте ще раз або оберіть точку вручну.",
        }));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  const setManual = useCallback(
    (coords: Coordinates) => {
      if (!isValidCoordinates(coords)) return;
      revision.current += 1;
      persist(coords);
      setState({ status: "manual", coords, error: null });
    },
    [persist],
  );

  return { ...state, request, setManual };
}
