import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function κωδικοποίηση(τιμή) {
  const key = [...randomBytes(32)];
  const bytes = Buffer.from(JSON.stringify(τιμή), "utf8");
  for (let θέση = 0; θέση < bytes.length; θέση++) bytes[θέση] ^= key[θέση % key.length];
  return { representation: "n7x-xor-1", key, chunks: bytes.toString("base64").match(/.{1,112}/g) || [] };
}

export async function buildGameCatalogs(output) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(output, "assets/studies/studies.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
  const aliases = {};
  async function δημοσίευση(path, τιμή) {
    const renamed = "/assets/studies/@r" + randomBytes(16).toString("hex") + "!.json";
    await writeFile(join(output, renamed.slice(1)), JSON.stringify(κωδικοποίηση(τιμή), null, 2) + "\n");
    aliases[path] = renamed;
    return renamed;
  }
  for (const catalog of manifest.catalogs) {
    for (const field of ["url", "coversUrl"]) {
      const path = catalog[field];
      if (!/^\/assets\/(?:ugs|gn-math|gms-studies)\/[a-z-]+\.json$/.test(path || "")) continue;
      catalog[field] = aliases[path] || await δημοσίευση(path,
        JSON.parse(await readFile(join(output, path.slice(1)), "utf8")));
    }
  }
  await δημοσίευση("/assets/studies/studies.json", manifest);
  await writeFile(join(output, "game-catalog-assets.json"), JSON.stringify({ version: 1, aliases }, null, 2) + "\n");
  // Other consumers retain their stable raw catalog endpoints.
  return { "/assets/studies/studies.json": aliases["/assets/studies/studies.json"] };
}
