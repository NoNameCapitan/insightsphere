// The active vertical: pet care in Kyiv.
//
// Typed against the canonical PlaceCategory / KyivDistrict unions, so a missing
// or misspelled category is a compile error rather than a blank label at
// runtime. Everything the product says about itself starts here.
import type { VerticalConfig } from "@/config/vertical";
import type { KyivDistrict, PlaceCategory } from "@/lib/types";

export const PET_CARE_KYIV: VerticalConfig<PlaceCategory, KyivDistrict> = {
  id: "pet-care-kyiv",
  productName: "VetNear",
  tagline:
    "Швидкий спосіб знайти потрібний заклад для тварини поруч — за 1–2 хвилини.",
  subject: { singular: "заклад для тварин", plural: "заклади для тварин" },

  city: {
    id: "kyiv",
    name: "Київ",
    locative: "у Києві",
    center: { latitude: 50.4501, longitude: 30.5234 },
    // Sanity box: a mistyped coordinate must not place a marker in a field.
    bounds: { minLat: 50.1, maxLat: 50.65, minLng: 30.2, maxLng: 30.9 },
    districts: {
      holosiivskyi: "Голосіївський район",
      darnytskyi: "Дарницький район",
      desnianskyi: "Деснянський район",
      dniprovskyi: "Дніпровський район",
      obolonskyi: "Оболонський район",
      pecherskyi: "Печерський район",
      podilskyi: "Подільський район",
      sviatoshynskyi: "Святошинський район",
      solomianskyi: "Солом'янський район",
      shevchenkivskyi: "Шевченківський район",
    },
  },

  categories: [
    {
      id: "veterinary_clinic",
      label: "Ветклініка",
      emoji: "🏥",
      color: "#0B6B62",
      seoSlug: "vet-clinic-near-me",
      schemaType: "VeterinaryCare",
    },
    {
      id: "emergency_vet",
      label: "Термінова ситуація",
      emoji: "🚑",
      color: "#E11D48",
      seoSlug: "emergency-vet-near-me",
      schemaType: "VeterinaryCare",
      urgent: true,
    },
    {
      id: "pet_store",
      label: "Зоомагазин",
      emoji: "🛍️",
      color: "#2563EB",
      seoSlug: "pet-store-near-me",
      schemaType: "PetStore",
    },
    {
      id: "vet_pharmacy",
      label: "Ветаптека",
      emoji: "💊",
      color: "#7C3AED",
      seoSlug: "vet-pharmacy-near-me",
      schemaType: "Pharmacy",
    },
    {
      id: "grooming",
      label: "Грумінг",
      emoji: "✂️",
      color: "#DB2777",
      seoSlug: "grooming-near-me",
      schemaType: "LocalBusiness",
    },
    {
      id: "shelter",
      label: "Притулок",
      emoji: "🏠",
      color: "#D97706",
      schemaType: "LocalBusiness",
    },
    {
      id: "animal_volunteer_help",
      label: "Зоозахист / волонтери",
      emoji: "🤝",
      color: "#CA8A04",
      schemaType: "LocalBusiness",
    },
    {
      id: "pet_boarding",
      label: "Перетримка та готель",
      emoji: "🛏️",
      color: "#0891B2",
      schemaType: "LocalBusiness",
    },
    {
      id: "dog_walking",
      label: "Вигул собак",
      emoji: "🦮",
      color: "#16A34A",
      schemaType: "LocalBusiness",
    },
    {
      id: "dog_training",
      label: "Дресирування",
      emoji: "🎓",
      color: "#9333EA",
      schemaType: "LocalBusiness",
    },
    {
      id: "pet_friendly_place",
      label: "Місце, дружнє до тварин",
      emoji: "☕",
      color: "#0D9488",
      schemaType: "LocalBusiness",
    },
    {
      id: "other_pet_service",
      label: "Інша послуга",
      emoji: "🐾",
      color: "#475569",
      seoSlug: "pet-services-near-me",
      schemaType: "LocalBusiness",
    },
  ],

  urgency: {
    enabled: true,
    requiresHumanConfirmation: true,
    deterministicTriage: true,
    nonDiagnosticNotice:
      "Сервіс не ставить діагнозів і не призначає лікування — він допомагає знайти фахівця.",
  },

  monetization: {
    promotionEnabled: true,
    // Never negotiable in a vertical where urgency exists.
    promotionDisabledWhenUrgent: true,
    maxPromotionDays: 365,
  },
};

/** The vertical this build ships. Swap this one line to retarget the platform. */
export const VERTICAL = PET_CARE_KYIV;
