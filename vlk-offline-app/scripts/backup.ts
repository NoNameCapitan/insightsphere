import "dotenv/config";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, scryptSync, createCipheriv } from "node:crypto";
import Database from "better-sqlite3";
import { ask } from "./prompt";
process.umask(0o077);
const url = process.env.DATABASE_URL || "file:" + resolve("data/vlk.sqlite");
if (!url.startsWith("file:")) throw new Error("Потрібна локальна SQLite");
const pass =
  process.env.BACKUP_PASSWORD ||
  (await ask("Пароль резервної копії (12+ символів): ", true));
if (pass.length < 12) throw new Error("Пароль надто короткий");
if (!existsSync(url.slice(5))) throw new Error("Базу не знайдено");
const temporary = mkdtempSync(join(tmpdir(), "vlk-backup-"));
try {
  const database = new Database(url.slice(5), { readonly: true });
  await database.backup(join(temporary, "snapshot.sqlite"));
  database.close();
  const salt = randomBytes(16),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", scryptSync(pass, salt, 32), iv),
    encrypted = Buffer.concat([
      cipher.update(readFileSync(join(temporary, "snapshot.sqlite"))),
      cipher.final(),
    ]),
    tag = cipher.getAuthTag();
  mkdirSync("backups", { recursive: true });
  const output = resolve(
    "backups",
    "vlk-" + new Date().toISOString().replaceAll(":", "-") + ".vlkbak",
  );
  writeFileSync(
    output,
    Buffer.concat([Buffer.from("VLKBAK1\n"), salt, iv, tag, encrypted]),
    { mode: 0o600 },
  );
  console.log("Зашифрована резервна копія: " + output);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
