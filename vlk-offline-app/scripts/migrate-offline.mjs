// Застосування міграцій без Prisma CLI: та сама таблиця _prisma_migrations,
// ті самі контрольні суми sha256. Потрібне для запуску на комп'ютері без мережі,
// де CLI марно чекає на перевірку версій.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { dirname, join } from "node:path";
import {
  applyOfflineEnv,
  root,
  migrationNames,
  databaseFile,
} from "./offline.mjs";

applyOfflineEnv();
const require = createRequire(import.meta.url);

// Повний пакет і портативний пакет мають різне розташування двійкового модуля.
const candidates = [
  join(root, "node_modules/better-sqlite3"),
  join(
    root,
    ".next/standalone/node_modules/@prisma/adapter-better-sqlite3/node_modules/better-sqlite3",
  ),
];

function loadDriver() {
  for (const path of candidates)
    if (existsSync(join(path, "package.json"))) {
      try {
        return require(path);
      } catch {
        /* пробуємо наступне розташування */
      }
    }
  throw new Error(
    "Не знайдено локальний модуль SQLite. Виконайте npm run prepare:offline з інтернетом.",
  );
}

const TABLE = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

export function applyMigrations({ file = databaseFile(), quiet = false } = {}) {
  const Database = loadDriver();
  mkdirSync(dirname(file), { recursive: true });
  const database = new Database(file);
  try {
    database.pragma("journal_mode = WAL");
    database.pragma("busy_timeout = 5000");
    database.exec(TABLE);
    const applied = new Map(
      database
        .prepare(
          'SELECT migration_name, checksum, rolled_back_at FROM "_prisma_migrations"',
        )
        .all()
        .map((row) => [row.migration_name, row]),
    );
    const pending = [];
    for (const name of migrationNames()) {
      const bytes = readFileSync(
        join(root, "prisma/migrations", name, "migration.sql"),
      );
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const known = applied.get(name);
      if (!known) {
        pending.push({ name, checksum, sql: bytes.toString("utf8") });
        continue;
      }
      if (known.rolled_back_at)
        throw new Error(
          "Міграцію " +
            name +
            " позначено як скасовану. Потрібен розбір стану бази.",
        );
      if (known.checksum !== checksum)
        throw new Error(
          "Контрольна сума міграції " +
            name +
            " не збігається з базою. Файли міграцій змінювати не можна.",
        );
    }
    for (const item of pending) {
      const started = Date.now();
      // Кожна міграція застосовується повністю або не застосовується взагалі.
      database.exec("BEGIN");
      try {
        database.exec(item.sql);
        database
          .prepare(
            'INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (?,?,?,?,NULL,NULL,?,1)',
          )
          .run(randomUUID(), item.checksum, Date.now(), item.name, started);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
      if (!quiet) console.log("Міграція застосована: " + item.name);
    }
    if (!quiet && pending.length === 0)
      console.log("Міграції вже застосовані.");
    return pending.map((item) => item.name);
  } finally {
    database.close();
  }
}

if (import.meta.url === "file://" + process.argv[1]) {
  try {
    applyMigrations();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
