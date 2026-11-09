"use client";

import { useCallback, useEffect, useState } from "react";
import type { KyivAlertStatus } from "@/lib/safety/types";
import { fetchCurrentKyivAlert, hasFreshAlertStatus, unavailableAlert } from "@/lib/safety/client";

/** Polling is serial, bounded and never falls back to a cached active alarm. */
export function useKyivAlert() {
  const [alert, setAlert] = useState<KyivAlertStatus | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const refresh = useCallback(() => setRefreshRevision((value) => value + 1), []);
  const acceptAlert = useCallback((value: KyivAlertStatus) => {
    const next = hasFreshAlertStatus(value) ? value : unavailableAlert("Актуальний статус тривоги не підтверджено.");
    // A slower background poll must not overwrite a newer manual all-clear check.
    setAlert((previous) => previous && Date.parse(previous.checkedAt) > Date.parse(next.checkedAt) ? previous : next);
  }, []);
  useEffect(() => {
    let stopped = false;
    let current: AbortController | null = null;
    const check = async () => {
      if (stopped || current || !navigator.onLine) return;
      const controller = new AbortController();
      current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const value = await fetchCurrentKyivAlert(controller.signal);
        if (!stopped && current === controller) {
          acceptAlert(value);
        }
      } catch {
        if (!stopped && current === controller) setAlert(unavailableAlert("Не вдалося оновити статус тривоги."));
      } finally {
        window.clearTimeout(timeout);
        if (current === controller) current = null;
      }
    };
    const refreshFromEvent = () => {
      current?.abort();
      current = null;
      setAlert(unavailableAlert("Перевіряємо актуальний статус тривоги…"));
      void check();
    };
    const onVisible = () => { if (document.visibilityState === "visible") refreshFromEvent(); };
    const offline = () => {
      current?.abort();
      current = null;
      setAlert(unavailableAlert("Немає мережі. Перевірте офіційні сповіщення."));
    };
    if (navigator.onLine) void check(); else offline();
    const poll = window.setInterval(() => { void check(); }, 30_000);
    const expiry = window.setInterval(() => {
      setAlert((value) => value && value.state !== "unavailable" && !hasFreshAlertStatus(value)
        ? unavailableAlert("Статус тривоги застарів. Очікуємо оновлення.") : value);
    }, 5_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refreshFromEvent);
    window.addEventListener("offline", offline);
    return () => {
      stopped = true;
      current?.abort();
      window.clearInterval(poll);
      window.clearInterval(expiry);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refreshFromEvent);
      window.removeEventListener("offline", offline);
    };
  }, [acceptAlert, refreshRevision]);
  return { alert, acceptAlert, refresh };
}
