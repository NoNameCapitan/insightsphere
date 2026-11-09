"use client";

import { readJSON, writeJSON } from "@/lib/storage";

const KEY = "vetnear:favorite-places";

export function getFavoritePlaceIds(): string[] {
  return readJSON<string[]>(KEY, []);
}

export function isFavoritePlace(placeId: string): boolean {
  return getFavoritePlaceIds().includes(placeId);
}

export function toggleFavoritePlace(placeId: string): boolean {
  const current = getFavoritePlaceIds();
  const favorite = !current.includes(placeId);
  writeJSON(KEY, favorite ? [...current, placeId] : current.filter((id) => id !== placeId));
  return favorite;
}
