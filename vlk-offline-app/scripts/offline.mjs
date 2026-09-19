// Спільна основа офлайн-життєвого циклу: стан готовності, відбитки та перевірки.
// Модуль не має залежностей поза Node.js, тому працює до встановлення пакетів.
import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";
import { lookup } from "node:dns/promises";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const markerPath = join(root, ".offline-ready.json");
export const MARKER_FORMAT = 2;

// Жодного звернення до мережі під час звичайного запуску: телеметрія Next.js,
// перевірка версій Prisma та повідомлення про оновлення npm вимкнені.
// Інакше кожен офлайн-старт чекає на таймаут DNS.
export const offlineEnv = {
  NEXT_TELEMETRY_DISABLED: "1",
  DO_NOT_TRACK: "1",
  CHECKPOINT_DISABLE: "1",
  PRISMA_HIDE_UPDATE_MESSAGE: "1",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_update_notifier: "false",
};

export function applyOfflineEnv(env = process.env) {
  for (const [key, value] of Object.entries(offlineEnv))
    if (env[key] === undefined) env[key] = value;
  return env;
}

export function packageJson() {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function lockHash() {
  const path = join(root, "package-lock.json");
  return existsSync(path) ? hashFile(path) : "";
}

// Відбиток вихідного коду: якщо він змінився після збірки, .next застарів.
const fingerprintTargets = [
  "src",
  "public",
  "prisma/schema.prisma",
  "next.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "package.json",
];
const fingerprintSkip = new Set(["generated", "node_modules"]);

export function sourceFingerprint() {
  const digest = createHash("sha256");
  const walk = (relative) => {
    const absolute = join(root, relative);
    if (!existsSync(absolute)) return;
    if (statSync(absolute).isDirectory()) {
      for (const name of readdirSync(absolute).sort()) {
        if (fingerprintSkip.has(name) || name.startsWith(".")) continue;
        walk(join(relative, name));
      }
      return;
    }
    digest.update(relative.replaceAll("\\", "/")).update(hashFile(absolute));
  };
  for (const target of fingerprintTargets) walk(target);
  return digest.digest("hex");
}

export function migrationNames() {
  const path = join(root, "prisma/migrations");
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => existsSync(join(path, name, "migration.sql")))
    .sort();
}

export function buildId() {
  const path = join(root, ".next/BUILD_ID");
  return existsSync(path) ? readFileSync(path, "utf8").trim() : "";
}

export function databaseFile() {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv?.startsWith("file:")) return fromEnv.slice(5);
  const envFile = join(root, ".env");
  if (existsSync(envFile)) {
    const match = readFileSync(envFile, "utf8").match(
      /^\s*DATABASE_URL\s*=\s*"?(file:[^"\r\n]+)"?/m,
    );
    if (match) return match[1].slice(5);
  }
  return join(root, "data/vlk.sqlite");
}

export function readMarker() {
  if (!existsSync(markerPath)) return null;
  try {
    return JSON.parse(readFileSync(markerPath, "utf8"));
  } catch {
    return null;
  }
}

export function writeMarker() {
  const marker = {
    format: MARKER_FORMAT,
    app_version: packageJson().version,
    prepared_at: new Date().toISOString(),
    node: process.version,
    node_major: Number(process.versions.node.split(".")[0]),
    platform: process.platform,
    arch: process.arch,
    lock_hash: lockHash(),
    source_fingerprint: sourceFingerprint(),
    build_id: buildId(),
    migrations: migrationNames(),
  };
  writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n");
  return marker;
}

export function supportedNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major === 24 || (major === 22 && minor >= 12);
}

// Коротка проба мережі з власним таймаутом: офлайн-машина не має чекати
// на системний таймаут DNS у кілька десятків секунд.
export async function hasNetwork(timeout = 2500) {
  const host = "registry.npmjs.org";
  try {
    const { address } = await Promise.race([
      lookup(host),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("dns-timeout")), timeout),
      ),
    ]);
    return await new Promise((done) => {
      const socket = createConnection({ host: address, port: 443 });
      const finish = (value) => {
        socket.destroy();
        done(value);
      };
      socket.setTimeout(timeout, () => finish(false));
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
    });
  } catch {
    return false;
  }
}

export const tick = (ok) => (ok ? "✓" : "✗");

// Повний перелік умов автономної роботи. Кожен пункт має дію для виправлення.
export function readinessChecks() {
  const marker = readMarker();
  const items = [];
  const add = (id, label, ok, detail, fix) =>
    items.push({ id, label, ok, detail, fix });

  add(
    "node",
    "Node.js 22.12+ або 24",
    supportedNode(),
    process.version,
    "Встановіть Node.js 24 LTS і повторіть підготовку.",
  );

  const modules = existsSync(join(root, "node_modules/next/package.json"));
  add(
    "modules",
    "Залежності встановлені локально",
    modules,
    modules ? "node_modules/" : "немає node_modules",
    "Один раз з інтернетом: npm run prepare:offline",
  );

  let native = false;
  let nativeDetail = "не перевірено";
  try {
    const bindingPath = join(
      root,
      ".next/standalone/node_modules/@prisma/adapter-better-sqlite3/node_modules/better-sqlite3",
    );
    native =
      existsSync(join(root, "node_modules/better-sqlite3/lib/index.js")) ||
      existsSync(bindingPath);
    nativeDetail = native ? "better-sqlite3 на місці" : "модуль відсутній";
  } catch {
    /* залишаємо позначку невдачі */
  }
  add(
    "native",
    "Двійковий модуль SQLite для цієї платформи",
    native,
    nativeDetail,
    "Повторіть npm run prepare:offline на тій самій ОС і версії Node.js.",
  );

  const client = existsSync(join(root, "src/generated/prisma/client.ts"));
  add(
    "client",
    "Клієнт Prisma згенеровано",
    client,
    client ? "src/generated/prisma" : "немає згенерованого клієнта",
    "npm run db:generate",
  );

  const built =
    existsSync(join(root, ".next/BUILD_ID")) &&
    existsSync(join(root, ".next/standalone/server.js")) &&
    existsSync(join(root, ".next/standalone/.next/static")) &&
    existsSync(join(root, ".next/standalone/public"));
  add(
    "build",
    "Production-збірка готова",
    built,
    built ? "build " + buildId() : "немає .next/standalone",
    "npm run build",
  );

  const fresh = !!marker && marker.source_fingerprint === sourceFingerprint();
  add(
    "fresh",
    "Збірка відповідає вихідному коду",
    built && fresh,
    fresh ? "відбиток збігається" : "код змінено після збірки",
    "npm run build",
  );

  const env = existsSync(join(root, ".env"));
  add(
    "env",
    "Файл .env створено",
    env,
    env ? ".env" : "немає .env",
    "npm run setup",
  );

  const dbFile = databaseFile();
  const database = existsSync(dbFile);
  add(
    "database",
    "Локальна база SQLite існує",
    database,
    database ? dbFile : "немає " + dbFile,
    "npm run setup",
  );

  const platformOk =
    !marker ||
    (marker.platform === process.platform &&
      marker.arch === process.arch &&
      marker.node_major === Number(process.versions.node.split(".")[0]));
  add(
    "platform",
    "Пакет підготовлено для цієї ОС і версії Node.js",
    platformOk,
    marker
      ? marker.platform + "/" + marker.arch + " · Node " + marker.node_major
      : "позначки підготовки немає",
    "Повторіть npm run prepare:offline на цьому комп'ютері (потрібен інтернет).",
  );

  add(
    "marker",
    "Позначка автономної готовності",
    !!marker && marker.format === MARKER_FORMAT,
    marker ? "підготовлено " + marker.prepared_at : "немає .offline-ready.json",
    "npm run prepare:offline",
  );

  return { marker, items, ok: items.every((item) => item.ok) };
}
