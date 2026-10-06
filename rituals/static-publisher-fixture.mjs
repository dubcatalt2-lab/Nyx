import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export async function staticPublisherFixture() {
  const root = resolve('.codex-artifacts/jsdelivr-static-fixture');
  const contents = {
    'index.html': '<!doctype html><title>Static Nyx fixture</title><p>Packaged application</p>',
    'Nyx.svg': '<svg xmlns="http://www.w3.org/2000/svg"><title>Static Nyx</title></svg>',
    'library-worker.js': 'const base="/__NYX_STATIC_BASE__/";',
    'pixel.bin': Buffer.from([0, 128, 255, 0])
  };
  const files = [];
  await mkdir(join(root, 'files'), { recursive: true });
  for (const [path, content] of Object.entries(contents)) {
    const bytes = Buffer.from(content);
    await writeFile(join(root, 'files', path), bytes);
    files.push({ path, bytes: bytes.length, encoding: typeof content === 'string' ? 'utf8' : 'base64', sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const manifest = { format: 'nyx-static-package', schema: 1, revision: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files };
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  return { root, manifest, contents };
}
