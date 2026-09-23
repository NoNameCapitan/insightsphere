"use client";

import { useEffect, useRef } from "react";

export type ToastAction = { label: string; onClick: () => void };

export type ToastState = {
  message: string;
  actions?: ToastAction[];
} | null;

// Accessible toast: announced to screen readers (role=status / aria-live),
// keyboard-reachable action buttons, and a labelled close control.
export default function ActionToast({
  toast,
  onClose,
  autoHideMs = 6000,
}: {
  toast: ToastState;
  onClose: () => void;
  autoHideMs?: number;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (toast) {
      timer.current = setTimeout(onClose, autoHideMs);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, autoHideMs, onClose]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 lg:bottom-5 left-1/2 z-[60] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-lg"
    >
      <span className="font-medium">{toast.message}</span>
      {toast.actions?.map((a) => (
        <button
          key={a.label}
          onClick={() => {
            a.onClick();
            onClose();
          }}
          className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold text-white underline-offset-2 hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {a.label}
        </button>
      ))}
      <button
        onClick={onClose}
        aria-label="Закрити сповіщення"
        className="ml-1 rounded-md px-1.5 py-0.5 text-white/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        ✕
      </button>
    </div>
  );
}
