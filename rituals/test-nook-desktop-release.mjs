import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp, mkdir, writeFile, unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {installNookDesktopRelease} from '../scripture/nook-desktop-release.mjs';
const root = await mkdtemp(join(tmpdir(), 'nook-release-'));
const app = express(); installNookDesktopRelease(app, {root});
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
try {
  assert.equal((await fetch(origin + '/api/nook-desktop/release')).status, 503);
  const version = '0.1.0', file = 'Nook-Agent-0.1.0-windows-x64-setup.exe', bytes = Buffer.alloc(1000001, 1);
  await mkdir(join(root, version)); await writeFile(join(root, version, file), bytes);
  const release = {version, signed: false, artifacts: [{arch: 'x64', file, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}]};
  await writeFile(join(root, 'release.json'), JSON.stringify(release));
  const manifest = await (await fetch(origin + '/api/nook-desktop/release')).json();
  assert.equal(manifest.artifacts.length, 1); assert.equal(manifest.signed, false);
  const download = await fetch(origin + manifest.artifacts[0].url); assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.equal((await download.arrayBuffer()).byteLength, bytes.length);
  assert.equal((await fetch(origin + '/download/nook/0.1.0/other.exe')).status, 404);
  await unlink(join(root, version, file)); assert.equal((await fetch(origin + '/api/nook-desktop/release')).status, 503);
  release.artifacts[0].file = '../private'; await writeFile(join(root, 'release.json'), JSON.stringify(release)); assert.equal((await fetch(origin + '/api/nook-desktop/release')).status, 503);
  console.log('PASS missing-artifact hiding, exact manifest links, installer response, traversal rejection and removed-file recovery');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
