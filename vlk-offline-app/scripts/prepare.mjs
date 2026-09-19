// Крок 1 життєвого циклу: єдиний запуск, якому потрібен інтернет.
// Після нього комп'ютер може працювати без мережі необмежено довго.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  root,
  applyOfflineEnv,
  hasNetwork,
  lockHash,
  readMarker,
  writeMarker,
  sourceFingerprint,
  supportedNode,
  readinessChecks,
  tick,
} from "./offline.mjs";

process.chdir(root);
applyOfflineEnv();

const force = process.argv.includes("--force");

function run(command, args, label) {
  console.log("\n> " + label);
  return new Promise((done, fail) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    child.on("error", fail);
    child.on("exit", (code) =>
      code === 0 ? done() : fail(new Error(label + ": код виходу " + code)),
    );
  });
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const node = process.execPath;

if (!supportedNode()) {
  console.error(
    "Потрібна Node.js 22.12+ або 24 LTS. Поточна версія: " + process.version,
  );
  process.exit(1);
}

const marker = readMarker();
const modulesReady =
  existsSync(join(root, "node_modules/next/package.json")) &&
  marker?.lock_hash === lockHash();

try {
  if (force || !modulesReady) {
    const online = await hasNetwork();
    if (!online && !existsSync(join(root, "node_modules/next/package.json"))) {
      console.error(
        [
          "",
          "Немає доступу до мережі, а залежності ще не встановлені.",
          "",
          "Підготовку потрібно виконати один раз на комп'ютері з інтернетом:",
          "  npm run prepare:offline",
          "",
          "Для комп'ютера, який ніколи не матиме мережі, підготуйте пакет",
          "на іншій машині з такою самою ОС і версією Node.js:",
          "  npm run pack:offline",
          "і перенесіть отриманий архів носієм. Докладно — docs/OFFLINE.md.",
          "",
        ].join("\n"),
      );
      process.exit(1);
    }
    if (!online)
      console.log(
        "Мережа недоступна — використовуємо локальний кеш npm (--offline).",
      );
    await run(
      npm,
      [
        "ci",
        "--no-audit",
        "--no-fund",
        online ? "--prefer-offline" : "--offline",
      ],
      "Встановлення залежностей",
    );
  } else {
    console.log(
      "Залежності вже встановлені та відповідають package-lock.json.",
    );
  }

  await run(
    node,
    [join(root, "node_modules/prisma/build/index.js"), "generate"],
    "Генерація клієнта Prisma",
  );
  await run(
    npm,
    ["run", "setup"],
    "Створення бази, адміністратора й довідника",
  );

  const stale = !marker || marker.source_fingerprint !== sourceFingerprint();
  if (force || stale || !existsSync(join(root, ".next/BUILD_ID")))
    await run(npm, ["run", "build"], "Production-збірка");
  else console.log("\nЗбірка актуальна — повторна не потрібна.");

  const written = writeMarker();
  const { items, ok } = readinessChecks();
  console.log("\nСтан автономної готовності:");
  for (const item of items)
    console.log("  " + tick(item.ok) + " " + item.label + " — " + item.detail);

  if (!ok) {
    console.error(
      "\nПідготовку не завершено. Виправте позначені пункти й повторіть.",
    );
    process.exit(1);
  }
  console.log(
    [
      "",
      "Готово. Інтернет більше не потрібен.",
      "Підготовлено для " +
        written.platform +
        "/" +
        written.arch +
        ", Node.js " +
        written.node +
        ".",
      "",
      "Щоденний запуск:      npm start        → http://localhost:3000",
      "Перевірка готовності: npm run offline:check",
      "Портативний пакет:    npm run pack:offline",
      "",
    ].join("\n"),
  );
} catch (error) {
  console.error("\n" + error.message);
  process.exit(1);
}
