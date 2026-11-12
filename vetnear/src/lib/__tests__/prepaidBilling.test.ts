import { beforeEach, describe, expect, it, vi } from "vitest";
import { BILLING_PLANS, getBillingPlan, validateActivation } from "@/lib/billing/plans";

vi.mock("server-only", () => ({}));

let identity: { actorId: string; role: "admin" | "moderator"; label: string } | null = null;
vi.mock("@/lib/server/moderatorAuth", () => ({
  authenticateModerator: async () => identity,
  requireRole: (who: { role: string } | null, role: string) => Boolean(who) && (role === "moderator" || who!.role === "admin"),
}));

// A stand-in for the two database functions, with the same contract as
// supabase/migrations/007 (idempotent by provider payment id).
const rpcCalls: { fn: string; args?: Record<string, unknown> }[] = [];
const recorded = new Map<string, { paymentId: string; periodEnd: string }>();
let lapsed = 2;
vi.mock("@/lib/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === "billing_expire_plans") { const n = lapsed; lapsed = 0; return { data: { expired: n }, error: null }; }
      if (args!.p_place_id === "ghost") return { data: { ok: false, error: "place_not_found" }, error: null };
      const key = args!.p_provider_payment_id ? `${args!.p_provider}:${args!.p_provider_payment_id}` : null;
      if (key && recorded.has(key)) return { data: { ok: true, duplicate: true, ...recorded.get(key), placeId: args!.p_place_id, tier: args!.p_tier }, error: null };
      const row = { paymentId: `pay_${recorded.size + 1}`, periodEnd: "2026-12-12T10:00:00Z" };
      if (key) recorded.set(key, row);
      return { data: { ok: true, duplicate: false, ...row, placeId: args!.p_place_id, tier: args!.p_tier }, error: null };
    },
  }),
}));

let provider: { id: string; verifyWebhook: (req: Request, raw: string) => Promise<unknown> } = { id: "manual", verifyWebhook: async () => null };
vi.mock("@/lib/server/billing/provider", () => ({ getBillingProvider: () => provider }));

const json = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("prepaid billing", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    recorded.clear();
    lapsed = 2;
    identity = { actorId: "mod-admin", role: "admin", label: "Owner" };
    provider = { id: "manual", verifyWebhook: async () => null };
  });

  it("has a small, explicit plan catalogue", () => {
    expect(BILLING_PLANS.map((p) => p.code)).toEqual(["verified_1m", "verified_3m", "verified_6m", "verified_12m", "promoted_1m", "promoted_3m"]);
    expect(getBillingPlan("verified_3m")).toMatchObject({ tier: "verified", months: 3, listPriceUah: 1347 });
    expect(getBillingPlan("promoted_1m")?.listPriceUah).toBeNull();
    expect(getBillingPlan("free")).toBeNull();
    expect(BILLING_PLANS.every((p) => p.months >= 1 && p.months <= 12)).toBe(true);
  });

  it("requires an explicit amount and a known plan to record a payment", () => {
    expect(validateActivation({ placeId: "p1", planCode: "verified_1m", amountUah: "449,00", paymentRef: " INV-1 " })).toMatchObject({
      ok: true,
      value: { placeId: "p1", amountUah: 449, paymentRef: "INV-1", note: null },
    });
    expect(validateActivation({ placeId: "p1", planCode: "verified_1m" }).ok).toBe(false);
    expect(validateActivation({ placeId: "p1", planCode: "verified_1m", amountUah: -5 }).ok).toBe(false);
    expect(validateActivation({ placeId: "p1", planCode: "gold_forever", amountUah: 1 }).ok).toBe(false);
    expect(validateActivation({ placeId: "", planCode: "verified_1m", amountUah: 1 }).ok).toBe(false);
  });

  it("lets only an admin mark a prepayment as received", async () => {
    const { POST } = await import("@/app/api/admin/billing/activate/route");
    const body = { placeId: "place-1", planCode: "verified_1m", amountUah: 449, paymentRef: "INV-1" };
    identity = null;
    expect((await POST(json("https://x/api/admin/billing/activate", body))).status).toBe(401);
    identity = { actorId: "mod-1", role: "moderator", label: "Mod" };
    expect((await POST(json("https://x/api/admin/billing/activate", body))).status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });

  it("activates a plan through one atomic database call with the actor recorded", async () => {
    const { POST } = await import("@/app/api/admin/billing/activate/route");
    const res = await POST(json("https://x/api/admin/billing/activate", { placeId: "place-1", planCode: "promoted_1m", amountUah: 900, paymentRef: "INV-7", note: "рахунок 7" }));
    expect(res.status).toBe(200);
    expect(rpcCalls).toEqual([
      {
        fn: "billing_activate_plan",
        args: {
          p_place_id: "place-1", p_plan_code: "promoted_1m", p_tier: "promoted", p_months: 1, p_amount_uah: 900,
          p_provider: "manual", p_provider_payment_id: "INV-7", p_actor_id: "mod-admin", p_note: "рахунок 7", p_max_promotion_days: 365,
        },
      },
    ]);
    expect(await res.json()).toMatchObject({ ok: true, duplicate: false, tier: "promoted" });
  });

  it("does not count the same payment twice and reports unknown places", async () => {
    const { POST } = await import("@/app/api/admin/billing/activate/route");
    const body = { placeId: "place-1", planCode: "verified_1m", amountUah: 449, paymentRef: "INV-1" };
    expect(await (await POST(json("https://x", body))).json()).toMatchObject({ duplicate: false });
    expect(await (await POST(json("https://x", body))).json()).toMatchObject({ duplicate: true });
    expect(recorded.size).toBe(1);
    const ghost = await POST(json("https://x", { ...body, placeId: "ghost", paymentRef: "INV-2" }));
    expect(ghost.status).toBe(404);
    expect((await POST(json("https://x", { placeId: "place-1", planCode: "verified_1m" }))).status).toBe(422);
  });

  it("expires lapsed plans on demand (admin only)", async () => {
    const { POST } = await import("@/app/api/admin/billing/expire/route");
    const req = () => new Request("https://x/api/admin/billing/expire", { method: "POST" });
    expect(await (await POST(req())).json()).toEqual({ ok: true, expired: 2 });
    expect(await (await POST(req())).json()).toEqual({ ok: true, expired: 0 });
    identity = null;
    expect((await POST(req())).status).toBe(401);
  });

  it("webhook is closed while no provider is connected", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    const res = await POST(json("https://x/api/billing/webhook", { placeId: "place-1", planCode: "verified_1m", amountUah: 449, providerPaymentId: "x" }));
    expect(res.status).toBe(501);
    expect(rpcCalls).toHaveLength(0);
  });

  it("webhook activates only on a verified signature, exactly once per payment", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    const paid = { providerPaymentId: "lp-1001", placeId: "place-1", planCode: "verified_1m", amountUah: 449 };
    provider = { id: "liqpay", verifyWebhook: async (req) => (req.headers.get("x-signature") === "good" ? paid : null) };

    expect((await POST(json("https://x/api/billing/webhook", {}, { "x-signature": "forged" }))).status).toBe(401);
    expect(rpcCalls).toHaveLength(0);

    const first = await POST(json("https://x/api/billing/webhook", {}, { "x-signature": "good" }));
    expect(await first.json()).toEqual({ ok: true, duplicate: false });
    const again = await POST(json("https://x/api/billing/webhook", {}, { "x-signature": "good" }));
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    expect(recorded.size).toBe(1);
    expect(rpcCalls[0].args).toMatchObject({ p_provider: "liqpay", p_provider_payment_id: "lp-1001", p_actor_id: "webhook:liqpay" });
  });

  it("webhook refuses underpayment and unknown plans", async () => {
    const { POST } = await import("@/app/api/billing/webhook/route");
    provider = { id: "liqpay", verifyWebhook: async () => ({ providerPaymentId: "lp-1", placeId: "place-1", planCode: "verified_12m", amountUah: 449 }) };
    expect((await POST(json("https://x", {}))).status).toBe(422);
    provider = { id: "liqpay", verifyWebhook: async () => ({ providerPaymentId: "lp-2", placeId: "place-1", planCode: "platinum", amountUah: 9999 }) };
    expect((await POST(json("https://x", {}))).status).toBe(422);
    provider = { id: "liqpay", verifyWebhook: async () => { throw new Error("boom"); } };
    expect((await POST(json("https://x", {}))).status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });
});
