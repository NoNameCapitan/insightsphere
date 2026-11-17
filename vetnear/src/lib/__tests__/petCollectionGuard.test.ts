// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PetProfileForm } from "@/components/PetProfileForm";
import MyPetsPage from "@/app/my-pets/page";
import { createPet, deletePet, getPet, getPetCollectionReadIssue, getPets, importPetsBackup, updatePet } from "@/lib/pets/store";
import type { PetProfile } from "@/lib/types";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

const KEY = "vetnear:pets";
const pet: PetProfile = {
  id: "legacy-pet", name: "Луна", animalType: "cat",
  createdAt: "2024-01-01T10:00:00Z", updatedAt: "2024-01-01T10:00:00Z",
};

beforeEach(() => {
  localStorage.clear();
  navigation.push.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("medical collection integrity", () => {
  it.each(['{"unexpected":true}', "null", '"broken"', '{"incomplete":', "[null]", "[42]"])
    ("reads a malformed top-level collection safely without changing its bytes: %s", (raw) => {
      localStorage.setItem(KEY, raw);
      expect(getPets()).toEqual([]);
      expect(getPet(pet.id)).toBeNull();
      expect(getPetCollectionReadIssue()).toContain("Не вдалося прочитати");
      expect(localStorage.getItem(KEY)).toBe(raw);
    });

  it("preserves the whole collection when one member is damaged instead of dropping other cards", () => {
    const raw = JSON.stringify([pet, { id: "damaged-record" }]);
    localStorage.setItem(KEY, raw);
    expect(getPets()).toEqual([]);
    expect(getPetCollectionReadIssue()).not.toBeNull();
    expect(() => createPet({ name: "Рікі", animalType: "bird" })).toThrow("Щоб не втратити дані");
    expect(localStorage.getItem(KEY)).toBe(raw);
  });

  it.each(["create", "update", "delete", "import"] as const)
    ("refuses %s when existing medical data cannot be read", (operation) => {
      const raw = '{"unexpected":"medical data retained for recovery"}';
      localStorage.setItem(KEY, raw);
      localStorage.setItem("vetnear:active-pet", JSON.stringify(pet.id));
      const actions = {
        create: () => createPet({ name: "Рікі", animalType: "bird" }),
        update: () => updatePet(pet.id, { name: "Нове ім’я" }),
        delete: () => deletePet(pet.id),
        import: () => importPetsBackup(JSON.stringify({ format: "vetnear-pets-backup", version: 1, pets: [pet] })),
      };
      expect(actions[operation]).toThrow("Щоб не втратити дані");
      expect(localStorage.getItem(KEY)).toBe(raw);
      expect(localStorage.getItem("vetnear:active-pet")).toBe(JSON.stringify(pet.id));
    });

  it("preserves valid legacy arrays without new optional fields or a schema marker", () => {
    const legacy = { ...pet, additionalLegacyField: { note: "Зберегти" } };
    localStorage.setItem(KEY, JSON.stringify([legacy]));
    expect(getPets()).toEqual([legacy]);
    expect(getPetCollectionReadIssue()).toBeNull();
    createPet({ name: "Рікі", animalType: "bird" });
    expect(getPet(pet.id)).toEqual(legacy);
    updatePet(pet.id, { name: "Луночка" });
    expect(getPet(pet.id)).toEqual({ ...legacy, name: "Луночка", updatedAt: expect.any(String) });
    expect(getPets()).toHaveLength(2);
  });

  it("does not overwrite existing cards if storage becomes unreadable", () => {
    const raw = JSON.stringify([pet]);
    localStorage.setItem(KEY, raw);
    const originalGet = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function(this: Storage, key) {
      if (key === KEY) throw new DOMException("Storage denied", "SecurityError");
      return originalGet.call(this, key);
    });
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(getPets()).toEqual([]);
    expect(() => createPet({ name: "Рікі", animalType: "bird" })).toThrow("Щоб не втратити дані");
    expect(write).not.toHaveBeenCalled();
    expect(originalGet.call(localStorage, KEY)).toBe(raw);
  });

  it.each([false, true])("keeps the entered form name when saving is blocked (editing: %s)", async (editing) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const raw = "null";
    localStorage.setItem(KEY, raw);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onSaved = vi.fn();
    try {
      await act(async () => root.render(createElement(PetProfileForm, { existing: editing ? pet : undefined, onSaved })));
      const input = container.querySelector<HTMLInputElement>("#pet-name")!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Нове ім’я");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      expect(input.value).toBe("Нове ім’я");
      expect(container.querySelector('[role="alert"]')?.textContent).toContain("Щоб не втратити дані");
      expect(onSaved).not.toHaveBeenCalled();
      expect(navigation.push).not.toHaveBeenCalled();
      expect(localStorage.getItem(KEY)).toBe(raw);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("shows a recoverable read error instead of onboarding and retries without resetting data", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const raw = '{"unexpected":true}';
    localStorage.setItem(KEY, raw);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(MyPetsPage)));
      expect(container.querySelector('[role="alert"]')?.textContent).toContain("Картки не завантажилися");
      expect(container.textContent).not.toContain("Турбота починається");
      expect(localStorage.getItem(KEY)).toBe(raw);
      // A later readable collection can be displayed by retrying, without reload/reset.
      localStorage.setItem(KEY, JSON.stringify([pet]));
      const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "Спробувати ще раз")!;
      await act(async () => retry.click());
      expect(container.querySelector('[role="alert"]')).toBeNull();
      expect(container.textContent).toContain("Луна");
      expect(localStorage.getItem(KEY)).toBe(JSON.stringify([pet]));
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
