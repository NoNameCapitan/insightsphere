"use client";

export default function DemoModeBanner({
  message,
  onConnect,
  onContinueDemo,
  onLearn,
}: {
  message?: string;
  onConnect?: () => void;
  onContinueDemo?: () => void;
  onLearn?: () => void;
}) {
  const hasActions = onConnect || onContinueDemo || onLearn;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-white">
          i
        </span>
        <p>
          {message ??
            "Демо-режим: показано приклади бізнесів. Підключіть Google Places для реального пошуку."}
        </p>
      </div>
      {hasActions && (
        <div className="mt-3 flex flex-wrap gap-2 pl-8">
          {onConnect && (
            <button
              onClick={onConnect}
              className="btn-primary btn-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Підключити Google Places
            </button>
          )}
          {onContinueDemo && (
            <button
              onClick={onContinueDemo}
              className="btn-ghost btn-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Продовжити демо
            </button>
          )}
          {onLearn && (
            <button
              onClick={onLearn}
              className="btn-ghost btn-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Дізнатися, як це працює
            </button>
          )}
        </div>
      )}
    </div>
  );
}
