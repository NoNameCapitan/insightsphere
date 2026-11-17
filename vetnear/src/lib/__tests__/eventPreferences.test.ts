// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS_PREFERENCES_KEY, readEventPreferences, toggleFollowedCategory, toggleSavedEvent } from "@/lib/events/preferences";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("browser-only event preferences", () => {
  it("keeps saved materials and followed topics after reading the store again", () => {
    toggleSavedEvent("kyiv-rabies-vaccination");
    toggleFollowedCategory("adoption");
    expect(readEventPreferences()).toEqual({ savedIds: ["kyiv-rabies-vaccination"], followedCategories: ["adoption"] });
    toggleSavedEvent("kyiv-rabies-vaccination");
    expect(readEventPreferences()).toEqual({ savedIds: [], followedCategories: ["adoption"] });
    toggleFollowedCategory("adoption");
    expect(readEventPreferences()).toEqual({ savedIds: [], followedCategories: [] });
  });
  it("handles malformed browser data and ignores unsupported topic values", () => {
    localStorage.setItem(EVENTS_PREFERENCES_KEY, "broken");
    expect(readEventPreferences()).toEqual({ savedIds: [], followedCategories: [] });
    localStorage.setItem(EVENTS_PREFERENCES_KEY, JSON.stringify({ savedIds: ["one", "one", 12], followedCategories: ["adoption", "unknown", "adoption"] }));
    expect(readEventPreferences()).toEqual({ savedIds: ["one"], followedCategories: ["adoption"] });
  });
  it("reports failed persistence and keeps the previous choices", () => {
    toggleSavedEvent("existing");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(() => toggleSavedEvent("new")).toThrow("Не вдалося зберегти");
    expect(() => toggleFollowedCategory("event")).toThrow("Не вдалося зберегти");
    expect(readEventPreferences()).toEqual({ savedIds: ["existing"], followedCategories: [] });
  });
});
