"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlaceCard } from "@/components/PlaceCard";
import { useFavoritePlaces } from "@/lib/favorites/useFavoritePlaces";
import { favoritePlacesMessage, removeFavoritePlaces, resetFavoritePlaces } from "@/lib/favorites/store";
import { PLACES } from "@/lib/data/places";
import { isDemoPlace, isSearchablePublicPlace } from "@/lib/data/provenance";
import { getPlaces, hydratePublishedPlaces } from "@/lib/store";
import type { Place } from "@/lib/types";
import styles from "./SavedPlaces.module.css";

export function SavedPlacesClient() {
  const { ids, issue, loaded } = useFavoritePlaces();
  const [catalog, setCatalog] = useState<Place[]>(PLACES);
  const [catalogReady, setCatalogReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = () => { if (mounted) setCatalog(getPlaces()); };
    refresh();
    void hydratePublishedPlaces().then(() => { refresh(); if (mounted) setCatalogReady(true); });
    window.addEventListener("focus", refresh);
    return () => { mounted = false; window.removeEventListener("focus", refresh); };
  }, []);

  const { places, unavailable } = useMemo(() => {
    const byId = new Map(catalog.filter((place) => isSearchablePublicPlace(place) && !isDemoPlace(place)).map((place) => [place.id, place]));
    return { places: ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []), unavailable: ids.filter((id) => !byId.has(id)) };
  }, [catalog, ids]);

  const recover = (action: () => void) => {
    try { action(); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не вдалося оновити список. Спробуйте ще раз."); }
  };

  return <div className="operating-screen container-px mx-auto max-w-3xl py-7">
    <Link href="/nearby" className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand">До пошуку</Link>
    <header><h1 className="operating-heading font-display text-3xl font-bold text-ink">Збережені місця</h1><p className="mt-2 max-w-lg text-sm leading-6 text-ink/70">Ваші клініки, грумери й інші корисні контакти — під рукою.</p><p className="mt-2 text-xs leading-5 text-ink/65">Список зберігається лише в цьому браузері. Після очищення його даних збережені місця зникнуть.</p></header>
    {error && <p role="alert" className={styles.note}>{error}</p>}
    {!loaded ? <div className="skeleton mt-6 h-48" role="status" aria-label="Завантажуємо збережені місця" /> : issue ? <section className={styles.note} role="alert"><p>{issue === "unavailable" ? "Браузер не дозволив прочитати список. Перевірте налаштування зберігання й відкрийте сторінку ще раз." : favoritePlacesMessage(issue)}</p>{issue === "corrupt" && <button type="button" onClick={() => recover(resetFavoritePlaces)}>Очистити пошкоджений список місць</button>}<Link href="/nearby" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand">Перейти до пошуку</Link></section> : ids.length === 0 ? <section className={styles.intro}><h2>Залиште потрібні місця під рукою.</h2><p>Натисніть сердечко біля закладу — тут з’явиться його картка й прямий контакт. Можна почати зі свого ветеринара або грумера.</p><Link href="/nearby" className="btn btn-brand">Знайти місце</Link></section> : <>
      <p className={styles.count} role="status">У вашому списку: <strong>{ids.length}</strong>{!catalogReady ? " · Оновлюємо каталог…" : ""}</p>
      <div className={styles.list}>{places.map((place) => <PlaceCard key={place.id} place={{ ...place, distanceMeters: null }} />)}</div>
      {catalogReady && unavailable.length > 0 && <section className={styles.note} aria-label="Місця без доступної картки"><p>Не вдалося знайти в поточному каталозі: {unavailable.length}. Це не означає, що заклади закрилися. Збереження залишаться у списку, поки ви їх не приберете.</p><button type="button" onClick={() => recover(() => removeFavoritePlaces(unavailable))}>Прибрати ці збереження</button></section>}
      <p className="mt-5 text-xs leading-5 text-ink/65">Збереження не підтверджує прийом зараз. Перед візитом зателефонуйте до закладу.</p>
      <Link href="/nearby" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand">Знайти ще місця</Link>
    </>}
  </div>;
}
