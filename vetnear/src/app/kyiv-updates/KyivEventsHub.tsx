"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COVERAGE_LABEL, COVERAGE_REGIONS } from "@/config/coverage";
import { buildEventCalendar, EVENT_CATEGORIES, EVENT_CATEGORY_LABELS, eventStatus, eventStatusLabel, filterKyivEvents, isCalendarEligible, KYIV_EVENTS, KYIV_UPDATES_AS_OF, type KyivEvent, type KyivEventCategory, type KyivEventScope } from "@/lib/data/kyivUpdates";
import { emptyEventPreferences, EVENTS_PREFERENCES_KEY, readEventPreferences, toggleFollowedCategory, toggleSavedEvent } from "@/lib/events/preferences";
import { groupEventFeed } from "@/lib/events/feed";
import { EXTERNAL_LINK_PROPS } from "@/lib/security/url";
import type { PlaceRegion } from "@/lib/types";
import styles from "./events.module.css";

const dateLabel = (date: string) => new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Kyiv" }).format(new Date(`${date}T12:00:00Z`));
function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">{diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h15m-6-6 6 6-6 6" />}</svg>;
}
function Bookmark({ filled = false }: { filled?: boolean }) {
  return <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6"><path d="M6 4h12v16l-6-4-6 4V4Z" /></svg>;
}

export function KyivEventsHub({ initialCategory = "all", initialNow }: { initialCategory?: KyivEventCategory | "all"; initialNow: string }) {
  const [category, setCategory] = useState<KyivEventCategory | "all">(initialCategory);
  const [region, setRegion] = useState<PlaceRegion | "all">("all");
  const [scope, setScope] = useState<KyivEventScope>("current");
  const [preferences, setPreferences] = useState(emptyEventPreferences);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date(initialNow));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => { setPreferences(readEventPreferences()); setLoaded(true); setNow(new Date()); };
    const storageChanged = (event: StorageEvent) => { if (!event.key || event.key === EVENTS_PREFERENCES_KEY) refresh(); };
    refresh();
    window.addEventListener("storage", storageChanged);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => { window.removeEventListener("storage", storageChanged); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, []);

  const events = filterKyivEvents(KYIV_EVENTS, { category, region, scope, ...preferences }, now);
  const groups = groupEventFeed(events, now);
  const confirmedUpcoming = events.filter((event) => eventStatus(event, now) === "upcoming");
  const savedCount = KYIV_EVENTS.filter((event) => preferences.savedIds.includes(event.id)).length;
  const save = (event: KyivEvent) => {
    try {
      setError(null);
      const next = toggleSavedEvent(event.id); setPreferences(next);
      setNotice(next.savedIds.includes(event.id) ? `«${event.title}» збережено у цьому браузері.` : "Матеріал прибрано зі збережених.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не вдалося зберегти вибір."); }
  };
  const follow = (topic: KyivEventCategory) => {
    try {
      setError(null); const next = toggleFollowedCategory(topic); setPreferences(next);
      setNotice(next.followedCategories.includes(topic) ? `Тема «${EVENT_CATEGORY_LABELS[topic]}» тепер у вашій добірці.` : "Тему прибрано з вашої добірки.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не вдалося зберегти тему."); }
  };
  const calendar = (event: KyivEvent) => {
    const content = buildEventCalendar(event, new Date());
    if (!content) { setError("Дати або умови потребують перевірки. Відкрийте першоджерело."); return; }
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `vetnear-${event.id}.ics`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setNotice("Файл календаря підготовлено. Імпортуйте його у свій календар; зміни організатора перевіряйте окремо.");
  };
  const clearFilters = () => { setCategory("all"); setRegion("all"); setScope("current"); };

  return <div className={styles.page}>
    <div className={styles.breadcrumb}><Link href="/">VetNear</Link><span aria-hidden>/</span><span>Події та можливості</span></div>
    <header className={styles.hero}>
      <div className={styles.heroMain}>
        <h1>Турбота поруч.<br /><span>І привід зустрітися.</span></h1>
        <p>Вакцинації, адопції та корисні події для вас і ваших тварин. З датами, умовами та посиланням на тих, хто організовує.</p>
        <div className={styles.heroMeta}><span>{COVERAGE_LABEL}</span><span>Джерела перевірено {dateLabel(KYIV_UPDATES_AS_OF)}</span></div>
      </div>
      <div className={styles.heroFeature}>
        <svg aria-hidden viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M24 5 40 11v13c0 10-16 19-16 19S8 34 8 24V11L24 5Z" /><path d="M24 15v15m-7-7.5h14" /></svg>
        <h2>Вакцина від сказу — безоплатно</h2>
        <p>Державні лікарні Києва й області. Знайдіть контакти та погодьте прийом.</p>
        <a href="#events-feed" onClick={() => { setCategory("vaccination"); setScope("current"); setRegion("all"); }}>Де звернутися <Arrow /></a>
      </div>
    </header>

    <section className={styles.followPanel} aria-labelledby="follow-topics-heading"><h2 id="follow-topics-heading">Ваша добірка турботи</h2><p>Оберіть теми — вони залишаться під рукою.</p><div className={styles.topicList}>{EVENT_CATEGORIES.map((topic) => <label key={topic}><input type="checkbox" checked={preferences.followedCategories.includes(topic)} disabled={!loaded} onChange={() => follow(topic)} /><span>{EVENT_CATEGORY_LABELS[topic]}</span></label>)}</div><button type="button" onClick={() => { setScope("following"); setCategory("all"); }}>Моя добірка <Arrow /></button><p className={styles.localNote}>Вибір збережеться в цьому браузері. Оновлення чекають тут. Без push-повідомлень і розсилок.</p></section>

    <div className={styles.workspace}>
      <section className={styles.feed} id="events-feed" aria-labelledby="events-heading">
        <div className={styles.feedHeading}><h2 id="events-heading">Варто знати</h2><span>Для людей, які дбають</span></div>
        <div className={styles.categories} aria-label="Категорії матеріалів">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>Усе</button>
          {EVENT_CATEGORIES.map((topic) => <button key={topic} type="button" aria-pressed={category === topic} onClick={() => setCategory(topic)}>{EVENT_CATEGORY_LABELS[topic]}</button>)}
        </div>
        <div className={styles.filterBar}>
          <div className={styles.scopes} aria-label="Добірка матеріалів">
            {([ ["current", "Актуальне"], ["following", "Мої теми"], ["saved", `Збережені${loaded ? ` · ${savedCount}` : ""}`], ["archive", "Архів"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>)}
          </div>
          <label className={styles.regionLabel}><span className="sr-only">Регіон події</span><select value={region} onChange={(event) => setRegion(event.target.value as PlaceRegion | "all")}><option value="all">Київ і область</option><option value="kyiv_city">{COVERAGE_REGIONS.kyiv_city}</option><option value="kyiv_oblast">{COVERAGE_REGIONS.kyiv_oblast}</option></select></label>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.liveNotice} role="status" aria-live="polite">{notice}</div>
        {scope === "current" && confirmedUpcoming.length === 0 && <div className={styles.scheduleNote}><strong>Найближчі події ще потребують уточнення.</strong><p>Постійні можливості й анонси з неповними деталями — в окремих розділах нижче.</p></div>}
        <p className={styles.resultCount} aria-live="polite">Матеріалів у добірці: {events.length}{scope === "archive" ? " · минулі дати" : ""}</p>
        {events.length ? <div className={styles.eventList}>{groups.map((group) => <section key={group.id} className={styles.group} aria-labelledby={`group-${group.id}`}><div className={styles.groupHeading}><h3 id={`group-${group.id}`}>{group.title}</h3><span>{group.events.length}</span></div><p className={styles.groupDescription}>{group.description}</p><div>{group.events.map((event) => {
          const status = eventStatus(event, now);
          const saved = preferences.savedIds.includes(event.id);
          return <article className={styles.event} key={event.id} id={`event-${event.id}`}>
            <div className={styles.eventCategory}><span>{EVENT_CATEGORY_LABELS[event.category]}</span>{event.cost === "free" && <strong>Вакцина безоплатна</strong>}</div>
            <div className={styles.eventContent}>
              <div className={styles.eventTop}><span className={`${styles.status} ${status === "needs_confirmation" ? styles.statusPending : status === "expired" ? styles.statusExpired : ""}`}>{eventStatusLabel(event, now)}</span><button type="button" className={styles.saveButton} aria-pressed={saved} aria-label={`${saved ? "Прибрати зі збережених" : "Зберегти"}: ${event.title}`} disabled={!loaded} onClick={() => save(event)}><Bookmark filled={saved} /><span>{saved ? "Збережено" : "Зберегти"}</span></button></div>
              <h4>{event.title}</h4><p className={styles.summary}>{event.summary}</p>
              <p className={styles.facts}><span>{event.locality}</span><span aria-hidden>·</span><span>{event.schedule.label}</span></p>
              <details className={styles.details}><summary>Умови, місце та джерела</summary><p>{event.summary}</p><p><strong>Місце:</strong> {event.venue}</p><p>{event.eligibility}</p><p>{event.cost === "free" ? "Безоплатність стосується вакцини проти сказу. Інші послуги уточнюйте окремо." : "Умови участі та можливу оплату уточніть в організатора."}</p><ul>{event.sources.map((source) => <li key={source.url}><a href={source.url} {...EXTERNAL_LINK_PROPS}>{source.label} <span aria-hidden>↗</span></a>{source.publishedAt && <span> · публікація {dateLabel(source.publishedAt)}</span>}</li>)}</ul></details>
              <div className={styles.eventActions}><a className={styles.sourceLink} href={event.sources[0].url} {...EXTERNAL_LINK_PROPS}>{event.action}<Arrow diagonal /></a>{isCalendarEligible(event, now) && <button type="button" className={styles.calendarButton} onClick={() => calendar(event)}>У календар</button>}</div>
              <p className={styles.checked}>Джерело звірено {dateLabel(event.lastCheckedAt)}</p>
            </div>
          </article>;
        })}</div></section>)}</div> : <div className={styles.empty}><Bookmark /><h3>{scope === "saved" ? "Ваш список починається тут" : scope === "following" ? "Оберіть теми, які вам близькі" : "За цими фільтрами матеріалів немає"}</h3><p>{scope === "saved" ? "Збережіть цікаву можливість — вона залишиться в цьому браузері, навіть після закриття сторінки." : scope === "following" ? "Позначте теми в блоці «Ваша добірка турботи» вище. Тут з’являться відповідні матеріали." : "Спробуйте іншу категорію або регіон. Ми не додаємо непідтверджені події заради заповнення списку."}</p><button type="button" onClick={clearFilters}>Переглянути всю добірку <Arrow /></button></div>}
      </section>

      <aside className={styles.sidebar} aria-label="Ваші теми та джерела">

        <section className={styles.editorNote}><svg aria-hidden viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 5h16v22H8zM12 11h8m-8 5h8m-8 5h5" /></svg><h2>Спочатку джерело.<br />Потім — плани.</h2><p>Перевірка сторінки підтверджує опубліковані умови, а не вільне місце чи прийом сьогодні. Анонс без дати не потрапляє до календаря.</p><p>Редакційне оновлення: {dateLabel(KYIV_UPDATES_AS_OF)}. Це добірка, а не автоматична стрічка всіх подій.</p></section>
        <Link href="/nearby" className={styles.nearbyLink}>Потрібна допомога зараз?<strong>Знайти заклад поруч <Arrow /></strong></Link>
      </aside>
    </div>
  </div>;
}
