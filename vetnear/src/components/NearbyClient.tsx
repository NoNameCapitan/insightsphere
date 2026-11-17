"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./NearbyClient.module.css";
import { DISCOVERY_RETURN_KEY, DISCOVERY_RESTORE_KEY, discoveryCount, discoveryFilters, discoveryUrl, safeDiscoveryReturn } from "./discoveryState";
import { ActivePetSelector } from "@/components/ActivePetSelector";
import { FiltersBar } from "@/components/Filters";
import { GeoFallback } from "@/components/GeoFallback";
import { Disclaimer } from "@/components/JsonLd";
import { PlaceCard } from "@/components/PlaceCard";
import { SavedPlacesLink } from "@/components/SavedPlacesLink";
import { PLACES } from "@/lib/data/places";
import { EMERGENCY_EMPTY_STATE } from "@/lib/data/verification";
import { RadiusSelector } from "@/components/RadiusSelector";
import { SafetyControls, useSafetyOverlay } from "@/components/SafetyOverlay";
import { NearestShelterButton } from "@/components/NearestShelterButton";
import { track } from "@/lib/analytics";
import { DEFAULT_FILTERS, getRecommendedPlaces } from "@/lib/geo/ranking";
import { COVERAGE_LABEL, COVERAGE_REGIONS, localityKey, localityOf, regionOf, shouldUseKyivSafety } from "@/config/coverage";
import { t } from "@/lib/i18n";
import { availabilityDuringAlert } from "@/lib/safety/placeAvailability";
import Link from "next/link";
import { ANIMAL_LABELS, CATEGORY_LABELS, DISTRICT_LABELS } from "@/lib/labels";
import { getActivePet } from "@/lib/pets/store";
import { getPlaces, hydratePublishedPlaces } from "@/lib/store";
import type {
  FilterState,
  PetProfile,
  Place,
} from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});

/** One-tap category chips; everything else stays behind "Фільтри". */
const QUICK_CATEGORIES: { id: FilterState["category"]; label: string }[] = [
  { id: "all", label: "Усі" },
  { id: "veterinary_clinic", label: "Ветклініки" },
  { id: "vet_pharmacy", label: "Ветаптеки" },
  { id: "pet_store", label: "Зоомагазини" },
  { id: "grooming", label: "Грумінг" },
  { id: "pet_boarding", label: "Перетримка" },
  { id: "shelter", label: "Притулки" },
];


export function NearbyClient() {
  const params = useSearchParams();
  const geo = useGeo();
  const [filters, setFilters] = useState<FilterState>(() => discoveryFilters(params));
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [locationOpen, setLocationOpen] = useState(params.get("location") === "manual");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [visibleCount, setVisibleCount] = useState(() => discoveryCount(params));
  const safety = useSafetyOverlay(geo.coords);
  const showKyivSafety = shouldUseKyivSafety(filters.region, geo.coords);

  // Start from the deterministic seed dataset so server and client render the
  // same HTML, then merge localStorage additions (approved submissions, admin
  // edits) after mount — otherwise an approved local place causes a hydration
  // mismatch on this page.
  const [allPlaces, setAllPlaces] = useState<Place[]>(PLACES);

  useEffect(() => {
    const activePet = getActivePet();
    setPet(activePet && (filters.animal === "all" || activePet.animalType === filters.animal) ? activePet : null);
    setAllPlaces(getPlaces());
    // Pull the server-published layer, then re-read the merged list (v1.9).
    void hydratePublishedPlaces().then(() => setAllPlaces(getPlaces()));
    track("nearby_search_started", { category: filters.category });
    // Location is requested only by an explicit action. A saved manual point
    // must not be overwritten by a competing mount-time GPS request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const result = useMemo(
    () => getRecommendedPlaces(allPlaces, geo.coords, { pet, filters }),
    [allPlaces, geo.coords, pet, filters],
  );
  const matchingPlaces = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("uk");
    return needle ? result.places.filter((place) => `${place.name} ${place.address}`.toLocaleLowerCase("uk").includes(needle)) : result.places;
  }, [result.places, query]);
  const localities = useMemo(() => {
    const labels = new Map<string, string>();
    for (const place of allPlaces) {
      if (place.status !== "approved" || (filters.region && filters.region !== "all" && regionOf(place) !== filters.region)) continue;
      const name = localityOf(place);
      if (name) labels.set(localityKey(name), name);
    }
    return Array.from(labels.values()).sort((a, b) => a.localeCompare(b, "uk"));
  }, [allPlaces, filters.region]);
  useEffect(() => {
    const timer = window.setTimeout(() => track("search_results_viewed", {
      category: filters.category, region: filters.region ?? "all", resultCount: matchingPlaces.length,
      hasLocation: Boolean(geo.coords), urgent: Boolean(filters.urgentIntent || filters.emergency),
    }), 500);
    return () => window.clearTimeout(timer);
  }, [filters.category, filters.region, filters.urgentIntent, filters.emergency, matchingPlaces.length, geo.coords]);

  useEffect(() => {
    let frame = 0;
    try {
      const current = window.location.pathname + window.location.search;
      const restore = sessionStorage.getItem(DISCOVERY_RESTORE_KEY);
      const saved: unknown = JSON.parse(sessionStorage.getItem(DISCOVERY_RETURN_KEY) ?? "null");
      if (restore === current && safeDiscoveryReturn(saved) && saved.path === current) {
        sessionStorage.removeItem(DISCOVERY_RESTORE_KEY);
        frame = window.requestAnimationFrame(() => { frame = window.requestAnimationFrame(() => window.scrollTo({ top: saved.scroll })); });
      }
    } catch { /* Search works without session storage. */ }
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const searchParamsKey = params.toString();
  useEffect(() => {
    const nextParams = new URLSearchParams(searchParamsKey);
    setFilters(discoveryFilters(nextParams));
    setQuery(nextParams.get("q") ?? "");
    setVisibleCount(discoveryCount(nextParams));
    if (new URLSearchParams(searchParamsKey).get("location") === "manual") setLocationOpen(true);
  }, [searchParamsKey]);

  const emergencyMode =
    Boolean(filters.urgentIntent) || filters.emergency || filters.category === "emergency_vet";

  useEffect(() => {
    if (geo.status === "denied" || geo.status === "unavailable") setLocationOpen(true);
  }, [geo.status]);

  const syncUrl = (next: FilterState, text = query, count = 12) => {
    window.history.replaceState(null, "", discoveryUrl(next, text, count));
  };
  const update = (patch: Partial<FilterState>) => {
    const next = { ...filters,
      ...(patch.region && patch.region !== filters.region ? { district: "all" as const, locality: "" } : {}),
      ...patch,
      ...(patch.category && !["veterinary_clinic", "emergency_vet"].includes(patch.category) ? { urgentIntent: false } : {}),
    };
    setFilters(next); setVisibleCount(12); syncUrl(next);
  };
  const changeQuery = (value: string) => { setQuery(value); setVisibleCount(12); syncUrl(filters, value); };
  const locationLabel = filters.locality || (filters.district !== "all" ? DISTRICT_LABELS[filters.district]
    : filters.region && filters.region !== "all" ? COVERAGE_REGIONS[filters.region] : "Київ та область");

  return (
    <div className={`operating-screen container-px mx-auto max-w-3xl py-5 ${styles.screen}`} onClickCapture={(event) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href^="/place/"]')) return;
      try { sessionStorage.setItem(DISCOVERY_RETURN_KEY, JSON.stringify({ path: window.location.pathname + window.location.search, scroll: window.scrollY })); } catch { /* Optional return context. */ }
    }}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="operating-heading font-display text-2xl font-bold text-ink">{emergencyMode ? "Зателефонуйте у клініку" : "Турбота поруч"}</h1>
          <p className="mt-1 text-sm text-ink/70">{emergencyMode ? "Уточніть прийом перед виїздом" : COVERAGE_LABEL}</p>
        </div>
        <div className="flex rounded-xl bg-ink/[0.04] p-1" role="group" aria-label="Вигляд результатів">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`min-h-11 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "list" ? "bg-surface text-brand shadow-sm" : "text-ink/70 hover:text-brand"}`}
          >Список</button>
          <button
            type="button"
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
            className={`min-h-11 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "map" ? "bg-surface text-brand shadow-sm" : "text-ink/70 hover:text-brand"}`}
          >Карта</button>
        </div>
      </div>
      <div className={styles.locationRow}>
        <button type="button" className={styles.locationButton} aria-expanded={locationOpen} aria-controls="discovery-location-form" onClick={() => setLocationOpen(!locationOpen)}>
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          <span><strong>{locationLabel}</strong><span>{geo.coords ? "Відстані від обраної точки" : "Оберіть адресу для відстаней"}</span></span>
          <span aria-hidden>{locationOpen ? "−" : "+"}</span>
        </button>
        {!geo.coords && <button type="button" className={styles.locateButton} disabled={geo.status === "prompting"} onClick={geo.request}>{geo.status === "prompting" ? "Визначаємо…" : "Визначити"}</button>}
      </div>
      {locationOpen && (
        <div id="discovery-location-form" className={styles.locationDetails}>
      <div className="mt-3 space-y-3 rounded-2xl bg-ink/[0.035] p-3">
        <div role="group" aria-label="Територія пошуку" className="flex flex-wrap gap-1.5">
          {(["all", "kyiv_city", "kyiv_oblast"] as const).map((region) => (
            <button key={region} type="button" aria-pressed={(filters.region ?? "all") === region}
              onClick={() => update({ region })}
              className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${(filters.region ?? "all") === region ? "bg-brand text-white" : "bg-surface text-ink/75 hover:text-brand"}`}>
              {region === "all" ? "Усі доступні" : COVERAGE_REGIONS[region]}
            </button>
          ))}
        </div>
        <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/70">
          Населений пункт
          <select value={filters.locality ?? ""} onChange={(event) => update({ locality: event.target.value, district: "all" })}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-brand-100 bg-surface px-3 text-sm text-ink">
            <option value="">Усі в обраній території</option>
            {filters.locality && !localities.some((name) => localityKey(name) === localityKey(filters.locality!)) && <option value={filters.locality}>{filters.locality}</option>}
            {localities.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <p className="text-xs leading-5 text-ink/65">Показуємо лише додані до каталогу заклади. Покриття області ще поповнюється; вибір міста не змінює вашу геопозицію.</p>
      </div>

          <GeoFallback onResolved={(coords) => { geo.setManual(coords); setLocationOpen(false); }} compact />
          <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-brand" disabled={geo.status === "prompting"} onClick={geo.request}>
            {geo.status === "prompting" ? "Визначаємо місце…" : "Використати мою геопозицію"}
          </button>
          <button type="button" className="btn btn-brand mt-3 w-full" onClick={() => setLocationOpen(false)}>Показати результати</button>
        </div>
      )}
      {emergencyMode && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emergency/15 bg-emergency-50 px-4 py-3 text-emergency-700">
          <span aria-hidden className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emergency" />
          <p className="text-sm font-medium">
            При загрозі життю телефонуйте негайно. Графік не гарантує прийому — уточніть, чи є потрібний фахівець зараз.
          </p>
        </div>
      )}

      {/* Safety layer: first on screen during an alert, a quiet row at the
          bottom otherwise (see below). The logic itself is unchanged. */}
      {safety.active && showKyivSafety && (
        <div className="mb-4">
          <NearestShelterButton
            alert={safety.alert}
            onAlertStatus={safety.acceptAlert}
            onRefresh={safety.refreshAlert}
          />
          <SafetyControls safety={safety} onOpenMap={() => setView("map")} />
        </div>
      )}

      {geo.coords && <div className="mb-3"><RadiusSelector value={filters.radius} onChange={(r) => update({ radius: r })} /></div>}
      <div className={styles.searchControls}>
        <label>
          <span className="sr-only">Назва закладу або адреса</span>
          <input type="search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Назва або адреса" />
        </label>
        <FiltersBar filters={filters} onChange={update} onReset={() => update({ ...DEFAULT_FILTERS, category: emergencyMode ? "veterinary_clinic" : "all", region: filters.region, locality: filters.locality, urgentIntent: emergencyMode })} />
      </div>


      <div className="nav-scroll -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Категорія">
        {QUICK_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filters.category === c.id}
            onClick={() => update({ category: c.id })}
            className={`min-h-11 shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
              filters.category === c.id
                ? "border-brand bg-brand text-white"
                : "border-brand-100 bg-surface text-ink/65 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 empty:hidden">
        <ActivePetSelector selectedPetId={pet?.id ?? null} onChange={(nextPet) => { setPet(nextPet); update({ animal: nextPet?.animalType ?? "all" }); }} hideWhenEmpty />
      </div>

      {filters.animal !== "all" && (
        <details className={styles.animalNote} open={matchingPlaces.length === 0}>
          <summary>Прийом: {ANIMAL_LABELS[filters.animal]} · лише вказана спеціалізація</summary>
          <p>Для решти закладів прийом цього виду потрібно уточнити. Відсутність даних не означає відсутності допомоги.</p>
          <button type="button" onClick={() => { setPet(null); update({ animal: "all" }); }} className="min-h-11 text-left font-semibold text-brand underline underline-offset-4">Показати заклади для уточнення</button>
        </details>
      )}

      <div className="my-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink/75" role="status" aria-live="polite">
          Знайдено: <strong className="tabular-nums text-ink">{matchingPlaces.length}</strong>
          {filters.category !== "all" && ` · ${CATEGORY_LABELS[filters.category]}`}
        </p>
        <SavedPlacesLink compact />
      </div>

      {result.expandedFrom && (
        <p className="mb-3 rounded-2xl bg-amber/10 px-4 py-2 text-sm text-amber">
          Нічого не знайдено в межах {result.expandedFrom / 1000} км. Показуємо
          найближчі в межах {result.appliedRadius / 1000} км.
        </p>
      )}

      {geo.coords && !query.trim() && result.places.length > 0 && result.places.length <= 2 && filters.radius < 10000 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3">
          <p className="text-sm leading-5 text-ink/70">У цьому радіусі мало місць за вашим запитом.</p>
          <button type="button" onClick={() => update({ radius: 10000 })} className="shrink-0 text-sm font-semibold text-brand hover:underline">Показати до 10 км</button>
        </div>
      )}

      {view === "map" ? (
        <div className="h-[60vh] w-full overflow-hidden rounded-3xl border border-brand-100">
          <MapView
            places={matchingPlaces.filter((place) => availabilityDuringAlert(place, safety.alert) !== "closed")}
            origin={geo.coords}
            zoom={13}
            shelters={showKyivSafety && safety.active && safety.enabled ? safety.shelters : []}
            selectedShelterId={safety.selectedShelterId}
            onSelectShelter={safety.setSelectedShelterId}
            onShowList={() => setView("list")}
          />
        </div>
      ) : matchingPlaces.length === 0 ? (
        <div className="rounded-3xl border border-brand-100 bg-surface p-8 text-center">
          <svg aria-hidden viewBox="0 0 48 48" className="mx-auto mb-4 h-12 w-12 text-brand" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="20" cy="20" r="11"/><path d="m28 28 10 10M15 20h10"/></svg>
          {query.trim() ? (
            <>
              <h2 className="text-lg font-bold">За цією назвою нічого не знайдено</h2>
              <p className="mt-2 text-sm text-ink/70">Перевірте написання або очистіть пошук. Обрані фільтри залишаться.</p>
              <button type="button" onClick={() => changeQuery("")} className="btn-brand mt-4 text-sm">Очистити пошук</button>
            </>
          ) : emergencyMode ? (
            <div>
              <p className="text-sm leading-6 text-ink/75">{EMERGENCY_EMPTY_STATE}</p>
              <button type="button" className="btn btn-brand mt-4" onClick={() => setLocationOpen(true)}>Змінити місце пошуку</button>
            </div>
          ) : filters.category === "shelter" ? (
            <>
              <p className="font-display text-lg font-bold text-ink">
                За цими умовами притулок не знайдено
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">
                Спробуйте інший населений пункт або більший радіус. Каталог
                поповнюється; можливість прийняти тварину уточнюйте телефоном.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/city/kyiv/shelters" className="btn btn-brand py-2 text-sm">Притулки Києва</Link>
                <Link href="/lost-found" className="btn btn-ghost py-2 text-sm">Знайшли тварину?</Link>
                <Link href="/add-place" className="btn btn-ghost py-2 text-sm">Додати притулок</Link>
              </div>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-ink">
                За цими фільтрами нічого не знайдено
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">
                {filters.region === "kyiv_oblast" ? "У каталозі поки немає відповідних місць у цій частині області." : "У каталозі поки немає місць за цим поєднанням умов."} Відсутність записів не означає, що допомоги поблизу немає.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setLocationOpen(true)} className="btn btn-brand py-2 text-sm">Змінити місце пошуку</button>
                {filters.region === "kyiv_oblast" && <button type="button" onClick={() => update({ region: "kyiv_city" })} className="btn btn-ghost py-2 text-sm">Ця послуга у Києві</button>}
                {filters.locality && <button type="button" onClick={() => update({ locality: "", district: "all" })} className="btn btn-ghost py-2 text-sm">Уся обрана територія</button>}
                {geo.coords && filters.radius < 100000 && <button type="button" onClick={() => update({ radius: 100000 })} className="btn btn-ghost py-2 text-sm">Розширити до 100 км</button>}
                <button type="button" onClick={() => update({ animal: "all", district: "all", openNow: false, emergency: false, verified: false })} className="min-h-11 px-2 text-sm font-semibold text-brand underline underline-offset-4">Прибрати додаткові умови</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
        <p className="mb-2.5 text-xs text-ink/70">
          Перед візитом зателефонуйте — графік і наявність можуть змінюватися.
        </p>
        <ul className="space-y-3">
          {matchingPlaces.slice(0, visibleCount).map((p) => (
            <li key={p.id}>
              <PlaceCard
                place={p}
                origin={geo.coords}
                emergencyMode={emergencyMode}
                petAnimal={pet?.animalType}
                activePetId={pet?.id}
                alert={safety.alert}
              />
            </li>
          ))}
        </ul>
        {matchingPlaces.length > visibleCount && (
          <div className="mt-5 text-center">
            <p className="mb-2 text-xs text-ink/70">Показано {visibleCount} із {matchingPlaces.length}</p>
            <button type="button" className="btn-ghost w-full text-sm" onClick={() => { const count = visibleCount + 12; setVisibleCount(count); syncUrl(filters, query, count); }}>Показати ще {Math.min(12, matchingPlaces.length - visibleCount)}</button>
          </div>
        )}
        </>
      )}

      {/* Calm mode: the shelter action is one quiet row, out of the way. */}
      {!safety.active && showKyivSafety && (
        <div className="mt-5">
          <NearestShelterButton
            alert={safety.alert}
            onAlertStatus={safety.acceptAlert}
            onRefresh={safety.refreshAlert}
          />
          <SafetyControls safety={safety} onOpenMap={() => setView("map")} />
        </div>
      )}

      <Disclaimer text={t.disclaimer} className="mt-4" />

      <div className="mt-4 text-center text-xs text-ink/40" role="status">
        {geo.status === "prompting" && !geo.coords ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            Визначаємо вашу локацію…
          </span>
        ) : geo.coords ? (
          "Локацію визначено"
        ) : (
          "Локація не визначена — увімкніть геолокацію або вкажіть адресу"
        )}
      </div>
    </div>
  );
}

// local import kept at bottom to avoid clutter
import { useGeolocation as useGeo } from "@/hooks/useGeolocation";
