import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IconMaterialDefs, ServiceIcon } from "@/components/icons/ServiceIcons";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { PlaceCategory } from "@/lib/types";

const categories = Object.keys(CATEGORY_LABELS) as PlaceCategory[];
const render = (category: PlaceCategory) => renderToStaticMarkup(createElement(ServiceIcon, { category, className: "h-8 w-8" }));

describe("category icons — objects from the warm room (v1.40)", () => {
  it.each(categories)("%s is decorative and built from the shared material layers", (category) => {
    const svg = render(category);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).toContain("svc-icon__body");
    expect(svg).toContain("svc-icon__contact");
    // Objects, not UI symbols: no outline stroke on the body.
    expect(svg).not.toMatch(/svc-icon__body"[^>]*stroke/);
    expect(svg).toContain("h-8 w-8");
    // Colours come from tokens only: no hard-coded fills or strokes inside the icon.
    expect(svg).not.toMatch(/(fill|stroke)="#/);
  });

  it("reserves the coral accent for the emergency category only", () => {
    for (const category of categories) {
      expect(render(category).includes("svc-icon--urgent")).toBe(category === "emergency_vet");
    }
  });

  it("gives the main categories their own silhouette", () => {
    const main: PlaceCategory[] = ["veterinary_clinic", "emergency_vet", "vet_pharmacy", "pet_store", "grooming", "pet_boarding", "shelter"];
    expect(new Set(main.map(render)).size).toBe(main.length);
  });

  it("defines the shared gradients once, hidden from assistive tech", () => {
    const defs = renderToStaticMarkup(createElement(IconMaterialDefs));
    for (const id of ["vn-obj-body", "vn-obj-detail", "vn-obj-urgent", "vn-obj-contact"]) expect(defs).toContain(`id="${id}"`);
    expect(defs).toContain('aria-hidden="true"');
    expect(defs).toContain("var(--obj-hi)");
  });
});
