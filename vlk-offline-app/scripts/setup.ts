import "dotenv/config";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { ask } from "./prompt";
import { hashPassword } from "../src/lib/passwords";
process.umask(0o077);
const url = process.env.DATABASE_URL || "file:" + resolve("data/vlk.sqlite");
if (!url.startsWith("file:")) throw new Error("Потрібна локальна SQLite");
process.env.DATABASE_URL = url;
mkdirSync(dirname(url.slice(5)), { recursive: true });
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    'DATABASE_URL="' +
      url.replaceAll("\\", "/") +
      '"\nAPP_ORIGIN="http://localhost:3000"\nALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"\nNEXT_TELEMETRY_DISABLED=1\nCOMMISSION_NAME="ВЛК установи"\nORDER_402_REVISION="За редакцією, чинною на дату огляду"\n',
  );
// Генерація клієнта потрібна лише поряд із повним node_modules.
// Міграції застосовує локальний рушій: Prisma CLI в офлайні чекає
// на перевірку версій і сповільнює кожен запуск.
for (const [key, value] of Object.entries({
  NEXT_TELEMETRY_DISABLED: "1",
  DO_NOT_TRACK: "1",
  CHECKPOINT_DISABLE: "1",
  PRISMA_HIDE_UPDATE_MESSAGE: "1",
}))
  process.env[key] ??= value;
if (existsSync(resolve("node_modules/prisma/build/index.js")))
  execFileSync(
    process.execPath,
    [resolve("node_modules/prisma/build/index.js"), "generate"],
    { stdio: "inherit", env: process.env },
  );
execFileSync(process.execPath, [resolve("scripts/migrate-offline.mjs")], {
  stdio: "inherit",
  env: process.env,
});
const { db, ready } = await import("../src/db");
await ready();
if ((await db.user.count()) === 0) {
  console.log(
    "\nСтворення першого адміністратора. Спільного стандартного пароля немає.",
  );
  const username =
    process.env.BOOTSTRAP_ADMIN_USERNAME ||
    (await ask("Логін (латиниця, наприклад admin): "));
  const full_name =
    process.env.BOOTSTRAP_ADMIN_NAME || (await ask("ПІБ адміністратора: "));
  const password =
    process.env.BOOTSTRAP_ADMIN_PASSWORD ||
    (await ask("Пароль (щонайменше 12 символів, приховано): ", true));
  if (
    !/^[a-z0-9._-]{3,50}$/.test(username) ||
    full_name.length < 2 ||
    password.length < 12 ||
    password.length > 256
  )
    throw new Error(
      "Перевірте логін, ПІБ та довжину пароля. Запустіть setup знову.",
    );
  await db.user.create({
    data: {
      username,
      full_name,
      password_hash: await hashPassword(password),
      role: "ADMIN",
    },
  });
  console.log("Адміністратора створено: " + username);
}
if (
  (await db.icd10Entry.count()) === 0 &&
  existsSync("reference-data/icd10-ehealth-snapshot.json")
) {
  const { importCatalog } = await import("./import-icd");
  await importCatalog("reference-data/icd10-ehealth-snapshot.json");
}
await db.$disconnect();
console.log(
  "\nГотово. Далі: npm run build, потім npm start. Адреса: http://localhost:3000",
);
