"use client";

import { useCallback, useEffect, useState } from "react";
import { useDialog } from "@/lib/useDialog";
import { useRouter } from "next/navigation";
import IntegrationCard from "@/components/IntegrationCard";
import {
  GOOGLE_CLOUD_CREDENTIALS_URL,
  GOOGLE_MAPS_JS_LIBRARY_URL,
  GOOGLE_PLACES_LIBRARY_URL,
  buildEnvSnippet,
  markOnboardingDone,
  nextStep,
  prevStep,
  setForceDemo,
  stepProgress,
  type WizardMode,
  type WizardStep,
} from "@/lib/onboarding";

type StatusResponse = { googlePlaces: boolean; mapsBrowserKey: boolean };

function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-ghost btn-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      {children}
    </a>
  );
}

export default function SetupWizard({
  open,
  onClose,
  initialMode = null,
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: WizardMode | null;
}) {
  const router = useRouter();
  const dialogRef = useDialog(open, onClose);
  const [mode, setMode] = useState<WizardMode | null>(initialMode);
  const [step, setStep] = useState<WizardStep>("mode");
  const [withMaps, setWithMaps] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setStatus({
        googlePlaces: !!data.googlePlaces,
        mapsBrowserKey: !!data.mapsBrowserKey,
      });
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setStep("mode");
      setWithMaps(false);
      setStatus(null);
      setCopied(false);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (step === "verify") checkStatus();
  }, [step, checkStatus]);

  if (!open) return null;

  const { index, total } = stepProgress(step, mode);
  const canBack = prevStep(step, mode) !== null;

  function goNext() {
    const n = nextStep(step, mode);
    if (n) setStep(n);
  }
  function goBack() {
    const p = prevStep(step, mode);
    if (p) setStep(p);
  }

  function finishToSearch() {
    markOnboardingDone();
    onClose();
    router.push("/search");
  }
  function finishToDemo() {
    setForceDemo(true);
    markOnboardingDone();
    onClose();
    router.push("/search?demo=1");
  }

  async function copyEnv() {
    try {
      await navigator.clipboard.writeText(buildEnvSnippet({ withMaps }));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-5 shadow-xl outline-none sm:rounded-2xl"
      >
        {/* Header + progress */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="wizard-title" className="text-lg font-bold text-ink">
              Майстер налаштування
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Крок {index} з {total}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити майстер"
            className="rounded-md px-2 py-1 text-slate-400 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            ✕
          </button>
        </div>
        <div
          className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={index}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>

        {/* Step: mode */}
        {step === "mode" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Як хочете почати?</p>
            <button
              onClick={() => {
                setMode("demo");
                setStep("verify");
              }}
              className="card w-full p-4 text-left transition hover:ring-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <p className="text-sm font-bold text-ink">Спробувати демо</p>
              <p className="mt-1 text-xs text-slate-500">
                100+ прикладів бізнесів, без ключів і без витрат. Усі функції
                працюють.
              </p>
            </button>
            <button
              onClick={() => {
                setMode("real");
                setStep("source");
              }}
              className="card w-full p-4 text-left transition hover:ring-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <p className="text-sm font-bold text-ink">
                Підключити реальні дані
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Пошук справжніх бізнесів через Google Places API (потрібен
                ключ).
              </p>
            </button>
          </div>
        )}

        {/* Step: source */}
        {step === "source" && (
          <div className="space-y-3">
            <IntegrationCard
              title="Google Places API"
              benefit="Реальні бізнеси, адреси, телефони, рейтинги поруч."
              cost="Платний, але є безкоштовний місячний кредит; запити обмежені FieldMask."
              opens="Справжній пошук замість демо-даних."
            />
            <IntegrationCard
              title="Google Maps browser key"
              benefit="Перегляд лідів на карті."
              cost="Необов'язково. Окремий ключ, обмежений по домену."
              opens="Вкладку «Карта» в результатах."
            >
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={withMaps}
                  onChange={(e) => setWithMaps(e.target.checked)}
                />
                Також додати Maps browser key до інструкції
              </label>
            </IntegrationCard>
          </div>
        )}

        {/* Step: configure */}
        {step === "configure" && (
          <div className="space-y-3 text-sm text-slate-600">
            <p className="font-semibold text-ink">
              Створення та обмеження ключа
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-xs">
              <li>
                Відкрийте Google Cloud Console і виберіть/створіть проєкт.
              </li>
              <li>Увімкніть «Places API (New)» у бібліотеці API.</li>
              <li>Створіть API-ключ у розділі Credentials.</li>
              <li>Обмежте ключ до «Places API (New)».</li>
              {withMaps && (
                <li>
                  Для карти увімкніть «Maps JavaScript API» і створіть окремий
                  browser-ключ з обмеженням за доменом.
                </li>
              )}
            </ol>
            <div className="flex flex-wrap gap-2">
              <ExtLink href={GOOGLE_PLACES_LIBRARY_URL}>
                Відкрити Places API
              </ExtLink>
              <ExtLink href={GOOGLE_CLOUD_CREDENTIALS_URL}>
                Відкрити Credentials
              </ExtLink>
              {withMaps && (
                <ExtLink href={GOOGLE_MAPS_JS_LIBRARY_URL}>
                  Відкрити Maps JS API
                </ExtLink>
              )}
            </div>

            <div>
              <p className="mb-1 font-semibold text-ink">
                Додайте у файл .env.local
              </p>
              <pre className="overflow-x-auto rounded-lg bg-ink p-3 text-[11px] leading-relaxed text-white">
                {buildEnvSnippet({ withMaps })}
              </pre>
              <button
                onClick={copyEnv}
                className="btn-ghost btn-sm mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {copied ? "Скопійовано ✓" : "Скопіювати .env.local"}
              </button>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
              Ключі зберігаються лише у <code>.env.local</code> на сервері — не
              в браузері та не в коді. Це не OAuth-підключення. Після додавання
              ключа <strong>перезапустіть застосунок</strong>, щоб Next.js
              зчитав змінні середовища.
            </div>
          </div>
        )}

        {/* Step: verify */}
        {step === "verify" && (
          <div className="space-y-3">
            {mode === "demo" ? (
              <div className="card p-4 text-sm text-slate-600">
                <p className="font-semibold text-ink">Демо готове до роботи</p>
                <p className="mt-1 text-xs">
                  Ключі не потрібні. Можна одразу шукати приклади бізнесів.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                  <span className="text-slate-600">Google Places API</span>
                  <span
                    className={
                      status?.googlePlaces
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-slate-400"
                    }
                  >
                    {checking
                      ? "Перевірка…"
                      : status?.googlePlaces
                        ? "Налаштовано ✓"
                        : "Не налаштовано"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                  <span className="text-slate-600">
                    Google Maps browser key
                  </span>
                  <span
                    className={
                      status?.mapsBrowserKey
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-slate-400"
                    }
                  >
                    {checking
                      ? "Перевірка…"
                      : status?.mapsBrowserKey
                        ? "Налаштовано ✓"
                        : "Не налаштовано"}
                  </span>
                </div>
                {status && !status.googlePlaces && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                    Ключ ще не зчитано. Перевірте <code>.env.local</code> і
                    перезапустіть застосунок, тоді натисніть «Перевірити ще
                    раз».
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {mode === "real" && (
                <button
                  onClick={checkStatus}
                  className="btn-ghost btn-sm"
                  disabled={checking}
                >
                  Перевірити ще раз
                </button>
              )}
              <button onClick={finishToSearch} className="btn-primary btn-sm">
                Перейти до пошуку
              </button>
              <button onClick={finishToDemo} className="btn-ghost btn-sm">
                Продовжити в демо
              </button>
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={goBack}
            disabled={!canBack}
            className={
              "btn-ghost btn-sm " +
              (canBack ? "" : "cursor-not-allowed text-slate-300")
            }
          >
            Назад
          </button>
          <div className="flex gap-2">
            {step !== "verify" && (
              <button
                onClick={() => setStep("verify")}
                className="btn-ghost btn-sm"
              >
                Пропустити
              </button>
            )}
            {step !== "verify" && (
              <button onClick={goNext} className="btn-primary btn-sm">
                Продовжити
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
