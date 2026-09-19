import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolve } from "node:path";

// У Prisma 7 URL бази задається тут, а не в datasource schema.prisma.
// Абсолютний шлях усуває розбіжності між CLI, Node.js та Docker.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL || `file:${resolve("data/vlk.sqlite")}`,
  },
});
