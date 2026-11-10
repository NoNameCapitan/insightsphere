"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActivePetSelector } from "@/components/ActivePetSelector";
import { FiltersBar } from "@/components/Filters";
import { GeoFallback } from "@/components/GeoFallback";
import { Disclaimer } from "@/components/JsonLd";
import { PlaceCard } from "@/components/PlaceCard";
import { PLACES } from "@/lib/data/places";
import { EMERGENCY_EMPTY_STATE } from "@/lib/data/verification";
import { RadiusSelector } from "@/components/RadiusSelector";
import { SafetyControls, useSafetyOverlay } from "@/components/SafetyOverlay";
import { NearestShelterButton } from "@/components/NearestShelterButton";
import { GeneratedVisual } from "@/components/GeneratedVisual";
import { track } from "@/lib/analytics";
import { DEFAULT_FILTERS, getRecommendedPlaces } from "@/lib/geo/ranking";
import { t } from "@/lib/i18n";
import { availabilityDuringAlert } from "@/lib/safety/placeAvailability";
import Link from "next/link";
import { CATEGORY_LABELS, normalizeDistrict } from "@/lib/labels";
import { getActivePet } from "@/lib/pets/store";
import { getPlaces, hydratePublishedPlaces } from "@/lib/store";
import type {
  AnimalType,
  FilterState,
  PetProfile,
  Place,
  PlaceCategory,
  RadiusMeters,
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

const VALID_RADII: RadiusMeters[] = [1000, 2000, 3000, 5000, 10000];

function seedFilters(params: URLSearchParams): FilterState {
  const f = { ...DEFAULT_FILTERS };
  // accept both ?category= and legacy ?type=
  const category = (params.get("category") || params.get("type")) as
    | PlaceCategory
    | null;
  if (category) f.category = category;
  const animal = params.get("animal") as AnimalType | null;
  if (animal) f.animal = animal;
  // Old links may still carry pre-v1.25 neighbourhood slugs.
  const district = normalizeDistrict(params.get("district"));
  if (district) f.district = district;
  const radius = Number(params.get("radius")) as RadiusMeters;
  if (VALID_RADII.includes(radius)) f.radius = radius;
  if (params.get("emergency") === "1") f.emergency = true;
  const sort = params.get("sort");
  if (sort) f.sort = sort as FilterState["sort"];
  return f;
}

export function NearbyClient() {
  const params = useSearchParams();
  const geo = useGeo();
  const [filters, setFilters] = useState<FilterState>(() => seedFilters(params));
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const safety = useSafetyOverlay(geo.coords);

  // Start from the deterministic seed dataset so server and client render the
  // same HTML, then merge localStorage additions (approved submissions, admin
  // edits) after mount — otherwise an approved local place causes a hydration
  // mismatch on this page.
  const [allPlaces, setAllPlaces] = useState<Place[]>(PLACES);

  useEffect(() => {
    setPet(getActivePet());
    setAllPlaces(getPlaces());
    // Pull the server-published layer, then re-read the merged list (v1.9).
    void hydratePublishedPlaces().then(() => setAllPlaces(getPlaces()));
    track("nearby_search_started", { category: filters.category });
    if (geo.status === "idle" && !geo.coords) geo.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const result = useMemo(
    () => getRecommendedPlaces(allPlaces, geo.coords, { pet, filters }),
    [allPlaces, geo.coords, pet, filters],
  );

  const emergencyMode =
    filters.emergency || filters.category === "emergency_vet";

  useEffect(() => {
    if (safety.shouldAutoOpenMap) setView("map");
  }, [safety.shouldAutoOpenMap]);

  const update = (patch: Partial<FilterState>) =>
    setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="container-px mx-auto max-w-3xl py-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Місця поруч</h1>
                  </div>
        <div className="flex rounded-xl bg-ink/[0.04] p-1">
          <button
            onClick={() => setView("list")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "list" ? "bg-surface text-brand shadow-sm" : "text-ink/55 hover:text-brand"}`}
          >Список</button>
          <button
            onClick={() => setView("map")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "map" ? "bg-surface text-brand shadow-sm" : "text-ink/55 hover:text-brand"}`}
          >Карта</button>
        </div>
      </div>
      {/* The map artwork is a desktop-only flourish; on phones results come first. */}
      <div aria-hidden className="relative mx-auto mb-4 hidden aspect-[1500/768] w-full max-w-[420px] sm:block">
        <GeneratedVisual src="/visuals/g-nearby-map.webp" className="absolute inset-0" motion="none" shine sizes="420px" />
        <span className="map-beacon left-[12%] top-[76%] -translate-x-1/2 -translate-y-1/2" />
      </div>
      {emergencyMode && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emergency/15 bg-emergency-50 px-4 py-3 text-emergency-700">
          <span aria-hidden className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emergency" />
          <p className="text-sm font-medium">
            У цій версії VetNear показує найближчі ветклініки. Цілодобові/термінові
            провайдери додаються тільки після підтвердження дзвінком. При загрозі життю
            телефонуйте у клініку напряму негайно.
          </p>
        </div>
      )}

      {/* Safety layer: first on screen during an alert, a quiet row at the
          bottom otherwise (see below). The logic itself is unchanged. */}
      {safety.active && (
        <div className="mb-4">
          <NearestShelterButton
            alert={safety.alert}
            onAlertStatus={safety.acceptAlert}
            onRefresh={safety.refreshAlert}
          />
          <SafetyControls safety={safety} onOpenMap={() => setView("map")} />
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_180px]">
        <RadiusSelector value={filters.radius} onChange={(r) => update({ radius: r })} />
        <FiltersBar filters={filters} onChange={update} onReset={() => setFilters(DEFAULT_FILTERS)} />
      </div>

      <div className="nav-scroll -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Категорія">
        {QUICK_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filters.category === c.id}
            onClick={() => update({ category: c.id })}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
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
        <ActivePetSelector onChange={setPet} hideWhenEmpty />
      </div>

      <div className="my-3 flex items-center justify-between">
        <p className="text-sm text-ink/60">
          Знайдено: <strong className="text-ink">{result.places.length}</strong>
          {filters.category !== "all" && ` · ${CATEGORY_LABELS[filters.category]}`}
        </p>
        <span className="text-xs text-ink/45">Радіус {filters.radius / 1000} км</span>
      </div>

      {result.expandedFrom && (
        <p className="mb-3 rounded-2xl bg-amber/10 px-4 py-2 text-sm text-amber">
          Нічого не знайдено в межах {result.expandedFrom / 1000} км. Показуємо
          найближчі в межах {result.appliedRadius / 1000} км.
        </p>
      )}

      {result.places.length > 0 && result.places.length <= 2 && filters.radius < 10000 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3">
          <p className="text-sm leading-5 text-ink/55">У цьому радіусі мало перевірених місць.</p>
          <button type="button" onClick={() => update({ radius: 10000 })} className="shrink-0 text-sm font-semibold text-brand hover:underline">Показати до 10 км</button>
        </div>
      )}

      {(geo.status === "denied" || geo.status === "unavailable") && (
        <div className="mb-3">
          <GeoFallback onResolved={geo.setManual} />
        </div>
      )}

      {view === "map" ? (
        <div className="h-[60vh] w-full overflow-hidden rounded-3xl border border-brand-100">
          <MapView
            places={result.places.filter((place) => availabilityDuringAlert(place, safety.alert) !== "closed")}
            origin={geo.coords}
            zoom={13}
            shelters={safety.active && safety.enabled ? safety.shelters : []}
            selectedShelterId={safety.selectedShelterId}
            onSelectShelter={safety.setSelectedShelterId}
          />
        </div>
      ) : result.places.length === 0 ? (
        <div className="rounded-3xl border border-brand-100 bg-surface p-8 text-center">
          <GeneratedVisual src="/visuals/j-empty-state.webp" className="mx-auto mb-3 h-52 w-full max-w-[320px] sm:h-60" motion="bob" glow shine shadow sizes="320px" />
          {emergencyMode ? (
            <p className="text-ink/60">{EMERGENCY_EMPTY_STATE}</p>
          ) : filters.category === "shelter" ? (
            <>
              <p className="font-display text-lg font-bold text-ink">
                Перевірених притулків у базі поки немає
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">
                Ми додаємо притулок лише після перевірки контактів, тому не показуємо
                непідтверджені адреси. Ось що можна зробити зараз:
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
                Спробуйте збільшити радіус, змінити категорію або скинути фільтри —
                і ми покажемо всі місця поруч.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="btn btn-brand py-2 text-sm"
                >
                  Скинути фільтри
                </button>
                <button
                  onClick={() => setFilters({ ...DEFAULT_FILTERS, radius: 10000 })}
                  className="btn btn-ghost py-2 text-sm"
                >
                  Показати всі місця поруч
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
        <p className="mb-2.5 text-xs text-ink/45">
          Перед візитом зателефонуйте — графік і наявність можуть змінюватися.
        </p>
        <ul className="space-y-3">
          {result.places.map((p) => (
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
        </>
      )}

      {/* Calm mode: the shelter action is one quiet row, out of the way. */}
      {!safety.active && (
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
          "Локація не визначена — увімкніть геолокацію або оберіть район"
        )}
      </div>
    </div>
  );
}

// local import kept at bottom to avoid clutter
import { useGeolocation as useGeo } from "@/hooks/useGeolocation";
