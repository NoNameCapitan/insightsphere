"use client";

import Link from "next/link";
import { useState } from "react";
import { DistrictMap3D } from "@/components/DistrictMap3D";
import type { KyivDistrict } from "@/lib/types";
import styles from "./HomeDistricts.module.css";

function OutwardArrow() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M4 12 12 4M4.5 4H12v7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Select a district, then follow a deliberate route into its results. */
export function HomeDistricts() {
  const [district, setDistrict] = useState<KyivDistrict | "all">("all");
  return (
    <section id="district-explorer" className={styles.section} aria-labelledby="home-districts-title">
      <div className={styles.heading}>
        <div>
          <h2 id="home-districts-title">Велике місто.<br /><span>Турбота поруч.</span></h2>
          <p>Оберіть район Києва — знайдіть ветклініки, догляд і щоденні послуги для вашої тварини.</p>
        </div>
        <nav className={styles.regionNav} aria-label="Пошук за територією">
          <a href="#home-districts-map" className={styles.cityLink}>Райони Києва</a>
          <Link href="/nearby?region=kyiv_oblast&location=manual">Київська область <OutwardArrow /></Link>
        </nav>
      </div>
      <div id="home-districts-map" className={styles.mapAnchor}>
        <DistrictMap3D value={district} onChange={setDistrict} mode="cinematic" showSearchLink />
      </div>
      <div className={styles.footnote}>
        <p>Заклади у каталозі проходять різні етапи перевірки. Актуальний статус — у профілі кожного.</p>
        <Link href="/nearby?region=kyiv_oblast&location=manual">Шукаєте за містом? Перейти до області <OutwardArrow /></Link>
      </div>
    </section>
  );
}
