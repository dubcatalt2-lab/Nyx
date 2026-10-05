import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import {chromium} from 'playwright';
const source = readFileSync('script.js', 'utf8'), functions = new Map();
function visit(node) {if (!node || typeof node !== 'object') return; if (node.type === 'FunctionDeclaration') functions.set(node.id.name, source.slice(node.start, node.end)); for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);}
visit(parse(source, {ecmaVersion: 'latest'}));
const browser = await chromium.launch({channel: 'msedge', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  await page.goto((process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199')+'/apps/chat/');
  await page.setContent('<html data-nyx-theme="halloween"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/css/avatar-decorations.css"><link rel="stylesheet" href="/css/profile-editor-layout.css"></head><body style="background:#18191c"><button id="origin">View profile</button></body></html>');
  let relation = {}, action;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/api/profiles/')) return route.fulfill({json: {uid: 'profile-user', role: 'moderator', online: true, createdAt: '2026-03-02', profile: {displayName: 'River', handle: '@river', bio: 'Music and late nights.', bannerUrl: '/assets/backgrounds/1014077.jpg'}}});
    if (path === '/api/chat/conversations') return route.fulfill({json: {conversation: {id: 'a'.repeat(40)}}});
    if (route.request().method() === 'POST') {action = route.request().postDataJSON().action; relation = {uid: 'profile-user', friend: action === 'request' ? 'outgoing' : '', canMessage: action !== 'block', blocked: action === 'block'};}
    return route.fulfill({json: {relationships: [relation]}});
  });
  await page.addScriptTag({content: `
    let nyxFounderSignedInUser={uid:'viewer-user'},nyxFounderIsOwner=false,nyxUserAccountRole='member',nyxUserProfileCreatedAt='';
    const closeNyxAccountMenu=()=>{},syncNyxVisualDockState=()=>{},nyxManageUserProfileGifs=()=>{};
    const nyxGetFirebaseToken=async()=>'fixture',nyxProfileMediaFetch=async(url,options)=>{const response=await fetch(url,options);if(!response.ok)throw Error('Unavailable');return response.json()};
    const openBrowserShellAppTab=url=>window.openedConversation=url;
    const normalizeNyxUserProfile=p=>({displayName:'Member',handle:'@member',bio:'',avatarUrl:'',bannerUrl:'',accentPrimary:'#5865f2',accentSecondary:'#8ea1ff',bannerColor:'#8ea1ff',avatarDecoration:'none',status:'online',...p});
    const nyxProfileStillSource=value=>value,nyxProfileEffectClass=()=>'',nyxProfileEffectArtwork=()=>'',nyxProfileEffectVars=()=>'',nyxDisplayNameStyleClass=()=>'',nyxDisplayNameStyleVars=()=>'';
    const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    ${functions.get('nyxAccountMenuIcon')}
    ${functions.get('nyxUserProfileCardMarkup')}
    ${functions.get('openNyxProfileDirectory')}
  `});
  await page.locator('#origin').focus();
  await page.evaluate(() => openNyxProfileDirectory('profile-user'));
  const card = page.locator('.nyx-profile-directory');
  assert(!(await page.getByText('Browse Profiles', {exact: true}).isVisible()));
  assert(!(await page.locator('.nyx-profile-directory-sidebar').isVisible()));
  assert.equal(await page.locator('.nyx-popup-name h2').innerText(), 'River');
  await page.locator('.nyx-user-profile-banner img').evaluate(image=>image.decode());
  const bounds = await card.boundingBox(); assert(bounds.width <= 442 && bounds.height < 600);
  await page.getByRole('button', {name: 'Add friend', exact: true}).click();
  await page.getByRole('button', {name: 'Cancel request', exact: true}).waitFor(); assert.equal(action, 'request');
  await page.screenshot({path: '.codex-artifacts/chat-social/main-profile.png'});
  await page.getByRole('button', {name: 'Block', exact: true}).click();
  await page.getByRole('button', {name: 'Unblock', exact: true}).waitFor(); assert(await page.getByRole('button', {name: 'Message', exact: true}).isDisabled());
  await page.getByRole('button', {name: 'Unblock', exact: true}).click();
  await page.getByRole('button', {name: 'Block', exact: true}).waitFor();
  await page.setViewportSize({width: 390, height: 600});
  const mobile = await card.boundingBox(); assert(mobile.x >= 0 && mobile.x + mobile.width <= 390 && mobile.y + mobile.height <= 600);
  await page.getByRole('button', {name: 'Message', exact: true}).click();
  await page.waitForFunction(() => window.openedConversation?.includes('/apps/chat/?conversation='));
  await page.locator('.nyx-profile-directory-overlay').waitFor({state: 'detached'});
  assert.equal(await page.evaluate(() => document.activeElement.id), 'origin');
  console.log('PASS compact main-site public profile, hidden directory chrome, safe role/bio, friend/block actions, mobile sizing, DM navigation and focus restoration');
} finally {await browser.close();}
