import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const workspace=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await workspace.newPage({viewport:{width:1440,height:900}}),errors=[];let payload;
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.SpeechRecognition=class {start(){window.__recognition=this;}stop(){this.onend?.();}abort(){this.onend?.();}};
  window.Audio=class {constructor(url){this.url=url;}play(){window.__utterance=this;return Promise.resolve();}pause(){window.__cancelled=true;}removeAttribute(){}};
 });
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-app.js',r=>r.fulfill({contentType:'text/javascript',body:'export const getApps=()=>[];export const initializeApp=()=>({});'}));
 await page.route('https://www.gstatic.com/firebasejs/**/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:'const auth={currentUser:{uid:"fixture-user",getIdToken:async()=>"fixture"}};export const getAuth=()=>auth;export const browserLocalPersistence={};export const setPersistence=async()=>{};export const onAuthStateChanged=(a,f)=>{f(a.currentUser);window.__switchAccount=uid=>{a.currentUser=uid?{uid,getIdToken:async()=>"fixture"}:null;f(a.currentUser);};};export const signOut=async()=>{};'}));
 await page.route('http://127.0.0.1:6768/**',r=>r.fulfill({json:r.request().url().endsWith('/connect')?{connected:true}:r.request().url().endsWith('/status')?{workspace:'Fixture'}:{entries:[]}}));
 await page.route('**/api/**',async r=>{const url=r.request().url();if(url.includes('auth-config'))return r.fulfill({json:{enabled:true,apiKey:'fixture',projectId:'fixture'}});if(url.endsWith('/api/profiles/me'))return r.fulfill({json:{profile:{handle:'@tester'}}});if(url.endsWith('/models'))return r.fulfill({json:{models:[{id:'openai/test',label:'OpenAI Test',created:1800000000,vision:true,text:true,outputModalities:['text','audio']},{id:'openai/legacy',label:'OpenAI Legacy',created:1600000000,text:true},{id:'x-ai/grok-test',label:'Grok Test',text:true},{id:'deepseek/test',label:'DeepSeek Test',text:true},{id:'anthropic/test',label:'Claude Test',created:1700000000,reasoning:true,text:true}]}});payload=r.request().postDataJSON();await new Promise(resolve=>setTimeout(resolve,150));return r.fulfill({json:{metadata:{summary:'I compared the visible details before answering.'},text:payload.task?JSON.stringify({message:'I can help with that image.',done:true}):'I can help with that image.',...(payload.generateAudio?{audio:{mime:'audio/mpeg',data:'SUQz'}}:{})}});});
 await page.goto((process.env.NYX_AGENTS_TEST_URL||'http://localhost:6769')+'/apps/agents/#companion='+'a'.repeat(64)+'&port=6768');await page.locator('#account').filter({hasText:'Sign out'}).waitFor();assert(await page.locator('#send').isEnabled());

 const send=async text=>{await page.locator('#prompt').fill(text);await page.locator('#send').click();await page.waitForFunction(()=>!document.getElementById('send').disabled);};
 assert.equal(await page.locator('#sidebarNewChat').innerText(),'New chat');
 await page.locator('#newProject').click();await page.locator('[name=projectName]').fill('Website');await page.locator('#organizeDialog button[type=submit]').click();
 await page.locator('[aria-label="Add reference files"]').setInputFiles([{name:'brief.txt',mimeType:'text/plain',buffer:Buffer.from('Use forest green accents.')},{name:'index.html',mimeType:'text/html',buffer:Buffer.from('<h1>Project fixture</h1>')}]);
 await page.locator('.project-files button').filter({hasText:'brief.txt'}).waitFor();await page.locator('#organizeDialog [aria-label=Close]').click();
 assert.match(await page.locator('#projectContext').innerText(),/2 reference files/);
 await send('Plan the website');assert.match(payload.messages[0].content,/Use forest green accents/);assert.match(payload.messages[0].content,/untrusted data/);
 await page.locator('.message.assistant .message-pin').click();assert.equal(await page.locator('.message.assistant .message-pin').getAttribute('aria-pressed'),'true');
 await page.locator('.saved-chat').hover();await page.locator('.chat-pin').click();assert.equal(await page.locator('.chat-pin').getAttribute('aria-pressed'),'true');
 await page.locator('#sidebarNewChat').click();await send('Second chat');assert.equal(await page.locator('.saved-chat .chat-title strong').first().innerText(),'Plan the website');
 await page.locator('#pinnedMessages').click();assert.equal(await page.locator('.pinned-result').count(),1);await page.locator('.pinned-result').click();assert(await page.locator('.message.assistant .message-pin[aria-pressed=true]').isVisible());
 await page.locator('#themeToggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');assert.equal(await page.locator('main').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
 await page.screenshot({path:'.codex-artifacts/nook-projects-light.png',animations:'disabled'});
 await page.reload();await page.locator('#account').filter({hasText:'Sign out'}).waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');assert.equal(await page.locator('.saved-chat .chat-title strong').first().innerText(),'Plan the website');
 await page.locator('#pinnedMessages').click();await page.locator('.pinned-result').click();assert.match(await page.locator('#projectContext').innerText(),/2 reference files/);
 const saved=await page.evaluate(()=>localStorage.getItem('agents.chats.v1.fixture-user'));
 await page.locator('#tempChat').click();await send('Temporary test');assert(!payload.messages.some(m=>m.content.includes('forest green')));assert.equal(await page.locator('.message-pin').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('agents.chats.v1.fixture-user')),saved);
 await page.locator('#projectList>button').click();await send('Outside the project');assert(!payload.messages.some(m=>m.content.includes('forest green')));
 await page.locator('#moveChat').click();await page.locator('#organizeDialog>button').filter({hasText:'Website'}).click();assert.match(await page.locator('#projectContext').innerText(),/Website/);
 await page.locator('#projectContext').click();await page.locator('[aria-label="Add reference files"]').setInputFiles({name:'huge.txt',mimeType:'text/plain',buffer:Buffer.from('x'.repeat(9000))});await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('8,000'));assert.equal(await page.locator('.project-files>div').count(),2);await page.locator('#organizeDialog [aria-label=Close]').click();
 await page.locator('#themeToggle').click();await page.screenshot({path:'.codex-artifacts/nook-projects-dark.png',animations:'disabled'});
 await page.evaluate(()=>window.__switchAccount('other-user'));assert.equal(await page.locator('.saved-chat').count(),0);assert.equal(await page.locator('.project-row').count(),0);await page.locator('#pinnedMessages').click();assert.equal(await page.locator('.pinned-result').count(),0);await page.locator('#organizeDialog [aria-label=Close]').click();
 await page.evaluate(()=>window.__switchAccount('fixture-user'));await page.locator('.project-row button').first().click();await page.locator('.saved-chat button').first().click();await page.locator('#projectContext').click();await page.locator('.delete-project').click();assert.equal(await page.locator('.project-row').count(),0);assert.equal(await page.locator('.saved-chat').count(),3);
 await page.locator('#pinnedMessages').click();await page.locator('.pinned-result').click();await page.locator('.message.assistant .message-pin').click();await page.locator('#pinnedMessages').click();assert.equal(await page.locator('.pinned-result').count(),0);

 await page.locator('#organizeDialog [aria-label=Close]').click();
 await page.locator('#modelTrigger').click();assert.deepEqual(await page.locator('.ai-model-group').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),['OpenAI','Anthropic','xAI','DeepSeek']);await page.locator('#modelMenuClose').click();
 await page.locator('#collapseChats').click();assert.equal(await page.locator('#collapseChats').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#toggleChats').count(),0);assert(await page.locator('#sidebarNewChat').isVisible());assert(await page.locator('#tempChat').isVisible());assert(await page.locator('#railProjects').isVisible());await page.waitForFunction(()=>Math.round(document.getElementById('chatSidebar').getBoundingClientRect().width)===52);await page.locator('#railProjects').click();await page.locator('#organizeDialog [aria-label=Close]').click();
 await page.locator('#sidebarNewChat').click();assert.equal(await page.locator('.message').count(),0);await page.screenshot({path:'.codex-artifacts/nook-icon-rail.png',animations:'disabled'});await page.locator('#collapseChats').click();
 assert.deepEqual(errors,[]);console.log('PASS project files/context, chat moves, both kinds of pins, persistence, temporary privacy, account isolation, file bounds, deletion and light/dark mode');
}finally{await workspace.close();}
