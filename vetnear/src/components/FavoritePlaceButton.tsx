"use client";

import { track } from "@/lib/analytics";
import { useId, useState } from "react";
import { toggleFavoritePlace } from "@/lib/favorites/store";
import { useFavoritePlaces } from "@/lib/favorites/useFavoritePlaces";
import styles from "./SavedPlaces.module.css";

export function FavoritePlaceButton({ placeId, compact = false }: { placeId: string; compact?: boolean }) {
  const { ids, loaded } = useFavoritePlaces();
  const favorite = ids.includes(placeId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const toggle = () => {
    try {
      const saved = toggleFavoritePlace(placeId);
      setError(null);
      setMessage(saved ? "Місце збережено в цьому браузері." : "Місце прибрано зі збережених.");
      if (saved) track("place_saved", { placeId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не вдалося зберегти місце. Спробуйте ще раз.");
      setMessage("");
    }
  };

  return (
    <span className={styles.favoriteWrap}>
    <button
      type="button"
      aria-label={favorite ? "Прибрати з обраного" : "Додати в обране"}
      aria-pressed={favorite}
      aria-describedby={error ? errorId : undefined}
      disabled={!loaded}
      title={favorite ? "В обраному" : "Додати в обране"}
      onClick={toggle}
      className={`favorite-place h-11 w-11 ${compact ? styles.compact : ""} grid shrink-0 place-items-center rounded-full border transition ${favorite ? "border-peach-200 bg-peach-50 text-peach-700" : "border-brand-100 bg-white text-ink/40 hover:border-brand-200 hover:text-brand"}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M20.8 4.9c-2.2-2.1-5.7-1.9-7.7.4L12 6.6l-1.1-1.3c-2-2.3-5.5-2.5-7.7-.4-2.4 2.3-2.5 6.2-.2 8.6L12 22l9-8.5c2.3-2.4 2.2-6.3-.2-8.6Z" strokeLinejoin="round" />
      </svg>
    </button>
    <span className="sr-only" role="status">{message}</span>
    {error && <span id={errorId} role="alert" className={`${styles.favoriteError} ${compact ? "" : styles.favoriteErrorStart}`}>{error}</span>}
    </span>
  );
}
