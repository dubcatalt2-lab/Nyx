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
  catalog: 'deezer',
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
  const fullTrackRequests = [];
  await page.route('**/api/**', route => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/nyxify/home') return json({ tracks: [track], artists: [], albums: [] });
    if (path === `/api/nyxify/full-track/${track.id}`) {
      fullTrackRequests.push(Object.fromEntries(requestUrl.searchParams));
      return json({ mode: 'octave', videoId: '5NV6Rdv1a3I', durationSeconds: track.duration, title: track.title });
    }
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
  const fallbackLayout = await page.locator('.row', { hasText: track.title }).evaluate(row => {
    const image = row.querySelector('img');
    const rowBox = row.getBoundingClientRect();
    const imageBox = image?.getBoundingClientRect();
    return { rowHeight: rowBox.height, imageWidth: imageBox?.width || 0, imageHeight: imageBox?.height || 0 };
  });
  assert.ok(fallbackLayout.rowHeight <= 74, `Fallback artwork expanded the track row to ${fallbackLayout.rowHeight}px`);
  assert.ok(fallbackLayout.imageWidth <= 52 && fallbackLayout.imageHeight <= 52, `Fallback artwork expanded to ${fallbackLayout.imageWidth}x${fallbackLayout.imageHeight}px`);
  await page.locator('.row', { hasText: track.title }).click();
  await page.waitForFunction(() => ['ready', 'playing'].includes(document.querySelector('#fullTrackStage')?.dataset.playbackState));
  if (await page.locator('#fullTrackStage').getAttribute('data-playback-state') === 'ready') await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.querySelector('#fullTrackStage')?.dataset.playbackState === 'playing');
  assert.deepEqual(fullTrackRequests[0], {
    title: track.title,
    artist: track.artist,
    duration: String(track.duration),
    catalog: track.catalog
  }, 'Full-track matching did not receive the selected catalog metadata');
  assert.equal(await page.locator('#fullTrackTitle').textContent(), track.title, 'The full-song row did not use the matched video title');
  assert.doesNotMatch(await page.locator('#fullTrackStage').textContent(), /octave/i, 'The internal playback-engine name leaked into the visible UI');
  assert.equal(await page.locator('#fullTrackPreview').count(), 0, 'The separate preview bar control was still rendered');
  assert.equal(await page.evaluate(() => window.__octavePlayer.options.playerVars.controls), 0, 'The embedded music video kept YouTube controls enabled');
  assert.equal(await page.evaluate(() => window.__octavePlayer.options.playerVars.fs), 1, 'The embedded music video explicitly disabled fullscreen');
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
  await page.waitForFunction(() => document.querySelector('#fullTrackStage')?.dataset.playbackState === 'ready');
  const blockedAutoplay = await page.evaluate(() => ({
    previewPaused: document.querySelector('#audio').paused,
    status: document.querySelector('#fullTrackStatus').textContent,
    videoTitle: document.querySelector('#fullTrackTitle').textContent
  }));
  assert.equal(blockedAutoplay.previewPaused, false, 'Blocked iframe autoplay silenced the preview on a Chromebook-style run');
  assert.match(blockedAutoplay.status, /press play/i, 'Blocked iframe autoplay did not provide a usable play prompt');
  assert.equal(blockedAutoplay.videoTitle, track.title, 'Blocked iframe autoplay lost the matched video title');
  await page.locator('#playBtn').click();
  await page.waitForFunction(() => document.querySelector('#fullTrackStage')?.dataset.playbackState === 'playing');
  assert.equal(await page.locator('#audio').evaluate(audio => audio.paused), true, 'The preview kept playing after the user started the full song');

  const musicUrl = page.url();
  await page.evaluate(() => { window.__octavePlayer.currentTime = 123; });
  await page.locator('#fullTrackVideo').click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#nowPlayingArt')).visibility === 'hidden');
  const inlineVideo = await page.evaluate(() => {
    const frame = document.querySelector('#fullTrackFrame')?.getBoundingClientRect();
    const media = document.querySelector('#nowPlayingMedia')?.getBoundingClientRect();
    return {
      url: location.href,
      currentTime: window.__octavePlayer.currentTime,
      pressed: document.querySelector('#fullTrackVideo')?.getAttribute('aria-pressed'),
      label: document.querySelector('#fullTrackVideoLabel')?.textContent,
      coverVisibility: getComputedStyle(document.querySelector('#nowPlayingArt')).visibility,
      rail: document.querySelector('.rail')?.getBoundingClientRect(),
      module: document.querySelector('#nowPlayingModule')?.getBoundingClientRect(),
      nextModule: document.querySelector('#nowPlayingModule')?.nextElementSibling?.getBoundingClientRect(),
      railOverflow: getComputedStyle(document.querySelector('.rail')).overflowY,
      railClientHeight: document.querySelector('.rail')?.clientHeight,
      railScrollHeight: document.querySelector('.rail')?.scrollHeight,
      frame,
      media
    };
  });
  assert.equal(inlineVideo.url, musicUrl, 'Switching to video navigated away from Nyxify');
  assert.equal(inlineVideo.currentTime, 123, 'Switching to video restarted the active song');
  assert.equal(inlineVideo.pressed, 'true', 'The video switch did not expose its active state');
  assert.equal(inlineVideo.label, 'Switch to cover', 'The active video switch did not offer the cover view');
  assert.equal(inlineVideo.coverVisibility, 'hidden', 'The cover remained visible over the inline video');
  assert.ok(inlineVideo.frame && inlineVideo.media && inlineVideo.frame.width > 0 && inlineVideo.frame.height > 0, 'The inline video was not visible');
  assert.ok(Math.abs(inlineVideo.frame.left - inlineVideo.media.left) <= 1 && Math.abs(inlineVideo.frame.top - inlineVideo.media.top) <= 1, 'The inline video was not placed in the cover area');
  assert.ok(Math.abs(inlineVideo.media.width - inlineVideo.media.height) <= 2, 'The music video expanded beyond the small square cover box');
  assert.ok(inlineVideo.rail?.height >= 680, 'The desktop right sidebar did not fill the available viewport height');
  assert.ok(inlineVideo.module?.height < inlineVideo.rail?.height, 'The now-playing panel still reserved the empty full-rail height');
  assert.ok(inlineVideo.nextModule && inlineVideo.nextModule.top - inlineVideo.module.bottom <= 22, 'The remaining sidebar modules did not follow Now Playing without a large empty gap');
  assert.equal(inlineVideo.railOverflow, 'visible', 'The desktop sidebar still used a nested clipped scroll area');
  assert.equal(inlineVideo.railClientHeight, inlineVideo.railScrollHeight, 'The desktop sidebar still clipped content outside its fixed height');
  assert.equal(await page.locator('#fullTrackFullscreen').isVisible(), true, 'The inline video did not expose Nyxify fullscreen');
  await page.locator('#fullTrackFullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'nowPlayingMedia');
  assert.equal(await page.locator('#fullTrackFullscreen').getAttribute('aria-label'), 'Exit fullscreen', 'The fullscreen control did not expose its active state');
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.fullscreenElement);

  await page.setViewportSize({ width: 728, height: 1_238 });
  const tabletRail = await page.evaluate(() => {
    const rail = document.querySelector('.rail').getBoundingClientRect();
    const nowPlaying = document.querySelector('#nowPlayingModule').getBoundingClientRect();
    const nextModule = document.querySelector('#nowPlayingModule').nextElementSibling.getBoundingClientRect();
    const media = document.querySelector('#nowPlayingMedia').getBoundingClientRect();
    return {
      railWidth: rail.width,
      nowPlayingWidth: nowPlaying.width,
      nextGap: nextModule.top - nowPlaying.bottom,
      mediaWidth: media.width,
      columns: getComputedStyle(document.querySelector('.rail')).gridTemplateColumns,
      display: getComputedStyle(document.querySelector('.rail')).display
    };
  });
  assert.equal(tabletRail.display, 'flex', 'The tablet sidebar still used the empty two-column grid');
  assert.equal(tabletRail.columns, 'none', 'The tablet sidebar retained a hidden empty grid column');
  assert.ok(Math.abs(tabletRail.railWidth - tabletRail.nowPlayingWidth) <= 2, 'Now Playing did not fill the tablet sidebar width');
  assert.ok(tabletRail.nextGap <= 16, `The tablet sidebar kept a ${tabletRail.nextGap}px empty gap between modules`);
  assert.ok(tabletRail.mediaWidth <= 322, `The tablet music video grew beyond the small cover box to ${tabletRail.mediaWidth}px`);

  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const bottomClearance = await page.evaluate(() => {
    const playlist = document.querySelector('.playlist-module').getBoundingClientRect();
    const player = document.querySelector('.player-inner').getBoundingClientRect();
    return {
      playlistBottom: playlist.bottom,
      playerTop: player.top,
      playlistClientHeight: document.querySelector('.playlist-module').clientHeight,
      playlistScrollHeight: document.querySelector('.playlist-module').scrollHeight
    };
  });
  assert.equal(bottomClearance.playlistClientHeight, bottomClearance.playlistScrollHeight, 'The Playlists card content was clipped inside its module');
  assert.ok(bottomClearance.playlistBottom <= bottomClearance.playerTop - 8, `The Playlists card remained ${bottomClearance.playlistBottom - bottomClearance.playerTop}px underneath the fixed player`);
  await page.evaluate(() => scrollTo(0, 0));

  await page.setViewportSize({ width: 390, height: 844 });
  const compactInlineVideo = await page.evaluate(() => {
    const frame = document.querySelector('#fullTrackFrame')?.getBoundingClientRect();
    const media = document.querySelector('#nowPlayingMedia')?.getBoundingClientRect();
    return {
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      frameWidth: frame?.width || 0,
      frameHeight: frame?.height || 0,
      mediaWidth: media?.width || 0,
      mediaHeight: media?.height || 0
    };
  });
  assert.ok(compactInlineVideo.overflow <= 1, `Inline video caused ${compactInlineVideo.overflow}px of mobile overflow`);
  assert.ok(compactInlineVideo.frameWidth > 0 && Math.abs(compactInlineVideo.frameWidth - compactInlineVideo.mediaWidth) <= 2, `Inline video width ${compactInlineVideo.frameWidth}px did not fit the ${compactInlineVideo.mediaWidth}px mobile cover`);
  assert.ok(compactInlineVideo.frameHeight > 0 && Math.abs(compactInlineVideo.frameHeight - compactInlineVideo.mediaHeight) <= 2, `Inline video height ${compactInlineVideo.frameHeight}px did not fit the ${compactInlineVideo.mediaHeight}px mobile cover`);
  await page.locator('#fullTrackVideo').click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#nowPlayingArt')).visibility === 'visible');
  assert.equal(await page.locator('#fullTrackVideo').getAttribute('aria-pressed'), 'false', 'Switching back to the cover did not clear the active state');
  assert.equal(await page.locator('#nowPlayingArt').evaluate(image => getComputedStyle(image).visibility), 'visible', 'Switching back did not restore the album cover');
  await page.setViewportSize({ width: 1_280, height: 800 });
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
  await chromeOsPage.waitForFunction(() => document.querySelector('#fullTrackStage')?.dataset.playbackState === 'ready');
  const chromeOsPlayerUrl = new URL(await chromeOsPage.locator('#fullTrackFrame iframe[data-direct-youtube="true"]').getAttribute('src'));
  assert.equal(chromeOsPlayerUrl.searchParams.get('controls'), '0', 'ChromeOS embedded video kept YouTube controls enabled');
  assert.equal(chromeOsPlayerUrl.searchParams.get('fs'), '1', 'ChromeOS embedded video explicitly disabled fullscreen');
  assert.equal(await chromeOsPage.locator('#audio').evaluate(audio => audio.paused), false, 'ChromeOS direct-player startup silenced the preview before full audio began');
  await chromeOsPage.locator('#playBtn').click();
  await chromeOsPage.waitForFunction(() => document.querySelector('#fullTrackStage')?.dataset.playbackState === 'playing');
  assert.equal(await chromeOsPage.locator('#audio').evaluate(audio => audio.paused), true, 'ChromeOS direct-player confirmation did not pause the preview');
  await chromeOsPage.locator('#fullTrackVideo').click();
  const chromeOsInlineVideo = await chromeOsPage.evaluate(() => {
    const frame = document.querySelector('#fullTrackFrame')?.getBoundingClientRect();
    const media = document.querySelector('#nowPlayingMedia')?.getBoundingClientRect();
    return {
      frameWidth: frame?.width || 0,
      mediaWidth: media?.width || 0,
      pressed: document.querySelector('#fullTrackVideo')?.getAttribute('aria-pressed')
    };
  });
  assert.equal(chromeOsInlineVideo.pressed, 'true', 'ChromeOS direct player did not switch into the cover area');
  assert.ok(chromeOsInlineVideo.frameWidth > 0 && Math.abs(chromeOsInlineVideo.frameWidth - chromeOsInlineVideo.mediaWidth) <= 2, 'ChromeOS inline video did not fit the cover area');
  assert.equal(await chromeOsPage.locator('#fullTrackFullscreen').isVisible(), true, 'ChromeOS inline video did not expose fullscreen');
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
