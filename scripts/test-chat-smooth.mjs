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
  await page.goto(base+'/apps/chat/');
  await page.locator('.message').first().waitFor();
  await page.getByRole('button',{name:'Choose a GIF',exact:true}).click();
  await page.locator('[data-gif-file]').setInputFiles({name:'invalid.gif',mimeType:'image/gif',buffer:Buffer.from('not a gif')});
  await page.waitForFunction(()=>{
    const text=document.querySelector('[data-gif-status]')?.textContent.normalize('NFKC');
    return text==='This file is not a GIF. Use a direct GIF link.' || text==='This fil3 is not a GIF. Use a dir3ct GIF link.';
  });
  assert.equal(await page.locator('[data-gif-grid] button').count(),0,'Rejected bytes never become an attachable GIF');
  const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
  await page.locator('[data-gif-file]').setInputFiles({name:'wave.gif',mimeType:'image/gif',buffer:gif});
  await page.getByRole('button',{name:'Attach wave.gif',exact:true}).click();
  await page.locator('[data-attachment-previews]').getByText('wave.gif',{exact:true}).waitFor();
  assert(await page.locator('[data-message-input]').evaluate(node=>node===document.activeElement));
  await page.getByRole('button',{name:'Remove attachment',exact:true}).click();
  await page.getByRole('button',{name:'Choose a GIF',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Attach wave.gif',exact:true}).count(),1);
  await page.keyboard.press('Escape');
  await page.locator('[data-gif-dialog]').waitFor({state:'hidden'});
  await page.locator('.message').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.locator('.message').first().click({button:'right'});
  await page.getByRole('menuitem',{name:'All emojis',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search reaction emojis'}).fill('rocket');
  await page.getByRole('button',{name:'React rocket',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog',{name:'Choose a reaction'}).count(),0,'Context-menu picker closes with Escape');
  await page.locator('.message').first().evaluate(n=>{window.qNode=n;const image=document.createElement('img');image.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>';n.querySelector('.message-content').append(image);window.qImage=image;});
  await page.locator('.message').first().hover();await page.locator('.reaction-add').first().click();
  assert(await page.locator('.reaction-emoji-grid button').count()<=120);
  await page.getByRole('button',{name:'Show more',exact:true}).click();
  const expanded = await page.locator('.reaction-emoji-grid button').count();
  assert(expanded>120&&expanded<=240,'Show more reveals up to 120 additional catalog entries');
  const pickerBox=await page.locator('.reaction-picker').boundingBox();assert(pickerBox.x>=0&&pickerBox.y>=0&&pickerBox.x+pickerBox.width<=1440);assert.equal(await page.getByRole('button',{name:/Quick react /}).count(),7);
  await page.screenshot({path:'.codex-artifacts/reaction-picker.png'});
  await page.getByRole('searchbox',{name:'Search reaction emojis'}).fill('fire');
  await page.getByRole('button',{name:'React fire',exact:true}).click();
  await page.locator('.reaction-chip.self').waitFor({timeout:500});
  assert(await page.evaluate(()=>qNode===document.querySelector('.message')&&qImage.isConnected));
  await page.waitForTimeout(800);
  assert(await page.evaluate(()=>qImage.isConnected));
  assert.equal(await page.locator('.reaction-add').first().textContent(),'\u{1f525}');
  await page.locator('.reaction-add').first().click();assert.equal(await page.locator('.q68d2 button').first().textContent(),'\u{1f525}');await page.keyboard.press('Escape');
  const chip=await page.locator('.reaction-chip').boundingBox();assert(chip.width<100&&chip.height<=34);
  qFail=true;await page.locator('.reaction-chip').click();
  assert.equal(await page.locator('.reaction-chip').count(),0);
  await page.locator('.reaction-chip.self').waitFor();
  assert(await page.evaluate(()=>qImage.isConnected));
  await page.reload();await page.locator('.message').first().waitFor();assert.equal(await page.locator('.reaction-add').first().textContent(),'\u{1f525}');
  await page.setViewportSize({width:320,height:568});await page.locator('.message').first().scrollIntoViewIfNeeded();await page.waitForTimeout(350);await page.locator('.reaction-add').first().click();const mobilePicker=await page.locator('.reaction-picker').boundingBox();assert(mobilePicker.x>=0&&mobilePicker.x+mobilePicker.width<=320&&mobilePicker.y>=0&&mobilePicker.y+mobilePicker.height<=568);
  assert.deepEqual(errors,[]);
  console.log('PASS immediate reactions, failed request rollback, stable message/media nodes, bounded searchable picker');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
