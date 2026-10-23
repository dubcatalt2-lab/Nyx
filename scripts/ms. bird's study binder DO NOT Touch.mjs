// Local release builder: readable source stays in place; obfuscation goes to dist.
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const once = process.argv.includes('--once');
let running = false, pending = false, stopped = false, timer, child;
function command(file) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [file], { cwd: root, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${file} exited ${code}`)));
  });
}
async function build() {
  if (running) { pending = true; return; }
  running = true; pending = false;
  try {
    await command('scripts/check-deploy.mjs');
    await command('scripts/check-branding.mjs');
    if (!stopped) await command('scripts/build-vps.mjs');
    if (!stopped) console.log('Obfuscated release ready in dist. No push or deployment performed.');
  } catch (error) {
    console.error(error.message);
    if (once) process.exitCode = 1;
  } finally {
    running = false;
    if (pending && !stopped) void build();
  }
}
const watcher = once ? null : watch(root, { recursive: true }, (_event, filename) => {
  const path = String(filename || '').replaceAll('\\', '/');
  if (!path || /(^|\/)(?:dist|node_modules|\.git|\.codex-artifacts|\.cache|backups)(\/|$)/.test(path)) return;
  if (!/^(?:apps|assets|css|js|lib|scripts|services)\//.test(path) && path.includes('/')) return;
  if (!/\.(?:html|css|js|mjs|json|svg|wasm|webmanifest)$/i.test(path)) return;
  clearTimeout(timer);
  timer = setTimeout(() => void build(), 2000);
});
watcher?.on('error', error => { console.error(error.message); process.exitCode = 1; watcher.close(); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopped = true; clearTimeout(timer); watcher?.close(); child?.kill();
});
console.log(once ? 'Building once.' : 'Watching source changes. Ctrl+C stops the watcher.');
await build();
