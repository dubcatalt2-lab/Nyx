import assert from 'node:assert/strict';
import {readFileSync, mkdirSync} from 'node:fs';
import express from 'express';
import {chromium} from 'playwright';

const fixture = readFileSync('scripts/test-account-controls.mjs', 'utf8');
const moduleText = name => fixture.match(new RegExp('const ' + name + '=`([\\s\\S]*?)`;'))[1];
const app = express(); app.use(express.static(process.env.NYX_TEST_STATIC_ROOT || process.cwd()));
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const base = process.env.NYX_TEST_BASE_URL || 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({channel: 'msedge', headless: true});
const me = {uid: 'fixture-member', displayName: 'Alex', handle: '@alex', role: 'member'};
const peer = {uid: 'outside-directory', displayName: 'River', handle: '@river', role: 'owner', online: true};
let relations = [], actions = [], dmCalls = 0, q18=false, qFail=false;
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 940}});
  page.on('pageerror', error => errors.push(error.message));
  for (const [file, name] of [['firebase-app.js', 'firebaseAppModule'], ['firebase-auth.js', 'firebaseAuthModule']]) {
    await page.route('https://www.gstatic.com/firebasejs/11.10.0/' + file, route => route.fulfill({contentType: 'text/javascript', headers: {'access-control-allow-origin': '*'}, body: moduleText(name)}));
  }
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let payload = {};
    if(path.endsWith('/reactions')){await new Promise(r=>setTimeout(r,650));if(qFail)return route.fulfill({status:500,json:{error:'Fixture rejection'}});q18=!q18;return route.fulfill({json:{reactions:q18?[{emoji:'\u{1f525}',count:1,self:true}]:[]}});}

    if (path === '/api/founder-profile/auth-config') payload = {enabled: true, projectId: 'fixture', apiKey: 'test'};
    if (path === '/api/chat/bootstrap') payload = {me, members: [me], channels: [{id: 'gaming', name: 'Gaming'}, {id: 'announcements', name: 'announcements'}, {id: 'general', name: 'general', description: 'Community chat'}], conversations: [], voice: {channels: [], participants: []}};
    if (path === '/api/chat/messages') payload = {messages: Array.from({length: 12}, (_, i) => ({id: String(i).padStart(40, 'a'), author: i % 3 ? peer : me, text: '&5color &lbold &kmagic @alex https://example.com/?a=1&b=2', createdAtMs: Date.now() - (12 - i) * 360000}))};
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
  await page.goto(base+'/apps/chat/');
  await page.locator('.message').first().waitFor();
  assert.equal(await page.locator('.message-text.minecraft-formatted').count(),0);
  assert.equal(await page.locator('.message-text .minecraft-magic').count(),0);
  assert.equal(await page.locator('.message-text').first().textContent(),'&5color &lbold &kmagic @alex https://example.com/?a=1&b=2');
  assert.equal(await page.locator('.message-text .message-mention.self').first().textContent(),'@alex');
  await page.locator('[data-channel-id="gaming"]').click();
  await page.locator('.message-text.minecraft-formatted').first().waitFor();
  assert(await page.locator('.message-text .minecraft-magic').count()>0);
  assert((await page.locator('.message-text').first().textContent()).includes('https://example.com/?a=1&b=2'));
  assert.deepEqual(errors,[]);
  console.log('PASS Global Chat literal formatting codes and mentions; other channels retain effects; URLs preserved');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
