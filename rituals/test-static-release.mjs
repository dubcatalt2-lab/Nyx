import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, access, rm, realpath} from 'node:fs/promises';
import {join, resolve, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import express from 'express';
import {activateStaticRelease, currentStaticRoot, pruneStaticReleases} from '../mission/static-release.mjs';
import {buildOutputPath} from '../scripture/build-output.mjs';
import {publicAssetBoundary} from '../scripture/public-assets.mjs';

const project = await mkdtemp(join(tmpdir(), 'nyx-static-release-'));
const environment = join(project, 'nyx.env');
const previous = join(project, 'dist');
const next = join(project, '.nyx-releases', 'release-next', 'site');
const servers = [];
const aliases = {'/js/proxy-startup.mjs':'/js/proxy-startup.js'};
async function files(root, label) {
  await mkdir(join(root, 'js'), {recursive: true});
  await writeFile(join(root, 'index.html'), '<title>' + label + '</title>');
  await writeFile(join(root, 'public-modules.json'), JSON.stringify({aliases}));
  await writeFile(join(root, 'js/proxy-startup.js'), `export const release=${JSON.stringify(label)};`);
}
async function serve(root) {
  const app = express();
  app.use(publicAssetBoundary(root));
  app.use(express.static(root));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise(done => server.once('listening', done));
  return 'http://127.0.0.1:' + server.address().port;
}
async function moduleResponse(base, expected) {
  const response = await fetch(base + '/js/proxy-startup.mjs');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.match(await response.text(), new RegExp(expected));
}
try {
  await files(previous, 'old');
  await writeFile(environment, 'OTHER_SETTING=unchanged\nNYX_STATIC_ROOT=' + previous + '\n', {mode: 0o640});
  const oldServer = await serve(await currentStaticRoot(project, environment));
  const oldEnvironment = await readFile(environment, 'utf8');
  for (const invalid of ['.', '/', '../outside', '.nyx-releases', '.nyx-releases/release-next', 'scripture']) {
    assert.throws(() => buildOutputPath(project, invalid), /Build output/);
  }
  assert.equal(buildOutputPath(project, next), next);
  await mkdir(next, {recursive: true});
  await writeFile(join(next, 'index.html'), 'partially built');
  await assert.rejects(activateStaticRelease(project, environment, next));
  assert.equal(await readFile(environment, 'utf8'), oldEnvironment);
  await moduleResponse(oldServer, 'old');
  await writeFile(join(dirname(next), 'ready.json'), JSON.stringify({format:'nyx-static-release', version:1}));
  await writeFile(join(next, 'public-modules.json'), JSON.stringify({aliases}));
  await assert.rejects(activateStaticRelease(project, environment, next));
  await moduleResponse(oldServer, 'old');
  await files(next, 'new');
  await activateStaticRelease(project, environment, next);
  assert.equal(await currentStaticRoot(project, environment), next);
  assert.match(await readFile(environment, 'utf8'), /OTHER_SETTING=unchanged/);
  await moduleResponse(oldServer, 'old');
  const newServer = await serve(await currentStaticRoot(project, environment));
  await moduleResponse(newServer, 'new');
  const redirect = await fetch(newServer + '/js/proxy-startup.mjs', {redirect:'manual'});
  assert.equal(redirect.headers.get('cache-control'), 'no-store');
  await activateStaticRelease(project, environment, previous, {rollback:true});
  assert.equal(await currentStaticRoot(project, environment), previous);
  const unrelated = join(project, '.nyx-releases', 'unrelated');
  await mkdir(unrelated);
  for (let index = 0; index < 5; index++) {
    const release = join(project, '.nyx-releases', 'release-old' + index);
    await mkdir(release);
    await writeFile(join(release, 'ready.json'), JSON.stringify({format:'nyx-static-release', version:1}));
  }
  await pruneStaticReleases(project, next, previous);
  await access(unrelated);
  await access(next);
  console.log('PASS staged assets stay private until complete; old server remains readable through promotion; module MIME/compatibility, config preservation, rollback, output containment and bounded cleanup.');
} finally {
  for (const server of servers) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  const checked = await realpath(project);
  if (dirname(checked) !== await realpath(tmpdir()) || !checked.startsWith(resolve(tmpdir(), 'nyx-static-release-'))) throw new Error('Unsafe fixture cleanup path.');
  await rm(checked, {recursive:true, force:true});
}
