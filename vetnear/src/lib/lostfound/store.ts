"use client";
import { track } from "@/lib/analytics";
import { makeId, nowIso, readJSON, writeJSON } from "@/lib/storage";
import type { AnimalType, KyivDistrict } from "@/lib/types";

export interface LostFoundCard {
  id: string;
  mode: "lost" | "found";
  petName: string;
  animalType: AnimalType;
  district: KyivDistrict;
  contact: string;
  note?: string;
  createdAt: string;
}

const KEY = "vetnear:lostfound";

export function getCards(): LostFoundCard[] {
  return readJSON<LostFoundCard[]>(KEY, []);
}

export function createCard(
  input: Omit<LostFoundCard, "id" | "createdAt">,
): LostFoundCard {
  const card: LostFoundCard = { ...input, id: makeId("lf"), createdAt: nowIso() };
  writeJSON(KEY, [card, ...getCards()]);
  track("lost_found_created", { mode: card.mode });
  return card;
}
