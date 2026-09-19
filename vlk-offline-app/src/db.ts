// Серверний модуль також використовується локальними CLI-утилітами.
import "dotenv/config";
import { resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";
if (typeof window !== "undefined")
  throw new Error("База доступна тільки на сервері");
export const databaseUrl =
  process.env.DATABASE_URL || "file:" + resolve("data/vlk.sqlite");
if (!databaseUrl.startsWith("file:"))
  throw new Error("Потрібна локальна SQLite (file:)");
const globalDb = globalThis as unknown as {
  vlkDb?: PrismaClient;
  vlkReady?: Promise<void>;
};
export const db =
  globalDb.vlkDb ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl, timeout: 5000 }),
  });
globalDb.vlkDb = db;
export async function ready() {
  if (process.env.VERCEL)
    throw new Error(
      "Цей застосунок запускається локально з постійним диском SQLite.",
    );
  if (!globalDb.vlkReady)
    globalDb.vlkReady = (async () => {
      await db.$queryRawUnsafe("PRAGMA foreign_keys = ON");
      await db.$queryRawUnsafe("PRAGMA journal_mode = WAL");
      await db.$queryRawUnsafe("PRAGMA synchronous = FULL");
      await db.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
    })().catch((e) => {
      globalDb.vlkReady = undefined;
      throw e;
    });
  await globalDb.vlkReady;
}
