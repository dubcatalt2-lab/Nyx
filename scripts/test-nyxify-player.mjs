import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 8199;
const externalOrigin = String(process.env.NYX_TEST_BASE_URL || '').replace(/\/$/, '');
const origin = externalOrigin || `http://127.0.0.1:${port}`;
const server = externalOrigin ? null : spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
server?.stdout.on('data', chunk => { serverOutput += chunk; });
server?.stderr.on('data', chunk => { serverOutput += chunk; });

const waitForServer = async () => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) throw new Error(`Nyx test server stopped early.\n${serverOutput}`);
    try { if ((await fetch(`${origin}/healthz`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Nyx test server did not start.\n${serverOutput}`);
};

const track = {
  id: '123456789',
  title: 'An intentionally long song title that must remain available in the fixed player',
  artist: 'Nyx Player Test',
  artistId: '987654321',
  album: 'Seek Regression',
  albumId: '456789123',
  cover: '',
  duration: 7_205
};

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1_280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    let currentTime = 0;
    let paused = true;
    Object.defineProperties(HTMLMediaElement.prototype, {
      duration: { configurable: true, get: () => 7_205 },
      readyState: { configurable: true, get: () => HTMLMediaElement.HAVE_METADATA },
      currentTime: { configurable: true, get: () => currentTime, set: value => { currentTime = Number(value); } },
      paused: { configurable: true, get: () => paused }
    });
    HTMLMediaElement.prototype.play = async function play() { paused = false; this.dispatchEvent(new Event('play')); };
    HTMLMediaElement.prototype.pause = function pause() { paused = true; this.dispatchEvent(new Event('pause')); };
    const states = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
    class MockOctavePlayer {
      constructor(id, options) {
        this.currentTime = 0;
        this.duration = 7_205;
        this.volume = 80;
        this.playAttempts = 0;
        this.options = options;
        const target = document.getElementById(id);
        const iframe = document.createElement('iframe');
        iframe.id = id;
        iframe.title = 'Mock Octave player';
        target.replaceWith(iframe);
        window.__octavePlayer = this;
        setTimeout(() => {
          options.events.onReady?.({ target: this });
          this.playVideo();
        });
      }
      playVideo() {
        this.playAttempts += 1;
        this.state = location.search.includes('block-autoplay=1') && this.playAttempts <= 2 ? states.CUED : states.PLAYING;
        this.options.events.onStateChange?.({ data: this.state, target: this });
      }
      pauseVideo() { this.state = states.PAUSED; this.options.events.onStateChange?.({ data: this.state, target: this }); }
      stopVideo() { this.state = states.ENDED; }
      destroy() { document.getElementById('fullTrackFrame')?.remove(); }
      getPlayerState() { return this.state; }
      getCurrentTime() { return this.currentTime; }
      getDuration() { return this.duration; }
      getPlaybackRate() { return 1; }
      seekTo(value) { this.currentTime = Number(value); }
      setVolume(value) { this.volume = Number(value); }
      getVolume() { return this.volume; }
      isMuted() { return false; }
      unMute() {}
    }
    window.YT = { Player: MockOctavePlayer, PlayerState: states };
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/nyxify/home') return json({ tracks: [track], artists: [], albums: [] });
    if (path === `/api/nyxify/full-track/${track.id}`) return json({ mode: 'octave', videoId: '5NV6Rdv1a3I', durationSeconds: track.duration, title: track.title });
    if (path === '/api/nyxtube/status') return json({ configured: true, provider: 'youtube' });
    if (path === '/api/nyxtube/video') return json({ provider: 'youtube', videos: [{
      id: '5NV6Rdv1a3I', title: track.title, creator: track.artist, durationSeconds: track.duration,
      viewCount: 42, likeCount: 4, commentCount: 0, description: 'Matched music video', sourceUrl: 'https://www.youtube.com/watch?v=5NV6Rdv1a3I'
    }] });
    if (path === '/api/nyxtube/community') return json({ provider: 'youtube', comments: [], transcript: [] });
    if (path === '/api/founder-profile/auth-config') return json({ enabled: false });
    return route.continue();
  });

  await page.goto(`${origin}/apps/nyxify/`, { waitUntil: 'domcontentloaded' });
  await page.locator('.row', { hasText: track.title }).click();
  await page.waitForFunction(() => ['ready', 'playing'].includes(document.querySelector('#fullTrackStage')?.dataset.playbackState));
  if (await page.locator('#fullTrackStage').getAttribute('data-playback-state') === 'ready') await page.locator('#playBtn').click();
  await page.locator('#fullTrackStage[data-playback-state="playing"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#fullTrackTitle').textContent(), track.title, 'The full-song row did not use the matched video title');
  assert.doesNotMatch(await page.locator('#fullTrackStage').textContent(), /octave/i, 'The internal playback-engine name leaked into the visible UI');
  const octaveFrame = await page.locator('#fullTrackFrame').boundingBox();
  assert.ok(octaveFrame && octaveFrame.width >= 200 && octaveFrame.height >= 200 && octaveFrame.x + octaveFrame.width < 0, 'The Octave iframe was not kept off the visible Nyxify canvas');
  assert.equal(await page.locator('#timeTotal').textContent(), '2:00:05', 'Long duration was not formatted with hours');
  assert.equal(await page.locator('#pTitle').getAttribute('title'), track.title, 'Full long title was unavailable from the player');

  await page.locator('#seekBar').evaluate(slider => {
    slider.value = '50';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(100);
  const liveSeek = await page.evaluate(() => ({
    currentTime: window.__octavePlayer.currentTime,
    label: document.querySelector('#timeCur').textContent,
    dragging: document.querySelector('#seekBar').classList.contains('dragging')
  }));
  assert.equal(liveSeek.currentTime, 3_602.5, 'Input-only slider movement did not seek the active audio');
  assert.equal(liveSeek.label, '1:00:02', 'Long current time was cut off or formatted incorrectly');
  assert.equal(liveSeek.dragging, true, 'Slider did not enter its active drag state');

  await page.locator('#seekBar').dispatchEvent('pointercancel');
  assert.equal(await page.locator('#seekBar').evaluate(slider => slider.classList.contains('dragging')), false, 'Cancelled pointer left the seek control stuck');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.evaluate(() => {
    const frame = document.querySelector('#fullTrackFrame')?.getBoundingClientRect();
    return {
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      frameWidth: frame?.width || 0,
      frameHeight: frame?.height || 0,
      frameRight: frame ? frame.right : 0,
      stageHeight: document.querySelector('#fullTrackStage')?.getBoundingClientRect().height || 0
    };
  });
  assert.ok(mobileLayout.overflow <= 1, `Full-track player caused ${mobileLayout.overflow}px of mobile overflow`);
  assert.ok(mobileLayout.frameWidth >= 200 && mobileLayout.frameHeight >= 200 && mobileLayout.frameRight < 0, 'The mobile Octave iframe leaked onto the visible canvas');
  assert.ok(mobileLayout.stageHeight < 90, `The audio-only status row grew to ${mobileLayout.stageHeight}px`);

  await page.setViewportSize({ width: 1_280, height: 800 });
  await page.goto(`${origin}/apps/nyxify/?block-autoplay=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('.row', { hasText: track.title }).click();
  await page.locator('#fullTrackStage[data-playback-state="ready"]').waitFor({ state: 'visible' });
  const blockedAutoplay = await page.evaluate(() => ({
    previewPaused: document.querySelector('#audio').paused,
    status: document.querySelector('#fullTrackStatus').textContent,
    videoTitle: document.querySelector('#fullTrackTitle').textContent
  }));
  assert.equal(blockedAutoplay.previewPaused, false, 'Blocked iframe autoplay silenced the preview on a Chromebook-style run');
  assert.match(blockedAutoplay.status, /press play/i, 'Blocked iframe autoplay did not provide a usable play prompt');
  assert.equal(blockedAutoplay.videoTitle, track.title, 'Blocked iframe autoplay lost the matched video title');
  await page.locator('#playBtn').click();
  await page.locator('#fullTrackStage[data-playback-state="playing"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#audio').evaluate(audio => audio.paused), true, 'The preview kept playing after the user started the full song');

  await page.locator('#fullTrackVideo').click();
  await page.waitForURL(/\/apps\/nyxtube\/?\?video=5NV6Rdv1a3I/);
  await page.locator('[data-view="watch"]:not([hidden])').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-watch-title]').textContent(), track.title, 'NyxTube did not open the matched music video');
  assert.deepEqual(pageErrors, [], `Browser errors: ${pageErrors.join(' | ')}`);

  const chromeOsContext = await browser.newContext({
    viewport: { width: 1_280, height: 800 },
    userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 15917.71.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  });
  const chromeOsPage = await chromeOsContext.newPage();
  const chromeOsErrors = [];
  chromeOsPage.on('pageerror', error => chromeOsErrors.push(error.message));
  await chromeOsPage.addInitScript(() => {
    let currentTime = 0;
    let paused = true;
    Object.defineProperties(HTMLMediaElement.prototype, {
      duration: { configurable: true, get: () => 7_205 },
      readyState: { configurable: true, get: () => HTMLMediaElement.HAVE_METADATA },
      currentTime: { configurable: true, get: () => currentTime, set: value => { currentTime = Number(value); } },
      paused: { configurable: true, get: () => paused }
    });
    HTMLMediaElement.prototype.play = async function play() { paused = false; this.dispatchEvent(new Event('play')); };
    HTMLMediaElement.prototype.pause = function pause() { paused = true; this.dispatchEvent(new Event('pause')); };
  });
  await chromeOsPage.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><script>
      let plays = 0;
      addEventListener('message', event => {
        let message = event.data;
        try { if (typeof message === 'string') message = JSON.parse(message); } catch {}
        if (message?.func !== 'playVideo') return;
        plays += 1;
        if (plays > 1) parent.postMessage(JSON.stringify({ event: 'onStateChange', info: 1 }), '*');
      });
    <\/script>`
  }));
  await chromeOsPage.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/nyxify/home') return json({ tracks: [track], artists: [], albums: [] });
    if (path === `/api/nyxify/full-track/${track.id}`) return json({ mode: 'octave', videoId: '5NV6Rdv1a3I', durationSeconds: track.duration, title: track.title });
    if (path === '/api/founder-profile/auth-config') return json({ enabled: false });
    return route.continue();
  });
  await chromeOsPage.goto(`${origin}/apps/nyxify/`, { waitUntil: 'domcontentloaded' });
  await chromeOsPage.locator('.row', { hasText: track.title }).click();
  await chromeOsPage.locator('#fullTrackFrame iframe[data-direct-youtube="true"]').waitFor({ state: 'attached' });
  await chromeOsPage.locator('#fullTrackStage[data-playback-state="ready"]').waitFor({ state: 'visible' });
  assert.equal(await chromeOsPage.locator('#audio').evaluate(audio => audio.paused), false, 'ChromeOS direct-player startup silenced the preview before full audio began');
  await chromeOsPage.locator('#playBtn').click();
  await chromeOsPage.locator('#fullTrackStage[data-playback-state="playing"]').waitFor({ state: 'visible' });
  assert.equal(await chromeOsPage.locator('#audio').evaluate(audio => audio.paused), true, 'ChromeOS direct-player confirmation did not pause the preview');
  assert.deepEqual(chromeOsErrors, [], `ChromeOS direct-player browser errors: ${chromeOsErrors.join(' | ')}`);
  await chromeOsContext.close();

  const invalidJsonPage = await browser.newPage({ viewport: { width: 1_280, height: 800 } });
  await invalidJsonPage.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/nyxify/home') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Gateway fallback</title>' });
    if (path === '/api/founder-profile/auth-config') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"enabled":false}' });
    return route.continue();
  });
  await invalidJsonPage.goto(`${origin}/apps/nyxify/`, { waitUntil: 'domcontentloaded' });
  await invalidJsonPage.locator('#emptySub').waitFor({ state: 'visible' });
  const availabilityMessage = await invalidJsonPage.locator('#emptySub').textContent();
  assert.match(availabilityMessage || '', /received a web page instead of music data/i, 'Non-JSON music response did not produce a useful availability message');
  assert.doesNotMatch(availabilityMessage || '', /Unexpected token/i, 'Raw JSON parser failure leaked into the Nyxify UI');
  await invalidJsonPage.close();

  console.log('Nyxify player, production endpoint handling, and non-JSON fallback regressions passed.');
} finally {
  await browser?.close().catch(() => {});
  if (server?.exitCode === null) server.kill();
}
