// Єдиний шар доступу до бази для обох режимів зберігання.
//
//   file:   — локальний SQLite на диску установи (основний, офлайн);
//   libsql: — віддалена база libSQL / Turso для хмарного розгортання,
//             наприклад на Vercel, де постійного диска немає.
// Режим визначає лише DATABASE_URL. Схема, міграції та тригери спільні.
//
// Клієнт НЕ створюється на рівні модуля: збірка Next.js імпортує цей файл на
// етапі збору даних сторінок, коли змінних оточення ще може не бути.
// Стан бази повертає databaseState(); він ніколи не кидає винятків, тому
// сторінки показують екран очікування замість помилки 500.
import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
// Не "server-only": цей модуль імпортують і локальні CLI-утиліти
// (setup, import:icd), які працюють без умови react-server.
if (typeof window !== "undefined")
  throw new Error("База доступна тільки на сервері");

export type DatabaseDriver = "file" | "remote";
export type DatabaseStatus =
  "ok" | "misconfigured" | "unreachable" | "migrations-pending";
export type DatabaseState = {
  status: DatabaseStatus;
  driver: DatabaseDriver | null;
  detail?: string;
};

const PROBE_TIMEOUT = 5000;

export function databaseUrl(): string | null {
  const raw = process.env.DATABASE_URL?.trim();
  return raw ? raw : null;
}

export function driverFor(url: string | null): DatabaseDriver | null {
  if (!url) return null;
  if (/^(libsql|wss?|https?):/.test(url)) return "remote";
  if (url.startsWith("file:")) return "file";
  return null;
}

// Причина, з якої база свідомо не відкривається. Порожнє значення означає,
// що конфігурація придатна — але ще не гарантує, що база доступна.
export function configurationProblem(): string | null {
  const url = databaseUrl();
  if (!url)
    return process.env.VERCEL
      ? "Не задано DATABASE_URL. Для Vercel потрібні змінні оточення " +
          "DATABASE_URL=libsql://… та DATABASE_AUTH_TOKEN, після додавання — повторне розгортання. " +
          "Докладно — docs/VERCEL.md."
      : "Не задано DATABASE_URL. Виконайте npm run prepare:offline на сервері установи " +
          "або задайте DATABASE_URL=file:/шлях/vlk.sqlite. Докладно — docs/OFFLINE.md.";
  if (!driverFor(url))
    return "DATABASE_URL має бути локальним файлом (file:) або базою libSQL (libsql:).";
  // На платформі без постійного диска локальний файл втрачається разом з
  // екземпляром: краще зупинитися, ніж мовчки втратити медичні записи.
  if (process.env.VERCEL && driverFor(url) === "file")
    return (
      "На Vercel немає постійного диска, тому локальний файл бази не зберігається. " +
      "Задайте змінні оточення DATABASE_URL=libsql://… та DATABASE_AUTH_TOKEN " +
      "і повторіть розгортання. Докладно — docs/VERCEL.md."
    );
  return null;
}

const globalDb = globalThis as unknown as {
  vlkDb?: PrismaClient;
  vlkInit?: Promise<PrismaClient | null>;
  vlkReady?: Promise<void>;
};

// Драйвер завантажується лише потрібний: у хмарі не підвантажується двійковий
// модуль better-sqlite3, а локально — мережевий клієнт libSQL. Саме через цей
// умовний імпорт ініціалізація асинхронна.
async function createClient(): Promise<PrismaClient | null> {
  const url = databaseUrl();
  if (!url || configurationProblem()) return null;
  const adapter =
    driverFor(url) === "remote"
      ? new (await import("@prisma/adapter-libsql")).PrismaLibSql({
          url,
          authToken: process.env.DATABASE_AUTH_TOKEN,
        })
      : new (
          await import("@prisma/adapter-better-sqlite3")
        ).PrismaBetterSqlite3({ url, timeout: 5000 });
  return new PrismaClient({ adapter });
}

// Повертає null, а не кидає, якщо конфігурація неповна. Результат треба
// перевірити на null — тип PrismaClient | null не дозволить звернутися інакше.
export async function getDb(): Promise<PrismaClient | null> {
  if (globalDb.vlkDb) return globalDb.vlkDb;
  if (configurationProblem()) return null;
  if (!globalDb.vlkInit)
    globalDb.vlkInit = createClient()
      .then((client) => {
        if (client) globalDb.vlkDb = client;
        return client;
      })
      .catch((error) => {
        globalDb.vlkInit = undefined;
        throw error;
      });
  return globalDb.vlkInit;
}

// Сумісний доступ для наявних викликів `db.user…`. Проксі звертається до вже
// відкритого клієнта; порядок гарантують ready() і pageActor().
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = globalDb.vlkDb;
    if (!client)
      throw new Error(
        configurationProblem() ??
          "Базу ще не відкрито. Викличте ready() або getDb() перед зверненням до даних.",
      );
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function ready() {
  const problem = configurationProblem();
  if (problem) throw new Error(problem);
  const client = await getDb();
  if (!client) throw new Error("Не вдалося відкрити базу даних.");
  if (!globalDb.vlkReady)
    globalDb.vlkReady = (async () => {
      // Налаштування локального файлу; у віддаленій базі режим журналу
      // та синхронізацію визначає сервер libSQL, а не клієнт.
      const pragmas =
        driverFor(databaseUrl()) === "remote"
          ? ["PRAGMA foreign_keys = ON"]
          : [
              "PRAGMA foreign_keys = ON",
              "PRAGMA journal_mode = WAL",
              "PRAGMA synchronous = FULL",
              "PRAGMA busy_timeout = 5000",
            ];
      for (const pragma of pragmas) await client.$queryRawUnsafe(pragma);
    })().catch((error) => {
      globalDb.vlkReady = undefined;
      throw error;
    });
  await globalDb.vlkReady;
}

// Порожня схема відрізняється від недоступної бази: у першому випадку
// з'єднання є, але міграції ще не застосовані.
function looksLikeMissingTables(message: string) {
  return /no such table|does not exist|P2021|P2010/i.test(message);
}

// Токен доступу до бази не має потрапляти у відповідь чи на екран.
function sanitize(message: string) {
  return message
    .replace(/(authToken|auth_token|token)=[^\s&"']+/gi, "$1=…")
    .slice(0, 600);
}

// Ніколи не кидає: придатна для рендеру сторінок і для /api/health.
export async function databaseState(): Promise<DatabaseState> {
  const driver = driverFor(databaseUrl());
  const problem = configurationProblem();
  if (problem) return { status: "misconfigured", driver, detail: problem };
  try {
    const client = await Promise.race([
      (async () => {
        await ready();
        return getDb();
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Перевищено час очікування бази даних.")),
          PROBE_TIMEOUT,
        ),
      ),
    ]);
    if (!client)
      return {
        status: "misconfigured",
        driver,
        detail: "Не вдалося відкрити базу даних.",
      };
    // Запит до справжньої таблиці: перевіряє і з'єднання, і наявність схеми.
    await client.user.count();
    return { status: "ok", driver };
  } catch (error) {
    const detail = sanitize(
      error instanceof Error ? error.message : String(error),
    );
    return {
      status: looksLikeMissingTables(detail)
        ? "migrations-pending"
        : "unreachable",
      driver,
      detail,
    };
  }
}
