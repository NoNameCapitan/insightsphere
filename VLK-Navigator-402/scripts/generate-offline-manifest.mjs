import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const target = process.argv[2];
if (!["next", "vinext"].includes(target)) throw new Error("Expected next or vinext build target");
const root = process.cwd();
const assetRoot = path.join(root, target === "next" ? ".next/static" : "dist/client/assets");
const prefix = target === "next" ? "/_next/static/" : "/assets/";
const output = path.join(root, target === "next" ? "public" : "dist/client");
async function filesAt(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? filesAt(name) : /\.(js|css|woff2?)$/.test(name) ? [name] : [];
  }));
  return groups.flat().sort();
}
const files = await filesAt(assetRoot);
if (!files.some((f) => f.endsWith(".js")) || !files.some((f) => f.endsWith(".css"))) {
  throw new Error("Build assets are incomplete; refusing to publish an offline manifest");
}
const hash = createHash("sha256");
for (const file of files) { hash.update(path.relative(assetRoot, file)); hash.update(await readFile(file)); }
for (const file of ["sw.js", "vlk-command-emblem.png", "vlk-command-header.png"]) {
  hash.update(await readFile(path.join(root, "public", file)));
}
const manifest = { version: hash.digest("hex"), assets: files.map((file) => prefix + path.relative(assetRoot, file).split(path.sep).join("/")) };
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "offline-manifest.json"), JSON.stringify(manifest));
console.log(`Offline manifest: ${target}, ${files.length} assets, release ${manifest.version.slice(0, 12)}`);
