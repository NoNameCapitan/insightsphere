import { cpSync, mkdirSync, existsSync } from "node:fs";

// На Vercel застосунок пакує сама платформа: standalone-каталогу немає,
// тому крок нічого не робить.
if (!existsSync(".next/standalone/server.js")) {
  console.log("Standalone: пропущено (збірка платформи).");
  process.exit(0);
}

mkdirSync(".next/standalone/.next", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
cpSync("public", ".next/standalone/public", { recursive: true });

console.log("Standalone: статичні файли та public скопійовано.");
