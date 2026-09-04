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

  await page.goto(`${baseUrl}/assets/games/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /All games/ }).waitFor();
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

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
  console.log('Game library and in-frame ad protection checks passed.');
} finally {
  await browser.close();
}
