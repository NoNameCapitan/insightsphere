import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/events/analytics/route";
import { GET } from "@/app/api/admin/analytics/route";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { authenticateModerator } from "@/lib/server/moderatorAuth";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/server/moderatorAuth", () => ({ authenticateModerator: vi.fn(), requireRole: (actor: { role: string } | null) => actor?.role === "admin" }));
vi.mock("@/lib/security/serverRateLimit", () => ({ clientKeyFromRequest: () => "not-stored-ip", createServerRateLimiter: () => async () => ({ allowed: true }) }));
const input = { id: "00000000-0000-4000-8000-000000000001", sessionId: "00000000-0000-4000-8000-000000000002", name: "search_results_viewed", route: "/nearby?address=private", props: { resultCount: 0, latitude: 50, query: "secret" }, campaign: { campaign: "allowed", source: "google", term: "private" } };
const request = (body: unknown = input, origin = "https://vetnear.test") => new Request("https://vetnear.test/api/events/analytics", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
const upsert = vi.fn(); const from = vi.fn(() => ({ upsert }));
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("MEASUREMENT_ENABLED", "1"); vi.stubEnv("MEASUREMENT_CAMPAIGN_CODES", "allowed"); upsert.mockResolvedValue({ error: null }); vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as never); });
afterEach(() => vi.unstubAllEnvs());
describe("first-party measurement receipts", () => {
  it("stores only sanitized data and hashes the random session", async () => {
    const res = await POST(request()); expect(res.status).toBe(201); expect(await res.json()).toEqual({ recorded: true, id: input.id });
    expect(from).toHaveBeenCalledWith("launch_events");
    expect(upsert.mock.calls[0][0]).toEqual({ id: input.id, event_name: input.name, route_group: "/nearby", session_hash: expect.stringMatching(/^[a-f0-9]{32}$/), props: { resultCount: 0 }, campaign: { campaign: "allowed", source: "google" } });
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "id", ignoreDuplicates: true });
  });
  it("does not claim a saved event when collection is disabled", async () => {
    vi.stubEnv("MEASUREMENT_ENABLED", "0"); const res = await POST(request()); expect(res.status).toBe(202); expect(await res.json()).toMatchObject({ recorded: false }); expect(upsert).not.toHaveBeenCalled();
  });
  it("does not claim receipt without storage", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(null); const res = await POST(request()); expect(res.status).toBe(503); expect(await res.json()).toMatchObject({ recorded: false });
  });
  it("does not claim receipt after a database failure", async () => {
    upsert.mockResolvedValue({ error: { message: "db unavailable" } }); const res = await POST(request()); expect(res.status).toBe(503); expect(await res.json()).toMatchObject({ recorded: false });
  });
  it("rejects cross-origin submissions and invalid event IDs", async () => {
    expect((await POST(request(input, "https://foreign.test"))).status).toBe(403);
    expect((await POST(request({ ...input, id: "bad" }))).status).toBe(422); expect(upsert).not.toHaveBeenCalled();
  });
  it("marks reports partial when the database row cap is lower than the requested limit", async () => {
    vi.mocked(authenticateModerator).mockResolvedValue({ actorId: "x", role: "admin", label: "x" });
    const query = { select: vi.fn(), gte: vi.fn(), order: vi.fn(), limit: vi.fn().mockResolvedValue({ data: [{ event_name: "page_viewed", session_hash: "s1" }], count: 42, error: null }) };
    query.select.mockReturnValue(query); query.gte.mockReturnValue(query); query.order.mockReturnValue(query);
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from: () => query } as never);
    const res = await GET(new Request("https://vetnear.test/api/admin/analytics?days=7"));
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ truncated: true, sampleSize: 1, totalEvents: 42 });
    expect(query.select).toHaveBeenCalledWith("event_name,session_hash,props,campaign,created_at", { count: "exact" });
  });
  it("protects aggregate reports with admin authorization", async () => {
    vi.mocked(authenticateModerator).mockResolvedValue(null); expect((await GET(new Request("https://vetnear.test/api/admin/analytics"))).status).toBe(401);
    vi.mocked(authenticateModerator).mockResolvedValue({ actorId: "x", role: "moderator", label: "x" }); expect((await GET(new Request("https://vetnear.test/api/admin/analytics"))).status).toBe(401);
  });
});
