import { test } from "node:test";
import assert from "node:assert/strict";
import { guardRequest } from "../lib/apiGuard";
import { searchGooglePlaces } from "../lib/places";
import { extractAiText, generateAiDraft } from "../lib/ai";
import { POST as searchRoute } from "../app/api/places/search/route";
import { POST as outreachRoute } from "../app/api/outreach/route";
const req = {
  query: "",
  niche: "dental" as const,
  offerType: "booking" as const,
  locationMode: "address" as const,
  city: "Київ",
  address: "Позняки, Київ",
  radiusKm: 5,
  limit: 30,
  lang: "uk" as const,
};
const post = (body: unknown) =>
  new Request("http://localhost/api/places/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("Google adapter paginates, keeps address and international phone, honors request budget", async (t) => {
  const calls: {
    body: Record<string, unknown>;
    headers: Record<string, string>;
  }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init: RequestInit) => {
      calls.push({
        body: JSON.parse(String(init.body)),
        headers: init.headers as Record<string, string>,
      });
      return Response.json({
        places: [
          {
            id: "place-" + calls.length,
            displayName: { text: "Demo" },
            internationalPhoneNumber: "+380441234567",
            nationalPhoneNumber: "0441234567",
            currentOpeningHours: { openNow: true },
            attributions: [
              { provider: "Test provider", providerUri: "https://example.com" },
            ],
          },
        ],
        nextPageToken: "next-" + calls.length,
      });
    },
  );
  const result = await searchGooglePlaces(req, "test-only");
  assert.equal(calls.length, 6);
  assert.equal(calls[1].body.pageToken, "next-1");
  assert.match(String(calls[0].body.textQuery), /Позняки/);
  assert.ok(calls[0].headers["X-Goog-FieldMask"].includes("nextPageToken"));
  assert.equal(result[0].phone, "+380441234567");
  assert.equal(result[0].isOpenNow, true);
  assert.equal(result[0].attributions?.[0].provider, "Test provider");
});
test("Google failure is an explicit error rather than fictional results", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("secret-provider-body", { status: 403 }),
  );
  await assert.rejects(
    () => searchGooglePlaces(req, "test-only"),
    /відхилив ключ/,
  );
});
test("search route rejects malformed inputs and keeps missing-key demo explicit", async () => {
  for (const value of [null, [], { limit: "many" }, { excludeKeys: 123 }])
    assert.equal((await searchRoute(post(value))).status, 400);
  const response = await searchRoute(post({ ...req, demo: true }));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.mode, "demo");
  assert.ok(data.leads.every((l: { source: string }) => l.source === "demo"));
});
test("search route rejects cross-origin POST", async () => {
  const request = new Request("http://localhost/api/places/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://other.example",
    },
    body: "{}",
  });
  assert.equal((await searchRoute(request)).status, 403);
});
test("live empty search stays live; upstream error is 502", async (t) => {
  const oldKey = process.env.GOOGLE_PLACES_API_KEY;
  const oldDemo = process.env.NEXT_PUBLIC_DEMO_MODE;
  process.env.GOOGLE_PLACES_API_KEY = "test-only";
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  try {
    const fetch = t.mock.method(globalThis, "fetch", async () =>
      Response.json({ places: [] }),
    );
    const empty = await searchRoute(post(req));
    const data = await empty.json();
    assert.equal(data.mode, "google_places");
    assert.equal(data.leads.length, 0);
    fetch.mock.mockImplementation(
      async () => new Response("error", { status: 500 }),
    );
    assert.equal((await searchRoute(post(req))).status, 502);
  } finally {
    if (oldKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = oldKey;
    if (oldDemo === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = oldDemo;
  }
});
test("AI reads provider text and rejects truncated/empty completions", () => {
  assert.equal(
    extractAiText(
      {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Привіт" }],
          },
        ],
      },
      "openai",
    ),
    "Привіт",
  );
  assert.equal(
    extractAiText({ content: [{ type: "text", text: "Hello" }] }, "anthropic"),
    "Hello",
  );
  assert.throws(() => extractAiText({ status: "incomplete" }, "openai"));
  assert.throws(() => extractAiText({}, "openai"));
});
test("AI routes send only validated minimal data and handle missing config", async (t) => {
  const old = {
    provider: process.env.AI_PROVIDER,
    key: process.env.AI_PROVIDER_API_KEY,
    model: process.env.AI_MODEL,
  };
  const input = {
    name: "Example",
    category: "Dental",
    offerType: "booking" as const,
    lang: "uk" as const,
    tone: "soft" as const,
    channel: "email" as const,
    evidence: ["No booking seen on checked homepage"],
    draft: "Hello",
  };
  try {
    process.env.AI_PROVIDER = "none";
    delete process.env.AI_PROVIDER_API_KEY;
    assert.equal((await outreachRoute(post(input))).status, 503);
    process.env.AI_PROVIDER = "openai";
    process.env.AI_PROVIDER_API_KEY = "test-only";
    process.env.AI_MODEL = "test-model";
    let body: Record<string, unknown> = {};
    t.mock.method(
      globalThis,
      "fetch",
      async (_url: unknown, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return Response.json({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Test draft" }],
            },
          ],
        });
      },
    );
    assert.equal(await generateAiDraft(input), "Test draft");
    assert.equal(body.store, false);
    assert.equal(body.model, "test-model");
    assert.equal(body.max_output_tokens, 4000);

    // OpenAI-compatible (Gemini/OpenRouter/Groq/Ollama) via Chat Completions.
    process.env.AI_PROVIDER = "openai_compatible";
    process.env.AI_BASE_URL = "https://openrouter.ai/api/v1/";
    let url = "";
    t.mock.method(
      globalThis,
      "fetch",
      async (u: unknown, init: RequestInit) => {
        url = String(u);
        body = JSON.parse(String(init.body));
        return Response.json({
          choices: [{ message: { content: "Compat draft" }, finish_reason: "stop" }],
        });
      },
    );
    assert.equal(await generateAiDraft(input), "Compat draft");
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal((body.messages as unknown[]).length, 2);

    // Anthropic: default model when AI_MODEL is empty; refusal is surfaced.
    process.env.AI_PROVIDER = "anthropic";
    delete process.env.AI_MODEL;
    t.mock.method(
      globalThis,
      "fetch",
      async (_u: unknown, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return Response.json({ content: [], stop_reason: "refusal" });
      },
    );
    await assert.rejects(generateAiDraft(input), /відхилив/);
    assert.equal(body.model, "claude-opus-5");
  } finally {
    delete process.env.AI_BASE_URL;
    for (const [key, value] of Object.entries({
      AI_PROVIDER: old.provider,
      AI_PROVIDER_API_KEY: old.key,
      AI_MODEL: old.model,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("same-origin requests through a reverse proxy are accepted", () => {
  const request = new Request("http://localhost/api/places/search", {
    method: "POST",
    headers: {
      host: "lead.example",
      origin: "https://lead.example",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(guardRequest(request, "proxy-test"), null);
});
