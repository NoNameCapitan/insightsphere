import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("billing provider seam", () => {
  it("defaults to the manual provider, which never produces a paid event", async () => {
    const { getBillingProvider } = await import("@/lib/server/billing/provider");
    const provider = getBillingProvider();
    expect(provider.id).toBe("manual");
    expect(await provider.verifyWebhook(new Request("https://x", { method: "POST" }), "{}")).toBeNull();
    const checkout = await provider.createCheckout({ placeId: "p", plan: { code: "verified_1m", tier: "verified", months: 1, label: "", listPriceUah: 449 }, amountUah: 449, returnUrl: "https://x" });
    expect(checkout.kind).toBe("manual");
  });

  it("round-trips order ids and rejects foreign ones", async () => {
    const { buildOrderId, parseOrderId } = await import("@/lib/server/billing/provider");
    const id = buildOrderId("masterzoo-podil-26", "verified_3m", "a1b2c3d4");
    expect(parseOrderId(id)).toEqual({ placeId: "masterzoo-podil-26", planCode: "verified_3m" });
    expect(parseOrderId("order-123")).toBeNull();
    expect(parseOrderId("vn.place.verified_3m.x")).toBeNull();
  });

  it("keeps money away from emergency trust", () => {
    const sql = read("supabase/migrations/007_prepaid_billing.sql");
    // comments aside, the billing SQL never mentions emergency or 24/7 fields
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/emergency|open_?24|isOpen24_7/i);
    for (const file of ["src/lib/server/billing/service.ts", "src/app/api/billing/webhook/route.ts", "src/app/api/admin/billing/activate/route.ts"]) {
      expect(read(file), file).not.toMatch(/emergencyAvailable|isOpen24_7/);
    }
    // the ranking rule that disables paid boost in urgent searches is still in place
    expect(read("src/config/verticals/pet-care-kyiv.ts")).toContain("promotionDisabledWhenUrgent: true");
    expect(read("src/app/for-partners/page.tsx")).toContain("У термінових запитах платне просування не працює");
  });

  it("migration 007 locks payments down and schedules the nightly expiry", () => {
    const sql = read("supabase/migrations/007_prepaid_billing.sql");
    expect(sql).toContain("alter table billing_payments enable row level security");
    expect(sql).toContain("revoke all on table billing_payments from public, anon, authenticated");
    expect(sql).toContain("before update or delete on billing_payments");
    expect(sql).toContain("on billing_payments (provider, provider_payment_id) where provider_payment_id is not null");
    expect(sql).toMatch(/revoke all on function billing_activate_plan\([^)]*\)\s+from public, anon, authenticated/);
    expect(sql).toContain("revoke all on function billing_expire_plans() from public, anon, authenticated");
    expect(sql).toContain("'expire-prepaid-plans'");
    expect(sql).not.toMatch(/create policy/i);
  });
});
