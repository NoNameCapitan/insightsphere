"use client";

import { useEffect } from "react";

/** Registers the PWA service worker in production-capable browsers. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        /* registration is best-effort */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
