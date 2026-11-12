import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let identity: { actorId: string; role: "admin" | "moderator"; label: string } | null = null;
vi.mock("@/lib/server/moderatorAuth", () => ({
  authenticateModerator: async () => identity,
  requireRole: (who: { role: string } | null, role: string) => Boolean(who) && (role === "moderator" || who!.role === "admin"),
}));

const writes: { table: string; op: string; payload: Record<string, unknown>; id?: string }[] = [];
let existing: { id: string; tier: string } | null = { id: "place-1", tier: "free" };
vi.mock("@/lib/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
      update: (payload: Record<string, unknown>) => ({ eq: async (_c: string, id: string) => { writes.push({ table, op: "update", payload, id }); return { error: null }; } }),
      insert: async (payload: Record<string, unknown>) => { writes.push({ table, op: "insert", payload }); return { error: null }; },
    }),
  }),
}));

const post = (body: unknown) =>
  new Request("https://vetnear.example/api/admin/places/tier", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("POST /api/admin/places/tier", () => {
  beforeEach(() => {
    writes.length = 0;
    identity = { actorId: "mod-admin", role: "admin", label: "Owner" };
    existing = { id: "place-1", tier: "free" };
  });

  it("is closed to guests and to plain moderators", async () => {
    const { POST } = await import("@/app/api/admin/places/tier/route");
    identity = null;
    expect((await POST(post({ placeId: "place-1", tier: "verified" }))).status).toBe(401);
    identity = { actorId: "mod-1", role: "moderator", label: "Mod" };
    expect((await POST(post({ placeId: "place-1", tier: "verified" }))).status).toBe(401);
    expect(writes).toHaveLength(0);
  });

  it("lets an admin set free / verified / promoted and records each change", async () => {
    const { POST } = await import("@/app/api/admin/places/tier/route");
    for (const body of [{ tier: "verified" }, { tier: "promoted", promotedDays: 30 }, { tier: "free" }]) {
      const res = await POST(post({ placeId: "place-1", ...body }));
      expect(res.status, body.tier).toBe(200);
      expect(((await res.json()) as { historyRecorded: boolean }).historyRecorded).toBe(true);
    }
    const updates = writes.filter((w) => w.table === "published_places");
    expect(updates.map((w) => w.payload.tier)).toEqual(["verified", "promoted", "free"]);
    expect(updates[0].payload).toMatchObject({ subscription_status: "active", billing_provider: "manual", promoted_until: null });
    expect(typeof updates[1].payload.promoted_until).toBe("string");
    expect(updates[2].payload).toMatchObject({ subscription_status: "none", billing_provider: null, promoted_until: null });
    const history = writes.filter((w) => w.table === "place_tier_events");
    expect(history).toHaveLength(3);
    expect(history[0].payload).toMatchObject({ place_id: "place-1", from_tier: "free", to_tier: "verified", actor_id: "mod-admin" });
  });

  it("refuses an open-ended promotion and an unknown place", async () => {
    const { POST } = await import("@/app/api/admin/places/tier/route");
    expect((await POST(post({ placeId: "place-1", tier: "promoted" }))).status).toBe(422);
    expect((await POST(post({ placeId: "", tier: "verified" }))).status).toBe(422);
    existing = null;
    expect((await POST(post({ placeId: "ghost", tier: "verified" }))).status).toBe(404);
    expect(writes).toHaveLength(0);
  });
});
