// Серверний модуль також використовується локальними CLI-утилітами.
//
// Два режими зберігання:
//   file:   — локальний SQLite на диску установи (основний, офлайн);
//   libsql: — віддалена база libSQL / Turso для хмарного розгортання,
//             наприклад на Vercel, де постійного диска немає.
// Режим визначає лише DATABASE_URL. Схема, міграції та тригери спільні.
import "dotenv/config";
import { resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./generated/prisma/client";
if (typeof window !== "undefined")
  throw new Error("База доступна тільки на сервері");
export const databaseUrl =
  process.env.DATABASE_URL || "file:" + resolve("data/vlk.sqlite");
export const isRemoteDatabase = /^(libsql|wss?|https?):/.test(databaseUrl);
if (!databaseUrl.startsWith("file:") && !isRemoteDatabase)
  throw new Error(
    "DATABASE_URL має бути локальним файлом (file:) або базою libSQL (libsql:)",
  );
// На платформі без постійного диска локальний файл втрачається разом з
// екземпляром: краще зупинитися зараз, ніж втратити медичні записи.
if (process.env.VERCEL && !isRemoteDatabase)
  throw new Error(
    "На Vercel немає постійного диска. Задайте DATABASE_URL=libsql://… і DATABASE_AUTH_TOKEN, " +
      "або розгортайте застосунок локально. Докладно — docs/VERCEL.md.",
  );
const globalDb = globalThis as unknown as {
  vlkDb?: PrismaClient;
  vlkReady?: Promise<void>;
};
export const db =
  globalDb.vlkDb ??
  new PrismaClient({
    adapter: isRemoteDatabase
      ? new PrismaLibSql({
          url: databaseUrl,
          authToken: process.env.DATABASE_AUTH_TOKEN,
        })
      : new PrismaBetterSqlite3({ url: databaseUrl, timeout: 5000 }),
  });
globalDb.vlkDb = db;
export async function ready() {
  if (!globalDb.vlkReady)
    globalDb.vlkReady = (async () => {
      // Налаштування локального файлу; у віддаленій базі режим журналу
      // та синхронізацію визначає сервер libSQL, а не клієнт.
      const pragmas = isRemoteDatabase
        ? ["PRAGMA foreign_keys = ON"]
        : [
            "PRAGMA foreign_keys = ON",
            "PRAGMA journal_mode = WAL",
            "PRAGMA synchronous = FULL",
            "PRAGMA busy_timeout = 5000",
          ];
      for (const pragma of pragmas) await db.$queryRawUnsafe(pragma);
    })().catch((e) => {
      globalDb.vlkReady = undefined;
      throw e;
    });
  await globalDb.vlkReady;
}
