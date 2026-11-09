import { describe, expect, it } from "vitest";
import {
  KYIV_OPERATIONAL_UPDATES,
  KYIV_INFO_ITEMS,
  KYIV_UPDATES_AS_OF,
  PARTNERSHIP_OPPORTUNITIES,
} from "@/lib/data/kyivUpdates";

describe("Kyiv operational updates", () => {
  it("keeps every update dated, actionable and sourced", () => {
    expect(KYIV_UPDATES_AS_OF).toBe("2026-11-09");
    for (const update of KYIV_OPERATIONAL_UPDATES) {
      expect(update.date).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(update.area).toBeTruthy();
      expect(update.action).toBeTruthy();
      expect(update.sources.length).toBeGreaterThan(0);
      for (const source of update.sources) {
        expect(source.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("keeps the compact public information strip sourced and time-labeled", () => {
    expect(KYIV_INFO_ITEMS.length).toBeGreaterThanOrEqual(3);
    for (const item of KYIV_INFO_ITEMS) {
      expect(item.dateLabel).toBeTruthy();
      expect(item.href).toMatch(/^https:\/\//);
      expect(item.summary).toBeTruthy();
    }
  });

  it("removes finished or postponed September events from the current surface", () => {
    const currentIds = KYIV_OPERATIONAL_UPDATES.map((item) => item.id);
    const partnershipNames = PARTNERSHIP_OPPORTUNITIES.map((item) => item.name);
    expect(currentIds).not.toContain("adopt-cat-dog-postponed");
    expect(partnershipNames).not.toContain("PesDay 2026");
    expect(partnershipNames).not.toContain("Виставка котів у МВЦ");
  });

  it("keeps current partnership leads linked to direct sources", () => {
    expect(PARTNERSHIP_OPPORTUNITIES.length).toBeGreaterThanOrEqual(3);
    for (const lead of PARTNERSHIP_OPPORTUNITIES) {
      expect(lead.url).toMatch(/^https:\/\//);
    }
  });
});
