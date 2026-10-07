import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync} from 'node:fs';
import express from 'express';
import {chromium} from 'playwright';

const fixture = readFileSync(sourceFile('scripts/test-account-controls.mjs'), 'utf8');
const moduleText = name => fixture.match(new RegExp('const ' + name + '=`([\\s\\S]*?)`;'))[1];
const app = express(); app.use(express.static(process.env.NYX_TEST_STATIC_ROOT || process.cwd()));
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const base = process.env.NYX_TEST_BASE_URL || 'http://127.0.0.1:' + server.address().port;
const workspace = await chromium.launch({channel: 'msedge', headless: true});
const me = {uid: 'fixture-member', displayName: 'Alex', handle: '@alex', role: 'member'};
const peer = {uid: 'outside-directory', displayName: 'River', handle: '@river', role: 'owner', online: true};
let relations = [], actions = [], dmCalls = 0;
const errors = [];
try {
  const page = await workspace.newPage({viewport: {width: 1440, height: 940}});
  page.on('pageerror', error => errors.push(error.message));
  for (const [file, name] of [['firebase-app.js', 'firebaseAppModule'], ['firebase-auth.js', 'firebaseAuthModule']]) {
    await page.route('https://www.gstatic.com/firebasejs/11.10.0/' + file, route => route.fulfill({contentType: 'text/javascript', headers: {'access-control-allow-origin': '*'}, body: moduleText(name)}));
  }
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let payload = {};
    if (path === '/api/founder-profile/auth-config') payload = {enabled: true, projectId: 'fixture', apiKey: 'test'};
    if (path === '/api/chat/bootstrap') payload = {me, members: [me], channels: [{id: 'rules', name: 'rules'}, {id: 'announcements', name: 'announcements'}, {id: 'general', name: 'general', description: 'Community chat'}], conversations: [], voice: {channels: [], participants: []}};
    if (path === '/api/chat/messages') payload = {messages: Array.from({length: 12}, (_, i) => ({id: String(i).padStart(40, 'a'), author: i % 3 ? peer : me, text: ['Anyone playing tonight?', 'I will be around after six.', 'See you there.'][i % 3], createdAtMs: Date.now() - (12 - i) * 360000}))};
    if (path === '/api/profiles/' + peer.uid) payload = {uid: peer.uid, profile: {...peer, bio: 'Design, music, and late nights.\n<script>Text stays text.</script>', bannerUrl: new URL('/assets/backgrounds/1014077.jpg', base).href}, online: true, role: 'owner', roleLabel: 'Owner', createdAt: '2026-01-01T00:00:00.000Z'};
    if (path === '/api/chat/relationships') payload = {relationships: relations};
    if (path.startsWith('/api/chat/relationships/')) {
      const action = route.request().postDataJSON().action; actions.push(action);
      let relation = relations.find(value => value.uid === peer.uid) || {uid: peer.uid, friend: '', blocked: false, ignored: false, canMessage: true, member: peer};
      if (action === 'request') relation.friend = 'outgoing';
      if (action === 'accept') relation.friend = 'accepted';
      if (['decline', 'cancel', 'remove'].includes(action)) relation.friend = '';
      if (['block', 'unblock'].includes(action)) {relation.blocked = action === 'block'; relation.canMessage = !relation.blocked; relation.friend = '';}
      if (['ignore', 'unignore'].includes(action)) relation.ignored = action === 'ignore';
      relations = relation.friend || relation.blocked || relation.ignored ? [relation] : [];
      payload = {relationships: relations};
    }
    if (path === '/api/chat/conversations' && route.request().method() === 'POST') {dmCalls++; payload = {conversation: {id: 'dm-fixture', other: peer}};}
    return route.fulfill({json: payload});
  });
  await page.goto(base + '/apps/chat/');
  await page.locator('.message-author').first().waitFor();
  assert.equal(await page.locator('.message-author').count(), 12);
  // The author is deliberately absent from the initial member directory.
  await page.getByRole('button', {name: 'River', exact: true}).first().click();
  const profile = page.locator('[data-member-dialog]');
  await profile.locator('.member-bio').waitFor();
  assert.match(await profile.innerText(), /Design, music/);
  await profile.locator('.member-banner-image').evaluate(image => image.decode());
  assert(await profile.locator('.member-banner-image').evaluate(image => image.naturalWidth > 0));
  assert.equal(await profile.locator('script').count(), 0);
  await profile.getByRole('button', {name: 'Add friend', exact: true}).click();
  await profile.getByRole('button', {name: 'Cancel request', exact: true}).waitFor();
  assert.equal(actions.at(-1), 'request');
  mkdirSync('.codex-artifacts/chat-social', {recursive: true});
  await page.screenshot({path: '.codex-artifacts/chat-social/profile.png'});
  await profile.getByRole('button', {name: 'Ignore', exact: true}).click();
  await profile.getByRole('button', {name: 'Unignore', exact: true}).waitFor();
  assert.equal(await page.locator('.message-author').filter({hasText: 'River'}).count(), 0);
  await profile.getByRole('button', {name: 'Block', exact: true}).click();
  await profile.getByRole('button', {name: 'Unblock', exact: true}).waitFor();
  assert(await profile.getByRole('button', {name: 'Message', exact: true}).isDisabled());
  await page.keyboard.press('Escape'); await page.reload();
  await page.locator('[data-message-form]').waitFor({state: 'visible'});
  assert.equal(await page.locator('.message-author').filter({hasText: 'River'}).count(), 0, 'Reload preserves ignored/blocked state');
  await page.getByRole('button', {name: 'Friends and requests'}).click();
  await page.getByRole('button', {name: 'Blocked', exact: true}).click();
  await page.getByRole('button', {name: 'Unblock', exact: true}).click();
  await page.getByRole('button', {name: 'Ignored', exact: true}).click();
  await page.getByRole('button', {name: 'Unignore', exact: true}).click();
  await page.getByRole('button', {name: 'Close friends'}).click();
  await page.getByRole('button', {name: 'River', exact: true}).first().waitFor();
  relations = [{uid: peer.uid, friend: 'incoming', blocked: false, ignored: false, canMessage: true, member: peer}];
  await page.reload(); await page.locator('[data-message-form]').waitFor({state: 'visible'});
  await page.getByRole('button', {name: 'Friends and requests'}).click();
  await page.getByRole('button', {name: 'Requests', exact: true}).click();
  await page.getByRole('button', {name: 'Accept', exact: true}).click();
  await page.getByRole('button', {name: 'All', exact: true}).click();
  await page.getByRole('button', {name: 'Remove friend', exact: true}).waitFor();
  await page.getByRole('button', {name: 'Close friends'}).click();
  await page.screenshot({path: '.codex-artifacts/chat-social/chat.png'});
  await page.getByRole('button', {name: 'View River profile', exact: true}).first().focus(); await page.keyboard.press('Enter');
  await profile.locator('.member-bio').waitFor();
  await profile.getByRole('button', {name: 'Message', exact: true}).click();
  await page.locator('[data-chat-directs]').waitFor({state: 'visible'}); assert.equal(dmCalls, 1);
  await page.setViewportSize({width: 390, height: 700});
  await page.getByRole('button', {name: 'View River profile', exact: true}).first().click();
  await profile.locator('.member-bio').waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const bounds = await profile.boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= 700);
  await page.screenshot({path: '.codex-artifacts/chat-social/mobile-profile.png'});
  await page.keyboard.press('Escape');
  for (const height of [400, 700]) {await page.setViewportSize({width: 390, height}); const bounds = await page.locator('[data-message-input]').boundingBox(); assert(bounds.y >= 0 && bounds.y + bounds.height <= height);}
  // Reproduce the original bug: an embedded chat whose parent has no profile handler.
  await page.route('**/chat-profile-host', route => route.fulfill({contentType: 'text/html', body: '<iframe title="Chat" src="/apps/chat/" style="width:100%;height:95vh;border:0"></iframe>'}));
  await page.setViewportSize({width: 1440, height: 940});
  await page.goto(base + '/chat-profile-host');
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', {name: 'River', exact: true}).first().click();
  await frame.locator('[data-member-dialog] .member-bio').waitFor();
  assert(await frame.locator('[data-member-dialog]').isVisible());
  assert.deepEqual(errors, []);
  console.log('PASS out-of-directory author profiles, keyboard entry, safe bio, friendship requests/acceptance, block and ignore persistence, DM button, mobile card/composer bounds');
} finally {await workspace.close(); await new Promise(resolve => server.close(resolve));}
