// Import a reviewed, pinned upstream checkout; never fetch code at runtime.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { adaptAction } from './blooket-action-adapter.mjs';
const checkout = resolve(process.argv[2] || '.codex-artifacts/blooket-upstream');
const reference = resolve(process.argv[3] || '.codex-artifacts/blooket-reference/dist/catalog.json');
const revision = 'c322469ebbd192b6731480af76b1ac0a3d4a7b22';
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim() !== revision) throw Error('Unexpected upstream revision');
const target = resolve('apps/blooket');
await mkdir(join(target, 'upstream'), { recursive: true });
const entries = JSON.parse(await readFile(reference, 'utf8'));
function find(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'VariableDeclarator' && node.id?.name === 'cheat' && ['ArrowFunctionExpression', 'FunctionExpression'].includes(node.init?.type)) return node.init;
  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object') continue;
    for (const child of Array.isArray(value) ? value : [value]) { const result = find(child); if (result) return result; }
  }
  return null;
}
for (const entry of entries) {
  if (!/^[a-zA-Z0-9/-]+\.js$/.test(entry.path)) throw Error('Invalid path');
  const original = await readFile(join(checkout, 'cheats', entry.path), 'utf8');
  const node = find(parse(original, { ecmaVersion: 'latest' }));
  entry.code = node ? '/*! @license AGPL-3.0-or-later; Copyright (C) 2023-present 05Konz. See LICENSE.txt and upstream source. */\n(' + original.slice(node.start, node.end) + ')()' : '';
  if (node && entry.category !== 'interfaces') { const adapted = adaptAction(entry.code, entry.path); entry.code = adapted.code; entry.componentRequirements = adapted.expected; entry.requirements = adapted.requirements; entry.implementation = adapted.implementation; }
  delete entry.unsupportedReason;
  entry.note = node ? 'Upstream action; current Blooket compatibility unverified.' : 'Legacy interface. Browse its source; use this app for individual tools.';
  const destination = join(target, 'upstream', entry.path + '.txt');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, original);
}
await copyFile(join(checkout, 'LICENSE'), join(target, 'LICENSE.txt'));
await writeFile(join(target, 'catalog.json'), JSON.stringify({ revision, author: '05Konz', license: 'AGPL-3.0-or-later', entries }));
console.log(`Imported ${entries.length} tools; ${entries.filter(e => e.code && e.category !== 'interfaces').length} individual actions. Original source retained; update-check/reporting wrappers excluded.`);
