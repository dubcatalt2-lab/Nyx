import { chromium } from 'playwright';

const baseUrl = process.env.NYX_TEST_BASE_URL || 'http://127.0.0.1:8080';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = {
  version: 1,
  catalogs: [
    { id: 'local', format: 'ugs', url: '/test-games/ugs.json', coversUrl: '/test-games/covers.json', player: '/assets/ugs/play.html?game={path}', priority: 50 },
    { id: 'gn', format: 'gn', url: '/test-games/gn.json', player: '/assets/reading/play.html?game={path}', priority: 40 },
    { id: 'gms', format: 'gms', url: '/test-games/gms.json', player: '/assets/math/play.html?game={path}', priority: 30 },
    { id: 'zengs', format: 'zengs', url: '/zengs-games', priority: 20 }
  ]
};

const zengsFixture = { games: [{ title: 'Zengs Only', url: '/zengs-assets/0/lg/fixture/index.html', cover: '/test-games/cover.png' }] };

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
  await page.route('**/assets/studies/studies.json', route => route.fulfill(json(manifest)));
  await page.route('**/test-games/ugs.json', route => route.fulfill(json([{ title: 'Shared Game', path: 'shared.html' }, { title: 'Nyx Only', path: 'nyx.html' }])));
  await page.route('**/test-games/covers.json', route => route.fulfill(json([])));
  await page.route('**/test-games/gn.json', route => route.fulfill(json([{ title: 'Shared Game', path: 'shared.html', cover: '/test-games/cover.png' }, { title: 'GN Only', path: 'gn.html', cover: '/test-games/cover.png' }])));
  await page.route('**/test-games/gms.json', route => route.fulfill(json([{ title: 'GMS Only', path: 'gms.html', cover: '/test-games/cover.png' }])));
  await page.route('**/zengs-games', route => route.fulfill(json(zengsFixture)));
  await page.route(url => url.pathname === '/assets/reading/play.html' && url.searchParams.get('game') === 'shared.html', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><script>parent.postMessage({type:'nyx:game-launched'},'*')<\/script>`
  }));

  await page.goto(`${baseUrl}/assets/studies/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /All games/ }).waitFor();
  await page.locator('[data-library="gn"]').waitFor();
  assert(await page.locator('[data-library="zengs"]').count() === 0, 'Removed provider must not appear, including with a cached manifest');
  const libraries = (await page.locator('[data-library]').allTextContents()).map(text=>text.normalize('NFKC'));
  assert(!libraries.some(label => label.includes('Zengs')), 'Removed provider appeared in library labels');
  assert(await page.getByRole('heading', {name:'Books',exact:true}).first().textContent() === 'Books', 'Main title must be plain Books');
  assert(libraries.some(label => label.includes('Reading')), `Reading shelf is missing (${libraries.join(', ')})`);
  assert(libraries.some(label => label.includes('Math')), `Math shelf is missing (${libraries.join(', ')})`);
  assert(libraries.some(label => label.includes('N7X Archive')), `N7X Archive library is missing (${libraries.join(', ')})`);
  assert(libraries.some(label => label.includes('Miscellaneous')), `Miscellaneous coverless library is missing (${libraries.join(', ')})`);

  await page.locator('[data-library="gn"]').click();
  const gnCards = (await page.locator('.q482f08e91ee0').allTextContents()).map(text=>text.normalize('NFKC'));
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

  await page.locator('[data-library="all"]').click();
  await page.locator('#q768acae37c5a').fill('Nyx Only');
  assert(await page.getByRole('button', {name:'Play Nyx Only',exact:true}).count() === 1, 'All-games search must find games without cover art');
  await page.locator('#q768acae37c5a').fill('');
  await page.locator('[data-library="misc"]').click();
  assert(await page.locator('.q482f08e91ee0').count() === 1, 'The miscellaneous library did not contain only the coverless games');
  await page.locator('[data-library="gn"]').click();


  assert(!(await page.locator('body').innerText()).normalize('NFKC').includes('Zengs Only'), 'Removed provider leaked into combined list');
  assert(/[\u{1d400}-\u{1d7ff}]/u.test(await page.locator('.q482f08e91ee0').first().innerText()), 'Catalog names must use Unicode presentation');
  assert(pageErrors.length===0, pageErrors.join(';'));
  console.log('PASS Books headers, removed provider even in cached manifest, Unicode names, plain accessible labels, source filters and search');
} finally {await browser.close();}
