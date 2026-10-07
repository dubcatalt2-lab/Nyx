import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const folder = await mkdtemp(join(tmpdir(), 'nyx-music-ui-'));
const fixture = join(folder, 'audio.mp3');
const made = spawnSync(require('@ffmpeg-installer/ffmpeg').path, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=125', '-c:a', 'libmp3lame', '-b:a', '32k', fixture]);
assert.equal(made.status, 0);
const bytes = await readFile(sourceFile(fixture));
const staticRoot = join(folder, 'site');
await symlink(resolve(process.env.NYX_TEST_ASSET_ROOT || '.'), staticRoot, process.platform === 'win32' ? 'junction' : 'dir');
const app=express();app.use(express.static(staticRoot));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
let workspace;
const tracks = [1, 2].map(id => ({ id: String(id), title: `Music fixture ${id}`, artist: 'Nyx test', duration: 125, catalog: 'deezer', cover: '', album: 'Test album' }));
try {
  workspace = await chromium.launch();
  for (const width of [1280, 390]) {
    let page = await workspace.newPage({ viewport: { width, height: 850 } });
    await page.addInitScript(() => {
      localStorage.setItem('nyx_nyxify_volume', 'invalid');
      localStorage.setItem('nyx_nyxify_history', '{}');
      localStorage.setItem('nyx_nyxify_likes', '[null]');
      localStorage.setItem('nyx_nyxify_repeat', 'invalid');
    });
    const errors = [], audioRequests = [];
    const previewRequests = [];
    page.on('request', r => { if(r.url().includes('/api/nyxify/stream/')) previewRequests.push(r.url()); });
    let failLookup = false, delayLookup = false, busyLookup = 0, failAudio = 0;
    let lookups = 0, firstTrackLookups = 0;
    page.on('pageerror', e => { errors.push(e.message); if(process.env.NYX_TEST_DEBUG)console.log('PAGEERROR',e.message); });
    await page.route('**/api/**', async route => {
      const u = new URL(route.request().url()), path = u.pathname;
      if (path === '/api/nyxify/home') return route.fulfill({ json: { tracks, artists: [], albums: [] } });
      if (path === '/api/nyxify/search') return route.fulfill({ json: { data: tracks } });
      if (path === '/api/founder-profile/auth-config') return route.fulfill({ json: { enabled: false } });
      if (path.startsWith('/api/nyxify/playback/')) {
        lookups++;
        if (path.endsWith("/1")) firstTrackLookups++;
        if (busyLookup > 0) { busyLookup--; return route.fulfill({ status: 503, json: { error: 'Music lookup is busy.' }, headers: { 'Retry-After': '1' } }); }
        if (delayLookup) await new Promise(r => setTimeout(r, 300));
        if (failLookup) return route.fulfill({ status: 404, json: { error: 'No matching full recording is available.' } });
        const id = path.split('/').pop();
        return route.fulfill({ json: { mode: 'meting', streamUrl: `/api/nyxify/audio/${id}`, title: `Music fixture ${id}`, durationSeconds: 125 } });
      }
      if (path.startsWith('/api/nyxify/audio/') || path.startsWith('/api/nyxify/stream/')) {
        if (path.includes('/audio/') && failAudio > 0) { failAudio--; return route.fulfill({ status: 502, body: 'Temporary audio failure' }); }
        audioRequests.push(path);
        const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
        const start = Number(range?.[1] || 0), end = Math.min(Number(range?.[2] || bytes.length - 1), bytes.length - 1);
        return route.fulfill({ status: range ? 206 : 200, body: bytes.subarray(start, end + 1), contentType: 'audio/mpeg', headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}) } });
      }
      return route.fulfill({ json: {} });
    });
    const hostPage=page;
    if(process.env.NYX_TEST_SHELL){
      await page.addInitScript(()=>{localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.workspaceShellMode','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');});
      await page.goto(origin+'/');
      await page.getByRole('button',{name:'Got it',exact:true}).click();
      await page.locator('[data-nyx-dock-item="music"]').click();
      await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.src.includes('/apps/nyxify/')));
      page=page.frames().find(f=>f.url().includes('/apps/nyxify/'));
    }else await page.goto(origin + '/apps/nyxify/');
    const firstRow = page.locator('.row', { hasText: tracks[0].title }).first();
    await firstRow.focus();
    await hostPage.waitForResponse(r => r.url().includes('/playback/1') && r.url().includes('prefetch=1'));
    assert.equal(firstTrackLookups, 1);
    assert.equal(audioRequests.length, 0, 'Intent preload only resolves metadata, without downloading or playing music');
    await page.locator('.row', { hasText: tracks[0].title }).first().dblclick();
    await page.waitForFunction(() => document.querySelector('audio').currentTime > .2);
    assert.match(await page.locator('audio').getAttribute('src'), /\/audio\/1$/);
    assert.equal(firstTrackLookups, 1, 'Clicking reuses the prepared match');
    await hostPage.screenshot({ path: `.codex-artifacts/music-loading-${width}.png` });


    async function finishTrack(){
      await page.locator('audio').evaluate(a=>a.currentTime=a.duration-.15);
    }
    await page.locator('#repeatBtn').click();
    assert.match(await page.locator('#repeatBtn').getAttribute('aria-label'),/Repeat: Queue/);
    await page.locator('#repeatBtn').click();
    assert.match(await page.locator('#repeatBtn').getAttribute('aria-label'),/Repeat: Song/);
    await finishTrack();
    await page.waitForFunction(()=>{const a=document.querySelector('audio');return a.currentTime>.2&&a.currentTime<5&&!a.paused;});
    assert.match(await page.locator('audio').getAttribute('src'),/audio\/1$/);
    await page.locator('#nextBtn').click();
    await page.waitForFunction(()=>{const a=document.querySelector('audio');return a.src.endsWith('/audio/2')&&a.currentTime>.2;});
    await page.locator('#repeatBtn').click();
    await page.locator('#repeatBtn').click();
    await finishTrack();
    await page.waitForFunction(()=>{const a=document.querySelector('audio');return a.src.endsWith('/audio/1')&&a.currentTime>.2;});
    await page.locator('#repeatBtn').click();
    await page.locator('#repeatBtn').click();
    await page.locator('#nextBtn').click();
    await page.waitForFunction(()=>{const a=document.querySelector('audio');return a.src.endsWith('/audio/2')&&a.currentTime>.2;});
    await finishTrack();
    await page.waitForFunction(()=>document.querySelector('audio').ended);
    assert.equal(await page.locator('#repeatBtn').getAttribute('aria-pressed'),'false');
    assert.deepEqual(errors,[]);
    await hostPage.close();
  }
  console.log('PASS repeat one, repeat all, off at queue end and manual next on desktop/mobile with real audio');
}finally{
 await workspace?.close();server.closeAllConnections();await new Promise(r=>server.close(r));
 await rm(folder,{recursive:true,force:true});
}
