import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 8198;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.on('data', chunk => { serverOutput += chunk; });

const waitForServer = async () => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Nyx test server stopped early.\n${serverOutput}`);
    try { if ((await fetch(`${origin}/healthz`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Nyx test server did not start.\n${serverOutput}`);
};

const firebaseAppModule = `
  const apps=[];
  export const getApps=()=>apps;
  export function initializeApp(config,name){const app={config,name};apps.push(app);return app}
`;
const firebaseAuthModule = `
  const user={uid:'cover-sync-user',email:'cover-sync@example.com',async getIdToken(){return 'cover-sync-token'}};
  const auth={currentUser:user,async authStateReady(){}};
  export const browserLocalPersistence={};
  export const getAuth=()=>auth;
  export async function setPersistence(){}
`;
const seedPlaylist = { id: 'playlist_crossdevice', name: 'Cross-device cover', cover: '', accent: '', tracks: [] };
let cloudPlaylists = [structuredClone(seedPlaylist)];
let delayFirstLibraryRead = true;

async function prepareContext(browser, localPlaylists = []) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(playlists => {
    localStorage.setItem('nyx_nyxify_playlists', JSON.stringify(playlists));
  }, localPlaylists);
  await context.route('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js', route => route.fulfill({
    status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: firebaseAppModule
  }));
  await context.route('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js', route => route.fulfill({
    status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: firebaseAuthModule
  }));
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/founder-profile/auth-config') return json({ enabled: true, projectId: 'nyx-test', apiKey: 'test' });
    if (path === '/api/nyxify/home') return json({ tracks: [], artists: [], albums: [] });
    if (path === '/api/nyxify/playlists' && request.method() === 'PUT') {
      cloudPlaylists = structuredClone(request.postDataJSON().playlists);
      return json({ saved: true, playlists: structuredClone(cloudPlaylists), updatedAt: Date.now() });
    }
    if (path === '/api/nyxify/playlists') {
      const snapshot = structuredClone(cloudPlaylists);
      if (delayFirstLibraryRead) {
        delayFirstLibraryRead = false;
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      return json({ playlists: snapshot, updatedAt: Date.now() });
    }
    return route.continue();
  });
  return context;
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const firstDevice = await prepareContext(browser, [seedPlaylist]);
  const firstPage = await firstDevice.newPage();
  const firstErrors = [];
  firstPage.on('pageerror', error => firstErrors.push(error.message));
  await firstPage.goto(`${origin}/apps/nyxify/`, { waitUntil: 'domcontentloaded' });
  await firstPage.locator('.playlist-open', { hasText: seedPlaylist.name }).click();
  await firstPage.locator('.playlist-cover-input').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAf0pXz4AAAAASUVORK5CYII=', 'base64')
  });
  await firstPage.getByText('Cover synced to your account.').waitFor();
  assert.match(cloudPlaylists[0].cover, /^data:image\/(?:png|webp);base64,/i, 'The account save omitted the custom cover');
  const savedCover = cloudPlaylists[0].cover;
  await firstPage.waitForTimeout(700);
  assert.equal(cloudPlaylists[0].cover, savedCover, 'A delayed initial load overwrote the custom cover');
  assert.deepEqual(firstErrors, [], `First-device browser errors: ${firstErrors.join(' | ')}`);
  await firstDevice.close();

  const secondDevice = await prepareContext(browser);
  const secondPage = await secondDevice.newPage();
  const secondErrors = [];
  secondPage.on('pageerror', error => secondErrors.push(error.message));
  await secondPage.goto(`${origin}/apps/nyxify/`, { waitUntil: 'domcontentloaded' });
  const syncedImage = secondPage.locator('.playlist-open', { hasText: seedPlaylist.name }).locator('.playlist-cover img');
  await syncedImage.waitFor();
  assert.equal(await syncedImage.getAttribute('src'), savedCover, 'The second device did not render the account-synced cover');
  assert.deepEqual(secondErrors, [], `Second-device browser errors: ${secondErrors.join(' | ')}`);
  await secondDevice.close();

  console.log('Nyxify custom playlist cover two-device sync regression passed.');
} finally {
  await browser?.close().catch(() => {});
  if (server.exitCode === null) server.kill();
}
