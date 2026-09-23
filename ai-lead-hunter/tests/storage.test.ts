import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCampaign,
  getCampaigns,
  addLeadsToCampaign,
  updateLeadNotes,
  updateLeadFollowUp,
  importCampaigns,
  replaceCampaigns,
} from "../lib/campaignStorage";
import { makeLead } from "./_fixtures";
test("campaign storage: dedupe, merge, quota errors and corrupt-data preservation", () => {
  const memory = new Map<string, string>();
  let fail = false;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (k: string) => memory.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (fail) throw Error("quota");
          memory.set(k, v);
        },
      },
      dispatchEvent: () => true,
    },
  });
  try {
    const c = createCampaign("Кампанія");
    const l = makeLead();
    assert.equal(addLeadsToCampaign(c.id, [l, l]).added, 1);
    assert.equal(getCampaigns()[0].leads.length, 1);
    updateLeadNotes(c.id, l.id, "Поточні нотатки");
    updateLeadFollowUp(c.id, l.id, "2026-10-01");
    assert.equal(getCampaigns()[0].leads[0].followUpAt, "2026-10-01");
    importCampaigns([{ ...c, leads: [{ ...l, notes: "Старі нотатки" }] }]);
    assert.equal(getCampaigns()[0].leads[0].notes, "Поточні нотатки");
    assert.equal(getCampaigns()[0].leads[0].followUpAt, "2026-10-01");
    fail = true;
    assert.throws(() => createCampaign("Не збереглось"), /Не збережено/);
    fail = false;
    assert.equal(getCampaigns().length, 1);
    memory.set("alh_campaigns_v1", "{corrupt");
    assert.throws(() => createCampaign("Не стираємо"), /не перезаписано/);
    assert.equal(memory.get("alh_campaigns_v1"), "{corrupt");
    replaceCampaigns([c]);
    assert.equal(getCampaigns().length, 1);
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});
