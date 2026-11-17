// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeoFallback } from "@/components/GeoFallback";
import { useGeolocation } from "@/hooks/useGeolocation";

let root: Root;
let container: HTMLDivElement;
const onResolved = vi.fn();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const found = [
  { lat: "50.45", lon: "30.52", display_name: "Київ, Хрещатик, 1, Україна" },
  { lat: "49.84", lon: "24.03", display_name: "Львів, Україна" },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T10:00:00Z"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear(); sessionStorage.clear(); onResolved.mockReset();
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

async function renderSearch() {
  await act(async () => { root.render(createElement(GeoFallback, { onResolved })); });
}
async function typeQuery(value = "Київ") {
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}

describe("manual address selection", () => {
  it("shows named alternatives and only uses coordinates after an explicit choice", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(found)));
    await renderSearch(); await typeQuery("Хрещатик"); await submit();
    expect(onResolved).not.toHaveBeenCalled();
    const choices = container.querySelectorAll<HTMLButtonElement>("ul button");
    expect(choices).toHaveLength(2);
    expect(choices[1].textContent).toBe("Львів, Україна");
    await act(async () => { choices[1].click(); });
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith({ latitude: 49.84, longitude: 24.03 });
  });

  it.each([[], { error: "not available" }, [{ lat: "500", lon: "30", display_name: "Bad location" }], [{ lat: null, lon: "", display_name: "Empty coordinates" }], [{ lat: "NaN", lon: "Infinity", display_name: "Invalid" }]])(
    "never substitutes Kyiv for an empty or malformed result: %j", async (response) => {
      vi.stubGlobal("fetch", vi.fn(async () => json(response)));
      await renderSearch(); await typeQuery("Невідоме село"); await submit();
      expect(onResolved).not.toHaveBeenCalled();
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.querySelectorAll("ul button")).toHaveLength(0);
    },
  );

  it("reports HTTP failures and retries successfully", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(found, 503)).mockResolvedValueOnce(json(found));
    vi.stubGlobal("fetch", fetcher);
    await renderSearch(); await typeQuery(); await submit();
    expect(onResolved).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Не вдалося");
    await submit();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelectorAll("ul button")).toHaveLength(2);
  });

  it("times out a stalled request, enables retry and never chooses a location", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    await renderSearch(); await typeQuery(); await submit();
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("надто довго");
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("ignores an older response after the query changes", async () => {
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    await renderSearch(); await typeQuery(); await submit();
    await typeQuery("Львів");
    await act(async () => { finish(json(found)); });
    expect(container.querySelectorAll("ul button")).toHaveLength(0);
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("keeps an explicit offline preset when a slow geocoder response arrives", async () => {
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    await renderSearch(); await typeQuery(); await submit();
    const preset = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Київ — Поділ")!;
    await act(async () => { preset.click(); finish(json(found)); });
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledWith({ latitude: 50.4659, longitude: 30.5167 });
    expect(container.querySelectorAll("ul button")).toHaveLength(0);
  });
});

let location: ReturnType<typeof useGeolocation>;
function LocationProbe() {
  const current = useGeolocation();
  useEffect(() => { location = current; }, [current]);
  return createElement("div", null, current.status);
}
async function renderLocation() {
  await act(async () => { root.render(createElement(LocationProbe)); });
}
const point = { latitude: 49.84, longitude: 24.03 };
const position = { coords: { latitude: 50.45, longitude: 30.52 } } as GeolocationPosition;

describe("geolocation freshness and races", () => {
  it("does not restore old persistent, untimed GPS coordinates", async () => {
    localStorage.setItem("vetnear:coords", JSON.stringify(point));
    await renderLocation();
    expect(location.coords).toBeNull();
    expect(localStorage.getItem("vetnear:coords")).toBeNull();
  });

  it("restores a recent manual point as manual, never as current device location", async () => {
    sessionStorage.setItem("vetnear:coords", JSON.stringify({ coords: point, savedAt: Date.now() - 1000 }));
    await renderLocation();
    expect(location.status).toBe("manual");
    expect(location.coords).toEqual(point);
  });

  it.each([
    { coords: point, savedAt: Date.parse("2026-11-16T08:00:00Z") },
    { coords: point, savedAt: Date.parse("2026-11-16T12:00:00Z") },
    { coords: { latitude: 91, longitude: 30 }, savedAt: Date.parse("2026-11-16T10:00:00Z") },
    { coords: { latitude: 50, longitude: "30" }, savedAt: Date.parse("2026-11-16T10:00:00Z") },
  ])("rejects stale, future-dated or invalid saved coordinates: %j", async (saved) => {
    sessionStorage.setItem("vetnear:coords", JSON.stringify(saved));
    await renderLocation();
    expect(location.coords).toBeNull();
    expect(sessionStorage.getItem("vetnear:coords")).toBeNull();
  });

  it.each(["success", "denied"])("a late GPS %s cannot replace a newer manual point", async (outcome) => {
    let success: PositionCallback = () => {};
    let failure: PositionErrorCallback = () => {};
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) => { success = ok; failure = fail; } } });
    await renderLocation();
    await act(async () => { location.request(); });
    await act(async () => { location.setManual(point); });
    await act(async () => {
      if (outcome === "success") success(position);
      else failure({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    });
    expect(location.status).toBe("manual");
    expect(location.coords).toEqual(point);
  });

  it("keeps precise device coordinates in memory without persisting them", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (ok: PositionCallback) => ok(position) } });
    await renderLocation();
    await act(async () => { location.request(); });
    expect(location.status).toBe("granted");
    expect(localStorage.getItem("vetnear:coords")).toBeNull();
    expect(sessionStorage.getItem("vetnear:coords")).toBeNull();
  });

  it("does not accept out-of-range manual or device coordinates", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 500, longitude: 20 } } as GeolocationPosition) } });
    await renderLocation();
    await act(async () => { location.setManual({ latitude: NaN, longitude: 30 }); location.request(); });
    expect(location.coords).toBeNull();
    expect(location.status).toBe("unavailable");
  });
});
