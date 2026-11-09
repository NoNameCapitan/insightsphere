import { describe, expect, it } from "vitest";
import {
  categoryMap,
  isWithinCityBounds,
  urgentCategories,
} from "@/config/vertical";
import { DENTAL_CARE_LVIV } from "@/config/verticals/dental-care-lviv.example";
import { PET_CARE_KYIV, VERTICAL } from "@/config/verticals/pet-care-kyiv";
import { PLACES } from "@/lib/data/places";
import {
  CATEGORY_COLOR,
  CATEGORY_EMOJI,
  CATEGORY_LABELS,
  DISTRICT_LABELS,
} from "@/lib/labels";
import { schemaTypeFor } from "@/lib/seo";
import type { PlaceCategory } from "@/lib/types";

describe("active vertical", () => {
  it("ships the pet-care Kyiv config", () => {
    expect(VERTICAL.id).toBe("pet-care-kyiv");
    expect(VERTICAL).toBe(PET_CARE_KYIV);
  });

  it("declares every category exactly once", () => {
    const ids = VERTICAL.categories.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every category used by the seed dataset", () => {
    const declared = new Set(VERTICAL.categories.map((c) => c.id));
    for (const place of PLACES) {
      expect(declared.has(place.category)).toBe(true);
    }
  });

  it("covers every district used by the seed dataset", () => {
    for (const place of PLACES) {
      expect(DISTRICT_LABELS[place.district]).toBeTruthy();
    }
  });

  it("gives every category a non-empty label, emoji and colour", () => {
    for (const c of VERTICAL.categories) {
      expect(c.label.trim().length).toBeGreaterThan(0);
      expect(c.emoji.trim().length).toBeGreaterThan(0);
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.schemaType.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps SEO slugs unique", () => {
    const slugs = VERTICAL.categories
      .map((c) => c.seoSlug)
      .filter((s): s is string => Boolean(s));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("derived taxonomy stays in sync with the config", () => {
  it("labels, emoji and colours all come from the config", () => {
    for (const c of VERTICAL.categories) {
      expect(CATEGORY_LABELS[c.id]).toBe(c.label);
      expect(CATEGORY_EMOJI[c.id]).toBe(c.emoji);
      expect(CATEGORY_COLOR[c.id]).toBe(c.color);
    }
  });

  it("exposes no category the config does not declare", () => {
    const declared = new Set<string>(VERTICAL.categories.map((c) => c.id));
    for (const key of Object.keys(CATEGORY_LABELS)) {
      expect(declared.has(key)).toBe(true);
    }
  });

  it("resolves schema.org types from the config", () => {
    expect(schemaTypeFor("veterinary_clinic")).toBe("VeterinaryCare");
    expect(schemaTypeFor("pet_store")).toBe("PetStore");
    expect(schemaTypeFor("vet_pharmacy")).toBe("Pharmacy");
    expect(schemaTypeFor("dog_walking")).toBe("LocalBusiness");
  });

  it("falls back safely for an unknown category", () => {
    expect(schemaTypeFor("not_a_category" as PlaceCategory)).toBe("LocalBusiness");
  });
});

describe("urgency policy", () => {
  it("marks the emergency category as urgent", () => {
    expect(urgentCategories(VERTICAL)).toContain("emergency_vet");
  });

  it("requires human confirmation before publishing urgent availability", () => {
    // This flag is what lib/places/publish.ts enforces. Flipping it to false
    // would let partner-claimed 24/7 reach users unverified.
    expect(VERTICAL.urgency.requiresHumanConfirmation).toBe(true);
    expect(VERTICAL.urgency.deterministicTriage).toBe(true);
  });

  it("never lets paid promotion apply to urgent results", () => {
    expect(VERTICAL.monetization.promotionDisabledWhenUrgent).toBe(true);
  });
});

describe("city bounds", () => {
  it("accepts a Kyiv coordinate", () => {
    expect(isWithinCityBounds(VERTICAL, 50.45, 30.52)).toBe(true);
  });

  it("rejects coordinates from another city, NaN and swapped pairs", () => {
    expect(isWithinCityBounds(VERTICAL, 49.84, 24.03)).toBe(false);
    expect(isWithinCityBounds(VERTICAL, Number.NaN, 30.5)).toBe(false);
    expect(isWithinCityBounds(VERTICAL, 30.52, 50.45)).toBe(false);
  });
});

describe("the config type is not pet-specific", () => {
  // The example vertical exists so this stays true: if the platform ever
  // hardcodes a pet assumption into VerticalConfig, this block breaks.
  it("supports a different domain, city and category union", () => {
    expect(DENTAL_CARE_LVIV.id).toBe("dental-care-lviv");
    expect(DENTAL_CARE_LVIV.city.name).toBe("Львів");
    expect(urgentCategories(DENTAL_CARE_LVIV)).toEqual(["emergency_dental"]);
  });

  it("builds a label map for its own categories", () => {
    const labels = categoryMap(DENTAL_CARE_LVIV, (c) => c.label);
    expect(labels.dental_clinic).toBe("Стоматологія");
    expect(Object.keys(labels)).toHaveLength(DENTAL_CARE_LVIV.categories.length);
  });

  it("applies its own city bounds, not Kyiv's", () => {
    expect(isWithinCityBounds(DENTAL_CARE_LVIV, 49.84, 24.03)).toBe(true);
    expect(isWithinCityBounds(DENTAL_CARE_LVIV, 50.45, 30.52)).toBe(false);
  });

  it("carries its own promotion ceiling", () => {
    expect(DENTAL_CARE_LVIV.monetization.maxPromotionDays).toBe(180);
    expect(VERTICAL.monetization.maxPromotionDays).toBe(365);
  });
});
