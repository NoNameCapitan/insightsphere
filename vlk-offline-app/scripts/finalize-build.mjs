import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
mkdirSync(".next/standalone/.next", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("public", ".next/standalone/public", { recursive: true });

// Версія кешу service worker прив'язана до збірки: після оновлення застосунку
// старі файли інтерфейсу видаляються, а не залишаються в браузері назавжди.
const buildId = readFileSync(".next/BUILD_ID", "utf8").trim();
const serviceWorker = ".next/standalone/public/sw.js";
if (existsSync(serviceWorker))
  writeFileSync(
    serviceWorker,
    readFileSync(serviceWorker, "utf8").replaceAll("__BUILD_ID__", buildId),
  );
console.log("Standalone: assets copied, service worker pinned to " + buildId);
