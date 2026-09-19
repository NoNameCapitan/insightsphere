// Міграції для віддаленої бази libSQL / Turso (хмарне розгортання).
// Формат таблиці _prisma_migrations і контрольні суми — ті самі, що й у
// локального рушія, тому обидва режими бачать однаковий стан схеми.
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import {
  applyOfflineEnv,
  root,
  migrationNames,
  databaseUrl,
} from "./offline.mjs";

applyOfflineEnv();

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

export async function applyRemoteMigrations({ quiet = false } = {}) {
  const url = databaseUrl();
  const token = process.env.DATABASE_AUTH_TOKEN;
  // Штатно сюди потрапляє тільки libsql:; file: приймається для перевірок,
  // бо клієнт libSQL працює і з локальним файлом.
  if (!/^(libsql|wss?|https?|file):/.test(url))
    throw new Error("DATABASE_URL не підтримується клієнтом libSQL: " + url);
  const client = createClient({ url, authToken: token });
  const applied = new Map();
  try {
    await client.execute(TABLE);
    const existing = await client.execute(
      'SELECT migration_name, checksum, rolled_back_at FROM "_prisma_migrations"',
    );
    for (const row of existing.rows) applied.set(row.migration_name, row);

    const done = [];
    for (const name of migrationNames()) {
      const bytes = readFileSync(
        join(root, "prisma/migrations", name, "migration.sql"),
      );
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const known = applied.get(name);
      if (known) {
        if (known.rolled_back_at)
          throw new Error("Міграцію " + name + " позначено як скасовану.");
        if (known.checksum !== checksum)
          throw new Error(
            "Контрольна сума міграції " + name + " не збігається з базою.",
          );
        continue;
      }
      const started = Date.now();
      await client.executeMultiple(bytes.toString("utf8"));
      await client.execute({
        sql: 'INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (?,?,?,?,NULL,NULL,?,1)',
        args: [randomUUID(), checksum, Date.now(), name, started],
      });
      done.push(name);
      if (!quiet) console.log("Міграція застосована: " + name);
    }
    if (!quiet && done.length === 0) console.log("Міграції вже застосовані.");
    return done;
  } finally {
    client.close();
  }
}

if (import.meta.url === "file://" + process.argv[1]) {
  try {
    await applyRemoteMigrations();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
