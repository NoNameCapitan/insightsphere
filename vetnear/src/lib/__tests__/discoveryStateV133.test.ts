import { describe, expect, it } from "vitest";
import { discoveryCount, discoveryFilters, discoveryUrl, safeDiscoveryReturn } from "@/components/discoveryState";
import { DEFAULT_FILTERS } from "@/lib/geo/ranking";

describe("discovery navigation context", () => {
  it("restores the complete meaningful search, without a pet identity or precise origin", () => {
    const filters = { ...DEFAULT_FILTERS, category: "veterinary_clinic" as const, animal: "cat" as const, region: "kyiv_oblast" as const, locality: "Біла Церква", radius: 50000 as const, verified: true, openNow: true, urgentIntent: true, sort: "verified" as const };
    const url = discoveryUrl(filters, "Генезис", 24);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(discoveryFilters(params)).toEqual(filters);
    expect(discoveryCount(params)).toBe(24);
    expect(params.get("q")).toBe("Генезис");
    expect(url).not.toMatch(/latitude|longitude|petId/);
  });
  it("bounds paging values and rejects untrusted return destinations", () => {
    for (const shown of ["-1", "999999", "12.5", "NaN"]) expect(discoveryCount(new URLSearchParams({ shown }))).toBe(12);
    expect(safeDiscoveryReturn({ path: "/nearby?category=grooming", scroll: 720 })).toBe(true);
    for (const path of ["//evil.test", "https://evil.test", "/nearby/evil", "/partner", "javascript:alert(1)"]) expect(safeDiscoveryReturn({ path, scroll: 1 })).toBe(false);
    expect(safeDiscoveryReturn({ path: "/nearby", scroll: NaN })).toBe(false);
  });
});
