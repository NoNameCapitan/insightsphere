// Портативний пакет для комп'ютера, який ніколи не матиме інтернету.
// Містить уже встановлені залежності та готову збірку, але жодних
// медичних даних: data/, backups/ і .env свідомо виключені.
import { spawn } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  createReadStream,
  statSync,
  existsSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  root,
  applyOfflineEnv,
  readinessChecks,
  packageJson,
  tick,
} from "./offline.mjs";

process.chdir(root);
applyOfflineEnv();

// Усе, що стосується конкретної установи або пацієнтів, до архіву не потрапляє.
const excluded = [
  "./.git",
  "./data",
  "./backups",
  "./dist-offline",
  "./qa",
  "./.env",
  "./.env.local",
  "./.next/cache",
  "./node_modules/.cache",
  "*.sqlite",
  "*.sqlite-wal",
  "*.sqlite-shm",
  "*.vlkbak",
  "*.tsbuildinfo",
  "*.zip",
  "*.tar.gz",
];

const { items, ok, marker } = readinessChecks();
if (!ok || !marker) {
  console.error("Пакет можна зібрати лише з підготовленого застосунку.\n");
  for (const item of items.filter((row) => !row.ok))
    console.error("  " + tick(false) + " " + item.label + " → " + item.fix);
  console.error("\nСпочатку виконайте: npm run prepare:offline");
  process.exit(1);
}

const version = packageJson().version;
const name =
  "vlk-offline-standby-" +
  version +
  "-" +
  marker.platform +
  "-" +
  marker.arch +
  "-node" +
  marker.node_major;
const outputDir = join(root, "dist-offline");
mkdirSync(outputDir, { recursive: true });
const archive = join(outputDir, name + ".tar.gz");
if (existsSync(archive)) rmSync(archive);

// Опис пакета лежить поруч з архівом і всередині нього.
const manifest = {
  bundle: name,
  app_version: version,
  created_at: new Date().toISOString(),
  requires: {
    platform: marker.platform,
    arch: marker.arch,
    node_major: marker.node_major,
    node_prepared_with: marker.node,
  },
  build_id: marker.build_id,
  migrations: marker.migrations,
  contains_patient_data: false,
  note: "Двійкові модулі зібрані для вказаної ОС і версії Node.js. Для іншої платформи повторіть підготовку на ній.",
};
writeFileSync(
  join(root, "offline-bundle.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

const instructions = `# Портативний пакет ВЛК Offline / Standby

Пакет: ${name}
Створено: ${manifest.created_at}
Потрібно: ${marker.platform}/${marker.arch}, Node.js ${marker.node_major}.x
(перевірено на ${marker.node})

Архів не містить медичних даних, паролів і файлу .env.

## Встановлення на комп'ютері без інтернету

1. Встановіть Node.js ${marker.node_major} LTS з офіційного інсталятора,
   перенесеного окремо (nodejs.org, той самий носій).
2. Розпакуйте архів, наприклад у C:\\VLK\\vlk-offline-app.
3. Windows: двічі натисніть START-WINDOWS.cmd.
   Linux/macOS: виконайте bash start-local.sh.
4. Перший запуск створить .env, базу та попросить логін, ПІБ і пароль
   першого адміністратора. Інтернет не потрібен.
5. Відкрийте http://localhost:3000.

## Перевірка

    npm run offline:check -- --serve

## Оновлення

Нову версію готують на комп'ютері з інтернетом і переносять новим архівом.
Перед заміною зробіть резервну копію: npm run backup.
Папки data/ і backups/ зі старого встановлення не перезаписуйте.
`;
writeFileSync(join(root, "BUNDLE.md"), instructions);

const args = [
  "-czf",
  archive,
  "-C",
  root,
  ...excluded.map((pattern) => "--exclude=" + pattern),
  ".",
];

console.log("Збирання пакета " + name + " …");
const code = await new Promise((done, fail) => {
  const child = spawn("tar", args, { stdio: ["ignore", "inherit", "inherit"] });
  child.on("error", () =>
    fail(
      new Error(
        "Не знайдено програму tar. У Windows 10/11 і Linux/macOS вона є штатно.",
      ),
    ),
  );
  child.on("exit", done);
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
if (code !== 0) {
  console.error("tar завершився з кодом " + code);
  process.exit(1);
}

const digest = await new Promise((done, fail) => {
  const hash = createHash("sha256");
  createReadStream(archive)
    .on("data", (chunk) => hash.update(chunk))
    .on("error", fail)
    .on("end", () => done(hash.digest("hex")));
});
writeFileSync(archive + ".sha256", digest + "  " + name + ".tar.gz\n");
writeFileSync(
  join(outputDir, name + ".json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
writeFileSync(join(outputDir, name + ".md"), instructions);

const size = statSync(archive).size / 1024 / 1024;
console.log(
  [
    "",
    "Готово.",
    "  Архів:      " + archive,
    "  Розмір:     " + size.toFixed(0) + " МБ",
    "  SHA-256:    " + digest,
    "  Платформа:  " +
      marker.platform +
      "/" +
      marker.arch +
      ", Node.js " +
      marker.node_major,
    "",
    "Медичних даних, паролів і .env в архіві немає.",
    "Інструкція для цільового комп'ютера: " + join(outputDir, name + ".md"),
    "",
  ].join("\n"),
);
