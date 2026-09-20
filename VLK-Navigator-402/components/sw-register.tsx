"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let disposed = false;
    let requestedReload = false;
    let checking = false;
    let lastCheck = 0;
    let registration: ServiceWorkerRegistration | undefined;
    const cleanup: (() => void)[] = [];
    const watched = new WeakSet<ServiceWorker>();

    const offerUpdate = () => {
      if (disposed || !registration?.waiting) return;
      toast("Нова версія готова", {
        id: "vlk-update", duration: Infinity, description: "Оновіть сторінку, коли завершите поточну дію.",
        action: { label: "Оновити", onClick: () => {
          requestedReload = true;
          registration?.waiting?.postMessage({ type: "ACTIVATE_UPDATE" });
        } },
      });
    };
    const watch = () => {
      const worker = registration?.installing;
      if (!worker || watched.has(worker)) return;
      watched.add(worker);
      const changed = () => {
        if (disposed || worker.state !== "installed") return;
        if (navigator.serviceWorker.controller) {
          // The waiting slot may be assigned just after the installed event.
          const timer = window.setTimeout(offerUpdate, 0);
          cleanup.push(() => window.clearTimeout(timer));
        }
        else toast.success("Офлайн-копія готова", { id: "vlk-offline-ready" });
      };
      worker.addEventListener("statechange", changed);
      cleanup.push(() => worker.removeEventListener("statechange", changed));
      changed();
    };
    const check = async () => {
      if (disposed || checking || !navigator.onLine || Date.now() - lastCheck < 60_000) return;
      checking = true;
      lastCheck = Date.now();
      try {
        const response = await fetch("/offline-manifest.json", { cache: "no-store" });
        if (!response.ok) return;
        const manifest: unknown = await response.json();
        const version = manifest && typeof manifest === "object" && "version" in manifest ? manifest.version : undefined;
        if (typeof version !== "string" || !/^[a-f0-9]{64}$/.test(version) || disposed) return;
        const next = await navigator.serviceWorker.register(`/sw.js?release=${version}`, { updateViaCache: "none" });
        if (disposed) return;
        if (registration !== next) {
          registration = next;
          registration.addEventListener("updatefound", watch);
          cleanup.push(() => next.removeEventListener("updatefound", watch));
        }
        watch();
        offerUpdate();
      } catch { /* Stay on the last complete release when offline or blocked. */ }
      finally { checking = false; }
    };
    const changed = () => { if (requestedReload) window.location.reload(); };
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", visible);
    void check();
    return () => {
      disposed = true;
      cleanup.forEach((fn) => fn());
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", visible);
      toast.dismiss("vlk-update");
    };
  }, []);
  return null;
}
