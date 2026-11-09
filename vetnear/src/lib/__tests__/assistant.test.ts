import { describe, it, expect } from "vitest";
import { isUrgent, routeSuggestion, mockProvider } from "@/lib/assistant";
import { SAFE_EMERGENCY_CTA_HREF } from "@/lib/data/verification";
import { makePet } from "./fixtures";

describe("isUrgent — deterministic emergency gate", () => {
  it.each([
    "у кота кров з носа",
    "собака не дихає",
    "пес проковтнув іграшку",
    "кішку збила машина",
    "у собаки судоми",
    "підозра на отруєння",
  ])("flags urgent: %s", (q) => {
    expect(isUrgent(q)).toBe(true);
  });

  it.each([
    "де купити корм для кота",
    "потрібен грумінг для пуделя",
    "де найближча ветаптека",
  ])("does not flag non-urgent: %s", (q) => {
    expect(isUrgent(q)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isUrgent("КРОВОТЕЧА у собаки")).toBe(true);
  });
});

describe("routeSuggestion — rule-based category routing", () => {
  it("food → pet stores", () => {
    expect(routeSuggestion("де купити корм").href).toContain("pet_store");
  });
  it("meds → vet pharmacies", () => {
    expect(routeSuggestion("потрібні ліки").href).toContain("vet_pharmacy");
  });
  it("grooming keywords → grooming", () => {
    expect(routeSuggestion("стрижка кігтів").href).toContain("grooming");
  });
  it("shelters/lost → shelter", () => {
    expect(routeSuggestion("знайшов кошеня").href).toContain("shelter");
  });
  it("default → vet clinics", () => {
    expect(routeSuggestion("кіт чхає").href).toContain("veterinary_clinic");
  });
});

describe("mockProvider.answer", () => {
  it("urgent questions get urgent=true and the SAFE emergency CTA (no fake 24/7)", () => {
    const r = mockProvider.answer("собака не дихає", null);
    expect(r.urgent).toBe(true);
    expect(r.suggestion?.href).toBe(SAFE_EMERGENCY_CTA_HREF);
    // The safe CTA routes to nearest clinics, not to a 24/7 promise.
    expect(r.suggestion?.href).toContain("veterinary_clinic");
  });

  it("never diagnoses: reply always carries the safety disclaimer", () => {
    const r = mockProvider.answer("кіт чхає, що робити?", null);
    expect(r.text).toContain("не ставлю діагнозів");
  });

  it("mentions the active pet when a profile is set", () => {
    const r = mockProvider.answer("де купити корм", makePet({ name: "Барсик" }));
    expect(r.text).toContain("Барсик");
  });
});
