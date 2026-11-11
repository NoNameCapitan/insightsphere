#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseUrl = (process.env.DB_URL ?? process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  console.error("Missing DB_URL (or DATABASE_URL). Use a direct PostgreSQL connection string.");
  process.exit(2);
}
if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  console.error("DB_URL must be a PostgreSQL connection URL.");
  process.exit(2);
}

const sqlFile = fileURLToPath(new URL("./vetnear-003-postcheck.sql", import.meta.url));
const child = spawn(
  "psql",
  ["-X", "-v", "ON_ERROR_STOP=1", "-f", sqlFile],
  {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      // Keep the credential out of the process argument list.
      PGDATABASE: databaseUrl,
      PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT ?? "10",
    },
  },
);

child.on("error", (error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.error("psql is not installed or is not available in PATH.");
  } else {
    console.error("Could not start the database post-check.");
  }
  process.exit(2);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Database post-check stopped by signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
