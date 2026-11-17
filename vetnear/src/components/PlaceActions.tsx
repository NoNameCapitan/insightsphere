"use client";

import { useEffect, useRef, useState } from "react";
import { SocialRow } from "@/components/SocialRow";
import { track } from "@/lib/analytics";
import { reportLead } from "@/lib/leads/report";
import { googleMapsRoute } from "@/lib/maps";
import { EXTERNAL_LINK_PROPS, safeUrl } from "@/lib/security/url";
import { getOpeningHoursStatus, type OpeningHoursStatus } from "@/lib/distance";
import type { Place } from "@/lib/types";
import { PhoneIcon, RouteIcon } from "@/components/icons/ServiceIcons";
import styles from "./PlaceActions.module.css";

/** Schedule only: never an assertion that a doctor can accept a patient now. */
export function PlaceOpeningStatus({ place }: { place: Place }) {
  const [status, setStatus] = useState<OpeningHoursStatus>("unknown");
  useEffect(() => {
    const refresh = () => setStatus(getOpeningHoursStatus(place));
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [place]);
  return <span className={styles.schedule} data-status={status}>
    <span aria-hidden className={styles.statusDot} />
    {status === "open" ? "Відкрито за графіком" : status === "closed" ? "Зачинено за графіком" : "Графік варто уточнити"}
  </span>;
}

export function PlaceActions({ place }: { place: Place }) {
  const website = safeUrl(place.website);
  const inlineActions = useRef<HTMLDivElement>(null);
  const [inlineVisible, setInlineVisible] = useState(true);
  useEffect(() => { track("place_profile_viewed", { placeId: place.id }); }, [place.id]);
  useEffect(() => {
    if (!inlineActions.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInlineVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(inlineActions.current);
    return () => observer.disconnect();
  }, []);

  const contact = (type: "call" | "route" | "website") => {
    track(`${type}_clicked`, { placeId: place.id });
    reportLead(place.id, type);
  };

  return (
    <div className={styles.actions}>
      <div ref={inlineActions} className={styles.primary} aria-label="Зв’язатися із закладом">
        <a href={`tel:${place.phone}`} onClick={() => contact("call")} className="btn btn-brand">
          <PhoneIcon className="h-6 w-6" />Зателефонувати
        </a>
        <a href={googleMapsRoute(place)} {...EXTERNAL_LINK_PROPS} onClick={() => contact("route")} className="btn btn-ghost">
          <RouteIcon className="h-6 w-6" />Маршрут
        </a>
      </div>
      <p className={styles.explanation}>Запис і умови прийому — напряму із закладом. Перед виїздом уточніть, чи можуть прийняти вашу тварину.</p>
      {(website || place.email) && <div className={styles.secondary}>
        {website && <a href={website} {...EXTERNAL_LINK_PROPS} onClick={() => contact("website")}>Офіційний сайт <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12 12 4M4 4h8v8" /></svg></a>}
        {place.email && <a href={`mailto:${place.email}`}>Написати email</a>}
      </div>}
      <SocialRow links={place.socialLinks} placeId={place.id} />
      {!inlineVisible && <nav className={styles.sticky} aria-label="Швидкий зв’язок із закладом" data-contact-dock>
        <div className={styles.stickyInner}>
          <a href={`tel:${place.phone}`} onClick={() => contact("call")} className="btn btn-brand">
            <PhoneIcon className="h-5 w-5" />Зателефонувати
          </a>
          <a href={googleMapsRoute(place)} {...EXTERNAL_LINK_PROPS} onClick={() => contact("route")} className="btn btn-ghost">
            <RouteIcon className="h-5 w-5" />Маршрут
          </a>
        </div>
      </nav>}
    </div>
  );
}
