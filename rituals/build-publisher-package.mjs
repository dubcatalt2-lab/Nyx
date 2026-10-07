import {sourceFile} from '../scripture/source-layout.mjs';
import { spawnSync } from 'node:child_process';
import { readdir, readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { staticBaseToken, validateStaticManifest } from '../chapels/jsdelivr-publisher/static-publish.js';

export async function buildPublisherPackage(root, dist) {
  const result = spawnSync(process.execPath, ['rituals/build-static-export.mjs', '--mini', '--publisher', `--base=${staticBaseToken}`,`--input=${dist}`], {
    cwd: root, encoding: 'utf8', maxBuffer: 4_000_000
  });
  if (result.status !== 0) throw Error(`Static publisher package failed: ${result.stderr || result.stdout}`);
  const { output } = JSON.parse(result.stdout.trim().split('\n').at(-1));
  const target = join(dist, 'apps/jsdelivr-publisher/static-package');
  const files = [];
  async function copy(directory) {
    for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const source = join(directory, item.name);
      if (item.isDirectory()) { await copy(source); continue; }
      const path = relative(output, source).replaceAll('\\', '/');
      if (['serve-mini.js', 'Start-Nyx-Mini.cmd', 'configure-host.js', 'hosting.json', 'START-HERE.txt'].includes(path)) continue;
      const bytes = await readFile(sourceFile(source));
      const encoding = /\.(?:html|svg|js|mjs|css|json|txt|webmanifest|xml)$/i.test(path) ? 'utf8' : 'base64';
      const file = join(target, 'files', path);
      await mkdir(join(file, '..'), { recursive: true });
      await copyFile(sourceFile(source), file);
      files.push({ path, bytes: bytes.length, encoding, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  await copy(output);
  const manifest = { format: 'nyx-static-package', schema: 1, revision: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files };
  validateStaticManifest(manifest);
  await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest));
  console.log(`Static publisher package: ${files.length} files, ${Math.ceil(files.reduce((sum, file) => sum + file.bytes, 0) / 1048576)} MiB; no hosted-site iframe.`);
}
