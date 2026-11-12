import { describe, expect, it } from "vitest";
import { petToRow, restoreFiles, rowToPet, sanitizePet, stripFiles } from "@/lib/pets/cloudModel";
import type { PetProfile } from "@/lib/types";

const PHOTO = `data:image/jpeg;base64,${"A".repeat(400)}`;
const base = {
  name: "  Барні  ",
  animalType: "dog",
  breed: "Бігль",
  sex: "male",
  birthDate: "2022-03-04",
  weightKg: 12.4,
  importantNotes: "Алергія на курку",
  photoUrl: PHOTO,
  vaccinations: [{ id: "vaccination-abc-12345", date: "2026-01-10", name: "Сказ", nextDate: "2027-01-10", documentDataUrl: "data:application/pdf;base64,AAAA" }],
  documents: [{ id: "document-abc-12345", date: "2026-02-01", title: "Паспорт", fileName: "p.pdf", dataUrl: "data:application/pdf;base64,AAAA" }],
  reminders: [{ id: "reminder-abc-12345", date: "2026-12-01", title: "Чистка зубів", completed: true }],
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-02T10:00:00.000Z",
};

describe("pet cloud model", () => {
  it("rebuilds a card from an allow-list and never accepts embedded files", () => {
    const result = sanitizePet({ ...base, ownerId: "someone-else", evil: "<script>", isAdmin: true }, "pet-abc-12345");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pet = result.pet as PetProfile & Record<string, unknown>;
    expect(pet.name).toBe("Барні");
    expect(pet.ownerId).toBeUndefined();
    expect(pet.evil).toBeUndefined();
    expect(pet.isAdmin).toBeUndefined();
    expect(pet.photoUrl).toBe(PHOTO);
    expect(pet.vaccinations?.[0]).not.toHaveProperty("documentDataUrl");
    expect(pet.documents?.[0]).not.toHaveProperty("dataUrl");
    expect(pet.documents?.[0].title).toBe("Паспорт");
    expect(JSON.stringify(pet)).not.toContain("application/pdf");
  });

  it("rejects invalid ids, names and species; drops bad values instead of storing them", () => {
    expect(sanitizePet(base, "../etc").ok).toBe(false);
    expect(sanitizePet({ ...base, name: "   " }, "pet-abc-12345").ok).toBe(false);
    expect(sanitizePet({ ...base, animalType: "dragon" }, "pet-abc-12345").ok).toBe(false);
    const result = sanitizePet(
      { ...base, sex: "robot", weightKg: -3, birthDate: "yesterday", photoUrl: "https://evil.example/x.png", vaccinations: [{ id: "x", date: "bad", name: "" }] },
      "pet-abc-12345",
    );
    expect(result.ok && result.pet.sex).toBeUndefined();
    expect(result.ok && result.pet.weightKg).toBeUndefined();
    expect(result.ok && result.pet.birthDate).toBeUndefined();
    expect(result.ok && result.pet.photoUrl).toBeUndefined();
    expect(result.ok && result.pet.vaccinations).toEqual([]);
  });

  it("caps lists and oversized photos", () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `reminder-${i}`, date: "2026-12-01", title: "x" }));
    const result = sanitizePet({ ...base, reminders: many, photoUrl: `data:image/png;base64,${"A".repeat(200_000)}` }, "pet-abc-12345");
    expect(result.ok && result.pet.reminders?.length).toBe(200);
    expect(result.ok && result.pet.photoUrl).toBeUndefined();
  });

  it("round-trips through the database row shape", () => {
    const clean = sanitizePet(base, "pet-abc-12345");
    if (!clean.ok) throw new Error("fixture must be valid");
    const row = petToRow(clean.pet);
    expect(row).toMatchObject({ id: "pet-abc-12345", name: "Барні", species: "dog", breed: "Бігль", sex: "male", birth_date: "2022-03-04", weight_kg: 12.4, notes: "Алергія на курку" });
    expect(row).not.toHaveProperty("owner_id");
    expect(row.record).not.toHaveProperty("name");
    const back = rowToPet({ ...row, owner_id: "user-1", created_at: "2026-01-01T10:00:00.000Z", updated_at: "2026-03-03T10:00:00.000Z" });
    expect(back).toMatchObject({ id: "pet-abc-12345", ownerId: "user-1", name: "Барні", animalType: "dog", weightKg: 12.4, importantNotes: "Алергія на курку", updatedAt: "2026-03-03T10:00:00.000Z" });
    expect(back.vaccinations?.[0].name).toBe("Сказ");
    expect(back.reminders?.[0].completed).toBe(true);
  });

  it("keeps attachments on the device: stripped before upload, restored after download", () => {
    const local = { id: "pet-abc-12345", ...base, animalType: "dog" } as unknown as PetProfile;
    const upload = stripFiles(local);
    expect(JSON.stringify(upload)).not.toContain("application/pdf");
    expect(local.documents?.[0].dataUrl).toContain("application/pdf");
    const restored = restoreFiles(upload, local);
    expect(restored.documents?.[0].dataUrl).toContain("application/pdf");
    expect(restored.vaccinations?.[0].documentDataUrl).toContain("application/pdf");
    expect(restoreFiles(upload, undefined)).toBe(upload);
  });
});
