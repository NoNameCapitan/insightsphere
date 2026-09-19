"use client";
import { useEffect, useState } from "react";
import { WifiOff, DatabaseZap } from "lucide-react";
import {
  probeHealth,
  isLocalHost,
  type Reachability,
} from "@/lib/reachability";

// Слідкує за доступністю сервера й реєструє service worker.
// Медичні дані в браузері не зберігаються: банер лише попереджає працівника,
// щоб він не закрив вкладку з незбереженою формою.
const UP_INTERVAL = 25000;
const DOWN_INTERVAL = 5000;

export function OfflineGuard() {
  const [state, setState] = useState<Reachability>("ok");
  const [local, setLocal] = useState(true);
  const [onStandby, setOnStandby] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext)
      navigator.serviceWorker
        .register("/sw.js?v=" + (process.env.VLK_BUILD_STAMP || "dev"))
        .catch(() => undefined /* кеш оболонки не критичний для роботи */);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setLocal(isLocalHost(window.location.hostname));
    // Екран очікування вже пояснює стан бази — дублювати його банером не треба.
    setOnStandby(!!document.querySelector("[data-vlk-standby]"));
    const check = async () => {
      const result = await probeHealth();
      if (!active) return;
      setState(result);
      timer = setTimeout(check, result === "ok" ? UP_INTERVAL : DOWN_INTERVAL);
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

  if (state === "ok") return null;

  if (state === "degraded") {
    if (onStandby) return null;
    return (
      <div className="server-down no-print" role="alert" aria-live="assertive">
        <DatabaseZap size={18} aria-hidden />
        <div>
          <strong>База даних недоступна.</strong> Сервер працює, але зберегти
          запис зараз не вдасться. Не закривайте вкладки з незбереженими формами
          — текст залишається на екрані. Причину показує сторінка{" "}
          <a href="/api/health">/api/health</a>; після відновлення бази
          повторіть збереження.
        </div>
      </div>
    );
  }

  return (
    <div className="server-down no-print" role="alert" aria-live="assertive">
      <WifiOff size={18} aria-hidden />
      <div>
        {local ? (
          <>
            <strong>Локальний сервер не відповідає.</strong> Не закривайте
            вкладки з незбереженими формами — текст залишається на екрані.
            Перевірте вікно запуску на комп&apos;ютері-сервері та повторіть
            збереження. Інтернет для роботи не потрібен.
          </>
        ) : (
          <>
            <strong>Сервер застосунку не відповідає.</strong> Не закривайте
            вкладки з незбереженими формами — текст залишається на екрані.
            Перевірте з&apos;єднання та повторіть збереження.
          </>
        )}
      </div>
    </div>
  );
}
