// Перевірка автономності: чи запуститься застосунок на комп'ютері без мережі.
// Виконує справжні дії — відкриває базу, читає довідник, за потреби піднімає
// сервер і робить локальний запит, — а не лише перевіряє наявність файлів.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  root,
  applyOfflineEnv,
  readinessChecks,
  databaseFile,
  databaseUrl,
  isRemoteUrl,
  hasNetwork,
  tick,
} from "./offline.mjs";

process.chdir(root);
applyOfflineEnv();
const require = createRequire(import.meta.url);
const deep = process.argv.includes("--serve");

const { items, ok, marker } = readinessChecks();
const rows = [...items];

// Справжнє відкриття бази й читання таблиць, а не лише перевірка файлу.
let dbDetail = "не перевірено";
let dbOk = false;
const remote = isRemoteUrl(databaseUrl());
if (remote) {
  // Хмарний режим не є автономним: файлову базу перевіряти нічого.
  dbOk = true;
  dbDetail = "віддалена база libSQL — перевірка автономності незастосовна";
} else
  try {
    const driverPath = [
      join(root, "node_modules/better-sqlite3"),
      join(
        root,
        ".next/standalone/node_modules/@prisma/adapter-better-sqlite3/node_modules/better-sqlite3",
      ),
    ].find((path) => existsSync(join(path, "package.json")));
    const file = databaseFile();
    if (driverPath && existsSync(file)) {
      const Database = require(driverPath);
      const database = new Database(file, { readonly: true });
      const users = database
        .prepare('SELECT COUNT(*) AS c FROM "User"')
        .get().c;
      const codes = database
        .prepare('SELECT COUNT(*) AS c FROM "Icd10Entry"')
        .get().c;
      const migrations = database
        .prepare('SELECT COUNT(*) AS c FROM "_prisma_migrations"')
        .get().c;
      database.close();
      dbOk = users > 0 && migrations > 0;
      dbDetail =
        "облікових записів: " +
        users +
        ", кодів довідника: " +
        codes +
        ", міграцій: " +
        migrations;
      if (users === 0) dbDetail += " (немає жодного працівника)";
    } else dbDetail = "база або двійковий модуль недоступні";
  } catch (error) {
    dbDetail = error.message;
  }
rows.push({
  id: "db-read",
  label: remote ? "База даних" : "Читання бази без мережі",
  ok: dbOk,
  detail: dbDetail,
  fix: "npm run setup",
});

console.log("Перевірка автономної роботи ВЛК Offline / Standby\n");
for (const row of rows)
  console.log("  " + tick(row.ok) + " " + row.label + "\n      " + row.detail);

// Довідкова інформація: наявність мережі не є умовою роботи.
const online = await hasNetwork(1500);
console.log(
  "\n  • Мережа зараз " +
    (online ? "доступна (для роботи не потрібна)" : "недоступна") +
    ".",
);
if (marker)
  console.log(
    "  • Підготовлено " +
      marker.prepared_at +
      " для " +
      marker.platform +
      "/" +
      marker.arch +
      ", Node.js " +
      marker.node +
      ".",
  );

let serveOk = true;
if (deep && rows.every((row) => row.ok)) {
  serveOk = false;
  const port = Number(process.env.CHECK_PORT || 3999);
  console.log(
    "\nЗапуск локального сервера на порту " + port + " для перевірки…",
  );
  const child = spawn(process.execPath, [join(root, "scripts/serve.mjs")], {
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
    stdio: "ignore",
  });
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((done) => setTimeout(done, 500));
      try {
        const response = await fetch(
          "http://127.0.0.1:" + port + "/api/health",
        );
        if (response.ok) {
          serveOk = true;
          break;
        }
      } catch {
        /* сервер ще піднімається */
      }
    }
  } finally {
    child.kill("SIGTERM");
  }
  console.log(
    "  " +
      tick(serveOk) +
      " Локальний сервер відповідає на /api/health" +
      (serveOk ? "" : " — перевірте порт і журнал запуску"),
  );
}

const failed = rows.filter((row) => !row.ok);
if (failed.length === 0 && serveOk) {
  console.log("\nГотово до роботи без інтернету.");
  process.exit(0);
}
console.log("\nЩо зробити:");
for (const row of failed) console.log("  • " + row.label + ": " + row.fix);
if (!serveOk) console.log("  • Локальний сервер: перевірте, чи вільний порт.");
if (!ok)
  console.log(
    "  • Повна підготовка одним кроком (потрібен інтернет): npm run prepare:offline",
  );
process.exit(1);
