// Example second vertical — NOT shipped, kept type-checked.
//
// Its only purpose is to prove that `VerticalConfig` carries no pet-specific
// assumptions: a different domain, a different city, its own category union,
// its own urgency policy. If a future change to the platform hardcodes
// something pet-shaped, this file stops compiling.
//
// To actually ship a vertical you additionally need: a seed dataset in the
// Place shape, and one line changed in the `VERTICAL` export.
// See docs/VERTICAL_ADAPTATION.md.
import type { VerticalConfig } from "@/config/vertical";

/** This vertical's own categories — nothing to do with PlaceCategory. */
export type DentalCategory =
  | "dental_clinic"
  | "emergency_dental"
  | "orthodontics"
  | "dental_lab"
  | "dental_hygiene";

export type LvivDistrict = "halytskyi" | "frankivskyi" | "sykhivskyi" | "shevchenkivskyi";

export const DENTAL_CARE_LVIV: VerticalConfig<DentalCategory, LvivDistrict> = {
  id: "dental-care-lviv",
  productName: "DentNear",
  tagline: "Знайти стоматологію поруч — швидко і без вгадування.",
  subject: { singular: "стоматологічний заклад", plural: "стоматологічні заклади" },

  city: {
    id: "lviv",
    name: "Львів",
    locative: "у Львові",
    center: { latitude: 49.8397, longitude: 24.0297 },
    bounds: { minLat: 49.75, maxLat: 49.95, minLng: 23.9, maxLng: 24.2 },
    districts: {
      halytskyi: "Галицький",
      frankivskyi: "Франківський",
      sykhivskyi: "Сихівський",
      shevchenkivskyi: "Шевченківський",
    },
  },

  categories: [
    {
      id: "dental_clinic",
      label: "Стоматологія",
      emoji: "🦷",
      color: "#0B6B62",
      seoSlug: "dentist-near-me",
      schemaType: "Dentist",
    },
    {
      id: "emergency_dental",
      label: "Гострий біль",
      emoji: "🚑",
      color: "#E11D48",
      seoSlug: "emergency-dentist-near-me",
      schemaType: "Dentist",
      urgent: true,
    },
    {
      id: "orthodontics",
      label: "Ортодонтія",
      emoji: "😁",
      color: "#2563EB",
      schemaType: "Dentist",
    },
    {
      id: "dental_lab",
      label: "Зуботехнічна лабораторія",
      emoji: "🔬",
      color: "#7C3AED",
      schemaType: "MedicalBusiness",
    },
    {
      id: "dental_hygiene",
      label: "Гігієна",
      emoji: "✨",
      color: "#0891B2",
      schemaType: "Dentist",
    },
  ],

  urgency: {
    enabled: true,
    requiresHumanConfirmation: true,
    deterministicTriage: true,
    nonDiagnosticNotice:
      "Сервіс не ставить діагнозів — він допомагає знайти лікаря.",
  },

  monetization: {
    promotionEnabled: true,
    promotionDisabledWhenUrgent: true,
    maxPromotionDays: 180,
  },
};
