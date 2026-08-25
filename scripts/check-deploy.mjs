import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "index.html",
  "about-nyx.html",
  "robots.txt",
  "sitemap.xml",
  "server.js",
  "script.js",
  "startup.js",
  "styles.css",
  "uv.config.js",
  "uv.sw.js",
  "scramjet.sw.js",
  "js/loading-screen.js",
  "css/core.css",
  "css/chrome-and-settings.css",
  "css/fresh-theme.css",
  "css/interface-polish.css",
  "css/midnight-theme.css",
  "apps/link-checker/index.html",
  "apps/link-checker/styles.css",
  "apps/link-checker/app.js",
  "apps/chat/index.html",
  "apps/chat/styles.css",
  "apps/chat/app.js",
  "apps/utility-shell.css",
  "apps/link-generator/index.html",
  "apps/link-generator/styles.css",
  "apps/link-generator/app.js",
  "apps/cloud-gaming/index.html",
  "apps/cloud-gaming/styles.css",
  "apps/cloud-gaming/app.js",
  "assets/icons/cloud-gaming.svg",
  "apps/nyxify/index.html",
  "apps/nyxify/app.css",
  "apps/nyxify/icons.css",
  "apps/nyxify/app.js",
  "assets/icons/shortcut-nyxify.svg",
  "assets/games/index.html",
  "assets/ugs/play.html",
  "deploy/nginx/nyx.conf.template",
  "deploy/caddy/nyx.Caddyfile.template",
  "deploy/systemd/nyx.service.template",
  "deploy/systemd/nyx-stratus.service.template",
  "deploy/nyx.env.example",
  "deploy/stratus.env.example",
  "services/stratus/package.json",
  "services/stratus/package-lock.json",
  "services/stratus/README.md",
  "services/stratus/launcher.mjs",
  "services/stratus/check.mjs",
  "services/stratus/smoke.mjs",
  "services/stratus/upstream/api.js",
  "services/stratus/upstream/public/e.html",
  "services/stratus/UPSTREAM-LICENSE",
  "deploy/setup-ovh.sh",
  "deploy/update-ovh.sh",
  "deploy/install-ytdlp.sh",
  "deploy/requirements-yt-dlp.txt"
];

const missing = [];
for (const file of requiredFiles) {
  try {
    await access(file);
  } catch {
    missing.push(file);
  }
}

if (missing.length) {
  console.error("Deployment is missing required files:");
  missing.forEach(file => console.error(`  - ${file}`));
  console.error("Add and commit these files before deploying.");
  process.exit(1);
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
for (const dependency of ["express", "firebase-admin", "@mercuryworkshop/wisp-js"]) {
  if (!packageJson.dependencies?.[dependency]) {
    console.error(`Deployment dependency is missing: ${dependency}`);
    process.exit(1);
  }
}

const stratusCheck = spawnSync(process.execPath, ["services/stratus/check.mjs"], { encoding: "utf8" });
if (stratusCheck.status !== 0) {
  console.error("The pinned Stratus service check failed:");
  console.error(String(stratusCheck.stderr || stratusCheck.stdout || "Unknown Stratus check failure.").trim());
  process.exit(1);
}

console.log(`Deployment check passed (${requiredFiles.length} required files found).`);
