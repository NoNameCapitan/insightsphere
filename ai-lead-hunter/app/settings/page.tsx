"use client";
import { useEffect, useRef, useState } from "react";
import {
  Settings2,
  MapPin,
  Sparkles,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  LockKeyhole,
} from "lucide-react";
import SetupWizard from "@/components/SetupWizard";
import {
  getCampaigns,
  importCampaigns,
  replaceCampaigns,
} from "@/lib/campaignStorage";
import { parseBackup, serializeBackup } from "@/lib/backup";
import { downloadText } from "@/lib/download";
import type { Campaign } from "@/lib/types";
type Status = {
  googlePlaces: boolean;
  mapsBrowserKey: boolean;
  aiProvider: string;
  aiReady: boolean;
  aiKeyConfigured: boolean;
  aiModelConfigured: boolean;
  aiModel?: string | null;
  demoMode: boolean;
  passwordProtected: boolean;
  defaultCity: string;
  defaultCountry: string;
};
export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [forceDemo, setForceDemo] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [notice, setNotice] = useState("");
  const [check, setCheck] = useState("");
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<Campaign[] | null>(null);
  const [replace, setReplace] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function load() {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setStatus)
      .catch(() =>
        setNotice("Не вдалося отримати стан сервера. Перевірте з’єднання."),
      );
  }
  useEffect(() => {
    load();
    try {
      setForceDemo(localStorage.getItem("alh_force_demo") === "true");
    } catch {
      setNotice(
        "Сховище браузера заблоковане. Кампанії можуть не зберігатися.",
      );
    }
  }, []);
  function backup() {
    try {
      const data = serializeBackup(getCampaigns());
      downloadText(
        data,
        `lead-hunter-backup-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json",
      );
      setNotice("Резервну копію підготовлено для завантаження.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8000000) throw Error("Максимальний розмір копії — 8 МБ.");
      setPending(parseBackup(await file.text()));
      setReplace(false);
      setNotice("Файл перевірено. Оберіть спосіб відновлення нижче.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  async function checkGoogle(provider: "google" | "ai" = "google") {
    setChecking(true);
    setCheck("");
    try {
      const r = await fetch("/api/integrations/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setCheck(data.message);
    } catch (e) {
      setCheck((e as Error).message);
    } finally {
      setChecking(false);
    }
  }
  const env =
    "GOOGLE_PLACES_API_KEY=your_server_key\nNEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=your_browser_key\nNEXT_PUBLIC_DEMO_MODE=false\nAI_PROVIDER=anthropic\nAI_PROVIDER_API_KEY=your_ai_key\nAI_MODEL=claude-opus-5\n# AI_BASE_URL=https://openrouter.ai/api/v1  (для openai_compatible)\nAPP_PASSWORD=your_private_workspace_password";
  return (
    <div className="container-app py-7 sm:py-9">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-eyebrow">Ваш робочий простір</p>
          <h1 className="page-title">Налаштування й дані</h1>
          <p className="mt-2 text-sm text-slate-500">
            Підключіть джерела, перевірте доступ і збережіть свою роботу.
          </p>
        </div>
        <button className="btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={14} />
          Оновити стан
        </button>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Settings2 size={18} className="text-brand-600" />
              <h2 className="font-semibold">Підключення</h2>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Наявність ключа в конфігурації ще не підтверджує, що сервіс
              відповідає.
            </p>
            <div className="mt-5 space-y-5">
              {[
                {
                  name: "Google Places",
                  description: "Реальні бізнеси, телефони, сайти та рейтинги",
                  ok: status?.googlePlaces,
                  icon: SearchIcon,
                },
                {
                  name: "Карта",
                  description: status?.mapsBrowserKey
                    ? "Google Maps JavaScript API"
                    : "OpenStreetMap працює без ключа; ключ Google Maps — необов’язковий",
                  ok: true,
                  label: status?.mapsBrowserKey ? "Google" : "OSM",
                  icon: MapPin,
                },
                {
                  name: `AI-чернетки · ${status?.aiProvider ?? "none"}`,
                  description: status?.aiModel
                    ? `Модель: ${status.aiModel}`
                    : "OpenAI, Anthropic або OpenAI-сумісний (Gemini, OpenRouter, Groq, Ollama)",
                  ok: status?.aiReady,
                  icon: Sparkles,
                },
              ].map(({ name, description, ok, icon: Icon, ...rest }) => (
                <div key={name} className="flex items-start gap-3">
                  <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {description}
                    </p>
                  </div>
                  <span
                    className={`chip shrink-0 ${ok ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {status
                      ? "label" in rest && rest.label
                        ? rest.label
                        : ok
                          ? "Задано"
                          : "Не задано"
                      : "…"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="btn-primary btn-sm"
                onClick={() => setWizard(true)}
              >
                Майстер підключення
              </button>
              <button
                className="btn-ghost btn-sm"
                disabled={!status?.googlePlaces || checking}
                onClick={() => checkGoogle("google")}
              >
                <RefreshCw
                  size={13}
                  className={checking ? "animate-spin" : ""}
                />
                {checking ? "Перевіряємо…" : "Перевірити Google"}
              </button>
              <button
                className="btn-ghost btn-sm"
                disabled={!status?.aiReady || checking}
                onClick={() => checkGoogle("ai")}
              >
                <Sparkles size={13} />
                Перевірити AI
              </button>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Кожна перевірка робить один мінімальний запит до вашого API;
              враховується тариф провайдера.
            </p>
            {check && (
              <p
                role="status"
                className="mt-3 rounded-xl bg-brand-50 p-3 text-xs text-brand-800"
              >
                {check}
              </p>
            )}
          </section>
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">Демо-режим</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Навчальна вибірка вигаданих бізнесів Києва. Без витрат на API.
                </p>
              </div>
              <button
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${forceDemo ? "bg-brand-600" : "bg-slate-300"}`}
                role="switch"
                aria-label="Примусовий демо-режим"
                aria-checked={forceDemo}
                onClick={() => {
                  try {
                    localStorage.setItem("alh_force_demo", String(!forceDemo));
                    setForceDemo(!forceDemo);
                  } catch {
                    setNotice("Не вдалося зберегти режим у браузері.");
                  }
                }}
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white transition ${forceDemo ? "left-6" : "left-1"}`}
                />
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Режим пошуку:{" "}
              <b className="text-brand-700">
                {status
                  ? forceDemo || status.demoMode || !status.googlePlaces
                    ? "Демо"
                    : "Google Places"
                  : "Перевіряємо…"}
              </b>
            </p>
            {status?.demoMode && (
              <p className="mt-2 text-xs text-amber-700">
                Демо також увімкнено на сервері. Змініть NEXT_PUBLIC_DEMO_MODE
                на false та повторно розгорніть застосунок.
              </p>
            )}
          </section>
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold">Резервні копії</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Кампанії зберігаються в цьому браузері. JSON-копія переносить
              ліди, етапи, нотатки, перевірки та дати контактів на інший
              комп’ютер.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary btn-sm" onClick={backup}>
                <Download size={15} />
                Завантажити копію
              </button>
              <button
                className="btn-ghost btn-sm"
                onClick={() => input.current?.click()}
              >
                <Upload size={15} />
                Імпортувати JSON
              </button>
              <input
                ref={input}
                type="file"
                accept=".json,application/json"
                className="hidden"
                aria-label="Файл резервної копії"
                onChange={(e) => void importFile(e.target.files?.[0])}
              />
            </div>
            {pending && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
                <p className="text-sm font-semibold">
                  Копія: {pending.length} кампаній ·{" "}
                  {pending.reduce((n, c) => n + c.leads.length, 0)} лідів
                </p>
                <label className="mt-3 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={replace}
                    onChange={(e) => setReplace(e.target.checked)}
                  />
                  Замінити поточні кампанії цією копією. Без позначки — додати
                  нові, зберегти поточні нотатки та пропустити дублікати.
                </label>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => {
                      if (
                        replace &&
                        !window.confirm(
                          "Замінити всі поточні кампанії даними з копії? Спершу збережіть поточну резервну копію.",
                        )
                      )
                        return;
                      try {
                        const restored = replace
                          ? replaceCampaigns(pending)
                          : importCampaigns(pending);
                        setPending(null);
                        setNotice(
                          `Відновлено. У сховищі ${restored.length} кампаній.`,
                        );
                      } catch (e) {
                        setNotice((e as Error).message);
                      }
                    }}
                  >
                    Відновити
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setPending(null)}
                  >
                    Скасувати
                  </button>
                </div>
              </div>
            )}
            {notice && (
              <p
                role="status"
                className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700"
              >
                {notice}
              </p>
            )}
          </section>
        </div>
        <div className="min-w-0 space-y-5">
          <section className="card p-5 sm:p-6">
            <h2 className="font-semibold">Швидке підключення</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-4 text-xs leading-relaxed text-slate-600">
              <li>
                Додайте змінні у <b>.env.local</b> локально або в{" "}
                <b>Environment Variables</b> вашого хостингу.
              </li>
              <li>
                У Google Cloud увімкніть Places API (New) і білінг. Для карти
                додатково потрібні Maps JavaScript API та окремий ключ із
                обмеженням за доменом.
              </li>
              <li>
                Для AI вкажіть <b>openai</b> або <b>anthropic</b>, ключ
                провайдера та точну назву доступної вам моделі.
              </li>
              <li>
                Перезапустіть застосунок або зробіть Redeploy. Потім натисніть
                «Перевірити Google».
              </li>
            </ol>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-[#182b25] p-4 text-[10px] leading-6 text-emerald-100">
              {env}
            </pre>
            <button
              className="btn-ghost btn-sm mt-3"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(env);
                  setNotice(
                    "Шаблон конфігурації скопійовано. Замініть значення на свої.",
                  );
                } catch {
                  setNotice("Виділіть і скопіюйте шаблон вручну.");
                }
              }}
            >
              <Copy size={13} />
              Копіювати шаблон
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Секретні ключі зберігаються на сервері. Ключ карти є публічним за
              призначенням — обмежте його доменом і Maps JavaScript API.
            </p>
          </section>
          <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
            <div className="flex items-center gap-2">
              <LockKeyhole size={17} className="text-brand-700" />
              <h2 className="text-sm font-semibold">
                Доступ до робочого простору
              </h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {status?.passwordProtected
                ? "Пароль робочого простору задано."
                : "APP_PASSWORD дозволяє закрити застосунок паролем перед публічним розгортанням із платними ключами."}{" "}
              Для входу використайте довільне ім’я та цей пароль. Публічний
              хостинг має працювати через HTTPS.
            </p>
          </section>
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Що відбувається з даними</h2>
            <ul className="mt-3 space-y-3 text-xs leading-relaxed text-slate-500">
              <li className="flex gap-2">
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-brand-600"
                />
                Кампанії й нотатки залишаються у браузері та резервних копіях.
              </li>
              <li className="flex gap-2">
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-brand-600"
                />
                AI отримує назву бізнесу, сигнали та чернетку лише після
                натискання кнопки генерації.
              </li>
              <li className="flex gap-2">
                <AlertCircle
                  size={14}
                  className="mt-0.5 shrink-0 text-amber-600"
                />
                Оцінка ліда — пояснювана евристика, а не прогноз угоди.
                Перевіряйте сигнали перед зверненням.
              </li>
            </ul>
          </section>
        </div>
      </div>
      <SetupWizard
        open={wizard}
        onClose={() => {
          setWizard(false);
          load();
        }}
      />
    </div>
  );
}
function SearchIcon(props: { size: number }) {
  return <MapPin {...props} />;
}
