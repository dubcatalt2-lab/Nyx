import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const folder = await mkdtemp(join(tmpdir(), 'nyx-music-ui-'));
const fixture = join(folder, 'audio.mp3');
const made = spawnSync(require('@ffmpeg-installer/ffmpeg').path, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=125', '-c:a', 'libmp3lame', '-b:a', '32k', fixture]);
assert.equal(made.status, 0);
const bytes = await readFile(fixture);
const origin = process.env.NYX_TEST_BASE_URL || 'http://127.0.0.1:8198';
const server = process.env.NYX_TEST_BASE_URL ? null : spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '8198' }, stdio: 'ignore' });
let browser;
const tracks = [1, 2].map(id => ({ id: String(id), title: `Music fixture ${id}`, artist: 'Nyx test', duration: 125, catalog: 'deezer', cover: '', album: 'Test album' }));
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/healthz')).ok) break; } catch {} await new Promise(r => setTimeout(r, 150)); }
  browser = await chromium.launch();
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const errors = [], audioRequests = [];
    let failLookup = false, delayLookup = false;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const u = new URL(route.request().url()), path = u.pathname;
      if (path === '/api/nyxify/home') return route.fulfill({ json: { tracks, artists: [], albums: [] } });
      if (path === '/api/nyxify/search') return route.fulfill({ json: { data: tracks } });
      if (path === '/api/founder-profile/auth-config') return route.fulfill({ json: { enabled: false } });
      if (path.startsWith('/api/nyxify/playback/')) {
        if (delayLookup) await new Promise(r => setTimeout(r, 300));
        if (failLookup) return route.fulfill({ status: 404, json: { error: 'No matching full recording is available.' } });
        const id = path.split('/').pop();
        return route.fulfill({ json: { mode: 'meting', streamUrl: `/api/nyxify/audio/${id}`, title: `Music fixture ${id}`, durationSeconds: 125 } });
      }
      if (path.startsWith('/api/nyxify/audio/') || path.startsWith('/api/nyxify/stream/')) {
        audioRequests.push(path);
        const range = route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
        const start = Number(range?.[1] || 0), end = Math.min(Number(range?.[2] || bytes.length - 1), bytes.length - 1);
        return route.fulfill({ status: range ? 206 : 200, body: bytes.subarray(start, end + 1), contentType: 'audio/mpeg', headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}) } });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto(origin + '/apps/nyxify/');
    await page.locator('.row', { hasText: tracks[0].title }).first().dblclick();
    await page.waitForFunction(() => document.querySelector('audio').currentTime > .2);
    assert.match(await page.locator('audio').getAttribute('src'), /\/audio\/1$/);
    await page.locator('#playBtn').click();
    assert.ok(await page.locator('audio').evaluate(a => a.paused));
    await page.locator('#playBtn').click();
    await page.locator('#seekBar').evaluate(el => { el.value = '72'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForFunction(() => document.querySelector('audio').currentTime > 89);
    await page.locator('#nextBtn').click();
    await page.waitForFunction(() => document.querySelector('audio').src.endsWith('/audio/2') && document.querySelector('audio').currentTime > .2);
    assert.equal(await page.locator('#fullTrackVideo').isVisible(), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    delayLookup = true;
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.locator('.row', { hasText: tracks[0].title }).first().dblclick();
    await page.locator('#nextBtn').click();
    await page.waitForFunction(() => document.querySelector('audio').src.endsWith('/audio/2') && document.querySelector('audio').currentTime > .3);
    assert.match(await page.locator('#pTitle').textContent(), /fixture 2/);
    await page.close();

    // A fresh page rejects a missing match and labels the existing preview fallback.
    const failed = await browser.newPage({ viewport: { width, height: 850 } });
    let truncated = false;
    await failed.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/nyxify/home') return route.fulfill({ json: { tracks: truncated ? tracks.map(t => ({ ...t, duration: 600 })) : tracks, artists: [], albums: [] } });
      if (path.includes('/playback/')) return truncated
        ? route.fulfill({ json: { mode: 'meting', streamUrl: '/api/nyxify/audio/1', durationSeconds: 600 } })
        : route.fulfill({ status: 404, json: { error: 'No matching full recording is available.' } });
      if (path.includes('/stream/') || path.includes('/audio/')) return route.fulfill({ body: bytes, contentType: 'audio/mpeg' });
      return route.fulfill({ json: {} });
    });
    await failed.goto(origin + '/apps/nyxify/');
    await failed.locator('.row', { hasText: tracks[0].title }).first().dblclick();
    await failed.waitForFunction(() => document.querySelector('#musicPlaybackStatus').textContent.includes('short preview'));
    assert.match(await failed.locator('audio').getAttribute('src'), /\/stream\/1$/);
    truncated = true;
    await failed.reload();
    await failed.locator('.row', { hasText: tracks[0].title }).first().dblclick();
    await failed.waitForFunction(() => document.querySelector('#musicPlaybackStatus').textContent.includes('incomplete recording'));
    assert.match(await failed.locator('audio').getAttribute('src'), /\/stream\/1$/);
    await failed.close();
    console.log(`PASS ${width}px: native playback, pause/resume, seek control, next track, stale lookup isolation, layout, missing/truncated recording fallback.`);
  }
} finally { await browser?.close(); server?.kill(); await rm(folder, { recursive: true, force: true }); }
