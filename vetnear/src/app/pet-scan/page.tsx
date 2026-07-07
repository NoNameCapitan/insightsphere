"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Disclaimer } from "@/components/JsonLd";
import { track } from "@/lib/analytics";

// Real provider is opt-in via env. Without a key we run a safe local mock.
const HAS_PROVIDER = !!process.env.NEXT_PUBLIC_PETSCAN_PROVIDER;

interface ScanResult {
  summary: string;
  notes: string[];
}

export default function PetScanPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file?: File) => {
    setResult(null);
    setConfirmed(false);
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    const w: string[] = [];
    if (file.size > 8 * 1024 * 1024) w.push("Фото завелике (>8 МБ) — якість аналізу може знизитись.");
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < 400 || img.naturalHeight < 400)
        w.push("Низька роздільність — зробіть чіткіше фото при денному світлі.");
      setWarnings(w);
    };
    img.src = url;
    setWarnings(w);
    track("pet_scan_started");
  };

  const analyze = () => {
    setBusy(true);
    // Safe, non-diagnostic mock. A real provider would replace this branch.
    setTimeout(() => {
      setResult({
        summary: HAS_PROVIDER
          ? "Фото оброблено. Це загальний орієнтир, а не діагноз."
          : "Демо-аналіз: фото отримано. Це не діагноз і не визначення породи.",
        notes: [
          "VetNear не ставить діагнозів і не гарантує визначення породи.",
          "Якщо помітили тривожні ознаки — зверніться до ветеринара.",
          "Для точної оцінки потрібен огляд фахівцем.",
        ],
      });
      setBusy(false);
      track("pet_scan_completed", { provider: HAS_PROVIDER ? "external" : "mock" });
    }, 700);
  };

  return (
    <div className="container-px mx-auto max-w-xl py-6">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl font-extrabold text-ink">Скан улюбленця</h1>
        <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">
          Пілот
        </span>
      </div>
      <p className="mt-1 text-ink/60">
        Демо-концепт: завантажте фото улюбленця. Це безпечний орієнтир, а не медичний
        висновок і не гарантований аналіз породи чи здоровʼя.
      </p>

      <div className="mt-4">
        <Disclaimer text="Це не діагноз і не гарантоване визначення породи. «Скан улюбленця» не замінює огляд ветеринара." />
      </div>

      <p className="mt-3 rounded-2xl bg-brand-50/60 px-4 py-3 text-sm text-ink/70">
        🔒 Приватність: фото обробляється локально у вашому браузері й не
        завантажується на сервер{ HAS_PROVIDER ? ", доки ви не підтвердите надсилання" : "" }.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="mt-4 flex gap-2">
        <button className="btn btn-brand flex-1" onClick={() => fileRef.current?.click()}>
          📷 Зробити / вибрати фото
        </button>
      </div>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Прев'ю" className="mt-4 max-h-72 w-full rounded-2xl object-cover" />
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-2xl bg-amber/10 p-3 text-sm text-amber">
          {warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
        </ul>
      )}

      {preview && !result && (
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2 text-sm text-ink/70">
            <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Я розумію, що це не діагноз і не заміна консультації ветеринара.
          </label>
          <button
            className="btn btn-brand w-full disabled:opacity-50"
            disabled={!confirmed || busy}
            onClick={analyze}
          >
            {busy ? "Аналізуємо…" : "Аналізувати фото"}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-2xl border border-brand-100 p-4">
          <p className="font-medium text-ink">{result.summary}</p>
          <ul className="mt-2 space-y-1 text-sm text-ink/70">
            {result.notes.map((n) => <li key={n}>• {n}</li>)}
          </ul>
          <Link href="/nearby?category=veterinary_clinic" className="btn btn-brand mt-3 w-full">
            Знайти ветклініки поруч →
          </Link>
        </div>
      )}
    </div>
  );
}
