import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOutputs, mapColor } from "../../../scripts/gen-dark-theme.mjs";

const hexLightness = (hex: string | null) => {
  if (!hex) throw new Error("expected a mapped colour");
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};

describe("dark theme generator", () => {
  it("turns dark ink into light ink and leaves light text alone", () => {
    const mapped = mapColor("#123a34", "text");
    expect(mapped).toMatch(/^#[0-9a-f]{6}$/);
    expect(hexLightness(mapped)).toBeGreaterThan(0.75);
    expect(mapColor("#fff7e5", "text")).toBeNull();
  });

  it("turns light surfaces into night surfaces and keeps dark or vivid fills", () => {
    expect(hexLightness(mapColor("#ffffff", "fill"))).toBeLessThan(0.15);
    expect(mapColor("#d9274c", "fill")).toBeNull(); // emergency coral
    expect(mapColor("#5a3a2a", "fill")).toBeNull(); // a dark warm fill stays
  });

  it("warms deep pine into evening olive-pine at the same depth", () => {
    const pine = mapColor("#0d352e", "fill"); // the hero green
    const [r, g, b] = [1, 3, 5].map((i) => parseInt((pine ?? "").slice(i, i + 2), 16));
    expect(pine).toMatch(/^#[0-9a-f]{6}$/);
    expect(b).toBeLessThan(g); // less cyan: blue drops below green
    expect(r).toBeGreaterThan(0x0d); // a little warmer
    expect(Math.abs(hexLightness(pine) - hexLightness("#0d352e"))).toBeLessThan(0.03);
  });

  it("keeps the alpha of translucent colours", () => {
    expect(mapColor("rgb(18 58 52 / 0.5)", "text")).toMatch(/^#[0-9a-f]{8}$/);
  });

  it("generated overrides are up to date with the light stylesheets", () => {
    const stale: string[] = [];
    for (const [file, content] of buildOutputs() as Map<string, string>) {
      if (readFileSync(path.resolve(process.cwd(), file), "utf8") !== content) stale.push(file);
    }
    expect(stale, "run `npm run theme:dark`").toEqual([]);
  });

  it("never darkens print or the page canvas", () => {
    const css = readFileSync(path.resolve(process.cwd(), "src/app/theme-dark.generated.css"), "utf8");
    expect(css).not.toMatch(/@media\s+print/);
    expect(css).not.toMatch(/html\[data-theme="dark"\] body\s*\{/);
  });
});
