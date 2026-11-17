"use client";

import { useEffect, useState } from "react";
import { readFavoritePlaces, subscribeToFavoritePlaces, type FavoritePlacesState } from "./store";

/** The server never reads or renders personal saved-place IDs. */
export function useFavoritePlaces() {
  const [state, setState] = useState<FavoritePlacesState>({ ids: [], issue: null });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const refresh = () => { setState(readFavoritePlaces()); setLoaded(true); };
    const unsubscribe = subscribeToFavoritePlaces(refresh);
    refresh();
    return unsubscribe;
  }, []);
  return { ...state, loaded };
}
