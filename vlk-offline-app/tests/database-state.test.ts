import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

// Стан бази визначається в окремому процесі: клієнт кешується в globalThis,
// тому в одному процесі не можна чесно перевірити кілька конфігурацій.
function stateFor(env: Record<string, string | undefined>) {
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      'const m = await import("./src/db.ts"); console.log(JSON.stringify(await m.databaseState()));',
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DOTENV_CONFIG_PATH: resolve("tests/nonexistent.env"),
        DATABASE_URL: undefined,
        DATABASE_AUTH_TOKEN: undefined,
        VERCEL: undefined,
        ...env,
      },
    },
  );
  return JSON.parse(output.trim().split("\n").at(-1) as string) as {
    status: string;
    driver: string | null;
    detail?: string;
  };
}

test("стан бази розрізняє чотири випадки без винятків", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "vlk-state-"));
  try {
    await t.test("немає DATABASE_URL — misconfigured", () => {
      const state = stateFor({});
      assert.equal(state.status, "misconfigured");
      assert.equal(state.driver, null);
      assert.match(state.detail ?? "", /DATABASE_URL/);
    });

    await t.test("на Vercel файлова база — misconfigured", () => {
      const state = stateFor({
        VERCEL: "1",
        DATABASE_URL: "file:" + join(folder, "vercel.sqlite"),
      });
      assert.equal(state.status, "misconfigured");
      assert.match(state.detail ?? "", /постійного диска/);
    });

    await t.test("файл без таблиць — migrations-pending", () => {
      const state = stateFor({
        DATABASE_URL: "file:" + join(folder, "empty.sqlite"),
      });
      assert.equal(state.status, "migrations-pending");
      assert.equal(state.driver, "file");
    });

    await t.test("застосовані міграції — ok", () => {
      const file = join(folder, "ready.sqlite");
      execFileSync(process.execPath, [resolve("scripts/migrate-offline.mjs")], {
        env: { ...process.env, DATABASE_URL: "file:" + file },
        stdio: "ignore",
      });
      const state = stateFor({ DATABASE_URL: "file:" + file });
      assert.equal(state.status, "ok");
      assert.equal(state.driver, "file");
    });

    await t.test("недосяжна віддалена база — unreachable", () => {
      const state = stateFor({
        DATABASE_URL: "libsql://unreachable.invalid",
        DATABASE_AUTH_TOKEN: "test-token-not-a-secret",
      });
      assert.equal(state.status, "unreachable");
      assert.equal(state.driver, "remote");
      // Токен не має потрапляти в текст, який бачить користувач.
      assert.doesNotMatch(state.detail ?? "", /test-token-not-a-secret/);
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("кожен серверний роут має перевірку стану бази", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (entry.name !== "page.tsx" && entry.name !== "layout.tsx") continue;
      const source = readFileSync(path, "utf8");
      // Роут, що звертається до бази або до автентифікації, без перевірки
      // стану впав би у 500 замість екрана очікування.
      const touchesDatabase = /pageActor|currentActor|from "@\/db"/.test(
        source,
      );
      if (touchesDatabase && !source.includes("standbyScreen"))
        found.push(path);
    }
  };
  walk("src/app");
  assert.deepEqual(found, []);
});
