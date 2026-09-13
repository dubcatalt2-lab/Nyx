import { chromium } from 'playwright';

const baseUrl = process.env.NYX_TEST_BASE_URL || 'http://127.0.0.1:8080';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = {
  version: 1,
  catalogs: [
    { id: 'local', format: 'ugs', url: '/test-games/ugs.json', coversUrl: '/test-games/covers.json', player: '/assets/ugs/play.html?game={path}', priority: 50 },
    { id: 'gn', format: 'gn', url: '/test-games/gn.json', player: '/assets/gn-math/play.html?game={path}', priority: 40 },
    { id: 'gms', format: 'gms', url: '/test-games/gms.json', player: '/assets/gms-games/play.html?game={path}', priority: 30 },
    { id: 'lumin', format: 'lumin', sdkUrl: '/test-games/lumin.js', priority: 20 }
  ]
};

const json = body => ({ contentType: 'application/json', body: JSON.stringify(body) });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  const pageErrors = [];
  const blockedRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 }); } catch {}
    try { Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 }); } catch {}
  });
  page.on('request', request => {
    if (/cdn\.r9x\.in|doubleclick\.net|gamemonetize\.com/i.test(request.url())) blockedRequests.push(request.url());
  });
  await page.route('**/assets/games/games.json', route => route.fulfill(json(manifest)));
  await page.route('**/test-games/ugs.json', route => route.fulfill(json([{ title: 'Shared Game', path: 'shared.html' }, { title: 'Nyx Only', path: 'nyx.html' }])));
  await page.route('**/test-games/covers.json', route => route.fulfill(json([])));
  await page.route('**/test-games/gn.json', route => route.fulfill(json([{ title: 'Shared Game', path: 'shared.html', cover: '/test-games/cover.png' }, { title: 'GN Only', path: 'gn.html', cover: '/test-games/cover.png' }])));
  await page.route('**/test-games/gms.json', route => route.fulfill(json([{ title: 'GMS Only', path: 'gms.html', cover: '/test-games/cover.png' }])));
  await page.route('**/test-games/lumin.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `window.Lumin={init:async()=>{},getGames:async()=>({games:[{id:'lumin-1',name:'Lumin Only',image_token:'cover-1'}],pages:1}),getGameUrl:async()=>({url:'about:blank'}),getImageUrl:async()=>'/test-games/cover.png'};`
  }));
  await page.route(url => url.pathname === '/assets/gn-math/play.html' && url.searchParams.get('game') === 'shared.html', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><script>parent.postMessage({type:'nyx:game-launched'},'*')<\/script>`
  }));

  await page.goto(`${baseUrl}/assets/games/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /All games/ }).waitFor();
  await page.locator('[data-library="lumin"]').waitFor();
  const libraries = await page.locator('[data-library]').allTextContents();
  assert(libraries.some(label => label.includes('LuminSDK')), `LuminSDK library is missing (${libraries.join(', ')})`);
  assert(libraries.some(label => label.includes('GN Math')), `GN Math library is missing (${libraries.join(', ')})`);
  assert(libraries.some(label => label.includes('GMS')), `GMS library is missing (${libraries.join(', ')})`);
  assert(libraries.some(label => label.includes('Nyx Archive')), `Nyx Archive library is missing (${libraries.join(', ')})`);
  assert(libraries.some(label => label.includes('Miscellaneous')), `Miscellaneous coverless library is missing (${libraries.join(', ')})`);

  await page.locator('[data-library="gn"]').click();
  const gnCards = await page.locator('.game-card').allTextContents();
  assert(gnCards.length === 2 && gnCards.some(card => card.includes('Shared Game')) && gnCards.some(card => card.includes('GN Only')), `GN filter returned the wrong games (${gnCards.join(', ')})`);
  assert(await page.locator('[data-library="gn"]').getAttribute('aria-pressed') === 'true', 'GN library did not expose its active state');
  const neutralLibrary = await page.locator('[data-library="gn"]').evaluate(button => {
    const channels = value => String(value).match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
    const style = getComputedStyle(button);
    const picker = getComputedStyle(button.closest('.library-picker'));
    return {
      color: channels(style.color),
      background: channels(style.backgroundColor),
      border: channels(style.borderTopColor),
      backdrop: picker.backdropFilter || picker.webkitBackdropFilter || ''
    };
  });
  const isGray = channels => channels.length === 3 && Math.max(...channels) - Math.min(...channels) <= 1;
  assert(neutralLibrary.color.every(channel => channel >= 245), `Library text is not white (${neutralLibrary.color.join(', ')})`);
  assert(isGray(neutralLibrary.background) && isGray(neutralLibrary.border), `Active library styling is theme-colored (${JSON.stringify(neutralLibrary)})`);
  assert(neutralLibrary.backdrop.includes('blur'), `Library picker is missing its neutral blur (${neutralLibrary.backdrop})`);

  await page.locator('[data-library="misc"]').click();
  assert(await page.locator('.game-card').count() === 1, 'The miscellaneous library did not contain only the coverless games');
  await page.locator('[data-library="gn"]').click();

  await page.getByRole('button', { name: 'Play Shared Game' }).click();
  assert((await page.locator('#gameFrame').getAttribute('src'))?.includes('/assets/gn-math/play.html'), 'A game opened from GN did not prefer its GN source');
  const optimizer = page.locator('#performanceGame');
  assert(await optimizer.getAttribute('data-mode') === 'auto' && await optimizer.getAttribute('data-level') === '0', 'Auto optimizer did not begin at full quality on the simulated capable device');
  await page.evaluate(async () => {
    for (let index = 0; index < 24; index += 1) {
      const started = performance.now();
      while (performance.now() - started < 70) {}
      await new Promise(resolve => setTimeout(resolve, 12));
    }
  });
  await page.waitForTimeout(1_000);
  const automaticOptimizer = await optimizer.evaluate(button => ({
    mode: button.dataset.mode,
    level: button.dataset.level,
    averageFrame: button.dataset.averageFrame,
    slowFrames: button.dataset.slowFrames,
    longTasks: button.dataset.longTasks
  }));
  assert(automaticOptimizer.level === '1', `Auto optimizer did not react to sustained slow frames (${JSON.stringify(automaticOptimizer)})`);
  await page.waitForFunction(() => document.getElementById('performanceGame')?.dataset.level === '0', null, { timeout: 16_000 });
  await optimizer.click();
  let optimizerLayout = await page.evaluate(() => ({
    mode: document.getElementById('performanceGame').dataset.mode,
    level: document.body.dataset.gamePerformanceLevel,
    frameWidth: document.getElementById('gameFrame').offsetWidth,
    stageWidth: document.querySelector('.player-stage').clientWidth
  }));
  assert(optimizerLayout.mode === 'balanced' && optimizerLayout.level === '1', `Balanced optimizer mode did not activate (${JSON.stringify(optimizerLayout)})`);
  assert(Math.abs(optimizerLayout.frameWidth / optimizerLayout.stageWidth - 0.86) < 0.02, `Balanced mode used the wrong render scale (${JSON.stringify(optimizerLayout)})`);

  await optimizer.click();
  optimizerLayout = await page.evaluate(() => ({
    mode: document.getElementById('performanceGame').dataset.mode,
    level: document.body.dataset.gamePerformanceLevel,
    frameWidth: document.getElementById('gameFrame').offsetWidth,
    stageWidth: document.querySelector('.player-stage').clientWidth
  }));
  assert(optimizerLayout.mode === 'boost' && optimizerLayout.level === '2', `Boost optimizer mode did not activate (${JSON.stringify(optimizerLayout)})`);
  assert(Math.abs(optimizerLayout.frameWidth / optimizerLayout.stageWidth - 0.72) < 0.02, `Boost mode used the wrong render scale (${JSON.stringify(optimizerLayout)})`);
  if (process.env.NYX_TEST_OPTIMIZER_SCREENSHOT) await page.screenshot({ path: process.env.NYX_TEST_OPTIMIZER_SCREENSHOT, fullPage: false });

  await optimizer.click();
  assert(await optimizer.getAttribute('data-mode') === 'off' && await optimizer.getAttribute('data-level') === '0', 'Optimizer Off mode did not restore full quality');
  await optimizer.click();
  assert(await optimizer.getAttribute('data-mode') === 'auto', 'Optimizer did not cycle back to Auto');
  await page.locator('#closePlayer').click();

  const adResult = page.evaluate(() => new Promise(resolve => {
    const listener = event => {
      if (event.data?.type !== 'nyx:test-game-ad-guard') return;
      removeEventListener('message', listener);
      resolve(event.data);
    };
    addEventListener('message', listener);
    const frame = document.createElement('iframe');
    frame.id = 'nyxAdGuardTestFrame';
    frame.sandbox = 'allow-scripts';
    frame.srcdoc = `<!doctype html><html><head><script src="${location.origin}/assets/games/game-ad-protection.js?v=test"><\/script></head><body><div id="ad-container-test" class="ad-container">Ad</div><script>
      (async()=>{
        const script=document.createElement('script');
        script.src='https://cdn.r9x.in/example/ads.js';
        document.body.appendChild(script);
        const response=await fetch('https://example.gamemonetize.com/ads.js');
        setTimeout(()=>parent.postMessage({type:'nyx:test-game-ad-guard',scriptConnected:script.isConnected,scriptSource:script.src,adPresent:Boolean(document.querySelector('.ad-container')),fetchStatus:response.status,poki:Boolean(window.PokiSDK),gd:Boolean(window.gdsdk)},'*'),20);
      })();
    <\/script></body></html>`;
    document.body.append(frame);
  }));
  const result = await adResult;
  assert(!result.scriptConnected, `Blocked ad script remained connected (${result.scriptSource})`);
  assert(!result.adPresent, 'A common ad container was not removed');
  assert(result.fetchStatus === 204, `Blocked ad fetch did not return a neutral response (${result.fetchStatus})`);
  assert(result.poki && result.gd, 'Compatibility shims were not available after blocking ad SDKs');
  assert(blockedRequests.length === 0, `Ad resources escaped the in-frame guard (${blockedRequests.join(', ')})`);
  await page.locator('#nyxAdGuardTestFrame').evaluate(frame => frame.remove());

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!overflow, 'Desktop game library has horizontal overflow');
  if (process.env.NYX_TEST_GAMES_SCREENSHOT) await page.screenshot({ path: process.env.NYX_TEST_GAMES_SCREENSHOT, fullPage: true });

  const progressive = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const progressiveManifest = {
    version: 1,
    catalogs: [
      { id: 'gn', format: 'gn', url: '/test-games/progressive-local.json', player: '/assets/gn-math/play.html?game={path}', priority: 50 },
      { id: 'lumin', format: 'lumin', sdkUrl: '/test-games/stalled-lumin.js', priority: 20 }
    ]
  };
  await progressive.route('**/assets/games/games.json', route => route.fulfill(json(progressiveManifest)));
  await progressive.route('**/test-games/progressive-local.json', route => route.fulfill(json([{ title: 'Ready First', path: 'ready.html', cover: '/test-games/cover.png' }])));
  await progressive.route('**/test-games/stalled-lumin.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `window.Lumin={init:async()=>{},getGames:()=>new Promise(()=>{})};`
  }));
  const progressiveStarted = Date.now();
  await progressive.goto(`${baseUrl}/assets/games/`, { waitUntil: 'domcontentloaded' });
  await progressive.getByRole('button', { name: 'Play Ready First' }).waitFor({ timeout: 3_000 });
  assert(Date.now() - progressiveStarted < 3_000, 'A stalled optional provider delayed the built-in game library');
  assert(await progressive.locator('#catalogProgress').evaluate(element => element.classList.contains('done')), 'The full-page loading indicator remained after built-in games were ready');
  assert((await progressive.locator('#gameCount').textContent()).includes('library loading'), 'Progressive loading status did not report the remaining provider');
  await progressive.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.addInitScript(() => {
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 2 }); } catch {}
    try { Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 2 }); } catch {}
  });
  await mobile.route('**/assets/games/games.json', route => route.fulfill(json(manifest)));
  await mobile.route('**/test-games/ugs.json', route => route.fulfill(json([{ title: 'Shared Game', path: 'shared.html' }, { title: 'Nyx Only', path: 'nyx.html' }])));
  await mobile.route('**/test-games/covers.json', route => route.fulfill(json([])));
  await mobile.route('**/test-games/gn.json', route => route.fulfill(json([{ title: 'Shared Game', path: 'shared.html', cover: '/test-games/cover.png' }, { title: 'GN Only', path: 'gn.html', cover: '/test-games/cover.png' }])));
  await mobile.route('**/test-games/gms.json', route => route.fulfill(json([{ title: 'GMS Only', path: 'gms.html', cover: '/test-games/cover.png' }])));
  await mobile.route('**/test-games/lumin.js', route => route.fulfill({ contentType: 'text/javascript', body: `window.Lumin={init:async()=>{},getGames:async()=>({games:[{id:'lumin-1',name:'Lumin Only',image_token:'cover-1'}],pages:1}),getGameUrl:async()=>({url:'about:blank'}),getImageUrl:async()=>'/test-games/cover.png'};` }));
  await mobile.goto(`${baseUrl}/assets/games/`, { waitUntil: 'domcontentloaded' });
  await mobile.getByRole('button', { name: /All games/ }).waitFor();
  const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!mobileOverflow, 'Mobile game library has horizontal page overflow');
  await mobile.locator('.game-card').first().click();
  assert(await mobile.locator('#performanceGame').getAttribute('data-mode') === 'auto' && await mobile.locator('#performanceGame').getAttribute('data-level') === '2', 'Auto optimizer did not start in Boost on the simulated low-end device');
  await mobile.locator('#closePlayer').click();
  await mobile.close();

  if (process.env.NYX_TEST_REAL_GAME) {
    const realGame = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const realAdRequests = [];
    let guardLoaded = false;
    realGame.on('request', request => {
      const url = request.url();
      if (url.includes('/assets/games/game-ad-protection.js')) guardLoaded = true;
      if (/imasdk\.googleapis\.com|cdn\.r9x\.in|doubleclick\.net|adtrafficquality\.google|gamemonetize\.com/i.test(url)) realAdRequests.push(url);
    });
    await realGame.goto(`${baseUrl}/assets/gn-math/play.html?game=${encodeURIComponent(process.env.NYX_TEST_REAL_GAME)}`, { waitUntil: 'domcontentloaded' });
    await realGame.waitForTimeout(8_000);
    assert(guardLoaded, 'The real GN Math runner did not load the in-frame ad guard');
    assert(realAdRequests.length === 0, `A real game requested blocked ad resources (${realAdRequests.join(', ')})`);
    await realGame.close();
  }

  assert(pageErrors.length === 0, `Game page browser errors: ${pageErrors.join(' | ')}`);
  console.log('Game library, progressive catalog loading, adaptive optimizer, and in-frame ad protection checks passed.');
} finally {
  await browser.close();
}
