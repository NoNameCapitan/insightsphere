// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NearbyClient } from "@/components/NearbyClient";

const context = vi.hoisted(() => ({ params: new URLSearchParams(), geo: { coords: null, status: "idle", request: vi.fn(), setManual: vi.fn() } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => context.params }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/hooks/useGeolocation", () => ({ useGeolocation: () => context.geo }));
vi.mock("@/components/ActivePetSelector", () => ({ ActivePetSelector: () => null }));
vi.mock("@/components/NearestShelterButton", () => ({ NearestShelterButton: () => null }));
vi.mock("@/components/SafetyOverlay", () => ({ SafetyControls: () => null, useSafetyOverlay: () => ({ active: false, alert: null }) }));
vi.mock("@/components/PlaceCard", () => ({ PlaceCard: ({ place }: { place: { name: string } }) => createElement("article", null, place.name) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/pets/store", () => ({ getActivePet: () => null }));
vi.mock("@/lib/store", async () => {
  const { PLACES } = await import("@/lib/data/places");
  return { getPlaces: () => PLACES, hydratePublishedPlaces: async () => undefined };
});
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.clear(); localStorage.clear();
  context.params = new URLSearchParams("region=kyiv_oblast&category=grooming");
  window.history.replaceState(null, "", "/nearby?region=kyiv_oblast&category=grooming");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(x => x.textContent === label);
  expect(button).toBeDefined(); await act(async () => button!.click());
}
describe("search recovery", () => {
  it("does not offer a meaningless radius without an origin, and preserves category when moving from oblast to Kyiv", async () => {
    await act(async () => root.render(createElement(NearbyClient)));
    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
    expect(container.textContent).not.toContain("Розширити до 100 км");
    expect(container.textContent).toContain("Ця послуга у Києві");
    await click("Ця послуга у Києві");
    const params = new URLSearchParams(window.location.search);
    expect(params.get("region")).toBe("kyiv_city");
    expect(params.get("category")).toBe("grooming");
    expect(container.querySelectorAll("article").length).toBeGreaterThan(0);
  });
  it("keeps territory selection out of the initial result path but makes recovery explicit", async () => {
    await act(async () => root.render(createElement(NearbyClient)));
    expect(container.querySelector('#discovery-location-form')).toBeNull();
    await click("Змінити місце пошуку");
    expect(container.querySelector('#discovery-location-form')).not.toBeNull();
    await click("Показати результати");
    expect(container.querySelector('#discovery-location-form')).toBeNull();
  });
});
