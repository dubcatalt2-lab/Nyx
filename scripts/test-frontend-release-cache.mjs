import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {buildFrontendAssets, unpackPublishedDocument} from './build-frontend-assets.mjs';

// Keep both builds so a stale-cache collision can be reproduced and inspected.
await mkdir('.codex-artifacts', {recursive:true});
const root = await mkdtemp('.codex-artifacts/release-cache-');
const releases = [];
for (const revision of ['old', 'new']) {
  const output = join(root, revision);
  await mkdir(join(output, 'apps/chat'), {recursive:true});
  await writeFile(join(output, 'proxy-assets.json'), JSON.stringify({aliases:{}}));
  await writeFile(join(output, 'apps/chat/index.html'), '<!doctype html><script type="module" src="./app.js"></script>');
  await writeFile(join(output, 'apps/chat/app.js'), `import {value} from './helper.js'; window.result = value;`);
  await writeFile(join(output, 'apps/chat/helper.js'), `export const value = ${JSON.stringify(revision)};`);
  await buildFrontendAssets(output, ['apps/chat/index.html','apps/chat/app.js','apps/chat/helper.js'], '');
  const {aliases} = JSON.parse(await readFile(join(output, 'frontend-assets.json')));
  const {pages} = JSON.parse(await readFile(join(output, 'published-pages.json')));
  const entry = pages['apps/chat/index.html'];
  const document = await unpackPublishedDocument(output, entry);
  assert(document.includes(aliases['/apps/chat/app.js'].split('/').at(-1)));
  const script = await readFile(join(output, aliases['/apps/chat/app.js'].slice(1)), 'utf8');
  assert(script.includes(aliases['/apps/chat/helper.js'].split('/').at(-1)));
  releases.push({aliases, entry});
}
assert.notEqual(releases[0].entry.loader, releases[1].entry.loader, 'cached document loaders must not survive a release');
for (const path of Object.keys(releases[0].aliases)) {
  assert.notEqual(releases[0].aliases[path], releases[1].aliases[path], path + ' must get a fresh URL, including unchanged importers');
}
console.log('PASS successive releases use distinct encoded loaders and script URLs with matching imports.');
