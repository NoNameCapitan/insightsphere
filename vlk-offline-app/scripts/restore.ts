import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { scryptSync, createDecipheriv } from "node:crypto";
import Database from "better-sqlite3";
import { ask } from "./prompt";
process.umask(0o077);
if (!process.argv[2]) throw new Error("Вкажіть шлях до .vlkbak");
const bytes = readFileSync(process.argv[2]);
if (bytes.subarray(0, 8).toString() !== "VLKBAK1\n")
  throw new Error("Невідомий формат резервної копії");
const pass =
    process.env.BACKUP_PASSWORD ||
    (await ask("Пароль резервної копії: ", true)),
  salt = bytes.subarray(8, 24),
  iv = bytes.subarray(24, 36),
  tag = bytes.subarray(36, 52),
  decipher = createDecipheriv("aes-256-gcm", scryptSync(pass, salt, 32), iv);
decipher.setAuthTag(tag);
let plain: Buffer;
try {
  plain = Buffer.concat([
    decipher.update(bytes.subarray(52)),
    decipher.final(),
  ]);
} catch {
  throw new Error("Неправильний пароль або пошкоджений файл");
}
mkdirSync("data", { recursive: true });
const target = resolve("data", "restored-" + Date.now() + ".sqlite");
writeFileSync(target, plain, { flag: "wx", mode: 0o600 });
try {
  const database = new Database(target);
  if (database.pragma("integrity_check", { simple: true }) !== "ok")
    throw new Error("Перевірка цілісності БД не пройдена");
  database
    .prepare('UPDATE "AuthSession" SET revoked_at=?')
    .run(new Date().toISOString());
  database.close();
} catch (e) {
  unlinkSync(target);
  throw e;
}
console.log("Створено окрему відновлену базу: " + target);
console.log(
  "Зупиніть сервер і змініть DATABASE_URL у .env на: file:" +
    target.replaceAll("\\", "/"),
);
console.log(
  "Поточну базу не змінено. Після запуску всі працівники входять знову.",
);
