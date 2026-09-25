import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';

// Exercise the real host watchdog with deterministic load/route timing.
const source=readFileSync('script.js','utf8');
const wanted=new Set(['watchProxyLoad','browserFrameStillAtSource','inspectFrameHealth']);
const functions=[];
let sourceDecoder='';
function visit(node){
  if(!node || typeof node!=='object') return;
  if(node.type==='FunctionDeclaration' && wanted.has(node.id?.name)) functions.push(source.slice(node.start,node.end));
  if(node.type==='FunctionDeclaration' && node.id?.name==='browserShellSourceUrl') sourceDecoder=source.slice(node.start,node.end);
  for(const value of Object.values(node)) {
    if(Array.isArray(value)) value.forEach(visit);
    else if(value && typeof value==='object') visit(value);
  }
}
visit(parse(source,{ecmaVersion:'latest'}));
assert.equal(functions.length,wanted.size);
const decode=vm.runInNewContext(sourceDecoder+';browserShellSourceUrl;',{
  URL,window:{},location:{origin:'https://nyx.test',href:'https://nyx.test/'}
});
const channel='https://discord.com/channels/100/200?flow=a%2Bb#message';
assert.equal(decode('https://nyx.test/~/sj-v1/'+encodeURIComponent(channel)),channel);
assert.equal(decode('https://nyx.test/~/sj-v1/'+encodeURIComponent(channel)+'#next%20message'),channel.replace('#message','#next%20message'));
const other='https://other.test/~/sj-v1/'+encodeURIComponent(channel);
assert.equal(decode(other),other,'Only decode local proxy paths');

function fixture(){
  const url='https://discord.com/app', tasks=[], calls=[], listeners=new Map();
  let now=0;
  const body={textContent:'Channel list',innerText:'Channel list',childElementCount:2};
  const doc={body,documentElement:{childElementCount:2},title:'Channel fixture',readyState:'complete',
    querySelector:selector=>selector==='main,button,a,input,[role],[data-testid],svg,img,canvas,video,audio' ? {} : null};
  const frame={contentDocument:doc,contentWindow:{location:{href:url}},getAttribute:()=>'/~/sj/fixture',
    addEventListener:(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},
    removeEventListener:(name,fn)=>listeners.set(name,(listeners.get(name)||[]).filter(x=>x!==fn))};
  const tab={url,sourceUrl:url,frame};
  const context=vm.createContext({
    Date:{now:()=>now},Math,location:{href:'https://nyx.test/'},state:{tabs:[tab]},
    DEFAULT_BROWSER_MODE:'scramjet',DEFAULT_BROWSER_TRANSPORT:'epoxy',
    store:{text:()=> 'auto'},normalizeBrowserModeName:x=>x,browserShellSourceUrl:x=>x,
    browserShellRejectFrameLocation:()=>false,isSpotifyFamilyUrl:()=>false,
    browserHost:x=>new URL(x).hostname,hostMatches:(host,list)=>list.includes(host),
    transportAutoEnabled:()=>true,proxyTransportName:()=> 'epoxy',transportRetryOrder:()=>['libcurlRaw'],
    setBrowserTransportOverride:()=>{},loadScramjetTab:()=>calls.push('reload'),
    fallbackProxyEngine:()=>calls.push('fallback'),loadSelectedSearchFallback:()=>calls.push('fallback'),
    setTimeout:(fn,delay)=>tasks.push({fn,at:now+delay}),setInterval:()=>0,clearInterval:()=>{}
  });
  vm.runInContext(functions.join('\n')+'\nthis.watch=watchProxyLoad;',context);
  context.watch(tab,url,'scramjet');
  return {tab,body,calls,
    load(){for(const fn of [...(listeners.get('load')||[])]) fn();},
    advance(to){for(;;){tasks.sort((a,b)=>a.at-b.at);if(!tasks.length || tasks[0].at>to) break;const task=tasks.shift();now=task.at;task.fn();}now=to;}
  };
}

// A channel switch updates native history before the shell receives any URL
// notification. Old startup timers must not send it back to /app.
{
  const f=fixture();f.load();
  f.tab.frame.contentWindow.location.href='https://discord.com/channels/100/200';
  f.body.textContent=f.body.innerText='A chat message says something went wrong';
  f.advance(12000);
  assert.deepEqual(f.calls,[],'Startup recovery must not reload a newer SPA route');
}
// Once the document renders successfully, later app content is not a startup
// failure, even when a router keeps its URL or briefly displays a spinner.
{
  const f=fixture();f.load();f.advance(2000);
  f.body.textContent=f.body.innerText='A chat message says something went wrong';
  f.advance(12000);
  assert.deepEqual(f.calls,[],'A loaded app must leave the startup watchdog');
}
// Actual startup error documents must still enter the existing bounded recovery.
{
  const f=fixture();f.body.textContent=f.body.innerText='Internal service worker error';f.load();f.advance(1700);
  assert.equal(f.calls[0],'reload');
}
console.log('Proxy SPA recovery: route changes, loaded apps and startup failure passed.');
