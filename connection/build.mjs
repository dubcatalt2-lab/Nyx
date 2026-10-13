import {build} from 'esbuild';
import {minify} from 'terser';
import {mkdir, writeFile, readFile, readdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {constants} from './constants.mjs';
import {transformWorkspaceStrings} from '../rituals/build-workspace-scramble.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');
const packages = new Set();
await mkdir(output, {recursive: true});
for (const name of await readdir(output)) {
  if (!['worker.js','client.js','isolated-worker.js','isolated-client.js','runtime.js','index.html','THIRD_PARTY_NOTICES.txt'].includes(name)) throw new Error('Unexpected output entry: ' + name);
}
for (const [source, name] of [['worker.mjs','worker.js'],['client.mjs','client.js'],['isolated-worker.mjs','isolated-worker.js'],['isolated-client.mjs','isolated-client.js'],['runtime.js','runtime.js']]) {
  const built = await build({absWorkingDir: root, entryPoints: [source], bundle: true, write: false, metafile: true, format: 'iife', platform: 'browser', target: 'es2022', legalComments: 'none', sourcemap: false});
  for (const file of Object.keys(built.metafile.inputs)) {
    const match = file.match(/^(?:\.\.\/)?node_modules\/(?:@[^/]+\/)?[^/]+/);
    if (match) packages.add(match[0]);
  }
  const result = await minify(built.outputFiles[0].text, {mangle: {toplevel: true, properties: {regex: /^_/}}, compress: {drop_console: true, dead_code: true, unused: true, passes: 3}, format: {comments: false}});
  await writeFile(resolve(output, name), transformWorkspaceStrings(constants(result.code)));
}
await writeFile(resolve(output, 'index.html'), await readFile(resolve(root, 'index.html')));
const notices = [];
for (const directory of [...packages].sort()) {
  const info = JSON.parse(await readFile(resolve(root, directory, 'package.json'), 'utf8'));
  const files = (await readdir(resolve(root, directory))).filter(name => /^(license|copying)(\.|$)/i.test(name));
  if (!files.length) throw new Error('No license found for ' + info.name);
  notices.push(info.name + ' ' + info.version);
  for (const file of files) notices.push(await readFile(resolve(root, directory, file), 'utf8'));
}
await writeFile(resolve(output, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n\n'));
const audit = spawnSync(process.execPath, [resolve(root, '../rituals/audit-release.mjs'), output, resolve(root, '../.codex-artifacts/connection-audit.json')], {stdio: 'inherit'});
if (audit.status !== 0) process.exit(audit.status || 1);
console.log('PASS original document application build');

