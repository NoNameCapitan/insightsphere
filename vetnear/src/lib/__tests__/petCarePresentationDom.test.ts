// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PetDetailPage from "@/app/my-pets/[id]/page";
import { HomeCareReturn } from "@/components/HomeCareReturn";
import { addReminder, createPet, getPet } from "@/lib/pets/store";
const navigation = vi.hoisted(() => ({ id: "", push: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: navigation.id }), useRouter: () => navigation }));
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("personal care presentation", () => {
  it("introduces the next action, personal vet and preparation before record navigation", async () => {
    navigation.id = createPet({ name: "Луна", animalType: "cat" }).id;
    await act(async () => root.render(createElement(PetDetailPage)));
    const titles = [...container.querySelectorAll("h2")].map((el) => el.textContent);
    expect(titles.slice(0, 4)).toEqual(["Наступна дія", "Мій ветеринар", "Перед прийомом", "Історія турботи"]);
    expect(container.querySelector('a[href$="?type=reminder"]')?.textContent).toBe("Запланувати подію");
  });
  it("does not present an old date as the next action and lets the owner complete a reminder", async () => {
    navigation.id = createPet({ name: "Луна", animalType: "cat" }).id;
    addReminder(navigation.id, { title: "Минуле", date: "2026-11-15" });
    addReminder(navigation.id, { title: "Наступний огляд", date: "2026-11-20" });
    await act(async () => root.render(createElement(PetDetailPage)));
    const next = container.querySelector('[aria-labelledby="next-care-heading"]')!;
    expect(next.textContent).toContain("Наступний огляд"); expect(next.textContent).not.toContain("Минуле");
    const done = [...next.querySelectorAll("button")].find((el) => el.textContent === "Позначити виконаним")!;
    await act(async () => done.click());
    expect(getPet(navigation.id)?.reminders?.find((x) => x.title === "Наступний огляд")?.completed).toBe(true);
    expect(next.textContent).toContain("Що заплануємо");
    expect(container.textContent).toContain("Минула дата не означає");
  });
  it("keeps personal data out of server HTML and restores the return shortcut after mount", async () => {
    const pet = createPet({ name: "Луна", animalType: "cat" });
    expect(renderToString(createElement(HomeCareReturn))).toBe("");
    await act(async () => root.render(createElement(HomeCareReturn)));
    expect(container.textContent).toContain("Луна — турбота триває");
    expect(container.querySelector(`a[href="/my-pets/${pet.id}"]`)).not.toBeNull();
  });
  it("does not break the homepage when old browser data has an invalid shape", async () => {
    localStorage.setItem("vetnear:pets", JSON.stringify({ unexpected: true }));
    await act(async () => root.render(createElement(HomeCareReturn)));
    expect(container.innerHTML).toBe("");
  });
});
