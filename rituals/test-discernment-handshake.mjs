import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'acorn';
import vm from 'node:vm';
const source=await readFile('gospel.js','utf8');
const names=new Set(['tlsCertificateErrorText','serviceWorkerTransportErrorText','retrySearchHandshake','watchFrameTransportErrors']);
const functions=[];
function visit(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&names.has(node.id?.name))functions.push(source.slice(node.start,node.end));for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
visit(parse(source,{ecmaVersion:'latest'}));
let transport='libcurlRaw',reason='Internal Service Worker Error: TypeError: Request failed with error code 35: SSL connect error';
const timers=[],loads=[],failures=[];
const tab={frame:{addEventListener(){}},navigationIntent:'first'};
const api=vm.runInNewContext(functions.join('\n')+';({tlsCertificateErrorText,retrySearchHandshake,watchFrameTransportErrors})',{
 engines:{duck:'https://duckduckgo.com/?q=',google:'https://www.google.com/search?q='},
 proxyTransportName:()=>transport,setBrowserTransportOverride:value=>{transport=value},
 loadScramjetTab:(...args)=>loads.push(args),state:{tabs:[tab]},
 store:{text:()=> 'scramjet'},DEFAULT_BROWSER_MODE:'scramjet',normalizeBrowserModeName:value=>value,
 browserFrameStillAtSource:()=>true,inspectFrameHealth:()=>({hasErrorText:true,visibleText:reason}),
 setBrowserTabSecurityState:()=>{},loadSelectedSearchFallback:(...args)=>failures.push(args),
 setTimeout:fn=>timers.push(fn)
});
const url='https://duckduckgo.com/?q=nyx';
api.watchFrameTransportErrors(tab,url,'scramjet');timers.shift()();
assert.equal(transport,'epoxy');assert.equal(loads.length,1);assert.equal(loads[0][2],false);
timers.shift()();assert.equal(loads.length,1,'old monitor must not retry twice');
api.watchFrameTransportErrors(tab,url,'scramjet');timers.shift()();
assert.equal(loads.length,1);assert.equal(failures.length,1,'second handshake failure ends with a readable error');
reason='Request failed with error code 60: SSL peer certificate not OK';tab.navigationIntent='second';
api.watchFrameTransportErrors(tab,url,'scramjet');timers.at(-1)();
assert.equal(loads.length,1,'certificate verification failures do not switch transport');
assert.equal(api.tlsCertificateErrorText('Request failed with error code 35: SSL connect error'),false);
assert.equal(api.tlsCertificateErrorText(reason),true);
assert.equal(api.retrySearchHandshake(tab,'https://example.com/pay','scramjet','SSL connect error'),false,'do not replay arbitrary page actions');
assert.equal(api.retrySearchHandshake(tab,url,'scramjet','SSL connect error'),true,'a fresh navigation can recover');
assert.equal(transport,'libcurlRaw');
console.log('PASS search handshake recovery: fixed transport and StudyJet mode, one alternate attempt, stale callback cancellation, preserved URL/history, certificate protection and non-search exclusion.');
