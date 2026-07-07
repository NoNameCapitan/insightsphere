import type { FilterState, PlaceCategory } from "./types";

export type Urgency = "low" | "medium" | "high" | "critical";
export type Duration = "hours" | "day" | "days" | "week";
export type Eating = "yes" | "reduced" | "no";
export type Symptom =
  | "bleeding"
  | "trauma"
  | "vomiting"
  | "weakness"
  | "breathing"
  | "none";

export type Intent =
  | "emergency"
  | "vaccination"
  | "food"
  | "medicine"
  | "grooming"
  | "general";

export interface QuestionnaireAnswers {
  intent: Intent;
  urgency: Urgency | null;
  duration: Duration | null;
  eating: Eating | null;
  symptoms: Symptom[];
}

export interface Recommendation {
  /** Suggested place type to preselect ("all" = no constraint). */
  category: PlaceCategory | "all";
  /** Whether to prioritize emergency / 24-7. */
  emergencyFirst: boolean;
  /** i18n key into t.questionnaire for the human-readable note. */
  noteKey:
    | "recoEmergency"
    | "recoClinic"
    | "recoStore"
    | "recoPharmacy"
    | "recoGrooming";
}

const EMERGENCY_SYMPTOMS: Symptom[] = ["bleeding", "trauma", "breathing"];

/**
 * Convert answers into recommended filters. This NEVER returns a diagnosis —
 * only which TYPE of service is likely relevant.
 */
export function recommendFromAnswers(
  a: QuestionnaireAnswers,
): Recommendation {
  const hasEmergencySymptom = a.symptoms.some((s) =>
    EMERGENCY_SYMPTOMS.includes(s),
  );
  const critical = a.urgency === "critical" || a.urgency === "high";

  // Emergency takes precedence regardless of stated intent.
  if (a.intent === "emergency" || hasEmergencySymptom || critical) {
    return { category: "emergency_vet", emergencyFirst: true, noteKey: "recoEmergency" };
  }

  switch (a.intent) {
    case "food":
      return { category: "pet_store", emergencyFirst: false, noteKey: "recoStore" };
    case "medicine":
      return { category: "vet_pharmacy", emergencyFirst: false, noteKey: "recoPharmacy" };
    case "grooming":
      return { category: "grooming", emergencyFirst: false, noteKey: "recoGrooming" };
    case "vaccination":
      return { category: "veterinary_clinic", emergencyFirst: false, noteKey: "recoClinic" };
    case "general":
    default:
      return { category: "veterinary_clinic", emergencyFirst: false, noteKey: "recoClinic" };
  }
}

/** Merge a recommendation into a filter state. */
export function applyRecommendation(
  base: FilterState,
  reco: Recommendation,
): FilterState {
  return {
    ...base,
    category: reco.category,
    emergency: reco.emergencyFirst ? true : base.emergency,
    sort: reco.emergencyFirst ? "emergency" : base.sort,
  };
}
