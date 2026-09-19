import "dotenv/config";
import { resolve, isAbsolute } from "node:path";
for (const [key, value] of Object.entries({
  NEXT_TELEMETRY_DISABLED: "1",
  DO_NOT_TRACK: "1",
  CHECKPOINT_DISABLE: "1",
}))
  process.env[key] ??= value;
// Шлях до бази не підставляється мовчки: без DATABASE_URL (з оточення або
// з .env, який створює setup) застосунок показує екран очікування з
// поясненням, а не відкриває порожню базу під виглядом робочої.
//
// Відносний file:-шлях доводиться до абсолютного саме тут: standalone-сервер
// виконує chdir у свій каталог, тому інакше CLI і сервер відкривали б різні
// файли. Цей скрипт ще працює в корені проєкту.
const url = process.env.DATABASE_URL;
if (url?.startsWith("file:")) {
  const file = url.slice(5);
  if (!isAbsolute(file)) process.env.DATABASE_URL = "file:" + resolve(file);
}
process.env.HOSTNAME = process.argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1";
await import("../.next/standalone/server.js");
