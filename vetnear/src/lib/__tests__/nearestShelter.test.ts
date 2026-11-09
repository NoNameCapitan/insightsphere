import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentKyivAlert, hasFreshActiveAlert, hasFreshAlertStatus } from "@/lib/safety/client";
import {
  currentShelterLocation, nearestEligibleShelter, resolveNearestShelterRoute, shelterWalkingRoute,
} from "@/lib/safety/nearestShelter";
import type { KyivAlertStatus, KyivShelter } from "@/lib/safety/types";

const origin = { latitude: 50.45, longitude: 30.52 };
const near: KyivShelter = {
  id: "near", address: "Тестове укриття", latitude: 50.4502, longitude: 30.5201,
  declaredOpen24h: true, distanceMeters: 99_999,
};
const far: KyivShelter = { ...near, id: "far", latitude: 50.48, distanceMeters: 1 };
const status = (state: KyivAlertStatus["state"] = "active"): KyivAlertStatus => ({
  state, checkedAt: new Date().toISOString(), sourceUrl: "https://map.ukrainealarm.com/", level: "unknown",
});
const json = (value: unknown, code = 200) => new Response(JSON.stringify(value), { status: code });
const controller = () => new AbortController();

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("manual shelter button alert gate", () => {
  it.each(["red", "yellow", "unknown"] as const)("allows a fresh active %s alert", (level) => {
    expect(hasFreshActiveAlert({ ...status(), level })).toBe(true);
  });
  it.each(["inactive", "unavailable"] as const)("disables for %s status", (state) => {
    expect(hasFreshActiveAlert(status(state))).toBe(false);
  });
  it("disables before the first response", () => { expect(hasFreshActiveAlert(null)).toBe(false); });
  it.each([-90_000, -100_000, 31_000])("rejects stale or future timestamps (%s ms)", (offset) => {
    const now = Date.now();
    expect(hasFreshActiveAlert({ ...status(), checkedAt: new Date(now + offset).toISOString() }, now)).toBe(false);
  });
  it("rejects invalid timestamps even on an active response", () => {
    expect(hasFreshAlertStatus({ ...status(), checkedAt: "not a date" })).toBe(false);
  });
  it("reads only the same-origin no-store API with no credential in the client request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(status()));
    const signal = controller().signal;
    await fetchCurrentKyivAlert(signal, fetcher);
    expect(fetcher).toHaveBeenCalledWith("/api/safety/alert", { cache: "no-store", signal });
  });
  it.each([null, {}, { state: "active" }, { state: "unknown", checkedAt: "now" }])("rejects malformed API payload %j", async (value) => {
    await expect(fetchCurrentKyivAlert(controller().signal, vi.fn<typeof fetch>().mockResolvedValue(json(value)))).rejects.toThrow();
  });
});

describe("nearest shelter routing", () => {
  it("recalculates distance instead of trusting API ordering or stored distances", () => {
    expect(nearestEligibleShelter([far, near], origin)?.id).toBe("near");
    expect(nearestEligibleShelter([near], origin)?.distanceMeters).toBeLessThan(100);
  });
  it("ignores closed, malformed, out-of-city and out-of-radius entries", () => {
    const invalid = [null, {}, { ...near, declaredOpen24h: false }, { ...near, declaredOpen24h: "false" },
      { ...near, address: " " }, { ...near, latitude: 0 }, { ...near, longitude: null },
      { ...near, latitude: 50.64 }, { ...near, latitude: Number.NaN }];
    expect(nearestEligibleShelter(invalid, origin)).toBeNull();
  });
  it("does not rank without valid Kyiv coordinates", () => {
    expect(nearestEligibleShelter([near], { latitude: 0, longitude: 0 })).toBeNull();
  });
  it("builds walking directions with both the fresh origin and selected destination", () => {
    const url = new URL(shelterWalkingRoute(near, origin));
    expect(url.origin).toBe("https://www.google.com");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      api: "1", origin: "50.45,30.52", destination: "50.4502,30.5201", travelmode: "walking",
    });
  });
  it("checks alert, obtains fresh GPS, selects the nearest and rechecks before navigation", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(status()))
      .mockResolvedValueOnce(json({ shelters: [far, near] }))
      .mockResolvedValueOnce(json(status()));
    const locate = vi.fn().mockResolvedValue(origin);
    const onPhase = vi.fn();
    const signal = controller().signal;
    const result = await resolveNearestShelterRoute({ signal, fetcher, locate, onPhase });
    expect(result.shelter.id).toBe("near");
    expect(result.origin).toEqual(origin);
    expect(locate).toHaveBeenCalledWith(signal);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/safety/alert", "/api/safety/shelters?lat=50.45&lng=30.52", "/api/safety/alert",
    ]);
    expect(onPhase.mock.calls.flat()).toEqual(["checking", "locating", "searching", "checking"]);
  });
  it("does not request GPS if the alert has already ended", async () => {
    const locate = vi.fn();
    await expect(resolveNearestShelterRoute({
      signal: controller().signal, locate,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(json(status("inactive"))),
    })).rejects.toThrow("Тривогу вже завершено");
    expect(locate).not.toHaveBeenCalled();
  });
  it("does not navigate if all-clear arrives during the lookup", async () => {
    const onAlertStatus = vi.fn();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(status()))
      .mockResolvedValueOnce(json({ shelters: [near] }))
      .mockResolvedValueOnce(json(status("inactive")));
    await expect(resolveNearestShelterRoute({ signal: controller().signal, fetcher, locate: async () => origin, onAlertStatus }))
      .rejects.toThrow("Тривогу вже завершено");
    expect(onAlertStatus.mock.calls.map(([value]) => value.state)).toEqual(["active", "inactive"]);
  });
  it("rejects a stale active alert", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ ...status(), checkedAt: "2020-01-01T00:00:00Z" }));
    await expect(resolveNearestShelterRoute({ signal: controller().signal, fetcher })).rejects.toThrow("не підтверджено");
  });
  it("fails closed when the alert API fails", async () => {
    const onAlertStatus = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(status(), 503));
    await expect(resolveNearestShelterRoute({ signal: controller().signal, fetcher, onAlertStatus })).rejects.toThrow();
    expect(onAlertStatus).toHaveBeenCalledWith(expect.objectContaining({ state: "unavailable" }));
  });
  it("does not use Kyiv's centre for an out-of-city user", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(status()));
    await expect(resolveNearestShelterRoute({
      signal: controller().signal, fetcher, locate: async () => ({ latitude: 49.8, longitude: 24 }),
    })).rejects.toThrow("лише в межах Києва");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([[], [null], [{ id: "planned", declaredOpen24h: false }]].map((shelters) => ({ shelters })))("does not invent a destination for empty/invalid shelters", async ({ shelters }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(status())).mockResolvedValueOnce(json({ shelters }));
    await expect(resolveNearestShelterRoute({ signal: controller().signal, fetcher, locate: async () => origin }))
      .rejects.toThrow("немає придатних записів");
  });
  it("reports an unavailable shelter dataset", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(status())).mockResolvedValueOnce(json({}, 503));
    await expect(resolveNearestShelterRoute({ signal: controller().signal, fetcher, locate: async () => origin }))
      .rejects.toThrow("завантажити укриття");
  });
  it("honours cancellation while geolocation resolves", async () => {
    const abort = controller();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(status()));
    await expect(resolveNearestShelterRoute({ signal: abort.signal, fetcher, locate: async () => {
      abort.abort(); return origin;
    } })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("fresh emergency geolocation", () => {
  it("requires a fresh GPS fix, not browser cached coordinates", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: origin } as GeolocationPosition);
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    expect(await currentShelterLocation(controller().signal)).toEqual(origin);
    expect(getCurrentPosition.mock.calls[0]).toHaveLength(3);
    expect((getCurrentPosition.mock.calls[0] as unknown[])[2]).toEqual({
      enableHighAccuracy: true, timeout: 10_000, maximumAge: 0,
    });
  });
  it("explains permission denial without falling back to localStorage", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_: PositionCallback, failure: PositionErrorCallback) => {
      failure({ code: 1 } as GeolocationPositionError);
    } } });
    await expect(currentShelterLocation(controller().signal)).rejects.toThrow("Дозвольте геолокацію");
  });
  it("reports an unsupported browser", async () => {
    vi.stubGlobal("navigator", {});
    await expect(currentShelterLocation(controller().signal)).rejects.toThrow("Геолокація недоступна");
  });
  it("bounds waiting even if the browser never invokes its callbacks", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: vi.fn() } });
    const result = currentShelterLocation(controller().signal);
    const assertion = expect(result).rejects.toThrow("Не вдалося визначити");
    await vi.advanceTimersByTimeAsync(11_000);
    await assertion;
  });
  it("cancels a pending GPS request immediately", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: vi.fn() } });
    const abort = controller();
    const result = currentShelterLocation(abort.signal);
    abort.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
});
