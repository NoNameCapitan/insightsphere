import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildGoogleAuthorizeUrl, challengeFor, createPkcePair, mapOAuthError } from "@/lib/auth/oauth";
import { describeProviders } from "@/lib/auth/providers";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: {} }) }));

const SITE = "https://vetnear.example.com"; // SITE.url default in tests
let settings: { ok: boolean; google: boolean } = { ok: true, google: true };
let token: { status: number; body: Record<string, unknown> } = { status: 200, body: {} };
const fetchCalls: { url: string; init?: RequestInit }[] = [];

function installFetch() {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    if (url.endsWith("/auth/v1/settings")) return new Response(JSON.stringify({ external: { google: settings.google } }), { status: settings.ok ? 200 : 500 });
    if (url.includes("/auth/v1/token?grant_type=pkce")) return new Response(JSON.stringify(token.body), { status: token.status });
    return new Response("{}", { status: 404 });
  });
}
const cookiesOf = (res: Response) => res.headers.getSetCookie().join("\n");

describe("Google sign-in (server-side PKCE through Supabase)", () => {
  beforeEach(async () => {
    process.env.SUPABASE_URL = "https://db.example";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    settings = { ok: true, google: true };
    token = { status: 200, body: { access_token: "at-1", refresh_token: "rt-1", expires_in: 3600 } };
    fetchCalls.length = 0;
    installFetch();
    (await import("@/lib/server/userAuth")).resetProviderCache();
  });

  it("creates a valid PKCE pair and authorize URL", () => {
    const pair = createPkcePair();
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(pair.challenge).toBe(challengeFor(pair.verifier));
    expect(createPkcePair().verifier).not.toBe(pair.verifier);
    const url = new URL(buildGoogleAuthorizeUrl("https://db.example/", "https://site.example/", "CH"));
    expect(url.origin + url.pathname).toBe("https://db.example/auth/v1/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      provider: "google",
      redirect_to: "https://site.example/auth/callback/google",
      code_challenge: "CH",
      code_challenge_method: "s256",
    });
  });

  it("maps provider errors to calm, specific messages", () => {
    expect(mapOAuthError("access_denied", null, "User cancelled")).toBe("cancelled");
    expect(mapOAuthError("access_denied", "signup_disabled", "Signups not allowed")).not.toBe("cancelled");
    expect(mapOAuthError(null, "over_request_rate_limit", null)).toBe("rate");
    expect(mapOAuthError("server_error", "identity_already_exists", null)).toBe("linking");
    expect(mapOAuthError(null, "provider_disabled", "Unsupported provider")).toBe("provider");
    expect(mapOAuthError(null, "flow_state_expired", null)).toBe("expired");
    expect(mapOAuthError("<script>", "weird", "x")).toBe("unknown");
    expect(describeProviders(["email", "google"])).toBe("посилання на пошту і Google");
    expect(describeProviders(["google"])).toBe("Google");
    expect(describeProviders([])).toBe("посилання на пошту");
  });

  it("starts the flow: verifier in an httpOnly cookie, browser sent to Supabase", async () => {
    const { GET } = await import("@/app/api/auth/google/route");
    const res = await GET(new Request(`${SITE}/api/auth/google?next=/my-pets/new`));
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location")!);
    expect(location.host).toBe("db.example");
    const cookies = cookiesOf(res);
    const verifier = /vn_pkce=([^;]+)/.exec(cookies)![1];
    expect(location.searchParams.get("code_challenge")).toBe(challengeFor(verifier));
    expect(cookies).toMatch(/vn_pkce=[^;]+;.*HttpOnly/i);
    expect(cookies).toContain("vn_next=%2Fmy-pets%2Fnew");
    expect(res.headers.get("location")).not.toContain(verifier);
    expect(res.headers.get("location")).not.toContain("anon-key");
  });

  it("never offers an open redirect and hides Google when the project has it off", async () => {
    const { GET } = await import("@/app/api/auth/google/route");
    const evil = await GET(new Request(`${SITE}/api/auth/google?next=https://evil.example`));
    expect(cookiesOf(evil)).toContain("vn_next=%2Fmy-pets");
    settings.google = false;
    (await import("@/lib/server/userAuth")).resetProviderCache();
    const off = await GET(new Request(`${SITE}/api/auth/google`));
    expect(off.headers.get("location")).toBe(`${SITE}/auth?error=provider`);
    const session = await import("@/app/api/auth/session/route");
    expect(await (await session.GET(new Request(`${SITE}/api/auth/session`))).json()).toEqual({ configured: true, google: false, user: null });
  });

  it("completes sign-in on the server and lands where the user was going", async () => {
    const { GET } = await import("@/app/auth/callback/google/route");
    const res = await GET(new Request(`${SITE}/auth/callback/google?code=abc`, { headers: { cookie: "vn_pkce=VERIFIER; vn_next=%2Fmy-pets%2Fnew" } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${SITE}/my-pets/new`);
    const exchange = fetchCalls.find((c) => c.url.includes("grant_type=pkce"))!;
    expect(JSON.parse(String(exchange.init!.body))).toEqual({ auth_code: "abc", code_verifier: "VERIFIER" });
    const cookies = cookiesOf(res);
    expect(cookies).toMatch(/vn_at=at-1;.*HttpOnly/i);
    expect(cookies).toMatch(/vn_rt=rt-1;.*HttpOnly/i);
    expect(cookies).toMatch(/vn_pkce=;/); // verifier is single-use
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("handles cancel, a missing verifier and a failed exchange without leaking details", async () => {
    const { GET } = await import("@/app/auth/callback/google/route");
    const go = (query: string, cookie = "vn_pkce=VERIFIER") => GET(new Request(`${SITE}/auth/callback/google?${query}`, { headers: { cookie } }));
    expect((await go("error=access_denied&error_description=User+denied")).headers.get("location")).toBe(`${SITE}/auth?error=cancelled`);
    expect((await go("code=abc", "")).headers.get("location")).toBe(`${SITE}/auth?error=expired`);
    token = { status: 400, body: { error_code: "flow_state_not_found", msg: "invalid flow state" } };
    const bad = await go("code=abc");
    expect(bad.headers.get("location")).toBe(`${SITE}/auth?error=expired`);
    expect(cookiesOf(bad)).not.toContain("vn_at=");
    token = { status: 429, body: {} };
    expect((await go("code=abc")).headers.get("location")).toBe(`${SITE}/auth?error=rate`);
    token = { status: 500, body: { error_code: "unexpected_failure" } };
    expect((await go("code=abc")).headers.get("location")).toBe(`${SITE}/auth?error=provider`);
  });
});
