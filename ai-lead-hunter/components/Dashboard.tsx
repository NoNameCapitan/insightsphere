"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Search,
  ArrowRight,
  Radar,
  Building2,
  Target,
  MessagesSquare,
  Trophy,
  Plus,
  MapPin,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { getCampaigns } from "@/lib/campaignStorage";
import type { Campaign } from "@/lib/types";
const niches = [
  [
    "Стоматології",
    "Онлайн-запис і сайти",
    "Знайди стоматології в Києві для онлайн-запису",
  ],
  [
    "Салони краси",
    "Заявки без зайвих дзвінків",
    "Знайди салони краси в Києві без сайту",
  ],
  [
    "Ветклініки",
    "Асистент для клієнтів",
    "Знайди ветклініки в Києві для AI-асистента",
  ],
  [
    "Кафе й ресторани",
    "Більше локальних гостей",
    "Знайди ресторани в Києві для SEO",
  ],
];
export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setCampaigns(getCampaigns());
    } catch (e) {
      setError((e as Error).message);
    }
    setReady(true);
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => setLive(s.googlePlaces && !s.demoMode))
      .catch(() => setLive(null));
  }, []);
  const leads = campaigns.flatMap((c) => c.leads);
  const metrics = [
    {
      label: "Лідів у кампаніях",
      value: leads.length,
      icon: Building2,
      note: "Збережені вами",
    },
    {
      label: "Потребують контакту",
      value: leads.filter(
        (l) =>
          ["new", "verified"].includes(l.status ?? "new") &&
          !l.verification?.doNotContact,
      ).length,
      icon: Target,
      note: "Нові та перевірені",
    },
    {
      label: "У діалозі",
      value: leads.filter((l) => l.status === "dialog").length,
      icon: MessagesSquare,
      note: "Є відповідь від бізнесу",
    },
    {
      label: "Успішні угоди",
      value: leads.filter((l) => l.status === "result" && l.outcome === "won")
        .length,
      icon: Trophy,
      note: "Підтверджені вами",
    },
  ];
  return (
    <div className="container-app py-7 sm:py-9">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="page-eyebrow">Ваш наступний клієнт — поруч</p>
          <h1 className="page-title">Час знаходити можливості.</h1>
          <p className="mt-2 text-sm text-slate-500">
            Від першого пошуку до змістовної розмови з бізнесом.
          </p>
        </div>
        <Link
          href="/settings"
          className="chip border border-slate-200 bg-white py-2 text-slate-600"
        >
          <span
            className={`mr-1 size-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`}
          />
          {live === null
            ? "Перевірка конфігурації"
            : live
              ? "Google Places налаштовано"
              : "Демо доступне"}
          <ArrowUpRight size={13} />
        </Link>
      </div>
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Статистика кампаній"
      >
        {metrics.map(({ label, value, icon: Icon, note }) => (
          <div className="metric-card" key={label}>
            <div>
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="metric-value">{ready ? value : "—"}</p>
              <p className="mt-2 text-[11px] text-slate-400">{note}</p>
            </div>
            <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
              <Icon size={18} />
            </span>
          </div>
        ))}
      </section>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      <section className="mt-6 grid overflow-hidden rounded-3xl bg-[#18382d] text-white lg:grid-cols-[1.15fr_.85fr]">
        <div className="p-7 sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[10px] uppercase tracking-widest text-emerald-200">
            <Sparkles size={13} />
            Локальний пошук клієнтів
          </span>
          <h2 className="mt-5 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-[40px]">
            Знайдіть бізнес,
            <br />
            <span className="text-[#c2f2d5]">якому потрібні саме ви.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-emerald-100/70">
            Опишіть послугу й локацію. Отримайте лідів із поясненням потреби та
            чернеткою першого звернення.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="btn bg-[#c2f2d5] text-[#17382b] hover:bg-white"
            >
              <Search size={17} />
              Знайти клієнтів <ArrowRight size={16} />
            </Link>
            <Link
              href="/search?demo=1"
              className="btn text-emerald-100 hover:bg-white/10"
            >
              Спробувати демо <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <div
          className="radar-visual relative hidden min-h-[340px] items-center justify-center lg:flex"
          aria-label="Ілюстрація пошуку можливостей"
        >
          <div className="absolute right-8 top-7 flex items-center gap-1.5 text-[10px] text-emerald-100/50">
            <MapPin size={12} />
            Ілюстрація · Київ
          </div>
          <div className="grid size-20 place-items-center rounded-2xl border border-emerald-200/20 bg-[#c2f2d5] text-brand-900 shadow-xl">
            <Radar size={40} />
          </div>
          <div className="absolute left-6 top-16 w-48 rounded-2xl bg-white p-3.5 text-ink shadow-xl">
            <div className="mb-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>МОЖЛИВІСТЬ</span>
              <Target size={13} className="text-brand-600" />
            </div>
            <p className="text-sm font-semibold">Потрібен онлайн-запис?</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Перевірте сайт та сигнали
            </p>
          </div>
          <div className="absolute bottom-12 right-7 w-48 rounded-2xl border border-white/20 bg-[#254b3c] p-4 shadow-xl">
            <CheckCircle2 size={19} className="mb-2 text-emerald-200" />
            <p className="text-sm font-semibold">Є привід для розмови</p>
            <p className="mt-1 text-xs text-emerald-100/60">
              Пропозиція під потребу
            </p>
          </div>
        </div>
      </section>
      <div className="mt-9 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">З чого почнемо?</h2>
          <p className="mt-1 text-xs text-slate-500">
            Готові напрями для першого пошуку
          </p>
        </div>
        <Link
          href="/search"
          className="hidden items-center gap-1 text-xs font-semibold text-brand-600 sm:flex"
        >
          Усі ніші <ArrowUpRight size={14} />
        </Link>
      </div>
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {niches.map(([title, sub, q], i) => (
          <Link
            key={title}
            href={`/search?q=${encodeURIComponent(q)}`}
            className="card group p-5 transition hover:border-brand-300"
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-50 font-mono text-xs text-brand-700">
                0{i + 1}
              </span>
              <ArrowUpRight
                size={17}
                className="text-slate-400 transition group-hover:text-brand-600"
              />
            </div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1.5 text-xs text-slate-500">{sub}</p>
          </Link>
        ))}
      </section>
      <section className="mt-9 card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Ваші кампанії</h2>
          <Link href="/campaigns" className="btn-ghost btn-sm">
            <Plus size={14} />
            Кампанії
          </Link>
        </div>
        {campaigns.length ? (
          <div className="mt-3 divide-y divide-slate-100">
            {campaigns.slice(0, 4).map((c) => (
              <Link
                href="/campaigns"
                key={c.id}
                className="flex items-center justify-between py-4 text-sm"
              >
                <span className="font-medium">{c.name}</span>
                <span className="flex items-center gap-4 text-xs text-slate-500">
                  {c.leads.length} лідів
                  <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-3 pt-5 sm:flex-row sm:items-center">
            <p className="max-w-lg text-sm leading-relaxed text-slate-500">
              Збережіть цікаві бізнеси з пошуку. Тут з’являться ваші кампанії, а
              ви зможете відстежувати кожен контакт.
            </p>
            <Link
              href="/search"
              className="text-sm font-semibold text-brand-600"
            >
              Знайти перших лідів →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
