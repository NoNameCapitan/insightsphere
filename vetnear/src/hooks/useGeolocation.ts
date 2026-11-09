"use client";

import { useCallback, useEffect, useState } from "react";
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

/**
 * Browser geolocation with graceful fallback:
 *  - request()        -> ask for permission
 *  - setManual(c)     -> use a manually chosen point (denied/unsupported)
 *  - persists the last known point to localStorage
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    status: "idle",
    coords: null,
    error: null,
  });

  // Restore last known location on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Coordinates;
        if (
          typeof parsed?.latitude === "number" &&
          typeof parsed?.longitude === "number"
        ) {
          setState((s) => ({ ...s, coords: parsed }));
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const persist = useCallback((coords: Coordinates) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState((s) => ({ ...s, status: "unavailable" }));
      return;
    }
    setState((s) => ({ ...s, status: "prompting", error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        persist(coords);
        setState({ status: "granted", coords, error: null });
      },
      (err) => {
        setState({
          status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
          coords: null,
          error: err.message,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [persist]);

  const setManual = useCallback(
    (coords: Coordinates) => {
      persist(coords);
      setState({ status: "manual", coords, error: null });
    },
    [persist],
  );

  return { ...state, request, setManual };
}
