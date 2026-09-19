"use client";
import { useRef, useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "./ui/button";
export function CopyField({ label, value }: { label: string; value: string }) {
  const input = useRef<HTMLTextAreaElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    [state, setState] = useState("");
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function copy() {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      /* Переходимо до локального резервного способу. */
    }
    if (!ok) {
      input.current?.focus();
      input.current?.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
    }
    setState(
      ok
        ? "Скопійовано"
        : "Текст виділено. Натисніть Ctrl+C / ⌘C або «Копіювати».",
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(""), 3500);
  }
  return (
    <div className="copy-field">
      <div className="copy-heading">
        <strong>{label}</strong>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copy}
          aria-label={"Копіювати: " + label}
        >
          {state === "Скопійовано" ? <Check size={15} /> : <Copy size={15} />}
          Копіювати
        </Button>
      </div>
      <textarea
        ref={input}
        readOnly
        aria-label={label}
        value={value}
        rows={value.length > 200 ? 4 : 2}
      />
      <span className="copy-status" role="status">
        {state}
      </span>
    </div>
  );
}
