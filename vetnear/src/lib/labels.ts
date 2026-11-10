// Centralized display labels (Ukrainian) for the platform taxonomy.
//
// v1.9: the category taxonomy is DERIVED from the active vertical config
// (src/config/verticals/*), not hardcoded here. Consumers keep importing the
// same names with the same types — swapping the vertical changes every label,
// marker colour and icon in one place.
import { categoryMap } from "@/config/vertical";
import { VERTICAL } from "@/config/verticals/pet-care-kyiv";
import type {
  AnimalType,
  Availability,
  KyivDistrict,
  PlaceCategory,
  RequestStatus,
  SubmissionStatus,
  TrustBadge,
} from "@/lib/types";

export const CATEGORY_LABELS: Record<PlaceCategory, string> = categoryMap(
  VERTICAL,
  (c) => c.label,
);

export const CATEGORY_EMOJI: Record<PlaceCategory, string> = categoryMap(
  VERTICAL,
  (c) => c.emoji,
);

/** Marker colors per category (hex). Emergency is intentionally the loudest. */
export const CATEGORY_COLOR: Record<PlaceCategory, string> = categoryMap(
  VERTICAL,
  (c) => c.color,
);

export const ANIMAL_LABELS: Record<AnimalType, string> = {
  cat: "Кіт",
  dog: "Собака",
  bird: "Птах",
  rodent: "Гризун",
  reptile: "Рептилія",
  exotic: "Екзотична тварина",
  other: "Інше",
};

export const DISTRICT_LABELS: Record<KyivDistrict, string> =
  VERTICAL.city.districts;

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  in_stock: "В наявності",
  low_stock: "Мало",
  out_of_stock: "Немає",
  unknown: "Уточнюйте",
};

export const BADGE_LABELS: Record<TrustBadge, string> = {
  free: "Безкоштовний профіль",
  verified: "Перевірено",
  claimed: "Підтверджено власником",
  updated_recently: "Нещодавно оновлено",
  data_outdated: "Дані можуть бути застарілі",
  emergency: "Термінова ситуація",
  open_now: "Відкрито зараз",
  partner: "Партнер",
};

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Чернетка",
  pending_review: "На модерації",
  approved: "Схвалено",
  rejected: "Відхилено",
  suspended: "Призупинено",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "Нова",
  pending: "Очікує",
  confirmed: "Підтверджено",
  declined: "Відхилено",
  cancelled: "Скасовано",
  completed: "Завершено",
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as PlaceCategory[];
export const ALL_ANIMALS = Object.keys(ANIMAL_LABELS) as AnimalType[];
export const ALL_DISTRICTS = Object.keys(DISTRICT_LABELS) as KyivDistrict[];

/**
 * Before v1.25 the app used a mix of neighbourhoods instead of the official
 * districts. Old links and data saved in a browser may still carry those
 * slugs, so they are mapped to the district the neighbourhood belongs to.
 */
const LEGACY_DISTRICTS: Record<string, KyivDistrict> = {
  pozniaky: "darnytskyi",
  osokorky: "darnytskyi",
  obolon: "obolonskyi",
  podil: "podilskyi",
  troieshchyna: "desnianskyi",
  holosiiv: "holosiivskyi",
  solomianka: "solomianskyi",
  pechersk: "pecherskyi",
  nyvky: "shevchenkivskyi",
  sviatoshyn: "sviatoshynskyi",
};

/** Returns a valid district for a current or legacy slug, otherwise null. */
export function normalizeDistrict(value: string | null | undefined): KyivDistrict | null {
  if (!value) return null;
  if ((ALL_DISTRICTS as string[]).includes(value)) return value as KyivDistrict;
  return LEGACY_DISTRICTS[value] ?? null;
}

export function categoryLabel(c: PlaceCategory): string {
  return CATEGORY_LABELS[c] ?? c;
}
export function districtLabel(d: KyivDistrict | string): string {
  const key = normalizeDistrict(d);
  return key ? DISTRICT_LABELS[key] : d;
}
