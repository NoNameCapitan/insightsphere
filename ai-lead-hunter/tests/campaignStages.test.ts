import { test } from "node:test";
import assert from "node:assert/strict";
import {
  migrateCampaigns,
  migrateStatus,
  nextActionForLead,
} from "../lib/campaignStages";
import { stepProgress, stepsForMode, buildEnvSnippet } from "../lib/onboarding";
import { makeLead } from "./_fixtures";
import type { Campaign } from "../lib/types";

test("migrates old 8 statuses into 5 stages", () => {
  assert.deepEqual(migrateStatus("new"), { status: "new" });
  assert.deepEqual(migrateStatus("verified"), { status: "verified" });
  assert.deepEqual(migrateStatus("contacted"), { status: "contact" });
  assert.deepEqual(migrateStatus("replied"), { status: "dialog" });
  assert.deepEqual(migrateStatus("interested"), { status: "dialog" });
  assert.deepEqual(migrateStatus("meeting"), { status: "dialog" });
  assert.deepEqual(migrateStatus("won"), { status: "result", outcome: "won" });
  assert.deepEqual(migrateStatus("lost"), {
    status: "result",
    outcome: "lost",
  });
});

test("migration is idempotent on already-migrated values", () => {
  for (const s of ["new", "verified", "contact", "dialog", "result"]) {
    assert.equal(migrateStatus(s).status, s);
  }
  assert.equal(migrateStatus(undefined).status, "new");
  assert.equal(migrateStatus("garbage").status, "new");
});

test("migrateCampaigns preserves leads, notes and verification", () => {
  const lead = makeLead();
  // simulate an old-format stored lead
  const stored = {
    ...lead,
    status: "meeting",
    notes: "важлива нотатка",
    verification: { phoneChecked: true, doNotContact: true },
  };
  const campaigns: Campaign[] = [
    {
      id: "c1",
      name: "Test",
      createdAt: "now",
      leads: [stored as typeof lead],
    },
  ];
  const { campaigns: out, changed } = migrateCampaigns(campaigns);
  assert.equal(changed, true);
  const ml = out[0].leads[0];
  assert.equal(ml.status, "dialog");
  assert.equal(ml.notes, "важлива нотатка");
  assert.equal(ml.verification?.phoneChecked, true);
  assert.equal(ml.verification?.doNotContact, true);
  assert.equal(out[0].leads.length, 1);
});

test("nextActionForLead gives a stage-appropriate action", () => {
  const lead = makeLead();
  assert.ok(
    nextActionForLead({ ...lead, status: "new", verification: {} }).label
      .length > 0,
  );
  assert.equal(
    nextActionForLead({ ...lead, status: "result", outcome: "won" }).label,
    "Зберегти як клієнта",
  );
  assert.equal(
    nextActionForLead({ ...lead, status: "dialog" }).label,
    "Зафіксувати результат",
  );
});

test("onboarding step flow differs for demo vs real", () => {
  assert.deepEqual(stepsForMode("demo"), ["mode", "verify"]);
  assert.deepEqual(stepsForMode("real"), [
    "mode",
    "source",
    "configure",
    "verify",
  ]);
  assert.deepEqual(stepProgress("verify", "demo"), { index: 2, total: 2 });
  assert.deepEqual(stepProgress("configure", "real"), { index: 3, total: 4 });
});

test("env snippet never contains a real key and honors maps flag", () => {
  const base = buildEnvSnippet({ withMaps: false });
  assert.ok(base.includes("GOOGLE_PLACES_API_KEY=ВАШ_КЛЮЧ_PLACES"));
  assert.ok(base.includes("NEXT_PUBLIC_DEMO_MODE=false"));
  assert.ok(!base.includes("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY"));
  assert.ok(
    buildEnvSnippet({ withMaps: true }).includes(
      "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY",
    ),
  );
});
