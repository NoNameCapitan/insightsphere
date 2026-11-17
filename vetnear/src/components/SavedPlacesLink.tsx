"use client";

import Link from "next/link";
import { useFavoritePlaces } from "@/lib/favorites/useFavoritePlaces";
import styles from "./SavedPlaces.module.css";

export function SavedPlacesLink({ compact = false }: { compact?: boolean }) {
  const { ids, loaded, issue } = useFavoritePlaces();
  return <Link href="/saved" className={styles.entry} aria-label="Збережені місця"><svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4V3Z" /></svg>{compact ? "Збережені" : "Збережені місця"}{loaded && !issue && ids.length > 0 ? ` · ${ids.length}` : ""}</Link>;
}
