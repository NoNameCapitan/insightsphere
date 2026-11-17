"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { findPartnerPlaces, type PartnerPlaceSummary } from "@/lib/partners/discovery";
import { CATEGORY_LABELS } from "@/lib/labels";
import styles from "@/app/for-partners/partners.module.css";

export function PartnerPlaceFinder({ places }: { places: PartnerPlaceSummary[] }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const matches = findPartnerPlaces(places, query);
  return <section className={styles.finder} id="find-your-place" aria-labelledby={`${id}-title`}>
    <div><h2 id={`${id}-title`}>Можливо, ви вже поруч.</h2><p>Знайдіть свою картку, щоб уточнити інформацію без дублювання.</p></div>
    <label className={styles.searchLabel} htmlFor={id}>Назва, адреса або телефон закладу</label>
    <input id={id} type="search" className={styles.searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder="Наприклад, назва вашої клініки" autoComplete="off" />
    {query.trim().length >= 3 && <div aria-live="polite">
      {matches.length ? <ul className={styles.matches}>{matches.map(place => <li key={place.id}>
        <div><strong>{place.name}</strong><p>{CATEGORY_LABELS[place.category]} · {place.locality ?? "Київ"}</p><p>{place.address}</p></div>
        <Link href={`/partner-interest?claim=${encodeURIComponent(place.slug)}`} className="btn btn-ghost">Це мій заклад</Link>
      </li>)}</ul> : <p className={styles.empty}>Збігів у каталозі немає. Спробуйте телефон або іншу частину назви. <Link href="/add-place">Додати новий заклад</Link></p>}
    </div>}
    <p className={styles.note}>Заявка починає перевірку представника через офіційний контакт. Права на профіль автоматично не надаються.</p>
  </section>;
}
