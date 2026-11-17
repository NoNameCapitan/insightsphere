import { describe, expect, it } from "vitest";
import { careToday, getPetCareEvents, nextPetCareEvent, petClinicSearchHref } from "@/lib/pets/care";
import { isPetBackupRecord } from "@/lib/pets/validation";
import type { PetProfile } from "@/lib/types";

const pet: PetProfile = { id: "pet-a", name: "Луна", animalType: "cat", createdAt: "2026-11-17T10:00:00Z", updatedAt: "2026-11-17T10:00:00Z" };
describe("personal next action", () => {
  it("never invents a medical date from a previous treatment", () => {
    expect(getPetCareEvents({ ...pet, treatments: [{ id: "t1", kind: "deworming", name: "Запис", date: "2026-11-10", createdAt: pet.createdAt }] })).toEqual([]);
  });
  it("keeps past dates separate from the next action and omits completed reminders", () => {
    const records = { ...pet, reminders: [
      { id: "old", date: "2026-11-16", title: "Минула дата", createdAt: pet.createdAt },
      { id: "done", date: "2026-11-17", title: "Виконано", completed: true, createdAt: pet.createdAt },
      { id: "next", date: "2026-11-20", title: "Огляд", createdAt: pet.createdAt },
    ] };
    expect(getPetCareEvents(records).map((e) => e.id)).toEqual(["reminder-old", "reminder-next"]);
    expect(nextPetCareEvent(records, "2026-11-17")?.title).toBe("Огляд");
  });
  it("uses a locality as an explicit search filter without a fabricated GPS origin", () => {
    const url = new URL(petClinicSearchHref({ ...pet, preferredLocality: "Буча" }), "https://example.test");
    expect(url.searchParams.get("locality")).toBe("Буча");
    expect(url.searchParams.get("animal")).toBe("cat");
    expect(url.searchParams.has("lat")).toBe(false);
    expect(url.searchParams.has("lng")).toBe(false);
  });
  it("uses Kyiv's calendar day at the UTC day boundary", () => {
    expect(careToday(new Date("2026-11-17T23:30:00Z"))).toBe("2026-11-18");
  });
  it("accepts legacy backups and optional locality but refuses malformed locality", () => {
    expect(isPetBackupRecord(pet)).toBe(true);
    expect(isPetBackupRecord({ ...pet, preferredLocality: "Буча" })).toBe(true);
    expect(isPetBackupRecord({ ...pet, preferredLocality: { city: "Буча" } })).toBe(false);
  });
});
