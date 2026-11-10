import { describe, expect, it } from "vitest";
import { PLACES } from "@/lib/data/places";
import { DISTRICT_CENTROIDS } from "@/lib/geo/districts";
import { DISTRICT_SHAPES, KYIV_MAP_VIEWBOX } from "@/lib/geo/kyivDistrictShapes";
import { ALL_DISTRICTS, DISTRICT_LABELS, districtLabel, normalizeDistrict } from "@/lib/labels";

const OFFICIAL = [
  "holosiivskyi", "darnytskyi", "desnianskyi", "dniprovskyi", "obolonskyi",
  "pecherskyi", "podilskyi", "sviatoshynskyi", "solomianskyi", "shevchenkivskyi",
];

describe("Kyiv districts", () => {
  it("uses exactly the ten official districts", () => {
    expect([...ALL_DISTRICTS].sort()).toEqual([...OFFICIAL].sort());
    expect(DISTRICT_LABELS.shevchenkivskyi).toBe("Шевченківський район");
  });

  it("assigns every place to an official district", () => {
    for (const place of PLACES) expect(OFFICIAL, place.name).toContain(place.district);
    // The places on Dmytrivska and Prorizna streets are in Shevchenkivskyi district.
    const shev = PLACES.filter((p) => p.district === "shevchenkivskyi").map((p) => p.address);
    expect(shev).toEqual(expect.arrayContaining(["вул. Дмитрівська, 39", "вул. Прорізна, 22"]));
  });

  it("maps legacy neighbourhood slugs to their district", () => {
    expect(normalizeDistrict("nyvky")).toBe("shevchenkivskyi");
    expect(normalizeDistrict("pozniaky")).toBe("darnytskyi");
    expect(normalizeDistrict("troieshchyna")).toBe("desnianskyi");
    expect(normalizeDistrict("podilskyi")).toBe("podilskyi");
    expect(normalizeDistrict("atlantis")).toBeNull();
    expect(normalizeDistrict(null)).toBeNull();
    expect(districtLabel("obolon")).toBe("Оболонський район");
  });

  it("has a map shape, a distinct colour and a centroid for every district", () => {
    const colors = new Set<string>();
    for (const d of ALL_DISTRICTS) {
      const shape = DISTRICT_SHAPES[d];
      expect(shape.path.startsWith("M"), d).toBe(true);
      expect(shape.cx).toBeGreaterThan(0);
      expect(shape.cx).toBeLessThan(KYIV_MAP_VIEWBOX.width);
      expect(shape.cy).toBeLessThan(KYIV_MAP_VIEWBOX.height);
      colors.add(shape.color);
      const c = DISTRICT_CENTROIDS[d];
      expect(c.latitude).toBeGreaterThan(50.2);
      expect(c.latitude).toBeLessThan(50.6);
    }
    expect(colors.size).toBe(ALL_DISTRICTS.length);
  });
});
