import { describe, it, expect } from "vitest";
import {
  sanitizeSubmissionInput,
  sanitizeReportInput,
  isModerationStatus,
} from "@/lib/server/submissionValidation";

const validBody = {
  name: "Ветклініка Тест",
  category: "veterinary_clinic",
  district: "obolon",
  address: "вул. Тестова, 1",
  phone: "+380441234567",
  description: "Опис",
  services: ["Терапія"],
  animalTypes: ["cat", "dog"],
  tags: [],
  representativeConfirmed: true,
  consentModeration: true,
};

describe("sanitizeSubmissionInput", () => {
  it("accepts a valid submission and sets server-side provenance", () => {
    const r = sanitizeSubmissionInput(validBody);
    expect(r.ok).toBe(true);
    expect(r.value?.status).toBe("pending_review");
    expect(r.value?.dataSource).toBe("partner_submitted");
    expect(r.value?.verificationStatus).toBe("needs_geocoding"); // no coords
  });

  it("HONESTY: forces emergencyAvailable=false even if the client claims true", () => {
    const r = sanitizeSubmissionInput({ ...validBody, emergencyAvailable: true });
    expect(r.ok).toBe(true);
    expect(r.value?.emergencyAvailable).toBe(false);
  });

  it("HONESTY: rejects self-declared emergency_vet category", () => {
    const r = sanitizeSubmissionInput({ ...validBody, category: "emergency_vet" });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("emergency_vet");
  });

  it("HONESTY: ignores client-sent status/verification and phone confirmation", () => {
    const r = sanitizeSubmissionInput({
      ...validBody,
      status: "approved",
      verificationStatus: "verified",
      phoneConfirmedAt: "2026-01-01",
    });
    expect(r.value?.status).toBe("pending_review");
    expect(r.value?.verificationStatus).toBe("needs_geocoding");
    expect(r.value?.phoneConfirmedAt).toBeNull();
  });

  it("with coordinates -> needs_review (mappable, still unverified)", () => {
    const r = sanitizeSubmissionInput({ ...validBody, latitude: 50.45, longitude: 30.52 });
    expect(r.value?.verificationStatus).toBe("needs_review");
  });

  it("accepts every category offered by the /add-place form", () => {
    const formCategories = [
      "veterinary_clinic", "vet_pharmacy", "pet_store", "grooming", "pet_boarding",
      "pet_friendly_place", "shelter", "animal_volunteer_help",
      "dog_walking", "dog_training", "other_pet_service",
    ];
    for (const category of formCategories) {
      expect(sanitizeSubmissionInput({ ...validBody, category }).ok).toBe(true);
    }
  });

  it("rejects submissions without representative confirmation (server-side)", () => {
    const r = sanitizeSubmissionInput({ ...validBody, representativeConfirmed: false });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("представляєте цей бізнес");
  });

  it("rejects submissions without moderation consent (server-side)", () => {
    const r = sanitizeSubmissionInput({ ...validBody, consentModeration: undefined });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("згода на модерацію");
  });

  it("rejects missing required fields", () => {
    const r = sanitizeSubmissionInput({ name: "X" });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(1);
  });

  it("rejects invalid phone / unsafe website / bad email", () => {
    expect(sanitizeSubmissionInput({ ...validBody, phone: "123" }).ok).toBe(false);
    expect(sanitizeSubmissionInput({ ...validBody, website: "javascript:alert(1)" }).ok).toBe(false);
    expect(sanitizeSubmissionInput({ ...validBody, email: "not-an-email" }).ok).toBe(false);
  });

  it("caps string lengths and array sizes", () => {
    const r = sanitizeSubmissionInput({
      ...validBody,
      name: "А".repeat(500),
      services: Array.from({ length: 100 }, (_, i) => `s${i}`),
    });
    expect(r.value?.name.length).toBeLessThanOrEqual(120);
    expect(r.value?.services.length).toBeLessThanOrEqual(20);
  });
});

describe("sanitizeReportInput", () => {
  it("accepts a valid report", () => {
    const r = sanitizeReportInput({ placeId: "p1", reason: "wrong_phone", message: "Номер не працює" });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ placeId: "p1", reason: "wrong_phone", message: "Номер не працює" });
  });

  it("rejects unknown reasons and missing placeId", () => {
    expect(sanitizeReportInput({ placeId: "p1", reason: "spam" }).ok).toBe(false);
    expect(sanitizeReportInput({ reason: "other" }).ok).toBe(false);
  });

  it("caps message length", () => {
    const r = sanitizeReportInput({ placeId: "p1", reason: "other", message: "x".repeat(5000) });
    expect(r.value?.message?.length).toBeLessThanOrEqual(1000);
  });
});

describe("isModerationStatus", () => {
  it("accepts known statuses and rejects junk", () => {
    expect(isModerationStatus("approved")).toBe(true);
    expect(isModerationStatus("pending_review")).toBe(true);
    expect(isModerationStatus("hacked")).toBe(false);
    expect(isModerationStatus(42)).toBe(false);
  });
});
