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
    await page.addInitScript(() => {
      localStorage.setItem('nyx_nyxify_volume', 'invalid');
      localStorage.setItem('nyx_nyxify_history', '{}');
      localStorage.setItem('nyx_nyxify_likes', '[null]');
      localStorage.setItem('nyx_nyxify_repeat', 'invalid');
    });
    const errors = [], audioRequests = [];
    let failLookup = false, delayLookup = false, busyLookup = 0, failAudio = 0;
    let lookups = 0;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const u = new URL(route.request().url()), path = u.pathname;
      if (path === '/api/nyxify/home') return route.fulfill({ json: { tracks, artists: [], albums: [] } });
      if (path === '/api/nyxify/search') return route.fulfill({ json: { data: tracks } });
      if (path === '/api/founder-profile/auth-config') return route.fulfill({ json: { enabled: false } });
      if (path.startsWith('/api/nyxify/playback/')) {
        lookups++;
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
    async function restart() {
      await page.evaluate(() => sessionStorage.clear());
      await page.reload();
    }
    async function selectFirst() { await page.locator('.row', { hasText: tracks[0].title }).first().dblclick(); }
    async function playing() { await page.waitForFunction(() => document.querySelector('audio').src.endsWith('/audio/1') && document.querySelector('audio').currentTime > .2); }
    busyLookup = 1;
    await restart(); await selectFirst(); await playing();
    assert.equal(busyLookup, 0);
    assert.match(await page.locator('#playerPlaybackStatus').textContent(), /full song/);
    failAudio = 1;
    await restart(); const beforeRetry = lookups;
    await selectFirst(); await playing();
    assert.ok(lookups >= beforeRetry + 2, 'failed audio renews its match');
    delayLookup = true;
    await restart(); await selectFirst();
    await page.locator('#playBtn').click();
    await page.waitForFunction(() => document.querySelector('audio').readyState >= 1);
    assert.ok(await page.locator('audio').evaluate(a => a.paused), 'pause during lookup prevents autoplay');
    await page.locator('#playBtn').click(); await playing();
    delayLookup = false;
    await restart();
    await page.evaluate(() => {
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        HTMLMediaElement.prototype.play = original;
        return Promise.reject(new DOMException('User gesture required', 'NotAllowedError'));
      };
    });
    await selectFirst();
    await page.waitForFunction(() => document.querySelector('#playerPlaybackStatus').textContent.includes('press play'));
    await page.locator('#playBtn').click(); await playing();
    delayLookup = true;
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.locator('.row', { hasText: tracks[0].title }).first().dblclick();
    await page.locator('#nextBtn').click();
    await page.waitForFunction(() => document.querySelector('audio').src.endsWith('/audio/2') && document.querySelector('audio').currentTime > .3);
    assert.match(await page.locator('#pTitle').textContent(), /fixture 2/);
    delayLookup = false;
    await restart();
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); }; });
    await selectFirst(); await playing();
    if (width >= 600) {
      await page.locator('#shuffleBtn').click();
      await page.locator('#repeatBtn').click();
    }
    assert.deepEqual(errors, [], 'corrupt/full storage does not crash playback or controls');
    await page.close();

    // A browser-side hung lookup is bounded, rather than spinning forever.
    const hung = await browser.newPage({ viewport: { width, height: 850 } });
    await hung.clock.install();
    await hung.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/nyxify/home') return route.fulfill({ json: { tracks, artists: [], albums: [] } });
      if (path.includes('/stream/')) return route.fulfill({ body: bytes, contentType: 'audio/mpeg' });
      return route.fulfill({ json: {} });
    });
    await hung.goto(origin + '/apps/nyxify/');
    await hung.evaluate(() => {
      const original = window.fetch;
      window.fetch = (url, options) => String(url).includes('/playback/')
        ? new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
        : original(url, options);
    });
    await hung.locator('.row', { hasText: tracks[0].title }).first().dblclick();
    await hung.clock.fastForward(26_000);
    await hung.waitForFunction(() => document.querySelector('#playerPlaybackStatus').textContent.includes('took too long'));
    assert.match(await hung.locator('audio').getAttribute('src'), /\/stream\/1$/);
    await hung.close();

    const offline = await browser.newPage({ viewport: { width, height: 850 } });
    await offline.clock.install();
    let offlineLookups = 0;
    await offline.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/nyxify/home') return route.fulfill({ json: { tracks, artists: [], albums: [] } });
      if (path.includes('/playback/')) { offlineLookups++; return route.fulfill({ json: { mode: 'meting', streamUrl: '/api/nyxify/audio/1', durationSeconds: 125 } }); }
      if (path.includes('/audio/') || path.includes('/stream/')) return route.fulfill({ body: bytes, contentType: 'audio/mpeg' });
      return route.fulfill({ json: {} });
    });
    await offline.goto(origin + '/apps/nyxify/');
    await offline.locator('.row', { hasText: tracks[0].title }).first().dblclick();
    await offline.waitForFunction(() => document.querySelector('audio').currentTime > .2);
    await offline.context().setOffline(true);
    await offline.evaluate(() => {
      const a = document.querySelector('audio');
      Object.defineProperty(a, 'error', { configurable: true, get: () => ({ code: 2 }) });
      a.dispatchEvent(new Event('error'));
    });
    await offline.waitForFunction(() => document.querySelector('#playerPlaybackStatus').textContent.includes('offline'));
    await offline.context().setOffline(false);
    await offline.waitForFunction(() => document.querySelector('#playerPlaybackStatus').textContent.includes('full song'));
    await offline.evaluate(() => { delete document.querySelector('audio').error; });
    await offline.waitForFunction(() => document.querySelector('audio').currentTime > .2);
    assert.ok(offlineLookups >= 2);
    await offline.evaluate(() => {
      Object.defineProperty(document.querySelector('audio'), 'currentTime', { configurable: true, get: () => 0, set() {} });
      document.querySelector('audio').dispatchEvent(new Event('timeupdate'));
    });
    await offline.clock.fastForward(55_000);
    await offline.waitForFunction(() => document.querySelector('#playerPlaybackStatus').textContent.includes('stopped responding'));
    assert.match(await offline.locator('audio').getAttribute('src'), /\/stream\/1$/);
    await offline.close();

    // A fresh page rejects a missing match and labels the existing preview fallback.
    const failed = await browser.newPage({ viewport: { width, height: 850 } });
    const restrictedErrors = [];
    failed.on('pageerror', e => restrictedErrors.push(e.message));
    await failed.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage denied', 'SecurityError'); } });
    });
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
    assert.deepEqual(restrictedErrors, [], 'blocked storage does not crash the app');
    console.log(`PASS ${width}px: playback/seeking, busy retry, audio renewal, pending pause, autoplay denial, lookup timeout, rapid switching, layout and preview fallback.`);
  }
} finally { await browser?.close(); server?.kill(); await rm(folder, { recursive: true, force: true }); }
