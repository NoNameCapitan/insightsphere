import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/server/requestBody";

const req = (body: string, type = "application/json") =>
  new Request("http://localhost/api/x", { method: "POST", body, headers: { "content-type": type } });

describe("readJsonBody", () => {
  it("parses a small JSON body", async () => {
    expect(await readJsonBody(req('{"a":1}'))).toEqual({ ok: true, value: { a: 1 } });
  });
  it("rejects non-JSON content types (CSRF simple-request guard)", async () => {
    const r = await readJsonBody(req('{"a":1}', "text/plain"));
    expect(r).toMatchObject({ ok: false, status: 415 });
  });
  it("rejects oversized bodies", async () => {
    const r = await readJsonBody(req(JSON.stringify({ a: "x".repeat(5000) })), 1024);
    expect(r).toMatchObject({ ok: false, status: 413 });
  });
  it("rejects malformed JSON", async () => {
    expect(await readJsonBody(req("{oops"))).toMatchObject({ ok: false, status: 400 });
  });
});
