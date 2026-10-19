import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import {chromium} from 'playwright';
const source=readFileSync('script.js','utf8'),functions=new Map();
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration')functions.set(n.id.name,source.slice(n.start,n.end));for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)}
visit(parse(source,{ecmaVersion:'latest'}));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage();await page.setContent('<button data-n7x-dock-item="chat">Chat</button>');await page.addStyleTag({content:readFileSync('css/obsidian.css','utf8')});
await page.evaluate(code=>{window.qTest=new Function('const q91ab=new Map(),q38fd=new Map(),nyxMentionIds=new Set();const toast=()=>{};'+code+';return {ping:showNyxMention,read:q81c4}')();},['q28c7','q81c4','showNyxMention'].map(n=>functions.get(n)).join('\n'));
await page.evaluate(()=>qTest.ping('message:general:100:mention'));
assert.equal(await page.locator('button').getAttribute('aria-label'),'Chat, unread mentions');assert.equal(await page.locator('button').evaluate(n=>getComputedStyle(n,'::after').backgroundColor),'rgb(240, 71, 71)');
await page.evaluate(()=>{qTest.ping('message:other:200:mention');qTest.read('channel:general',150)});assert(await page.locator('button').evaluate(n=>n.classList.contains('q19f8')));
await page.evaluate(()=>qTest.read('channel:other',250));assert.equal(await page.locator('button').getAttribute('aria-label'),'Chat');
await page.evaluate(()=>qTest.ping('message:general:120:mention'));assert.equal(await page.locator('button').getAttribute('aria-label'),'Chat');
await page.evaluate(()=>qTest.ping('dm:room:300:mention'));assert.equal(await page.locator('button').getAttribute('aria-label'),'Chat, unread mentions');
const chatSource=readFileSync('apps/chat/app.js','utf8'),chatFunctions=new Map();
function scan(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration')chatFunctions.set(n.id.name,chatSource.slice(n.start,n.end));for(const v of Object.values(n))if(Array.isArray(v))v.forEach(scan);else if(v&&typeof v==='object')scan(v)}scan(parse(chatSource,{ecmaVersion:'latest'}));
await page.setContent('<div id="channels"></div>');await page.addStyleTag({content:readFileSync('apps/chat/polish.css','utf8')});
await page.evaluate(code=>{window.qChat=new Function(`const q63a9=new Map(),state={notifiedDm:new Set(),lastRead:{},channels:[{id:'general',name:'General'},{id:'announcements',name:'Announcements'}],latestActivity:{},active:{type:'channel',id:'general'}};const refs={channelList:document.getElementById('channels')},channelGroups=[['announcements','Announcements'],['chat','Chat']],collapsedChannelGroups=new Set(),scopeKey=()=> 'channel:general',social={muted:()=>false},showMentionToast=()=>{};`+code+`;return {ping:playChatPing,read:()=>{state.lastRead['channel:announcements']=250;renderChannels()},render:renderChannels}`)();qChat.render();},['channelGroup','renderChannels','playChatPing'].map(n=>chatFunctions.get(n)).join('\n'));
await page.evaluate(()=>{qChat.ping('message:announcements:100','mention');qChat.ping('message:announcements:100','mention');qChat.ping('message:announcements:200','mention')});
assert.equal(await page.locator('.q93a1').textContent(),'2');assert.equal(await page.locator('.q93a1').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(231, 68, 82)');
await page.evaluate(()=>qChat.read());assert.equal(await page.locator('.q93a1').count(),0);
await page.evaluate(()=>qChat.ping('message:announcements:150','mention'));assert.equal(await page.locator('.q93a1').count(),0);
console.log('PASS channel mention counts, red badge, deduplication, read clearing and stale event suppression');
console.log('PASS red accessible sidebar dot, per-conversation reads, stale poll suppression and DM mentions');
}finally{await browser.close()}
