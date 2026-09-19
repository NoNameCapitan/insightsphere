// Серверний модуль також використовується локальними CLI-утилітами.
//
// Два режими зберігання, які визначає лише DATABASE_URL:
//   file:   — локальний SQLite на диску установи (основний, офлайн);
//   libsql: — віддалена база libSQL / Turso для хмарного розгортання,
//             наприклад на Vercel, де постійного диска немає.
// Схема, міграції та тригери спільні для обох.
//
// Модуль не кидає помилок під час імпорту: збірка Next.js виконує його на
// етапі збору даних сторінок, коли змінні оточення ще можуть бути не задані.
// Хибну конфігурацію видно під час першого звернення до бази й у /api/health.
import "dotenv/config";
import { resolve } from "node:path";
import { PrismaClient } from "./generated/prisma/client";
if (typeof window !== "undefined")
  throw new Error("База доступна тільки на сервері");
export const databaseUrl =
  process.env.DATABASE_URL || "file:" + resolve("data/vlk.sqlite");
export const isRemoteDatabase = /^(libsql|wss?|https?):/.test(databaseUrl);

function describeProblem(): string | null {
  if (!databaseUrl.startsWith("file:") && !isRemoteDatabase)
    return "DATABASE_URL має бути локальним файлом (file:) або базою libSQL (libsql:)";
  // На платформі без постійного диска локальний файл втрачається разом з
  // екземпляром: краще зупинитися, ніж мовчки втратити медичні записи.
  if (process.env.VERCEL && !isRemoteDatabase)
    return (
      "На Vercel немає постійного диска, тому локальний файл бази не зберігається. " +
      "Задайте змінні оточення DATABASE_URL=libsql://… та DATABASE_AUTH_TOKEN " +
      "і повторіть розгортання. Докладно — docs/VERCEL.md."
    );
  return null;
}

export const configurationProblem = describeProblem();

const globalDb = globalThis as unknown as {
  vlkDb?: PrismaClient;
  vlkReady?: Promise<void>;
};

// Драйвер завантажується лише той, який потрібен цьому режиму: у хмарі не
// підвантажується двійковий модуль better-sqlite3, а локально — клієнт libSQL.
async function createAdapter() {
  if (isRemoteDatabase) {
    const { PrismaLibSql } = await import("@prisma/adapter-libsql");
    return new PrismaLibSql({
      url: databaseUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  const { PrismaBetterSqlite3 } =
    await import("@prisma/adapter-better-sqlite3");
  return new PrismaBetterSqlite3({ url: databaseUrl, timeout: 5000 });
}

function unusableClient(message: string) {
  const fail = () => {
    throw new Error(message);
  };
  return new Proxy({} as PrismaClient, { get: fail, apply: fail });
}

export const db: PrismaClient = configurationProblem
  ? unusableClient(configurationProblem)
  : (globalDb.vlkDb ?? new PrismaClient({ adapter: await createAdapter() }));
if (!configurationProblem) globalDb.vlkDb = db;

export async function ready() {
  if (configurationProblem) throw new Error(configurationProblem);
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
