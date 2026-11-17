// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MapView from "@/components/MapView";
import { PLACES } from "@/lib/data/places";

const probe = vi.hoisted(() => ({
  events: {} as Record<string, () => void>,
  map: { setView: vi.fn(), fitBounds: vi.fn() },
}));
vi.mock("react-leaflet", async () => {
  const { createElement: h } = await import("react");
  const children = ({ children }: { children?: ReactNode }) => h("div", null, children);
  return {
    MapContainer: children,
    Marker: ({ children }: { children?: ReactNode }) => h("div", { "data-marker": true }, children),
    Popup: children,
    Polyline: () => null,
    TileLayer: ({ eventHandlers }: { eventHandlers: Record<string, () => void> }) => { probe.events = eventHandlers; return null; },
    useMap: () => probe.map,
  };
});

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("map basemap availability", () => {
  it("keeps provider markers on a tile failure and offers the existing filtered list", async () => {
    const onShowList = vi.fn();
    await act(async () => root.render(createElement(MapView, {
      places: [{ ...PLACES[0], distanceMeters: null }], onShowList,
    })));
    expect(container.querySelector('[role="status"]')).toBeNull();
    await act(async () => probe.events.tileerror());
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Дані закладів доступні у списку");
    expect(container.querySelectorAll("[data-marker]")).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(onShowList).toHaveBeenCalledTimes(1);
    await act(async () => probe.events.loading());
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("offers discovery navigation when the map is embedded without a list callback", async () => {
    await act(async () => root.render(createElement(MapView, { places: [] })));
    await act(async () => probe.events.tileerror());
    expect(container.querySelector<HTMLAnchorElement>('a[href="/nearby"]')?.textContent).toBe("До списку");
  });
});
