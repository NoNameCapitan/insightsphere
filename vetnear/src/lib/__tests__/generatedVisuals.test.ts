import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const files = [
  "a-visual-system.webp",
  "b-icon-system.webp",
  "c-home-hero.webp",
  "d-my-pets.webp",
  "e-medical-record.webp",
  "f-add-record.webp",
  "g-nearby-map.webp",
  "h-place-detail.webp",
  "i-motion-layer.webp",
  "j-empty-state.webp",
];

describe("generated A–J visual assets", () => {
  it("ships every generated visual as a non-empty project asset", () => {
    for (const file of files) {
      const target = path.join(process.cwd(), "public", "visuals", file);
      expect(fs.existsSync(target), file).toBe(true);
      expect(fs.statSync(target).size, file).toBeGreaterThan(20_000);
    }
  });

  it("keeps the generated visual component reduced-motion aware", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".generated-visual__image");
  });

  it("ships the sliced icon and motion parts used for per-element animation", () => {
    const parts = [
      ...["clinic", "pharmacy", "boarding", "grooming", "emergency", "shield", "location", "phone", "route", "verified"].map((n) => `icon-${n}.webp`),
      ...["ring", "arrow", "check", "sparkle", "halo"].map((n) => `motion-${n}.webp`),
    ];
    for (const file of parts) {
      const target = path.join(process.cwd(), "public", "visuals", "parts", file);
      expect(fs.existsSync(target), file).toBe(true);
    }
  });

  it("disables every new motion layer under reduced motion", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    for (const selector of [".generated-visual__shine", ".generated-visual__glow", ".motion-piece", ".icon-tile"]) {
      expect(reduced, selector).toContain(selector);
    }
  });
});
