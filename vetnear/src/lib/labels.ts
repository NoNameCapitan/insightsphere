// Centralized display labels (Ukrainian) for the platform taxonomy.
// Localization-ready: swap this map per locale later.
import type {
  AnimalType,
  Availability,
  KyivDistrict,
  PlaceCategory,
  RequestStatus,
  SubmissionStatus,
  TrustBadge,
} from "@/lib/types";

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  veterinary_clinic: "Ветклініка",
  emergency_vet: "Термінова ситуація",
  pet_store: "Зоомагазин",
  vet_pharmacy: "Ветаптека",
  grooming: "Грумінг",
  shelter: "Притулок",
  animal_volunteer_help: "Зоозахист / волонтери",
  pet_boarding: "Перетримка та готель",
  dog_walking: "Вигул собак",
  dog_training: "Дресирування",
  pet_friendly_place: "Місце, дружнє до тварин",
  other_pet_service: "Інша послуга",
};

export const CATEGORY_EMOJI: Record<PlaceCategory, string> = {
  veterinary_clinic: "🏥",
  emergency_vet: "🚑",
  pet_store: "🛍️",
  vet_pharmacy: "💊",
  grooming: "✂️",
  shelter: "🏠",
  animal_volunteer_help: "🤝",
  pet_boarding: "🛏️",
  dog_walking: "🦮",
  dog_training: "🎓",
  pet_friendly_place: "☕",
  other_pet_service: "🐾",
};

/** Marker colors per category (hex). Emergency is intentionally the loudest. */
export const CATEGORY_COLOR: Record<PlaceCategory, string> = {
  veterinary_clinic: "#0E7C66",
  emergency_vet: "#E11D48",
  pet_store: "#2563EB",
  vet_pharmacy: "#7C3AED",
  grooming: "#DB2777",
  shelter: "#D97706",
  animal_volunteer_help: "#CA8A04",
  pet_boarding: "#0891B2",
  dog_walking: "#16A34A",
  dog_training: "#9333EA",
  pet_friendly_place: "#0D9488",
  other_pet_service: "#475569",
};

export const ANIMAL_LABELS: Record<AnimalType, string> = {
  cat: "Кіт",
  dog: "Собака",
  bird: "Птах",
  rodent: "Гризун",
  reptile: "Рептилія",
  exotic: "Екзотична тварина",
  other: "Інше",
};

export const DISTRICT_LABELS: Record<KyivDistrict, string> = {
  pozniaky: "Позняки",
  osokorky: "Осокорки",
  obolon: "Оболонь",
  podil: "Поділ",
  troieshchyna: "Троєщина",
  holosiiv: "Голосіїв",
  solomianka: "Солом'янка",
  pechersk: "Печерськ",
  nyvky: "Нивки",
  sviatoshyn: "Святошин",
};

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
