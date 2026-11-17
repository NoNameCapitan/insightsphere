// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PetProfileForm } from "@/components/PetProfileForm";
import { createPet, getPet, getPets } from "@/lib/pets/store";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); navigation.push.mockClear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function fill(id: string, value: string) {
  const field = container.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function save() {
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}
describe("quick pet profile", () => {
  it("creates a useful profile immediately from name and species without optional steps", async () => {
    await act(async () => root.render(createElement(PetProfileForm)));
    await fill("pet-name", "Луна"); await save();
    const stored = getPets()[0]; expect(stored.name).toBe("Луна"); expect(stored.animalType).toBe("dog");
    expect(stored.reminders).toBeUndefined(); expect(stored.vaccinations).toBeUndefined();
    expect(navigation.push).toHaveBeenCalledWith(`/my-pets/${stored.id}`);
  });
  it("preserves entered name and does not navigate when local storage fails", async () => {
    await act(async () => root.render(createElement(PetProfileForm)));
    await fill("pet-name", "Луна");
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) { if(key === "vetnear:pets") throw new DOMException("Full", "QuotaExceededError"); original.call(this, key, value); });
    await save(); expect(navigation.push).not.toHaveBeenCalled(); expect(container.querySelector<HTMLInputElement>("#pet-name")!.value).toBe("Луна"); expect(container.querySelector('[role="alert"]')?.textContent).toContain("Не вдалося зберегти");
  });
  it("updates the visible profile through onSaved without relying on navigation to the same route", async () => {
    const pet = createPet({ name: "Луна", animalType: "cat", preferredDistrict: "obolonskyi" });
    const onSaved = vi.fn(); await act(async () => root.render(createElement(PetProfileForm, { existing: pet, onSaved })));
    await fill("pet-locality", "Буча"); await save();
    expect(getPet(pet.id)?.preferredLocality).toBe("Буча"); expect(getPet(pet.id)?.preferredDistrict).toBeUndefined();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: pet.id, preferredLocality: "Буча" })); expect(navigation.push).not.toHaveBeenCalled();
  });
});
