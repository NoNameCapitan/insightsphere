import { test } from "node:test";
import assert from "node:assert/strict";
import { leadsToCsv } from "../lib/csv";
import { makeLead } from "./_fixtures";

test("CSV starts with a UTF-8 BOM for Excel", () => {
  const csv = leadsToCsv([makeLead()]);
  assert.ok(csv.startsWith("\uFEFF"));
});

test("CSV header includes key columns", () => {
  const csv = leadsToCsv([makeLead()]);
  const header = csv.replace(/^\uFEFF/, "").split("\n")[0];
  assert.ok(header.includes("name"));
  assert.ok(header.includes("leadScore"));
});

test("CSV contains a row with the lead name and score", () => {
  const lead = makeLead({ name: "Салон Тест" });
  const csv = leadsToCsv([lead]);
  assert.ok(csv.includes("Салон Тест"));
  assert.ok(csv.includes(String(lead.score.total)));
});

test("CSV escapes commas and quotes", () => {
  const csv = leadsToCsv([makeLead({ name: 'A, "B"' })]);
  // A field containing a comma/quote must be wrapped in double quotes,
  // and inner quotes doubled.
  assert.ok(csv.includes('"A, ""B"""'));
});

test("empty input still yields a header line", () => {
  const csv = leadsToCsv([]);
  const lines = csv.replace(/^\uFEFF/, "").split("\n");
  assert.ok(lines[0].includes("name"));
  assert.equal(lines.length, 1);
});
