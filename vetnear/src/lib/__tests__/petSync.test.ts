// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { addVaccination, createPet, deletePet, getPets } from "@/lib/pets/store";
import { commitPetChanges, getGuestPets, importGuestPets, pullPets, startPetSync, stopPetSync } from "@/lib/pets/sync";
import type { PetProfile } from "@/lib/types";

type Call = { method: string; url: string; body?: { pet: PetProfile } };
let calls: Call[] = [];
let remote: PetProfile[] = [];
let failWrites = 0;

function installFetch() {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as { pet: PetProfile }) : undefined;
    calls.push({ method, url, body });
    if (method === "GET") return new Response(JSON.stringify({ pets: remote }), { status: 200 });
    if (failWrites > 0) { failWrites -= 1; return new Response("{}", { status: 500 }); }
    const id = decodeURIComponent(url.split("/").pop()!);
    if (method === "PUT" && body) remote = [{ ...body.pet, ownerId: "user-1" }, ...remote.filter((p) => p.id !== id)];
    if (method === "DELETE") remote = remote.filter((p) => p.id !== id);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
}

describe("pet account sync", () => {
  beforeEach(() => {
    stopPetSync(false);
    localStorage.clear();
    calls = [];
    remote = [];
    failWrites = 0;
    installFetch();
  });

  it("sets device-only cards aside on first sign-in instead of uploading them silently", async () => {
    createPet({ name: "Локальна", animalType: "cat" });
    remote = [{ id: "pet-cloud-00001", ownerId: "user-1", name: "Хмарна", animalType: "dog", createdAt: "", updatedAt: "" }];
    await startPetSync("user-1");
    expect(getPets().map((p) => p.name)).toEqual(["Хмарна"]);
    expect(getGuestPets().map((p) => p.name)).toEqual(["Локальна"]);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });

  it("moves device-only cards into the account only when asked", async () => {
    createPet({ name: "Локальна", animalType: "cat" });
    await startPetSync("user-1");
    expect(await importGuestPets()).toBeNull();
    expect(getGuestPets()).toHaveLength(0);
    expect(remote.map((p) => p.name)).toEqual(["Локальна"]);
    expect(getPets()[0].ownerId).toBe("user-1");
  });

  it("pushes local changes to the account without attachments", async () => {
    await startPetSync("user-1");
    const pet = createPet({ name: "Барні", animalType: "dog" });
    addVaccination(pet.id, { date: "2026-11-01", name: "Сказ", documentDataUrl: "data:application/pdf;base64,AAAA" });
    expect(await commitPetChanges()).toBeNull();
    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts.at(-1)?.url).toBe(`/api/pets/${pet.id}`);
    expect(JSON.stringify(puts.at(-1)?.body)).not.toContain("application/pdf");
    expect(remote[0].vaccinations?.[0].name).toBe("Сказ");
    // the file is still on this device after the next download
    await pullPets();
    expect(getPets()[0].vaccinations?.[0].documentDataUrl).toContain("application/pdf");
  });

  it("reports a failed save and keeps the change for a retry", async () => {
    await startPetSync("user-1");
    failWrites = 1;
    const pet = createPet({ name: "Барні", animalType: "dog" });
    expect(await commitPetChanges()).toMatch(/Не вдалося зберегти/);
    // a download in between must not wipe the unsent card
    failWrites = 1;
    await pullPets();
    expect(getPets().map((p) => p.id)).toContain(pet.id);
    expect(await commitPetChanges()).toBeNull();
    expect(remote.map((p) => p.id)).toEqual([pet.id]);
  });

  it("deletes in the account and clears the device on sign-out", async () => {
    await startPetSync("user-1");
    const pet = createPet({ name: "Барні", animalType: "dog" });
    await commitPetChanges();
    deletePet(pet.id);
    expect(await commitPetChanges()).toBeNull();
    expect(remote).toHaveLength(0);
    createPet({ name: "Ще одна", animalType: "cat" });
    await commitPetChanges();
    stopPetSync(true);
    expect(getPets()).toHaveLength(0);
    expect(localStorage.getItem("vetnear:pets:owner")).toBeNull();
  });

  it("does not show one account's cached cards to another account", async () => {
    await startPetSync("user-1");
    createPet({ name: "Алісина", animalType: "dog" });
    await commitPetChanges();
    stopPetSync(false); // e.g. session expired without a clean sign-out
    remote = [];
    await startPetSync("user-2");
    expect(getPets()).toHaveLength(0);
    expect(getGuestPets()).toHaveLength(0);
  });
});
