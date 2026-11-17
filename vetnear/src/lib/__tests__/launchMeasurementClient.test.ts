// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics";
import { measurementAllowed, measurementVisit, setMeasurementOptOut } from "@/lib/measurement/client";
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubEnv("NEXT_PUBLIC_MEASUREMENT_ENABLED", "1"); vi.stubEnv("NEXT_PUBLIC_MEASUREMENT_CAMPAIGN_CODES", "kyiv-vet"); vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000001" }); Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: null }); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("measurement user controls", () => {
  it("is off unless the deployment explicitly enables collection", () => { vi.stubEnv("NEXT_PUBLIC_MEASUREMENT_ENABLED", "0"); expect(measurementAllowed()).toBe(false); expect(measurementVisit()).toBeNull(); });
  it("honors do not track", () => { Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "1" }); expect(measurementAllowed()).toBe(false); });
  it("honors a persistent opt-out and clears tab identity", () => { expect(measurementVisit()?.id).toBeDefined(); expect(setMeasurementOptOut(true)).toBe(true); expect(measurementVisit()).toBeNull(); expect(sessionStorage.getItem("vetnear:measurement-session")).toBeNull(); });
  it("never blocks an action when random UUID generation is unavailable or fails", () => {
    setMeasurementOptOut(false);
    vi.stubGlobal("crypto", { randomUUID: () => { throw Error("not available"); } });
    expect(() => track("call_clicked", { placeId: "public-clinic" })).not.toThrow();
    vi.stubGlobal("crypto", {});
    expect(() => track("route_clicked", { placeId: "public-clinic" })).not.toThrow();
  });
  it("repairs a malformed cached session before the server rejects it", () => {
    setMeasurementOptOut(false);
    sessionStorage.setItem("vetnear:measurement-session", JSON.stringify({ id: "a".repeat(36), last: Date.now(), campaign: {} }));
    expect(measurementVisit()?.id).toBe("00000000-0000-4000-8000-000000000001");
  });
  it("does not create cookies", () => { setMeasurementOptOut(false); measurementVisit(); expect(document.cookie).toBe(""); });
});
