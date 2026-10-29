import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import {chromium} from 'playwright';
const source=readFileSync('script.js','utf8'), functions={};
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&['startNyxLatencyMonitor','proxyFailureHtml'].includes(n.id?.name))functions[n.id.name]=source.slice(n.start,n.end);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
visit(parse(source,{ecmaVersion:'latest'}));
let release;globalThis.__relayGate=new Promise(r=>release=r);globalThis.__adapterInstalled=false;
const module='data:text/javascript,'+encodeURIComponent('await globalThis.__relayGate; export function installHttpRelaySocket(){globalThis.__adapterInstalled=true;}');
const monitor=functions.startNyxLatencyMonitor.replace('"/apps/tutsi/http-relay.mjs"',JSON.stringify(module));
for(const mode of ['http','socket','custom']){
 let started=0;globalThis.__adapterInstalled=false;
 const run=new Function('window','store','storedCustomWispUrl','syncNyxLatencyBubble','calibrateNyxLatency','document','addEventListener','setInterval',`const wispUrl=()=>'';${monitor};return startNyxLatencyMonitor;`)({NyxAvailability:{start(){if(mode==='http')assert.equal(globalThis.__adapterInstalled,true);started++;}}},{get:()=>mode==='http'},()=>mode==='custom'?'wss://custom.test/':'',()=>{},()=>{}, {addEventListener(){}},()=>{},()=>{});
 run();run();if(mode==='http'){assert.equal(started,0,'Do not probe the synthetic HTTP socket until its adapter is installed');release();await new Promise(r=>setTimeout(r,30));}assert.equal(started,1,'Start one monitor; preserve direct and custom relay behavior');
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const render=new Function('esc',functions.proxyFailureHtml+';return proxyFailureHtml;')(escape);
const b=await chromium.launch();try{const p=await b.newPage();await p.setContent(render('The destination refused this connection. <img src=x onerror=alert(1)>','Page',{heading:'Connection not private',allowDirect:true,directUrl:'https://duckduckgo.com/?q=e'}));assert.equal(await p.locator('h1').innerText(),'Connection not private');assert.match(await p.locator('p').innerText(),/destination refused/);assert.equal(await p.locator('img').count(),0);assert.equal(await p.getByRole('button',{name:'Reload page'}).count(),1);const direct=p.getByRole('link',{name:/Open directly/});assert.equal(await direct.getAttribute('href'),'https://duckduckgo.com/?q=e');assert.equal(await direct.getAttribute('target'),'_blank');assert.equal(await direct.getAttribute('rel'),'noopener noreferrer');assert.doesNotMatch(await p.content(),/nyx:proxy-direct-fallback/);await p.context().route('https://duckduckgo.com/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Direct destination</h1>'}));const popupPromise=p.waitForEvent('popup');await direct.click();const popup=await popupPromise;await popup.getByRole('heading',{name:'Direct destination'}).waitFor();assert.equal(p.frames().length,1);await popup.close();await p.setContent(render('Failed','Page',{allowDirect:true,directUrl:'javascript:alert(1)'}));assert.equal(await p.locator('a').count(),0);}finally{await b.close();delete globalThis.__relayGate;delete globalThis.__adapterInstalled;}
console.log('PASS HTTP monitor waits for adapter; native/custom relays preserved; escaped error explanation and accessible actions render.');
