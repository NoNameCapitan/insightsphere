import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

// Перевірки автономності. Жодна з них не звертається до мережі
// і не відкриває робочу базу установи.

const offlineEnv = {
  ...process.env,
  CHECKPOINT_DISABLE: "1",
  DO_NOT_TRACK: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};

function migrationDirectories() {
  return readdirSync("prisma/migrations")
    .filter((name) => /^\d/.test(name))
    .sort();
}

test("міграції застосовуються без Prisma CLI та мережі", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "vlk-offline-"));
  const file = join(folder, "offline.sqlite");
  const run = () =>
    execFileSync(process.execPath, [resolve("scripts/migrate-offline.mjs")], {
      env: { ...offlineEnv, DATABASE_URL: "file:" + file },
      encoding: "utf8",
    });
  try {
    const first = run();
    for (const name of migrationDirectories())
      assert.match(first, new RegExp(name));

    const database = new Database(file);
    await t.test("записи сумісні з форматом Prisma", () => {
      const rows = database
        .prepare(
          'SELECT migration_name, checksum, finished_at, applied_steps_count, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name',
        )
        .all() as {
        migration_name: string;
        checksum: string;
        finished_at: number | null;
        applied_steps_count: number;
        rolled_back_at: number | null;
      }[];
      assert.equal(rows.length, migrationDirectories().length);
      for (const row of rows) {
        const bytes = readFileSync(
          join("prisma/migrations", row.migration_name, "migration.sql"),
        );
        // Prisma зберігає sha256 самого файлу міграції.
        assert.equal(
          row.checksum,
          createHash("sha256").update(bytes).digest("hex"),
        );
        assert.ok(row.finished_at);
        assert.equal(row.rolled_back_at, null);
        assert.equal(row.applied_steps_count, 1);
      }
    });

    await t.test("схема з таблицями й тригерами незмінності створена", () => {
      const tables = database
        .prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'")
        .get() as { c: number };
      const triggers = database
        .prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='trigger'")
        .get() as { c: number };
      assert.ok(tables.c > 10);
      assert.ok(triggers.c > 10);
    });
    database.close();

    await t.test("повторний запуск нічого не змінює", () => {
      assert.match(run(), /вже застосовані/);
    });

    await t.test("змінена міграція відхиляється", () => {
      const sql = new Database(file);
      sql
        .prepare(
          'UPDATE "_prisma_migrations" SET checksum = ? WHERE migration_name = ?',
        )
        .run("0".repeat(64), migrationDirectories()[0]);
      sql.close();
      assert.throws(run, /Контрольна сума/);
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("у вихідному коді інтерфейсу немає зовнішніх адрес", () => {
  // Дозволені лише простори імен XML і локальні адреси.
  const allowed =
    /^(https?:\/\/(www\.)?w3\.org|https?:\/\/localhost|https?:\/\/127\.0\.0\.1)/;
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "generated") continue;
        walk(path);
        continue;
      }
      if (!/\.(tsx?|css|js|json|webmanifest|svg)$/.test(entry.name)) continue;
      for (const match of readFileSync(path, "utf8").matchAll(
        /https?:\/\/[^\s"'`)<>]+/g,
      ))
        if (!allowed.test(match[0])) found.push(path + " → " + match[0]);
    }
  };
  walk("src");
  walk("public");
  assert.deepEqual(found, []);
});

test("service worker не кешує медичні дані", () => {
  const source = readFileSync("public/sw.js", "utf8");
  const shell = source.match(/const SHELL = \[([^\]]*)\]/s);
  assert.ok(shell, "у service worker має бути перелік SHELL");
  const paths = [...shell[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(paths.length > 0);
  // Кешуються лише статичні файли оболонки; сторінок і API тут бути не може.
  const permitted = new Set([
    "/offline",
    "/icon.svg",
    "/icon-192.png",
    "/icon-512.png",
    "/manifest.webmanifest",
  ]);
  for (const path of paths) assert.ok(permitted.has(path), path);
  assert.match(source, /request\.method !== "GET"/);
  assert.match(source, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  // Єдине місце запису в кеш — гілка незмінних файлів збірки.
  assert.equal([...source.matchAll(/cache\.put\(/g)].length, 1);
  assert.match(source, /url\.origin !== self\.location\.origin/);
  // Сторінка-заглушка не має доступу до бази.
  const page = readFileSync("src/app/offline/page.tsx", "utf8");
  assert.doesNotMatch(page, /@\/db|pageActor|prisma/);
});

test("значки та маніфест PWA присутні й локальні", () => {
  const manifest = JSON.parse(
    readFileSync("public/manifest.webmanifest", "utf8"),
  ) as { icons: { src: string }[]; start_url: string; display: string };
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith("/"), icon.src);
    assert.ok(statSync(join("public", icon.src)).size > 0);
  }
  for (const [name, size] of [
    ["public/icon-192.png", 192],
    ["public/icon-512.png", 512],
  ] as const) {
    const bytes = readFileSync(name);
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    );
    // IHDR: ширина й висота у великому порядку байтів.
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
});

test("штатні скрипти запуску вимикають мережеві перевірки", () => {
  for (const file of ["scripts/serve.mjs", "scripts/setup.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /CHECKPOINT_DISABLE/);
    assert.match(source, /NEXT_TELEMETRY_DISABLED/);
  }
  const offline = readFileSync("scripts/offline.mjs", "utf8");
  for (const key of [
    "NEXT_TELEMETRY_DISABLED",
    "DO_NOT_TRACK",
    "CHECKPOINT_DISABLE",
    "PRISMA_HIDE_UPDATE_MESSAGE",
  ])
    assert.match(offline, new RegExp(key));
  // Штатний запуск не має встановлювати пакети.
  assert.doesNotMatch(readFileSync("scripts/serve.mjs", "utf8"), /npm/);
});
