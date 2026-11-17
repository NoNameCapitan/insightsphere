// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KyivEventsHub } from "@/app/kyiv-updates/KyivEventsHub";
import { readEventPreferences } from "@/lib/events/preferences";

let root: Root;
let container: HTMLDivElement;
const initialNow = "2026-11-17T12:00:00Z";
const render = () => act(async () => root.render(createElement(KyivEventsHub, { initialNow })));
const findButton = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === label)!;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(initialNow));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe("Kyiv event hub actions", () => {
  it("places topic choices before the feed and keeps incomplete dates out of the confirmed group", async () => {
    await render();
    const topics = container.querySelector('[aria-labelledby="follow-topics-heading"]')!;
    const feed = container.querySelector('#events-feed')!;
    expect(topics.compareDocumentPosition(feed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('#group-dated')).toBeNull();
    expect(container.querySelector('#group-ongoing')).not.toBeNull();
    expect(container.querySelector('#group-pending')).not.toBeNull();
    const pending = container.querySelector('#event-ukc-pinscher-november')!;
    expect(pending.closest('section')?.getAttribute('aria-labelledby')).toBe('group-pending');
    expect(pending.textContent).not.toContain('У календар');
  });
  it("saves an item, shows it in the saved view and keeps it after remounting", async () => {
    await render();
    const save = container.querySelector<HTMLButtonElement>('[aria-label="Зберегти: Щеплення від сказу без оплати за вакцину"]')!;
    await act(async () => save.click());
    expect(readEventPreferences().savedIds).toEqual(["kyiv-rabies-vaccination"]);
    await act(async () => findButton("Збережені · 1").click());
    expect(container.querySelectorAll("article")).toHaveLength(1);
    await act(async () => root.unmount()); root = createRoot(container); await render();
    expect(container.querySelector('[aria-label="Прибрати зі збережених: Щеплення від сказу без оплати за вакцину"]')?.getAttribute("aria-pressed")).toBe("true");
  });
  it("follows a topic and filters the personal feed without claiming notifications", async () => {
    await render();
    const adoption = Array.from(container.querySelectorAll("label")).find((label) => label.textContent === "Адопція")!.querySelector<HTMLInputElement>("input")!;
    await act(async () => adoption.click());
    await act(async () => findButton("Мої теми").click());
    expect(readEventPreferences().followedCategories).toEqual(["adoption"]);
    expect(container.querySelectorAll("article")).toHaveLength(2);
    expect(container.textContent).toContain("Без push-повідомлень і розсилок");
  });
  it("reports a save error without showing a false saved state", async () => {
    await render();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    const save = container.querySelector<HTMLButtonElement>('[aria-label="Зберегти: Щеплення від сказу без оплати за вакцину"]')!;
    await act(async () => save.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Не вдалося зберегти");
    expect(save.getAttribute("aria-pressed")).toBe("false");
    expect(readEventPreferences().savedIds).toEqual([]);
  });
});
