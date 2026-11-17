import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/partner-interest/route";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getPublicPlace } from "@/lib/server/placesFeed";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/server/placesFeed", () => ({ getPublicPlace: vi.fn() }));
vi.mock("@/lib/security/serverRateLimit", () => ({ clientKeyFromRequest: () => "test", createServerRateLimiter: () => async () => ({ allowed: true }) }));
const input = { requestId: "00000000-0000-4000-8000-000000000001", organization: "Тест", contactEmail: "test@example.org", locality: "Київ", requestedPlan: "pro", consent: true, status: "active", paymentStatus: "paid" };
const req = (body: unknown) => new Request("https://vetnear.test/api/partner-interest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const upsert = vi.fn();
const from = vi.fn(() => ({ upsert }));
beforeEach(() => { vi.clearAllMocks(); upsert.mockResolvedValue({ error: null }); vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as never); });

describe("partner plan intake API", () => {
  it("confirms a pending unpaid request and uses duplicate-safe insertion", async () => {
    const response = await POST(req(input));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ status: "pending_review", paymentStatus: "unpaid", planActive: false });
    expect(from).toHaveBeenCalledWith("partner_plan_requests");
    expect(upsert.mock.calls[0][0]).toMatchObject({ id: input.requestId, status: "pending_review" });
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("paymentStatus");
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "id", ignoreDuplicates: true });
  });
  it("does not claim receipt when backend is unavailable", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(null);
    const response = await POST(req(input));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("ok", true);
  });
  it("rejects missing consent before inserting", async () => {
    expect((await POST(req({ ...input, consent: false }))).status).toBe(422);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("rejects requests claiming a nonexistent profile", async () => {
    vi.mocked(getPublicPlace).mockResolvedValue(null);
    expect((await POST(req({ ...input, claimPlaceSlug: "missing-place" }))).status).toBe(422);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("records a canonical manual claim without ownership or paid rights", async () => {
    vi.mocked(getPublicPlace).mockResolvedValue({ id: "official-id", slug: "real-place", name: "Офіційна назва" } as never);
    const response = await POST(req({ ...input, claimPlaceSlug: "real-place", organization: "Введена назва", claimed: true, ownerId: "forged" }));
    expect(response.status).toBe(201);
    expect(upsert.mock.calls[0][0].message).toContain("Офіційна назва (ID: official-id; slug: real-place)");
    expect(upsert.mock.calls[0][0].message).toContain("Повноваження ще не підтверджені");
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("ownerId");
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("claimed");
  });
  it("does not silently truncate claim text or overflow the storage contract", async () => {
    vi.mocked(getPublicPlace).mockResolvedValue({ id: "official-id", slug: "real-place", name: "Офіційна назва" } as never);
    const response = await POST(req({ ...input, claimPlaceSlug: "real-place", message: "а".repeat(1500) }));
    expect(response.status).toBe(422);
    expect(upsert).not.toHaveBeenCalled();
  });
});
