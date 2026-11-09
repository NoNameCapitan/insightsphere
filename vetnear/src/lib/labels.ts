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

export function categoryLabel(c: PlaceCategory): string {
  return CATEGORY_LABELS[c] ?? c;
}
export function districtLabel(d: KyivDistrict): string {
  return DISTRICT_LABELS[d] ?? d;
}
