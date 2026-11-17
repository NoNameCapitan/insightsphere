import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/events/lead/route";
import { getSupabaseAdmin } from "@/lib/server/supabase";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/security/serverRateLimit", () => ({ clientKeyFromRequest: () => "private-ip", createServerRateLimiter: () => async () => ({ allowed: true }) }));
const insert = vi.fn();
const request = () => new Request("https://vetnear.test/api/events/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ placeId: "clinic-1", eventType: "call", sourcePath: "/nearby?address=private" }) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("MEASUREMENT_ENABLED", "1"); insert.mockResolvedValue({ error: null }); vi.mocked(getSupabaseAdmin).mockReturnValue({ from: () => ({ insert }) } as never); });
afterEach(() => vi.unstubAllEnvs());
describe("contact events are not phantom receipts", () => {
  it("states disabled collection explicitly", async () => { vi.stubEnv("MEASUREMENT_ENABLED", "0"); const r = await POST(request()); expect(r.status).toBe(202); expect(await r.json()).toMatchObject({ recorded: false }); expect(insert).not.toHaveBeenCalled(); });
  it("does not accept and drop when storage is missing", async () => { vi.mocked(getSupabaseAdmin).mockReturnValue(null); const r = await POST(request()); expect(r.status).toBe(503); expect(await r.json()).toMatchObject({ recorded: false }); });
  it("acknowledges only a stored intent with sanitized path", async () => { const r = await POST(request()); expect(r.status).toBe(201); expect(await r.json()).toEqual({ recorded: true }); expect(insert.mock.calls[0][0]).toMatchObject({ source_path: "/nearby", session_hash: expect.stringMatching(/^[a-f0-9]{32}$/) }); expect(JSON.stringify(insert.mock.calls)).not.toContain("private-ip"); });
  it("accepts the known uniqueness duplicate but refuses other storage errors", async () => { insert.mockResolvedValue({ error: { code: "23505", message: "localized" } }); expect((await POST(request())).status).toBe(201); insert.mockResolvedValue({ error: { code: "XX000", message: "not a uniqueness conflict" } }); expect((await POST(request())).status).toBe(500); });
});
