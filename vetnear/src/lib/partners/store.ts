"use client";
// Partner submissions + moderation (Module 5). localStorage is the local copy;
// when NEXT_PUBLIC_BACKEND_ENABLED=1 every new submission is also pushed to the
// server API (see src/lib/api/backendClient.ts) so moderators see it anywhere.
import { track } from "@/lib/analytics";
import { syncSubmissionToServer } from "@/lib/api/backendClient";
import { makeId, nowIso, readJSON, writeJSON } from "@/lib/storage";
import type {
  ModerationEvent,
  PartnerSubmission,
  Place,
  UserRole,
} from "@/lib/types";

const KEY = "vetnear:submissions";
const MOD_KEY = "vetnear:moderation";

export function getSubmissions(): PartnerSubmission[] {
  return readJSON<PartnerSubmission[]>(KEY, []);
}

export function createSubmission(
  input: Omit<PartnerSubmission, "id" | "status" | "createdAt" | "updatedAt">,
): PartnerSubmission {
  const hasCoords =
    typeof input.latitude === "number" && typeof input.longitude === "number";
  const sub: PartnerSubmission = {
    ...input,
    id: makeId("sub"),
    status: "pending_review",
    dataSource: "partner_submitted",
    // No coordinates => cannot be placed on the map until geocoded.
    verificationStatus: hasCoords ? "needs_review" : "needs_geocoding",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  writeJSON(KEY, [sub, ...getSubmissions()]);
  track("add_place_submitted", { category: sub.category });
  // Push to server (non-blocking; local copy is kept regardless).
  void syncSubmissionToServer(input);
  return sub;
}

export function setSubmissionStatus(
  id: string,
  status: PartnerSubmission["status"],
  actorRole: UserRole = "moderator",
  reason?: string,
): void {
  const subs = getSubmissions();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  subs[idx] = { ...subs[idx], status, updatedAt: nowIso() };
  writeJSON(KEY, subs);
  const action =
    status === "approved"
      ? "approved"
      : status === "rejected"
        ? "rejected"
        : status === "suspended"
          ? "suspended"
          : "requested_changes";
  const ev: ModerationEvent = {
    id: makeId("mod"),
    submissionId: id,
    action,
    reason,
    actorRole,
    createdAt: nowIso(),
  };
  writeJSON(MOD_KEY, [ev, ...getModerationEvents()]);
}

export function getModerationEvents(): ModerationEvent[] {
  return readJSON<ModerationEvent[]>(MOD_KEY, []);
}

/** Set coordinates on a submission (admin geocoding step). Clears needs_geocoding. */
export function setSubmissionVerification(
  id: string,
  verificationStatus: PartnerSubmission["verificationStatus"],
): void {
  const subs = getSubmissions();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  subs[idx] = { ...subs[idx], verificationStatus, updatedAt: nowIso() };
  writeJSON(KEY, subs);
}

// Phone confirmation is the ONLY gate for emergency/24-7 on a partner record.
export function setSubmissionPhoneConfirmed(id: string, by = "moderator"): void {
  const subs = getSubmissions();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  subs[idx] = {
    ...subs[idx],
    phoneConfirmedAt: nowIso(),
    phoneConfirmedBy: by,
    verificationStatus: "verified",
    updatedAt: nowIso(),
  };
  writeJSON(KEY, subs);
}

// Emergency can be enabled only after a phone confirmation exists.
export function setSubmissionEmergency(id: string, on: boolean): void {
  const subs = getSubmissions();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  if (on && !subs[idx].phoneConfirmedAt) return; // gated
  subs[idx] = { ...subs[idx], emergencyAvailable: on, updatedAt: nowIso() };
  writeJSON(KEY, subs);
}

export function setSubmissionCoords(id: string, latitude: number, longitude: number): void {
  const subs = getSubmissions();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  subs[idx] = {
    ...subs[idx],
    latitude,
    longitude,
    verificationStatus:
      subs[idx].verificationStatus === "needs_geocoding"
        ? "needs_review"
        : subs[idx].verificationStatus,
    updatedAt: nowIso(),
  };
  writeJSON(KEY, subs);
}

/** Convert approved submissions into publicly listable Places. */
export function getApprovedAsPlaces(): Place[] {
  return getSubmissions()
    .filter((s) => s.status === "approved")
    .map((s) => submissionToPlace(s))
    .filter((p): p is Place => p !== null);
}

export function submissionToPlace(s: PartnerSubmission): Place | null {
  // Coordinate safety (P0.6): never fall back to central Kyiv. A submission
  // without coordinates is not searchable/mappable and must be geocoded first.
  if (typeof s.latitude !== "number" || typeof s.longitude !== "number") {
    return null;
  }
  return {
    id: s.id,
    ownerId: undefined,
    slug: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    address: s.address,
    district: s.district,
    latitude: s.latitude,
    longitude: s.longitude,
    phone: s.phone,
    email: s.email,
    website: s.website,
    socialLinks: s.socialLinks,
    workingHours: s.workingHours ?? [],
    isOpen24_7: false,
    services: s.services,
    animalTypes: s.animalTypes,
    tags: s.tags,
    hasSurgery: false,
    hasUltrasound: false,
    hasXray: false,
    hasPharmacy: s.category === "vet_pharmacy",
    emergencyAvailable: s.emergencyAvailable,
    appointmentRequired: s.appointmentRequired,
    deliveryAvailable: s.deliveryAvailable,
    pickupAvailable: s.pickupAvailable,
    verified: false,
    claimed: true,
    status: "approved",
    rating: 0,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    dataSource: "partner_submitted",
    verificationStatus: s.verificationStatus === "verified" ? "verified" : "unverified",
    lastVerifiedAt: null,
  };
}
