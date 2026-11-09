// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { getFavoritePlaceIds, toggleFavoritePlace } from "@/lib/favorites/store";
import {
  addDocument,
  addReminder,
  addTreatment,
  addVaccination,
  addVisit,
  addWeight,
  createPet,
  getPet,
  toggleReminder,
} from "@/lib/pets/store";

describe("pet medical record store", () => {
  beforeEach(() => localStorage.clear());

  it("keeps new medical modules compatible with a basic pet profile", () => {
    const pet = createPet({ name: "Луна", animalType: "cat", sex: "female" });
    addVaccination(pet.id, { date: "2026-11-01", name: "Rabies", nextDate: "2027-11-01" });
    addTreatment(pet.id, { kind: "flea_tick", date: "2026-11-02", name: "Spot-on" });
    addVisit(pet.id, { date: "2026-11-03", reason: "Огляд" });
    addWeight(pet.id, { date: "2026-11-04", weightKg: 4.8 });
    addDocument(pet.id, { date: "2026-11-04", title: "Ветпаспорт" });
    const withReminder = addReminder(pet.id, { date: "2026-12-01", title: "Повторна обробка" });

    expect(getPet(pet.id)?.vaccinations?.[0].name).toBe("Rabies");
    expect(getPet(pet.id)?.treatments).toHaveLength(1);
    expect(getPet(pet.id)?.visits).toHaveLength(1);
    expect(getPet(pet.id)?.weightKg).toBe(4.8);
    expect(getPet(pet.id)?.documents).toHaveLength(1);

    const reminderId = withReminder?.reminders?.[0].id;
    expect(reminderId).toBeTruthy();
    toggleReminder(pet.id, reminderId!);
    expect(getPet(pet.id)?.reminders?.[0].completed).toBe(true);
  });
});

describe("place favorites", () => {
  beforeEach(() => localStorage.clear());

  it("adds and removes a favorite without duplicates", () => {
    expect(toggleFavoritePlace("clinic-1")).toBe(true);
    expect(getFavoritePlaceIds()).toEqual(["clinic-1"]);
    expect(toggleFavoritePlace("clinic-1")).toBe(false);
    expect(getFavoritePlaceIds()).toEqual([]);
  });
});
