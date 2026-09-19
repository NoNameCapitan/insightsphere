"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// Слідкує за доступністю локального сервера й реєструє service worker.
// Медичні дані в браузері не зберігаються: банер лише попереджає працівника,
// щоб він не закрив вкладку з незбереженою формою.
const UP_INTERVAL = 25000;
const DOWN_INTERVAL = 5000;

async function probe() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch("/api/health", {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function OfflineGuard() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext)
      navigator.serviceWorker
        .register("/sw.js?v=" + (process.env.VLK_BUILD_STAMP || "dev"))
        .catch(() => undefined /* кеш оболонки не критичний для роботи */);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const ok = await probe();
      if (!active) return;
      setDown(!ok);
      timer = setTimeout(check, ok ? UP_INTERVAL : DOWN_INTERVAL);
    };
    const now = () => {
      clearTimeout(timer);
      void check();
    };
    void check();
    const visible = () => {
      if (document.visibilityState === "visible") now();
    };
    window.addEventListener("online", now);
    window.addEventListener("offline", now);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("online", now);
      window.removeEventListener("offline", now);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  if (!down) return null;
  return (
    <div className="server-down no-print" role="alert" aria-live="assertive">
      <WifiOff size={18} aria-hidden />
      <div>
        <strong>Локальний сервер не відповідає.</strong> Не закривайте вкладки з
        незбереженими формами — текст залишається на екрані. Перевірте вікно
        запуску на комп&apos;ютері-сервері та повторіть збереження. Інтернет для
        роботи не потрібен.
      </div>
    </div>
  );
}
