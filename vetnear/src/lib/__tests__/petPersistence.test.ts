// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDocument, addReminder, addVaccination, addWeight, createPet, deletePet, exportPetsBackup, getActivePetId, getPet, getPets, importPetsBackup, updatePet } from "@/lib/pets/store";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function refuseMedicalWrites() {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "vetnear:pets") throw new DOMException("Storage full", "QuotaExceededError");
    original.call(this, key, value);
  });
}

describe("medical persistence failures", () => {
  it("does not claim a new card exists or change selection when storage rejects it", () => {
    const existing = createPet({ name: "Луна", animalType: "cat" });
    refuseMedicalWrites();
    expect(() => createPet({ name: "Рікі", animalType: "bird" })).toThrow("Не вдалося зберегти");
    expect(getPets().map((pet) => pet.id)).toEqual([existing.id]);
    expect(getActivePetId()).toBe(existing.id);
  });

  it("keeps the previous medical history when a document or reminder cannot be persisted", () => {
    const pet = createPet({ name: "Луна", animalType: "cat" });
    addVaccination(pet.id, { date: "2026-11-01", name: "Запис лікаря" });
    const before = exportPetsBackup();
    refuseMedicalWrites();
    expect(() => addDocument(pet.id, { date: "2026-11-02", title: "Паспорт", dataUrl: "data:application/pdf;base64,YQ==" })).toThrow();
    expect(() => addReminder(pet.id, { date: "2026-12-01", title: "Огляд" })).toThrow();
    expect(getPet(pet.id)).toEqual(JSON.parse(before).pets[0]);
    expect(() => deletePet(pet.id)).toThrow();
    expect(getPet(pet.id)).not.toBeNull();
  });

  it("uses the latest measurement date for current weight when an older record is added", () => {
    const pet = createPet({ name: "Луна", animalType: "cat" });
    addWeight(pet.id, { date: "2026-11-10", weightKg: 4.8 });
    addWeight(pet.id, { date: "2026-09-10", weightKg: 4.1 });
    expect(getPet(pet.id)?.weightKg).toBe(4.8);
    expect(getPet(pet.id)?.weightHistory?.map((item) => item.date)).toEqual(["2026-11-10", "2026-09-10"]);
  });
});

describe("medical backup restore", () => {
  it("round trips supported medical data and merges other existing pets", () => {
    const pet = createPet({ name: "Рікі", animalType: "bird" });
    addVaccination(pet.id, { date: "2026-11-01", name: "Запис лікаря", nextDate: "2027-01-01" });
    addDocument(pet.id, { date: "2026-11-01", title: "Паспорт", dataUrl: "data:application/pdf;base64,YQ==" });
    const raw = exportPetsBackup();
    localStorage.clear();
    const other = createPet({ name: "Місяць", animalType: "cat" });
    expect(importPetsBackup(raw)).toBe(1);
    expect(getPets()).toHaveLength(2);
    expect(getPet(other.id)).not.toBeNull();
    expect(getPet(pet.id)).toEqual(JSON.parse(raw).pets[0]);
  });

  it.each([
    { vaccinations: "broken" },
    { animalType: "unsupported-species" },
    { vaccinations: [{ id: "v1", date: "2026-02-30", name: "Запис", createdAt: "2026-11-01T10:00:00Z" }] },
    { documents: [{ id: "d1", date: "2026-11-01", title: "Паспорт", dataUrl: "javascript:alert(1)", createdAt: "2026-11-01T10:00:00Z" }] },
  ])("rejects a malformed backup without changing any medical data: %j", (patch) => {
    createPet({ name: "Луна", animalType: "cat" });
    const before = getPets();
    const backup = JSON.parse(exportPetsBackup());
    Object.assign(backup.pets[0], patch);
    expect(() => importPetsBackup(JSON.stringify(backup))).toThrow("пошкоджені");
    expect(getPets()).toEqual(before);
  });

  it("rejects duplicate IDs and an unsupported backup version", () => {
    createPet({ name: "Луна", animalType: "cat" });
    const before = getPets();
    const backup = JSON.parse(exportPetsBackup());
    backup.pets.push(backup.pets[0]);
    expect(() => importPetsBackup(JSON.stringify(backup))).toThrow("повторні");
    backup.version = 2;
    expect(() => importPetsBackup(JSON.stringify(backup))).toThrow("версія");
    expect(getPets()).toEqual(before);
  });

  it("does not overwrite newer records with an older backup", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
      const pet = createPet({ name: "Луна", animalType: "cat" });
      const oldBackup = exportPetsBackup();
      vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
      updatePet(pet.id, { allergies: "Нотатка лікаря" });
      expect(() => importPetsBackup(oldBackup)).toThrow("старіші версії");
      expect(getPet(pet.id)?.allergies).toBe("Нотатка лікаря");
    } finally { vi.useRealTimers(); }
  });

  it("does not report a successful restore when storage is full", () => {
    const pet = createPet({ name: "Луна", animalType: "cat" });
    const backup = exportPetsBackup();
    localStorage.clear();
    refuseMedicalWrites();
    expect(() => importPetsBackup(backup)).toThrow("Не вдалося зберегти");
    expect(getPet(pet.id)).toBeNull();
    expect(getActivePetId()).toBeNull();
  });
});
