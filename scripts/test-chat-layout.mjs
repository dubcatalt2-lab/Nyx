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
let relations = [], actions = [], dmCalls = 0;
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 940}});
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
  await page.goto(base+'/apps/chat/');await page.locator('.message').first().waitFor();assert.equal(await page.locator('.current-user>span').last().evaluate(n=>getComputedStyle(n).display),'grid');
  assert.equal(await page.getByRole('button',{name:'Chat appearance',exact:true}).count(),0);
  assert.equal(await page.locator('.chat-topbar').count(),0);
  assert.equal(await page.getByRole('button',{name:'Back to home',exact:true}).count(),0);
  assert.equal(await page.locator('[data-connection-state]').isVisible(),false);
  assert.equal(await page.locator('.message-text').first().evaluate(n=>getComputedStyle(n).backdropFilter),'none');
  await page.locator('.message').first().hover();assert.equal(await page.locator('.message').first().evaluate(n=>getComputedStyle(n).backdropFilter),'blur(16px)');assert.equal(await page.locator('.message').first().evaluate(n=>getComputedStyle(n).borderRadius),'0px');
  assert.equal(await page.locator('[data-message-input]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.getByRole('button',{name:'Show members',exact:true}).click();assert(await page.locator('[data-member-sidebar]').isVisible());await page.locator('[data-drawer-shade]').click();
  mkdirSync('.codex-artifacts/chat-layout',{recursive:true});
  for(const [width,height] of [[1440,900],[1024,768],[390,844],[320,568]]){
    await page.setViewportSize({width,height});await page.waitForFunction(()=>parseFloat(document.documentElement.style.getPropertyValue('--chat-viewport-height'))===visualViewport.height);await page.waitForTimeout(50);
    const composer=page.locator('[data-message-form]');const box=await composer.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,JSON.stringify({width,height,box}));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.locator('.message-text').first().evaluate(n=>getComputedStyle(n).fontSize),'15px');
    if(width<=700){await page.getByRole('button',{name:'Show channels',exact:true}).click();await page.locator('details.q63e8>summary').click();assert(await page.getByRole('combobox',{name:'Voice connection'}).isVisible());await page.locator('details.q63e8>summary').click();await page.getByRole('button',{name:'Close channels',exact:true}).click();}
    await page.screenshot({path:'.codex-artifacts/chat-layout/'+width+'.png'});
  }
  assert.deepEqual(errors,[]);console.log('PASS chat layout at desktop/tablet/390px/320px; reachable composer, voice settings and channel drawer');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
