// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritePlaceButton } from "@/components/FavoritePlaceButton";
import { SavedPlacesClient } from "@/components/SavedPlacesClient";
import { FAVORITE_PLACES_KEY, getFavoritePlaceIds, toggleFavoritePlace } from "@/lib/favorites/store";
import { PLACES } from "@/lib/data/places";
import type { Place, PlaceWithDistance } from "@/lib/types";

const state = vi.hoisted(() => ({ catalog: [] as Place[], published: [] as Place[], track: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: state.track }));
vi.mock("@/lib/store", () => ({
  getPlaces: () => state.catalog,
  hydratePublishedPlaces: async () => { state.catalog = [...state.catalog, ...state.published]; return state.published; },
}));
vi.mock("@/components/PlaceCard", () => ({
  PlaceCard: ({ place }: { place: PlaceWithDistance }) => createElement("article", { "data-place-id": place.id }, place.name, createElement(FavoritePlaceButton, { placeId: place.id })),
}));

let root: Root; let container: HTMLDivElement;
const seed = PLACES.find((place) => place.status === "approved" && place.dataSource !== "demo")!;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); state.track.mockClear(); state.catalog = [seed]; state.published = [];
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function click(button: HTMLButtonElement) { await act(async () => button.click()); }

describe("saved-place owner flow", () => {
  it("updates both hearts only after a persisted save, including cross-tab removal", async () => {
    await act(async () => root.render(createElement("div", null, createElement(FavoritePlaceButton, { placeId: seed.id }), createElement(FavoritePlaceButton, { placeId: seed.id }))));
    const buttons = [...container.querySelectorAll("button")];
    await click(buttons[0]);
    expect(buttons.every((button) => button.getAttribute("aria-pressed") === "true")).toBe(true);
    expect(state.track).toHaveBeenCalledWith("place_saved", { placeId: seed.id });
    await act(async () => { localStorage.setItem(FAVORITE_PLACES_KEY, "[]"); window.dispatchEvent(new StorageEvent("storage", { key: FAVORITE_PLACES_KEY })); });
    expect(buttons.every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
  });

  it("keeps the heart unchanged and reports the actual failure without success analytics", async () => {
    await act(async () => root.render(createElement(FavoritePlaceButton, { placeId: seed.id })));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    await click(container.querySelector("button")!);
    expect(container.querySelector("button")?.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Не вдалося зберегти");
    expect(state.track).not.toHaveBeenCalled();
  });

  it("does not expose saved personal IDs during server render and offers a useful empty state", async () => {
    localStorage.setItem(FAVORITE_PLACES_KEY, '["private-unknown-id"]');
    expect(renderToString(createElement(SavedPlacesClient))).not.toContain("private-unknown-id");
    localStorage.clear(); await act(async () => root.render(createElement(SavedPlacesClient)));
    expect(container.textContent).toContain("Залиште потрібні місця під рукою");
    expect(container.querySelector('a[href="/nearby"]')).not.toBeNull();
  });

  it("resolves saved published places and removes a card immediately when unsaved", async () => {
    const published = { ...seed, id: "published-clinic", slug: "published-clinic", name: "Опублікована клініка" };
    state.published = [published]; localStorage.setItem(FAVORITE_PLACES_KEY, JSON.stringify([published.id]));
    await act(async () => root.render(createElement(SavedPlacesClient)));
    expect(container.querySelector('[data-place-id="published-clinic"]')).not.toBeNull();
    await click(container.querySelector("article button")!);
    expect(getFavoritePlaceIds()).toEqual([]);
    expect(container.querySelector("article")).toBeNull();
    expect(container.textContent).toContain("Залиште потрібні місця під рукою");
  });

  it("keeps unavailable or rejected entries until explicitly removed, preserving visible favorites", async () => {
    const rejected = { ...seed, id: "rejected-clinic", verificationStatus: "rejected" as const };
    state.catalog = [seed, rejected]; localStorage.setItem(FAVORITE_PLACES_KEY, JSON.stringify([seed.id, "missing", rejected.id]));
    await act(async () => root.render(createElement(SavedPlacesClient)));
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(container.textContent).toContain("Не вдалося знайти в поточному каталозі: 2");
    expect(getFavoritePlaceIds()).toHaveLength(3);
    const remove = [...container.querySelectorAll("button")].find((button) => button.textContent === "Прибрати ці збереження")!;
    await click(remove); expect(getFavoritePlaceIds()).toEqual([seed.id]);
    await act(async () => toggleFavoritePlace(seed.id)); expect(container.querySelectorAll("article")).toHaveLength(0);
  });

  it("shows corrupt data as a recoverable error instead of a fictional empty collection", async () => {
    localStorage.setItem(FAVORITE_PLACES_KEY, "{}");
    await act(async () => root.render(createElement(SavedPlacesClient)));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("пошкоджені");
    expect(container.textContent).not.toContain("Залиште потрібні місця під рукою");
    await click([...container.querySelectorAll("button")].find((button) => button.textContent === "Очистити пошкоджений список місць")!);
    expect(container.textContent).toContain("Залиште потрібні місця під рукою");
  });
});
