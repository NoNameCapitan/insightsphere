// Shared test fixtures. `makePlace` builds a fully-typed, searchable,
// verified place near Kyiv center; override any field per test.
import type { FilterState, PetProfile, Place } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/geo/ranking";

// Kyiv center (Maidan) — origin used across geo tests.
export const KYIV_CENTER = { latitude: 50.4501, longitude: 30.5234 };

let seq = 0;

export function makePlace(overrides: Partial<Place> = {}): Place {
  seq += 1;
  return {
    id: `test-${seq}`,
    slug: `test-place-${seq}`,
    name: `Test Place ${seq}`,
    category: "veterinary_clinic",
    description: "Test clinic",
    address: "вул. Тестова, 1",
    district: "pechersk",
    latitude: KYIV_CENTER.latitude,
    longitude: KYIV_CENTER.longitude,
    phone: "+380441234567",
    workingHours: [
      // Mon–Sun 08:00–20:00
      ...Array.from({ length: 7 }, (_, day) => ({
        day,
        open: "08:00",
        close: "20:00",
      })),
    ],
    isOpen24_7: false,
    services: [],
    animalTypes: ["cat", "dog"],
    tags: [],
    hasSurgery: false,
    hasUltrasound: false,
    hasXray: false,
    hasPharmacy: false,
    emergencyAvailable: false,
    appointmentRequired: false,
    deliveryAvailable: false,
    pickupAvailable: false,
    verified: true,
    claimed: true,
    status: "approved",
    rating: 4.5,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-25T00:00:00.000Z",
    dataSource: "manual_verified",
    verificationStatus: "verified",
    ...overrides,
  };
}

export function makePet(overrides: Partial<PetProfile> = {}): PetProfile {
  return {
    id: "pet-1",
    name: "Барсик",
    animalType: "cat",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as PetProfile;
}

export function makeFilters(overrides: Partial<FilterState> = {}): FilterState {
  return { ...DEFAULT_FILTERS, ...overrides };
}

/** Wednesday 2026-07-01 12:00 local — inside 08:00–20:00 working hours. */
export const NOON = new Date(2026, 6, 1, 12, 0, 0);
/** Wednesday 2026-07-01 23:00 local — outside 08:00–20:00. */
export const LATE_NIGHT = new Date(2026, 6, 1, 23, 0, 0);
