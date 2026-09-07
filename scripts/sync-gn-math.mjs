import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(root, "assets", "gn-math", "games.json");
const source = "https://github.com/genizy/npm";
const catalogSource = "https://raw.githubusercontent.com/freebuisness/assets/main/zones.json";
const htmlSource = "https://github.com/freebuisness/html";
const coverSource = "https://github.com/freebuisness/covers";
const safeHtmlPath = /^[a-z0-9_.-]+\.html(?:-[a-z0-9]+)?$/i;
const safeAssetPath = /^[a-z0-9_./-]+$/i;

const response = await fetch(catalogSource, {
  headers: {
    accept: "application/json",
    "user-agent": "nyx-gn-math-sync/1.0"
  }
});
if (!response.ok) throw new Error(`GN Math catalog returned HTTP ${response.status}`);

const zones = await response.json();
if (!Array.isArray(zones)) throw new Error("GN Math catalog is not an array");

const games = zones.map(zone => {
  const path = String(zone?.url || "").replace(/^\{HTML_URL\}\/?/i, "");
  if (!safeHtmlPath.test(path)) return null;
  const coverPath = String(zone?.cover || "").replace(/^\{COVER_URL\}\/?/i, "");
  if (coverPath && !safeAssetPath.test(coverPath)) throw new Error(`Unsafe GN Math cover path: ${coverPath}`);
  return {
    id: String(zone.id ?? ""),
    path,
    title: String(zone.name || path.replace(/\.html(?:-[a-z0-9]+)?$/i, "")),
    author: String(zone.author || ""),
    authorLink: String(zone.authorLink || ""),
    tags: Array.isArray(zone.special) ? zone.special.map(tag => String(tag)) : [],
    cover: coverPath ? `/gn-math-asset?repo=covers&path=${encodeURIComponent(coverPath)}` : "",
    rawUrl: `https://raw.githubusercontent.com/freebuisness/html/main/${path}`,
    coverFallback: coverPath ? `https://raw.githubusercontent.com/freebuisness/covers/main/${coverPath}` : ""
  };
}).filter(Boolean).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

if (games.length < 100) throw new Error(`GN Math catalog unexpectedly contains only ${games.length} games`);
if (new Set(games.map(game => game.id)).size !== games.length) throw new Error("GN Math catalog contains duplicate game IDs");

const catalog = {
  source,
  catalogSource,
  htmlSource,
  coverSource,
  generatedAt: new Date().toISOString(),
  count: games.length,
  games
};
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Updated ${outputPath} with ${games.length} GN Math games.`);
