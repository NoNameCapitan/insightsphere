import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { db, ready } from "../src/db";
const schema = z.object({
  version: z.string().min(1).max(200),
  source: z.string().min(1).max(1000),
  note: z.string().optional(),
  entries: z
    .array(
      z.object({
        code: z.string().regex(/^[A-Z]\d{2}(?:\.[A-Z0-9]{1,5})?$/),
        title: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(60000),
});
export async function importCatalog(path: string) {
  await ready();
  const bytes = readFileSync(path);
  if (bytes.length > 30_000_000) throw new Error("Довідник перевищує 30 МБ");
  const data = schema.parse(JSON.parse(bytes.toString("utf8")));
  if (new Set(data.entries.map((e) => e.code)).size !== data.entries.length)
    throw new Error("У довіднику дублікати кодів");
  const sha = createHash("sha256").update(bytes).digest("hex"),
    existing = await db.icd10Entry.findFirst({
      where: { catalog_version: data.version },
    });
  if (existing && existing.source_sha256 !== sha)
    throw new Error(
      "Ця версія вже має інший зміст. Використайте новий ідентифікатор версії.",
    );
  if (existing) {
    console.log("Довідник цієї версії вже встановлено.");
    return;
  }
  await db.$transaction(
    async (tx) => {
      for (let i = 0; i < data.entries.length; i += 200) {
        await tx.icd10Entry.createMany({
          data: data.entries.slice(i, i + 200).map((e) => ({
            code: e.code,
            catalog_version: data.version,
            title_uk: e.title,
            search_text: (e.code + " " + e.title)
              .normalize("NFKC")
              .toLocaleLowerCase("uk"),
            source_uri: data.source,
            source_sha256: sha,
          })),
        });
      }
    },
    { timeout: 120000 },
  );
  console.log("Імпортовано " + data.entries.length + " кодів: " + data.version);
  if (data.note) console.log(data.note);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (!process.argv[2]) throw new Error("Вкажіть шлях до JSON-каталогу");
    await importCatalog(process.argv[2]);
  } finally {
    await db.$disconnect();
  }
}
