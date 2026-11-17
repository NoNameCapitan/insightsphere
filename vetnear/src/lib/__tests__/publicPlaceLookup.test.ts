import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLACES } from "@/lib/data/places";
import { makePlace } from "./fixtures";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase", () => ({ getSupabaseAdmin }));

import { getPublicPlace } from "@/lib/server/placesFeed";

function databaseRows(rows: { id: string; data: unknown; tier: string; promoted_until: null }[]) {
  const limit = vi.fn(async () => ({ data: rows, error: null }));
  const eq = vi.fn(() => ({ order: () => ({ limit }) }));
  getSupabaseAdmin.mockReturnValue({ from: () => ({ select: () => ({ eq }) }) });
  return { eq };
}

beforeEach(() => getSupabaseAdmin.mockReset());

describe("public place detail lookup", () => {
  it("resolves a newly published provider by slug and id, even when it is absent from the seed", async () => {
    const place = makePlace({ id: "published-only-1", slug: "new-published-clinic", name: "Нова клініка" });
    expect(PLACES.some((seed) => seed.id === place.id)).toBe(false);
    const { eq } = databaseRows([{ id: place.id, data: place, tier: "verified", promoted_until: null }]);
    expect(await getPublicPlace(place.slug)).toMatchObject({ id: place.id, name: place.name, tier: "verified" });
    expect(await getPublicPlace(place.id)).toMatchObject({ slug: place.slug });
    expect(eq).toHaveBeenCalledWith("status", "published");
  });

  it("uses the published update instead of stale bundled data", async () => {
    const seed = PLACES[0];
    const changed = { ...seed, name: "Оновлена назва", phone: "+380441112233" };
    databaseRows([{ id: changed.id, data: changed, tier: "free", promoted_until: null }]);
    expect(await getPublicPlace(seed.slug)).toMatchObject({ name: changed.name, phone: changed.phone });
  });

  it("retains seed detail pages when the backend is not configured", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    expect(await getPublicPlace(PLACES[0].slug)).toMatchObject({ id: PLACES[0].id });
    expect(await getPublicPlace("unknown-place-that-does-not-exist")).toBeNull();
  });

  it("does not expose non-approved payloads through a direct profile URL", async () => {
    const place = makePlace({ id: "suspended-provider", slug: "suspended-provider", status: "suspended" });
    databaseRows([{ id: place.id, data: place, tier: "free", promoted_until: null }]);
    expect(await getPublicPlace(place.slug)).toBeNull();
  });
});
