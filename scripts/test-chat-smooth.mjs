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
let relations = [], actions = [], dmCalls = 0, q18=false, qFail=false, validGif=false;
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 940}});
  page.on('pageerror', error => errors.push(error.message));
  for (const [file, name] of [['firebase-app.js', 'firebaseAppModule'], ['firebase-auth.js', 'firebaseAuthModule']]) {
    await page.route('https://www.gstatic.com/firebasejs/11.10.0/' + file, route => route.fulfill({contentType: 'text/javascript', headers: {'access-control-allow-origin': '*'}, body: moduleText(name)}));
  }
  await page.addInitScript(() => {
    window.fixtureSocketHandlers = {}; window.fixtureSocketSent = [];
    window.io = () => {
      const socket = {connected:true,on(name,fn){window.fixtureSocketHandlers[name]=fn;return this;},emit(name,value){window.fixtureSocketSent.push({name,value});return this;},timeout(){return this;},disconnect(){},removeAllListeners(){},connect(){}};
      setTimeout(()=>window.fixtureSocketHandlers.connect?.(),100);
      return socket;
    };
  });
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/chat/gifs/media') { const preview = new URL(route.request().url()).searchParams.get('url').endsWith('/preview.gif'); return route.fulfill({contentType:'image/gif',body:preview || validGif ? Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64') : Buffer.from('not a gif')}); }
    let payload = {};
    if(path.endsWith('/reactions')){await new Promise(r=>setTimeout(r,650));if(qFail)return route.fulfill({status:500,json:{error:'Fixture rejection'}});q18=!q18;return route.fulfill({json:{reactions:q18?[{emoji:'\u{1f525}',count:1,self:true,uids:[me.uid]}]:[]}});}

    if (path === '/api/founder-profile/auth-config') payload = {enabled: true, projectId: 'fixture', apiKey: 'test'};
    if (path === '/api/chat/bootstrap') payload = {me, members: [me], channels: [{id: 'rules', name: 'rules'}, {id: 'announcements', name: 'announcements'}, {id: 'general', name: 'general', description: 'Community chat'}], conversations: [], voice: {channels: [], participants: []}};
    if (path === '/api/chat/messages') payload = {messages: Array.from({length: 12}, (_, i) => ({id: String(i).padStart(40, 'a'), author: i % 3 ? peer : me, text: ['Anyone playing tonight?', 'I will be around after six.', 'See you there.'][i % 3], createdAtMs: Date.now() - (12 - i) * 360000}))};
    if (path === '/api/chat/gifs') payload = {items:[{id:'wave',title:'Wave',url:'https://media.giphy.com/media/fixture/giphy.gif',preview:'https://media.giphy.com/media/fixture/preview.gif'}],next:null};
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
  const composer = await page.locator('[data-message-form]').boundingBox();
  const input = await page.locator('[data-message-input]').boundingBox();
  assert(input.width > composer.width * .5, 'Message input occupies the flexible column, not the send-button column');
  await page.waitForFunction(()=>Boolean(window.fixtureSocketHandlers['nyx:chat:typing']));
  await page.evaluate(() => {
    for(let i=0;i<5;i++) window.fixtureSocketHandlers['nyx:chat:typing']({uid:'typing-'+i,displayName:'Person '+i,scopeId:'general',scopeType:'channel',active:true});
  });
  assert.match(await page.locator('[data-typing-indicator]').innerText(),/Person 0, Person 1, Person 2 and 2 others are typing/);
  assert.equal(await page.locator('[data-typing-indicator] .avatar').count(),3);
  await page.evaluate(()=>window.fixtureSocketHandlers.connect());
  await page.locator('[data-message-input]').fill('draft');
  await page.waitForFunction(()=>window.fixtureSocketSent.some(event=>event.name==='nyx:chat:typing'&&event.value.active));
  await page.locator('[data-message-input]').fill('');
  await page.waitForFunction(()=>window.fixtureSocketSent.some(event=>event.name==='nyx:chat:typing'&&!event.value.active));
  await page.waitForTimeout(7000);
  assert(await page.locator('[data-typing-indicator]').isHidden(),'Stale typing indicators expire');
  await page.route('https://*.giphy.com/**', route => route.abort());
  await page.getByRole('button',{name:'Choose a GIF',exact:true}).click();
  await page.waitForFunction(()=>{const img=document.querySelector('[data-gif-grid] img');return img?.naturalWidth>0 && img.src.startsWith('blob:');});
  await page.getByRole('button',{name:'Favorite Wave',exact:true}).click();
  await page.getByRole('button',{name:'Favorites',exact:true}).click();
  await page.getByRole('button',{name:'Remove favorite Wave',exact:true}).waitFor();
  assert.equal(await page.locator('[data-gif-grid]').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),2);
  await page.getByRole('button',{name:'Attach Wave',exact:true}).click();
  await page.waitForFunction(()=>{
    const text=document.querySelector('[data-gif-status]')?.textContent.normalize('NFKC');
    return text==='This GIF could not be loaded. Choose another.' || text==='This GIF c0uld not be load3d. Choos3 anoth3r.';
  });
  assert.equal(await page.getByRole('button',{name:'Remove attachment',exact:true}).count(),0,'Rejected bytes never become an attachment');
  validGif = true;
  await page.getByRole('button',{name:'Trending',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search GIFs',exact:true}).fill('wave');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByRole('button',{name:'Attach Wave',exact:true}).click();
  await page.locator('[data-attachment-previews]').getByText('animation.gif',{exact:true}).waitFor();
  assert(await page.locator('[data-message-input]').evaluate(node=>node===document.activeElement));
  await page.getByRole('button',{name:'Remove attachment',exact:true}).click();
  await page.getByRole('button',{name:'Choose a GIF',exact:true}).click();
  await page.getByRole('button',{name:'Attach Wave',exact:true}).waitFor();
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
  assert.equal(await page.locator('.reaction-chip .avatar').count(),1,'Optimistic reaction shows current user avatar');
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
  await page.getByRole('button',{name:'Choose a GIF',exact:true}).click();
  await page.getByRole('button',{name:'Favorites',exact:true}).click();
  await page.getByRole('button',{name:'Remove favorite Wave',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:320,height:568});await page.locator('.message').first().scrollIntoViewIfNeeded();await page.waitForTimeout(350);await page.locator('.reaction-add').first().click();const mobilePicker=await page.locator('.reaction-picker').boundingBox();assert(mobilePicker.x>=0&&mobilePicker.x+mobilePicker.width<=320&&mobilePicker.y>=0&&mobilePicker.y+mobilePicker.height<=568);
  assert.deepEqual(errors,[]);
  console.log('PASS two-column GIF picker, persistent favorites, multi-user typing, expiry and reaction avatars');
  console.log('PASS immediate reactions, failed request rollback, stable message/media nodes, bounded searchable picker');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
