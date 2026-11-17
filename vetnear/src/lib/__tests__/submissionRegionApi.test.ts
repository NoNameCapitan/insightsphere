import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/submissions/route";

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/lib/server/supabase", () => ({ getSupabaseAdmin: () => ({ from: () => ({ insert }) }) }));
vi.mock("@/lib/security/serverRateLimit", () => ({
  clientKeyFromRequest: () => "local-test",
  createServerRateLimiter: () => async () => ({ allowed: true, retryAfterSec: 0 }),
}));

const input = {
  name: "Клініка тест", category: "veterinary_clinic", region: "kyiv_oblast", locality: "Буча",
  address: "вул. Тестова, 1", phone: "+380441234567", latitude: 50.55, longitude: 30.21,
  animalTypes: ["cat"], representativeConfirmed: true, consentModeration: true,
};
const request = (body: unknown) => new Request("http://localhost/api/submissions", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => { insert.mockReset().mockResolvedValue({ error: null }); });

describe("regional submission API persistence boundary", () => {
  it("sends null for the optional SQL district and keeps locality in the source JSON", async () => {
    const response = await POST(request({ ...input, emergencyAvailable: true }));
    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({
      district: null,
      data: { region: "kyiv_oblast", locality: "Буча", countryCode: "UA", emergencyAvailable: false },
    });
    expect(insert.mock.calls[0][0].data.district).toBeUndefined();
  });

  it("rejects a missing settlement before making any database write", async () => {
    const response = await POST(request({ ...input, locality: "" }));
    expect(response.status).toBe(422);
    expect(insert).not.toHaveBeenCalled();
  });
});
