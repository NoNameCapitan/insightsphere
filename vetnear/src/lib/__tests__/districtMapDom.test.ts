// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeDistricts } from "@/components/HomeDistricts";
import { DistrictMap3D } from "@/components/DistrictMap3D";

let root: Root;
let container: HTMLDivElement;
let reduced = false;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  reduced = false;
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" && reduced,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

function districtButton(name: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("ul button")].find((button) => button.textContent?.startsWith(name))!;
}

describe("cinematic district selection", () => {
  it("keeps selection on the home page and exposes the matching district search link", async () => {
    await act(async () => root.render(createElement(HomeDistricts)));
    const obolon = districtButton("Оболонський");
    await act(async () => obolon.click());
    expect(obolon.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('a[href*="district=obolonskyi"]')?.getAttribute("href"))
      .toBe("/nearby?region=kyiv_city&district=obolonskyi&radius=10000&location=manual");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Обрано Оболонський район");
    expect(container.querySelector('a[href*="region=kyiv_oblast"]')).not.toBeNull();
  });

  it("allows the same district to be selected from the SVG using Enter or Space", async () => {
    await act(async () => root.render(createElement(HomeDistricts)));
    const district = container.querySelector<SVGPathElement>('path[role="button"][aria-label^="Печерський район:"]')!;
    await act(async () => { district.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); });
    expect(district.getAttribute("aria-pressed")).toBe("true");
    expect(districtButton("Печерський").getAttribute("aria-pressed")).toBe("true");
    await act(async () => { district.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })); });
    expect(district.getAttribute("aria-pressed")).toBe("false");
    expect(districtButton("Усі райони").getAttribute("aria-pressed")).toBe("true");
  });

  it("supports the existing single-district form contract without an all-district option", async () => {
    const change = vi.fn();
    await act(async () => root.render(createElement(DistrictMap3D, { value: "podilskyi", onChange: change, allowAll: false })));
    expect(districtButton("Усі райони")).toBeUndefined();
    await act(async () => districtButton("Подільський").click());
    expect(change).toHaveBeenCalledWith("podilskyi");
  });

  it("pauses motion without clearing the current district or disabling search", async () => {
    await act(async () => root.render(createElement(HomeDistricts)));
    await act(async () => districtButton("Дарницький").click());
    const pause = container.querySelector<HTMLButtonElement>('button[aria-label="Зупинити рух карти"]')!;
    await act(async () => pause.click());
    expect(container.querySelector('[data-district-map]')?.getAttribute("data-motion")).toBe("paused");
    expect(districtButton("Дарницький").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('a[href*="district=darnytskyi"]')).not.toBeNull();
  });

  it("honours reduced motion while retaining the equivalent HTML district selector", async () => {
    reduced = true;
    await act(async () => root.render(createElement(HomeDistricts)));
    expect(container.querySelector('[data-district-map]')?.getAttribute("data-motion")).toBe("paused");
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Системний режим без руху"]')?.disabled).toBe(true);
    expect(container.querySelectorAll("ul button")).toHaveLength(11);
    await act(async () => districtButton("Подільський").click());
    expect(districtButton("Подільський").getAttribute("aria-pressed")).toBe("true");
  });
});
