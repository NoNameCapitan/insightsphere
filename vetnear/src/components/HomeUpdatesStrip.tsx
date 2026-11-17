"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COVERAGE_LABEL } from "@/config/coverage";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS, eventStatus, KYIV_EVENTS, KYIV_UPDATES_AS_OF } from "@/lib/data/kyivUpdates";
import styles from "./HomeUpdatesStrip.module.css";

function Arrow() { return <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>; }

export function HomeUpdatesStrip() {
  const [now, setNow] = useState(() => new Date(`${KYIV_UPDATES_AS_OF}T12:00:00+02:00`));
  useEffect(() => {
    const refresh = () => setNow(new Date()); refresh();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, []);
  const active = KYIV_EVENTS.filter((event) => eventStatus(event, now) !== "expired");
  const featured = [active.find((event) => event.category === "vaccination"), active.find((event) => event.category === "adoption"), active.find((event) => event.category === "event" && eventStatus(event, now) === "upcoming") ?? active.find((event) => event.category === "opportunity")].filter((event) => event !== undefined);

  return <section className={styles.strip} aria-labelledby="kyiv-now-title">
    <div className={styles.intro}>
      <h2 id="kyiv-now-title">Місто живе.<br /><span>Турбота триває.</span></h2>
      <p>Вакцинації, адопції, події та можливості для власників тварин. {COVERAGE_LABEL} — в окремій добірці.</p>
      <nav className={styles.topics} aria-label="Теми новин">{EVENT_CATEGORIES.map((category) => <Link key={category} href={`/kyiv-updates?category=${category}`}>{EVENT_CATEGORY_LABELS[category]}</Link>)}</nav>
      <Link href="/kyiv-updates" className={styles.allLink}>Події та можливості <Arrow /></Link>
      <p className={styles.checked}>Перевірка джерел · {new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Kyiv" }).format(new Date(`${KYIV_UPDATES_AS_OF}T12:00:00Z`))}</p>
    </div>
    <div className={styles.items}>{featured.map((event) => <article key={event.id}>
      <div className={styles.meta}><span>{EVENT_CATEGORY_LABELS[event.category]}</span><span>{event.schedule.kind === "date" ? event.schedule.label : eventStatus(event, now) === "needs_confirmation" ? "Уточніть актуальні умови" : "Постійна можливість"}</span></div>
      <Link href={`/kyiv-updates?category=${event.category}#event-${event.id}`}><h3>{event.title}</h3><Arrow /></Link>
      <p>{event.locality}{event.confirmation === "needs_confirmation" ? " · деталі потребують підтвердження" : " · умови в першоджерелі"}</p>
    </article>)}</div>
  </section>;
}
