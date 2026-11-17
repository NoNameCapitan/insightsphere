// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewMedicalRecordPage from "@/app/my-pets/[id]/records/new/page";
import { createPet, getPet } from "@/lib/pets/store";

const navigation = vi.hoisted(() => ({ id: "", push: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: navigation.id }),
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.params,
}));
vi.mock("@/components/GeneratedVisual", () => ({ GeneratedVisual: () => null }));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  navigation.push.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render(animalType: "cat" | "bird" | "reptile" | "other") {
  navigation.id = createPet({ name: "Улюбленець", animalType }).id;
  await act(async () => root.render(createElement(NewMedicalRecordPage)));
}
async function click(label: string) {
  const control = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === label);
  expect(control).toBeDefined();
  await act(async () => control!.click());
}

describe("medical record form", () => {
  it.each(["cat", "bird", "reptile", "other"] as const)("does not invent a care interval for %s", async (species) => {
    await render(species);
    expect(container.querySelector<HTMLInputElement>("#record-next")?.value).toBe("");
    expect(container.textContent).toContain("узгоджену з ветеринаром");
    await click("Блохи й кліщі");
    expect(container.querySelector<HTMLInputElement>("#record-next")?.value).toBe("");
  });

  it("saves an existing care record without creating a reminder date", async () => {
    await render("cat");
    await click("Комплексна");
    await click("Зберегти запис");
    expect(getPet(navigation.id)?.vaccinations?.[0].nextDate).toBeUndefined();
    expect(navigation.push).toHaveBeenCalledWith(`/my-pets/${navigation.id}`);
  });

  it("keeps entered data on screen and does not navigate after a storage failure", async () => {
    await render("cat");
    await click("Комплексна");
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "vetnear:pets") throw new DOMException("Storage full", "QuotaExceededError");
      original.call(this, key, value);
    });
    await click("Зберегти запис");
    expect(navigation.push).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Не вдалося зберегти");
    expect(container.querySelector<HTMLInputElement>("#record-name")?.value).toBe("Комплексна");
    expect(getPet(navigation.id)?.vaccinations).toBeUndefined();
  });
});
