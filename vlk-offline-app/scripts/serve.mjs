import "dotenv/config";
import { resolve } from "node:path";
for (const [key, value] of Object.entries({
  NEXT_TELEMETRY_DISABLED: "1",
  DO_NOT_TRACK: "1",
  CHECKPOINT_DISABLE: "1",
}))
  process.env[key] ??= value;
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "file:" + resolve("data/vlk.sqlite");
process.env.HOSTNAME = process.argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1";
await import("../.next/standalone/server.js");
