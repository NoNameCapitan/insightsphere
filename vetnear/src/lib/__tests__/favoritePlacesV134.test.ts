// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAVORITE_PLACES_KEY, getFavoritePlaceIds, readFavoritePlaces, removeFavoritePlaces, resetFavoritePlaces, subscribeToFavoritePlaces, toggleFavoritePlace } from "@/lib/favorites/store";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("reliable browser-local saved places", () => {
  it("preserves invalid storage for explicit recovery instead of crashing or overwriting it", () => {
    for (const value of ["{", "{}", "null", '["clinic-1",42]', '[""]']) {
      localStorage.setItem(FAVORITE_PLACES_KEY, value);
      expect(getFavoritePlaceIds()).toEqual([]);
      expect(readFavoritePlaces().issue).toBe("corrupt");
      expect(() => toggleFavoritePlace("clinic-2")).toThrow("пошкоджені");
      expect(localStorage.getItem(FAVORITE_PLACES_KEY)).toBe(value);
    }
    localStorage.setItem("vetnear:pets", "keep-medical-data");
    resetFavoritePlaces();
    expect(readFavoritePlaces()).toEqual({ ids: [], issue: null });
    expect(localStorage.getItem("vetnear:pets")).toBe("keep-medical-data");
  });

  it("never reports a save or announces a mutation when local storage rejects it", () => {
    localStorage.setItem(FAVORITE_PLACES_KEY, '["clinic-1"]');
    const refresh = vi.fn(); const unsubscribe = subscribeToFavoritePlaces(refresh);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(() => toggleFavoritePlace("clinic-2")).toThrow("Не вдалося зберегти");
    expect(() => toggleFavoritePlace("clinic-1")).toThrow("Не вдалося зберегти");
    expect(getFavoritePlaceIds()).toEqual(["clinic-1"]);
    expect(refresh).not.toHaveBeenCalled(); unsubscribe();
  });

  it("announces actual same-tab changes and only relevant cross-tab storage changes", () => {
    const refresh = vi.fn(); const unsubscribe = subscribeToFavoritePlaces(refresh);
    toggleFavoritePlace("clinic-1"); expect(refresh).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent("storage", { key: "other" })); expect(refresh).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent("storage", { key: FAVORITE_PLACES_KEY })); expect(refresh).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new StorageEvent("storage", { key: null })); expect(refresh).toHaveBeenCalledTimes(3);
    unsubscribe(); toggleFavoritePlace("clinic-2"); expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("removes selected unavailable IDs without dropping another tab's newer favorite", () => {
    localStorage.setItem(FAVORITE_PLACES_KEY, '["unknown","clinic-1","clinic-1"]');
    expect(getFavoritePlaceIds()).toEqual(["unknown", "clinic-1"]);
    toggleFavoritePlace("newly-saved");
    removeFavoritePlaces(["unknown"]);
    expect(getFavoritePlaceIds()).toEqual(["clinic-1", "newly-saved"]);
  });

  it("distinguishes unavailable storage from an empty list", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    expect(readFavoritePlaces()).toEqual({ ids: [], issue: "unavailable" });
    expect(() => toggleFavoritePlace("clinic-1")).toThrow();
  });
});
