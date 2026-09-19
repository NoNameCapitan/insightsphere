// Єдина точка запуску для працівника установи.
// Перший запуск (з інтернетом) готує пакет, усі наступні працюють без мережі.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  root,
  applyOfflineEnv,
  readinessChecks,
  writeMarker,
  hasNetwork,
  supportedNode,
  tick,
} from "./offline.mjs";

process.chdir(root);
applyOfflineEnv();

const lan = process.argv.includes("--lan");
const openBrowser = process.argv.includes("--open");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args, label) {
  console.log("\n> " + label);
  return new Promise((done, fail) => {
    const child = spawn(npm, args, {
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

if (!supportedNode()) {
  console.error(
    "Потрібна Node.js 22.12+ або 24 LTS (nodejs.org). Поточна: " +
      process.version,
  );
  process.exit(1);
}

try {
  let state = readinessChecks();
  const failed = (id) => state.items.some((item) => item.id === id && !item.ok);

  // Що саме вимагає інтернету: лише встановлення залежностей.
  const needsInstall = failed("modules") || failed("native");
  const needsFirstRun =
    needsInstall || failed("client") || failed("env") || failed("database");

  if (needsFirstRun) {
    console.log(
      needsInstall
        ? "\nПерший запуск: потрібне одноразове підключення до інтернету."
        : "\nЗавершення початкового налаштування (мережа не потрібна).",
    );
    if (needsInstall && !(await hasNetwork())) {
      console.error(
        [
          "",
          "Інтернет недоступний, а залежності ще не встановлені.",
          "",
          "Зробіть одне з двох:",
          "  1. Підключіть інтернет один раз і запустіть цей файл знову.",
          "  2. На комп'ютері з такою самою ОС і версією Node.js виконайте",
          "     npm run pack:offline і перенесіть готовий архів носієм.",
          "",
          "Докладно — docs/OFFLINE.md.",
          "",
        ].join("\n"),
      );
      process.exit(1);
    }
    await run(["run", "prepare:offline"], "Підготовка пакета");
    state = readinessChecks();
  } else {
    // Звичайний офлайн-старт: міграції застосовуються локальним рушієм,
    // без Prisma CLI, тому жоден крок не звертається до мережі.
    const { applyMigrations } = await import("./migrate-offline.mjs");
    applyMigrations({ quiet: true });

    if (failed("build") || failed("fresh")) {
      console.log(
        "\nВихідний код змінився після збірки — збираємо заново (локально).",
      );
      await run(["run", "build"], "Production-збірка");
      writeMarker();
      state = readinessChecks();
    }
  }

  if (!state.ok) {
    console.error("\nЗапуск неможливий:");
    for (const item of state.items.filter((row) => !row.ok))
      console.error("  " + tick(false) + " " + item.label + " → " + item.fix);
    console.error("\nДіагностика: npm run offline:check");
    process.exit(1);
  }

  const port = process.env.PORT || "3000";
  const address = "http://localhost:" + port;
  console.log(
    [
      "",
      "ВЛК Offline / Standby — локальний сервер запущено.",
      "Інтернет для роботи не потрібен.",
      "",
      "  Адреса:  " + address,
      "  Режим:   " + (lan ? "локальна мережа установи" : "лише цей комп'ютер"),
      "",
      "Це вікно залишайте відкритим. Зупинка — Ctrl+C.",
      "",
    ].join("\n"),
  );

  if (openBrowser) {
    const opener =
      process.platform === "win32"
        ? ["cmd", ["/c", "start", "", address]]
        : process.platform === "darwin"
          ? ["open", [address]]
          : ["xdg-open", [address]];
    setTimeout(() => {
      try {
        spawn(opener[0], opener[1], {
          stdio: "ignore",
          detached: true,
        }).unref();
      } catch {
        /* браузер відкриється вручну */
      }
    }, 1500);
  }

  await run(["run", lan ? "start:lan" : "start"], "Локальний сервер");
} catch (error) {
  console.error("\n" + error.message);
  console.error("Діагностика: npm run offline:check");
  process.exit(1);
}
