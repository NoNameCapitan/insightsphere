import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

test("workspace password gate rejects missing/wrong credentials and supports UTF-8", () => {
  const original = process.env.APP_PASSWORD;
  const request = (password?: string) =>
    new NextRequest("https://workspace.example/api/status", {
      headers:
        password === undefined
          ? {}
          : {
              authorization: `Basic ${Buffer.from(`user:${password}`).toString("base64")}`,
            },
    });
  try {
    delete process.env.APP_PASSWORD;
    assert.equal(middleware(request()).status, 200);
    process.env.APP_PASSWORD = "тестовий:пароль-only-for-tests";
    assert.equal(middleware(request()).status, 401);
    assert.equal(middleware(request("wrong")).status, 401);
    assert.equal(middleware(request(process.env.APP_PASSWORD)).status, 200);
    assert.match(
      middleware(request()).headers.get("WWW-Authenticate") ?? "",
      /UTF-8/,
    );
  } finally {
    if (original === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = original;
  }
});
