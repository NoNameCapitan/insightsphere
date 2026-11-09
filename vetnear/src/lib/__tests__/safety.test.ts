import { describe, expect, it } from "vitest";
import { parseKyivAlertPayload } from "@/lib/safety/alert";
import { normalizeShelterFeatures } from "@/lib/safety/shelters";
import { availabilityDuringAlert } from "@/lib/safety/placeAvailability";

describe("live safety data", () => {
  it("detects an active alert specifically for Kyiv city", () => {
    const result = parseKyivAlertPayload([
      { regionName: "Київська область", regionType: "State", activeAlerts: [] },
      {
        regionName: "м. Київ",
        regionType: "City",
        activeAlerts: [{ type: "AIR", lastUpdate: "2026-09-07T08:00:00Z" }],
      },
    ], "2026-09-07T08:01:00Z");
    expect(result.state).toBe("active");
    expect(result.startedAt).toBe("2026-09-07T08:00:00Z");
    expect(result.level).toBe("unknown");
  });

  it("distinguishes Kyiv yellow drone and red missile threats when supplied upstream", () => {
    const yellow = parseKyivAlertPayload([{ regionName: "м. Київ", regionType: "City", activeAlerts: [{ message: "Жовта дронова небезпека" }] }]);
    const red = parseKyivAlertPayload([{ regionName: "м. Київ", regionType: "City", activeAlerts: [{ message: "Червона комбінована ракетна загроза" }] }]);
    expect(yellow.level).toBe("yellow");
    expect(red.level).toBe("red");
  });

  it("closes municipal clinics only on a confirmed red threat", () => {
    const place = { alertPolicy: "municipal_severity_based" } as const;
    expect(availabilityDuringAlert(place, { state: "active", level: "yellow", checkedAt: "now", sourceUrl: "official" })).toBe("call_first");
    expect(availabilityDuringAlert(place, { state: "active", level: "unknown", checkedAt: "now", sourceUrl: "official" })).toBe("call_first");
    expect(availabilityDuringAlert(place, { state: "active", level: "red", checkedAt: "now", sourceUrl: "official" })).toBe("closed");
  });

  it("does not treat Kyiv oblast as Kyiv city", () => {
    const result = parseKyivAlertPayload([
      {
        regionName: "Київська область",
        regionType: "State",
        activeAlerts: [{ type: "AIR" }],
      },
    ]);
    expect(result.state).toBe("unavailable");
  });

  it("keeps only current shelters declared open 24h", () => {
    const shelters = normalizeShelterFeatures([
      {
        attributes: {
          objectid: 1,
          actual: 1,
          address: "Ближня, 1",
          lat: 50.4502,
          long: 30.5235,
          working_time: "За графіком",
        },
      },
      {
        attributes: {
          objectid: 2,
          actual: 1,
          address: "Цілодобова, 2",
          lat: 50.452,
          long: 30.525,
          working_time: "Цілодобово",
        },
      },
      {
        attributes: {
          objectid: 3,
          actual: 0,
          address: "Неактуальна, 3",
          lat: 50.4501,
          long: 30.5234,
          working_time: "Цілодобово",
        },
      },
    ], { latitude: 50.4501, longitude: 30.5234 });

    expect(shelters).toHaveLength(1);
    expect(shelters[0].address).toBe("Цілодобова, 2");
    expect(shelters[0].declaredOpen24h).toBe(true);
    expect(shelters.some((shelter) => shelter.address === "Ближня, 1")).toBe(false);
    expect(shelters.some((shelter) => shelter.address === "Неактуальна, 3")).toBe(false);
  });
});
