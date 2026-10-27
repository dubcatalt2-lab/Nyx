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
const me = {uid: 'fixture-member', displayName: 'Alex', handle: '@alex', role: 'moderator',canModerate:true};
const peer = {uid: 'mizu_'+ 'a'.repeat(40), displayName: 'River (Mizu)', handle: '@river', role: 'owner', online: true};
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
    if(path.startsWith('/api/chat/integrations/mizu/users/')){actions.push(route.request().postDataJSON());return route.fulfill({json:actions.at(-1)});}

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
  await page.waitForFunction(()=>Boolean(window.fixtureSocketHandlers['nyx:chat:event']));
  const incoming = async id => {
    await page.evaluate(({id,peer})=>window.fixtureSocketHandlers['nyx:chat:event']({kind:'message',scopeType:'channel',scopeId:'general',message:{id,author:peer,text:'Incoming '+id,createdAtMs:Date.now()}}),{id,peer});
    await page.getByText('Incoming '+id,{exact:true}).waitFor();
  };
  const scroll = () => page.locator('[data-message-scroller]').evaluate(el=>{el.scrollTop-=150;el.dispatchEvent(new Event('scroll'));});
  await page.locator('.message').nth(1).click({button:'right'});
  await incoming('incoming-one');await scroll();
  assert(await page.getByRole('menuitem',{name:'Reply',exact:true}).isVisible(),'Incoming messages and scroll preserve menu');
  await page.getByRole('menuitem',{name:'Reply',exact:true}).click();
  assert.match(await page.locator('[data-reply-preview]').innerText(),/I will be around after six/);
  await page.getByRole('button',{name:'Cancel reply',exact:true}).click();
  await page.locator('.message').nth(1).click({button:'right'});
  await page.getByRole('menuitem',{name:'All emojis',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search reaction emojis'}).fill('fire');
  await incoming('incoming-two');await scroll();
  assert(await page.getByRole('button',{name:'React fire',exact:true}).isVisible(),'Picker survives refresh and scroll');
  const reactionRequest=page.waitForRequest(r=>r.url().includes('/reactions')&&r.method()==='POST');
  await page.getByRole('button',{name:'React fire',exact:true}).click();
  assert((await reactionRequest).url().includes(String(1).padStart(40,'a')),'Reaction retains original target');
  await page.waitForTimeout(750);
  await page.locator('.message').nth(2).click({button:'right'});
  await page.evaluate(id=>window.fixtureSocketHandlers['nyx:chat:event']({kind:'delete',scopeType:'channel',scopeId:'general',messageId:id}),String(2).padStart(40,'a'));
  await page.getByRole('menuitem',{name:'Reply',exact:true}).waitFor({state:'hidden'});
  await page.locator('.message').nth(1).click({button:'right'});
  await page.getByRole('menuitem',{name:'Ban from shared global chat',exact:true}).click();
  await page.waitForTimeout(100);assert.deepEqual(actions,[{banned:true}]);
  await page.locator('.message').nth(1).click({button:'right'});
  await page.getByRole('menuitem',{name:'Unban from shared global chat',exact:true}).click();
  await page.waitForTimeout(100);assert.deepEqual(actions,[{banned:true},{banned:false}]);
  await page.locator('.message').nth(1).click({button:'right'});
  await page.getByRole('menuitem',{name:'All emojis',exact:true}).click();
  await page.evaluate(id=>window.fixtureSocketHandlers['nyx:chat:event']({kind:'delete',scopeType:'channel',scopeId:'general',messageId:id}),String(1).padStart(40,'a'));
  await page.getByRole('dialog',{name:'Choose a reaction'}).waitFor({state:'hidden'});
  console.log('PASS menus survive incoming messages and scroll; reply/reaction retain their target; deleting target closes menu/picker');
  assert.deepEqual(errors,[]);console.log('PASS Mizu message moderator context actions call signed-in Nyx ban/unban routes');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
