"use client";

import { useEffect, useMemo, useState } from "react";
import LocationPicker, {
  type LocationValue,
} from "@/components/LocationPicker";
import { LIMIT_OPTIONS, NICHE_OPTIONS, OFFER_OPTIONS } from "@/lib/options";
import { parseQuery } from "@/lib/queryParser";
import type {
  LocationMode,
  NicheKey,
  OfferType,
  SearchFilters,
  SearchRequest,
} from "@/lib/types";

const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY || "Київ";

export type SearchSubmit = {
  request: SearchRequest;
  demo: boolean;
  parsedFilters: SearchFilters;
  notice?: string;
};

const EXAMPLES = [
  "Знайди 50 салонів краси поруч зі мною без сайту.",
  "Знайди стоматології на Позняках для онлайн-запису.",
  "Знайди ветклініки в Києві, яким можна продати AI-асистента.",
  "Я продаю сайти за $300. Кому поруч це може бути цікаво?",
];

const NICHE_LABEL: Record<string, string> = Object.fromEntries(
  NICHE_OPTIONS.map((n) => [n.value, n.label]),
);
const OFFER_LABEL: Record<string, string> = Object.fromEntries(
  OFFER_OPTIONS.map((o) => [o.value, o.label]),
);

const FILTER_LABEL: Record<string, string> = {
  noWebsite: "без сайту",
  hasWebsite: "з сайтом",
  hasPhone: "є телефон",
  hotOnly: "тільки гарячі",
  needsManualReview: "потребує перевірки",
  openNow: "відкрито зараз",
  ratingBelow: "низький рейтинг",
  ratingAbove: "високий рейтинг",
  minReviews: "багато відгуків",
};

function activeFilterLabels(f: SearchFilters): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(f)) {
    if (v === true && FILTER_LABEL[k]) out.push(FILTER_LABEL[k]);
    if (k === "ratingBelow" && typeof v === "number")
      out.push(FILTER_LABEL.ratingBelow);
    if (k === "ratingAbove" && typeof v === "number")
      out.push(FILTER_LABEL.ratingAbove);
    if (k === "minReviews" && typeof v === "number")
      out.push(FILTER_LABEL.minReviews);
  }
  return out;
}

function requestGeolocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  });
}

export default function SearchForm({
  initialQuery = "",
  loading,
  onSearch,
}: {
  initialQuery?: string;
  loading: boolean;
  onSearch: (payload: SearchSubmit) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = JSON.parse(
        localStorage.getItem("alh_search_history") ?? "[]",
      );
      if (Array.isArray(raw))
        setHistory(
          raw.filter((x): x is string => typeof x === "string").slice(0, 5),
        );
    } catch {}
  }, []);
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);
  const [offer, setOffer] = useState<OfferType | "auto">("auto");
  const [niche, setNiche] = useState<NicheKey | "auto">("auto");
  const [limitChoice, setLimitChoice] = useState<number | "auto">("auto");
  const [location, setLocation] = useState<LocationValue>({
    mode: "city",
    city: DEFAULT_CITY,
    address: "",
    radiusKm: 0,
  });
  const [locationTouched, setLocationTouched] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const parsed = useMemo(() => parseQuery(query), [query]);

  // Effective values = manual override if set, otherwise parsed-from-text.
  const effective = useMemo(() => {
    const effNiche: NicheKey = niche === "auto" ? parsed.niche : niche;
    const effOffer: OfferType = offer === "auto" ? parsed.offer : offer;
    const effLimit = limitChoice === "auto" ? parsed.limit : limitChoice;

    let mode: LocationMode;
    let city: string;
    let address: string;
    let radiusKm: number;
    let lat: number | undefined;
    let lng: number | undefined;

    if (locationTouched) {
      mode = location.mode;
      city = location.city;
      address = location.address;
      radiusKm = location.radiusKm;
      lat = location.lat;
      lng = location.lng;
    } else {
      mode = parsed.locationMode;
      city = parsed.city ?? DEFAULT_CITY;
      address = parsed.address ?? "";
      radiusKm = parsed.radiusKm;
      lat = mode === "near_me" ? location.lat : undefined;
      lng = mode === "near_me" ? location.lng : undefined;
    }
    return {
      effNiche,
      effOffer,
      effLimit,
      mode,
      city,
      address,
      radiusKm,
      lat,
      lng,
    };
  }, [parsed, niche, offer, limitChoice, location, locationTouched]);

  const locationText =
    effective.mode === "near_me"
      ? effective.lat != null
        ? "Поруч зі мною (геолокація надана)"
        : "Поруч зі мною — буде запит геолокації"
      : effective.mode === "address"
        ? effective.address || "Район / адреса"
        : effective.city || DEFAULT_CITY;

  const filterLabels = activeFilterLabels(parsed.filters);

  function updateLocation(next: LocationValue) {
    setLocationTouched(true);
    setLocation(next);
  }

  async function run(demo: boolean) {
    let mode = effective.mode;
    let lat = effective.lat;
    let lng = effective.lng;
    let city = effective.city;
    let notice: string | undefined;

    if (demo && mode === "near_me") {
      mode = "city";
      city = "Київ";
      lat = undefined;
      lng = undefined;
      notice =
        "Демо показує вигадані бізнеси Києва; ваша геолокація не запитується.";
    }
    if (mode === "near_me" && (lat == null || lng == null)) {
      setRequesting(true);
      const coords = await requestGeolocation();
      setRequesting(false);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
        setLocation((p) => ({
          ...p,
          mode: "near_me",
          lat: coords.lat,
          lng: coords.lng,
        }));
      } else {
        mode = "city";
        city = DEFAULT_CITY;
        lat = undefined;
        lng = undefined;
        notice =
          "Геолокацію не надано — показано результати для міста Київ. Дозвольте доступ або вкажіть район вручну.";
      }
    }

    const request: SearchRequest = {
      query,
      niche: effective.effNiche,
      offerType: effective.effOffer,
      locationMode: mode,
      lat,
      lng,
      city: city || DEFAULT_CITY,
      address: effective.address || undefined,
      radiusKm: effective.radiusKm,
      limit: effective.effLimit,
      lang: "uk",
    };
    if (query.trim()) {
      const next = [
        query.trim(),
        ...history.filter((h) => h !== query.trim()),
      ].slice(0, 5);
      setHistory(next);
      try {
        localStorage.setItem("alh_search_history", JSON.stringify(next));
      } catch {}
    }
    onSearch({ request, demo, parsedFilters: parsed.filters, notice });
  }

  const busy = loading || requesting;

  return (
    <div className="card p-4 sm:p-6">
      <div>
        <label className="label" htmlFor="alh-query">
          Що шукаємо
        </label>
        <textarea
          id="alh-query"
          className="input min-h-[76px] resize-y"
          placeholder="Напр.: Знайди 50 салонів краси поруч зі мною без сайту"
          maxLength={1500}
          value={query}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !busy) {
              e.preventDefault();
              void run(false);
            }
          }}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="chip border border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-700"
              onClick={() => setQuery(ex)}
            >
              {ex.length > 44 ? ex.slice(0, 44) + "…" : ex}
            </button>
          ))}
        </div>
      </div>

      {/* Parsed-query preview — shows exactly what the search will do. */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Розпізнано із запиту
        </p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="chip bg-white ring-1 ring-slate-200">
            Ніша:{" "}
            <b className="ml-1">
              {NICHE_LABEL[effective.effNiche] ?? effective.effNiche}
            </b>
          </span>
          <span className="chip bg-white ring-1 ring-slate-200">
            Пропозиція:{" "}
            <b className="ml-1">
              {OFFER_LABEL[effective.effOffer] ?? effective.effOffer}
            </b>
          </span>
          <span className="chip bg-white ring-1 ring-slate-200">
            Локація: <b className="ml-1">{locationText}</b>
          </span>
          <span className="chip bg-white ring-1 ring-slate-200">
            Радіус:{" "}
            <b className="ml-1">
              {effective.radiusKm ? `${effective.radiusKm} км` : "усе місто"}
            </b>
          </span>
          <span className="chip bg-white ring-1 ring-slate-200">
            Ліди: <b className="ml-1">{effective.effLimit}</b>
          </span>
          {filterLabels.map((f) => (
            <span
              key={f}
              className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-100"
            >
              {f}
            </span>
          ))}
        </div>
        {effective.mode === "near_me" && effective.lat == null && (
          <p className="mt-2 text-xs text-amber-700">
            Запит «поруч зі мною»: під час пошуку браузер попросить доступ до
            геолокації. Якщо відмовити — покажемо Київ.
          </p>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-slate-400">
            Останні запити
          </span>
          {history.map((h) => (
            <button
              key={h}
              className="chip max-w-[260px] truncate bg-slate-50 text-slate-500"
              onClick={() => {
                setQuery(h);
                setNiche("auto");
                setOffer("auto");
                setLimitChoice("auto");
                setLocationTouched(false);
              }}
              title={h}
            >
              {h}
            </button>
          ))}
        </div>
      )}
      <details className="mt-4 rounded-xl border border-slate-200 px-3 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-brand-700">
          Уточнити нішу, пропозицію й локацію
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="alh-offer">
              Що пропонуєш
            </label>
            <select
              id="alh-offer"
              className="input"
              value={offer}
              onChange={(e) => setOffer(e.target.value as OfferType | "auto")}
            >
              <option value="auto">Авто (з тексту)</option>
              {OFFER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="alh-niche">
              Ніша бізнесу
            </label>
            <select
              id="alh-niche"
              className="input"
              value={niche}
              onChange={(e) => setNiche(e.target.value as NicheKey | "auto")}
            >
              <option value="auto">Авто (з тексту)</option>
              {NICHE_OPTIONS.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="alh-limit">
              Кількість лідів
            </label>
            <select
              id="alh-limit"
              className="input"
              value={limitChoice}
              onChange={(e) =>
                setLimitChoice(
                  e.target.value === "auto" ? "auto" : Number(e.target.value),
                )
              }
            >
              <option value="auto">Авто (з тексту)</option>
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <LocationPicker
            value={{
              mode: effective.mode,
              city: effective.city,
              address: effective.address,
              radiusKm: effective.radiusKm,
              lat: effective.lat,
              lng: effective.lng,
            }}
            onChange={updateLocation}
          />
          {!locationTouched && (
            <p className="mt-1 text-xs text-slate-400">
              Локація задається з тексту запиту. Змініть будь-що тут, щоб
              керувати вручну.
            </p>
          )}
        </div>
      </details>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={busy}
          onClick={() => run(false)}
        >
          {requesting
            ? "Визначаємо локацію…"
            : loading
              ? "Шукаємо…"
              : "Знайти лідів"}
        </button>
        <button
          type="button"
          className="btn-ghost sm:w-48"
          disabled={busy}
          onClick={() => run(true)}
        >
          Спробувати демо
        </button>
      </div>
    </div>
  );
}
