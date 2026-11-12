import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// A tiny stand-in for supabase-js: records which key/JWT each client was
// created with and what it was asked to write.
const calls: { key: string; authorization?: string; table?: string; op?: string; payload?: unknown; filter?: unknown }[] = [];
const USERS: Record<string, { id: string; email: string }> = { "token-alice": { id: "user-alice", email: "alice@example.com" } };
let refreshOk = false;

vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, key: string, options?: { global?: { headers?: Record<string, string> } }) => {
    const authorization = options?.global?.headers?.Authorization;
    const table = (name: string) => ({
      select: () => ({ order: () => ({ limit: async () => { calls.push({ key, authorization, table: name, op: "select" }); return { data: [], error: null }; } }) }),
      upsert: (payload: Record<string, unknown>) => ({
        select: () => ({ single: async () => { calls.push({ key, authorization, table: name, op: "upsert", payload }); return { data: { ...payload, created_at: "2026-11-12T10:00:00Z", updated_at: "2026-11-12T10:00:00Z" }, error: null }; } }),
      }),
      delete: () => ({ eq: async (_c: string, id: string) => { calls.push({ key, authorization, table: name, op: "delete", filter: id }); return { error: null }; } }),
    });
    return {
      from: table,
      auth: {
        getUser: async (token: string) => (USERS[token] ? { data: { user: USERS[token] }, error: null } : { data: { user: null }, error: { message: "bad jwt" } }),
        refreshSession: async () =>
          refreshOk
            ? { data: { session: { access_token: "token-alice", refresh_token: "r2", expires_in: 3600 }, user: USERS["token-alice"] }, error: null }
            : { data: { session: null, user: null }, error: { message: "expired" } },
        admin: { deleteUser: async (id: string) => { calls.push({ key, op: "deleteUser", filter: id }); return { error: null }; }, signOut: async () => ({ error: null }) },
      },
    };
  },
}));

const SAME = { "sec-fetch-site": "same-origin", "content-type": "application/json" };
const pet = { name: "Барні", animalType: "dog", ownerId: "user-mallory" };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const put = (headers: Record<string, string>, body: unknown = { pet }) =>
  new Request("https://vetnear.example/api/pets/pet-abc-12345", { method: "PUT", headers, body: JSON.stringify(body) });

describe("account API routes", () => {
  beforeEach(() => {
    calls.length = 0;
    refreshOk = false;
    process.env.SUPABASE_URL = "https://db.example";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  });

  it("reports accounts as off (and keeps pets closed) when not configured", async () => {
    delete process.env.SUPABASE_ANON_KEY;
    const session = await import("@/app/api/auth/session/route");
    const pets = await import("@/app/api/pets/route");
    expect(await (await session.GET(new Request("https://vetnear.example/api/auth/session"))).json()).toEqual({ configured: false, user: null });
    expect((await pets.GET(new Request("https://vetnear.example/api/pets"))).status).toBe(503);
  });

  it("returns 401 to guests and never touches the database", async () => {
    const pets = await import("@/app/api/pets/route");
    const one = await import("@/app/api/pets/[id]/route");
    expect((await pets.GET(new Request("https://vetnear.example/api/pets"))).status).toBe(401);
    expect((await one.PUT(put(SAME), ctx("pet-abc-12345"))).status).toBe(401);
    expect((await one.DELETE(new Request("https://vetnear.example/api/pets/pet-abc-12345", { method: "DELETE", headers: SAME }), ctx("pet-abc-12345"))).status).toBe(401);
    expect(calls.filter((c) => c.table === "pets")).toHaveLength(0);
  });

  it("rejects cross-site writes even with a valid session cookie", async () => {
    const one = await import("@/app/api/pets/[id]/route");
    const res = await one.PUT(put({ "sec-fetch-site": "cross-site", "content-type": "application/json", cookie: "vn_at=token-alice" }), ctx("pet-abc-12345"));
    expect(res.status).toBe(403);
    expect(calls.filter((c) => c.table === "pets")).toHaveLength(0);
  });

  it("saves a pet as the verified user, under the user's JWT, ignoring a spoofed owner", async () => {
    const one = await import("@/app/api/pets/[id]/route");
    const res = await one.PUT(put({ ...SAME, cookie: "vn_at=token-alice" }), ctx("pet-abc-12345"));
    expect(res.status).toBe(200);
    const write = calls.find((c) => c.op === "upsert")!;
    expect(write.key).toBe("anon-key"); // never the service role
    expect(write.authorization).toBe("Bearer token-alice"); // RLS evaluates as the user
    expect((write.payload as { owner_id: string }).owner_id).toBe("user-alice");
    expect(JSON.stringify(write.payload)).not.toContain("user-mallory");
    const body = (await res.json()) as { pet: { ownerId: string; name: string } };
    expect(body.pet).toMatchObject({ ownerId: "user-alice", name: "Барні" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("validates ids and bodies before writing", async () => {
    const one = await import("@/app/api/pets/[id]/route");
    const headers = { ...SAME, cookie: "vn_at=token-alice" };
    expect((await one.PUT(put(headers), ctx("../../etc"))).status).toBe(422);
    expect((await one.PUT(put(headers, { pet: { name: "", animalType: "dog" } }), ctx("pet-abc-12345"))).status).toBe(422);
    expect((await one.PUT(put({ cookie: "vn_at=token-alice", "sec-fetch-site": "same-origin", "content-type": "text/plain" }), ctx("pet-abc-12345"))).status).toBe(415);
    expect(calls.filter((c) => c.op === "upsert")).toHaveLength(0);
  });

  it("lists pets for the signed-in user and refreshes an expired session", async () => {
    refreshOk = true;
    const pets = await import("@/app/api/pets/route");
    const res = await pets.GET(new Request("https://vetnear.example/api/pets", { headers: { cookie: "vn_at=expired; vn_rt=refresh-1" } }));
    expect(res.status).toBe(200);
    expect(calls.find((c) => c.op === "select")?.authorization).toBe("Bearer token-alice");
    const cookies = res.headers.getSetCookie().join("\n");
    expect(cookies).toContain("vn_at=token-alice");
    expect(cookies).toMatch(/vn_at=[^;]+;.*HttpOnly/i);
    expect(cookies).toMatch(/SameSite=lax/i);
  });

  it("accepts sign-in tokens only after Supabase verifies them", async () => {
    const session = await import("@/app/api/auth/session/route");
    const post = (body: unknown, headers = SAME) => new Request("https://vetnear.example/api/auth/session", { method: "POST", headers, body: JSON.stringify(body) });
    expect((await session.POST(post({ accessToken: "forged", refreshToken: "r" }))).status).toBe(401);
    expect((await session.POST(post({ accessToken: "token-alice", refreshToken: "r" }, { ...SAME, "sec-fetch-site": "cross-site" }))).status).toBe(403);
    const ok = await session.POST(post({ accessToken: "token-alice", refreshToken: "r" }));
    expect(ok.status).toBe(200);
    expect(ok.headers.getSetCookie().join("\n")).toMatch(/vn_rt=r;.*HttpOnly/i);
  });

  it("deletes only the signed-in user's own account", async () => {
    const account = await import("@/app/api/account/route");
    const del = (headers: Record<string, string>) => new Request("https://vetnear.example/api/account", { method: "DELETE", headers });
    expect((await account.DELETE(del(SAME))).status).toBe(401);
    expect((await account.DELETE(del({ "sec-fetch-site": "cross-site", cookie: "vn_at=token-alice" }))).status).toBe(403);
    const res = await account.DELETE(del({ ...SAME, cookie: "vn_at=token-alice" }));
    expect(res.status).toBe(200);
    expect(calls.filter((c) => c.op === "deleteUser")).toEqual([{ key: "service-key", op: "deleteUser", filter: "user-alice" }]);
    expect(res.headers.getSetCookie().join("\n")).toMatch(/vn_at=;/);
  });
});
