import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("places dataset", () => {
  it("is exactly what scripts/build-verified-places.mjs generates", () => {
    // Fails after a hand edit of places.ts: the change must live in the script,
    // otherwise the next regeneration silently reverts it.
    const output = execFileSync("node", ["scripts/build-verified-places.mjs", "--check"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("in sync");
  });
});
