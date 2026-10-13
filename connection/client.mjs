import {Transport} from './pilgrimage.mjs';
import {activeWorker} from './registration.mjs';
import {route,source} from './passage.mjs';
const transport = new Transport();
const form = document.querySelector('form');
const frame = document.querySelector('iframe');
const status = document.querySelector('output');
const addressInput=document.querySelector('input');
function readTarget(){
  try {
    const target=new URL(decodeURIComponent(location.hash.slice(1)));
    if(['http:','https:'].includes(target.protocol))addressInput.value=target.href;
  } catch {}
}
readTarget();
const session = crypto.randomUUID();
let profile,storageError;
try{
  profile=localStorage.getItem('document-profile');
  if(!/^[a-z0-9-]+$/i.test(profile||'')){
    profile=crypto.randomUUID();
    localStorage.setItem('document-profile',profile);
  }
}catch{
  storageError=new Error('Site storage is blocked for the document window. Check this site’s browser storage permission.');
}
let registration, channel, registrationReady, connectedWorker, attaching;

function attach(force=false) {
  if(attaching)return attaching;
  attaching=connect(force).finally(()=>{attaching=null;});
  return attaching;
}

async function connect(force) {
  registrationReady ||= navigator.serviceWorker.register('/boot/start.js', {scope: '/content/', updateViaCache: 'none'}).then(async value=>{
    registration=value;
    await registration.update();
    return value;
  }).catch(error=>{registrationReady=null;throw error;});
  await registrationReady;
  const active = await activeWorker(registration);
  if(!force&&connectedWorker===active)return;
  channel?.port1.close();
  channel = new MessageChannel();
  const port = channel.port1;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Document handler did not respond')), 10000);
    port.onmessage = async event => {
      const value = event.data;
      if (value.ready) { clearTimeout(timer); resolve(); return; }
      try {
        const response = await transport.fetch(value.url, {method: value.method, headers: value.headers, body: value.body || undefined});
        const body = await response.arrayBuffer();
        const headers=response.headerPairs;
        port.postMessage({id: value.id, status: response.status, headers, body}, [body]);
      } catch (error) { port.postMessage({id: value.id, error: error.message}); }
    };
    active.postMessage({type: 'connect', session, profile, readyAt:transport.started}, [channel.port2]);
  });
  connectedWorker=active;
}

navigator.serviceWorker.addEventListener('message',event=>{
  if(event.data?.type!=='document-reconnect'||event.data.session!==session||!transport.started||event.source?.scriptURL!==new URL('/boot/start.js',location.origin).href)return;
  void attach(true).catch(error=>{
    if(parent!==window&&parentOrigin)parent.postMessage({type:'document-error',message:error.message},parentOrigin);
    else status.textContent=error.message;
  });
});

async function navigate(input) {
  try {
    status.textContent = '';
    if(storageError)throw storageError;
    await attach();
    frame.src = route(input, location.href, '/content/' + session + '/');
    status.textContent = '';
  } catch (error) {
    if(parent!==window&&parentOrigin)parent.postMessage({type:'document-error',message:error.message},parentOrigin);
    else status.textContent=error.message;
  }
}

document.querySelector('button').addEventListener('click', event => transport.activate(event));
addressInput.addEventListener('keydown',event=>{if(event.key==='Enter')transport.activate(event);});
form.addEventListener('submit',event=>{
  event.preventDefault();
  void navigate(addressInput.value);
});
if(parent!==window){form.remove();status.remove();}
let parentOrigin='';
try{parentOrigin=new URL(document.referrer).origin;}catch{}
let started=false;
function ready(){
  if(parent!==window&&parentOrigin)parent.postMessage({type:'document-ready'},parentOrigin);
}
function reset(){
  transport.close();started=false;readTarget();ready();
}
window.addEventListener('hashchange',reset);
ready();
window.addEventListener('message',event=>{
  if(parent!==window&&event.source===parent&&event.origin===parentOrigin&&event.data?.type==='document-prepare'){
    let target='';
    try{target=new URL(decodeURIComponent(location.hash.slice(1))).href;}catch{}
    if(event.data.url===target)reset();
    return;
  }
  if(parent!==window&&event.source===parent&&event.origin===parentOrigin&&event.data?.type==='document-start'&&!started){
    const {url,readyAt}=event.data;
    if(url!==addressInput.value||!Number.isFinite(readyAt)||readyAt<=0||readyAt>Date.now()+5000)return;
    started=true;
    transport.started=readyAt;
    document.documentElement.classList.add('embedded');
    void navigate(url);
    return;
  }
  if(event.source===frame.contentWindow&&event.origin===location.origin&&event.data?.type==='document-navigation'){
    try{
      const value=source(frame.contentWindow.location.href,'/content/'+session+'/');
      if(value!==event.data.url)return;
      if(document.activeElement!==addressInput)addressInput.value=value;
      if(parent!==window&&parentOrigin)parent.postMessage({type:'document-navigation',url:value,title:String(event.data.title||'').slice(0,512)},parentOrigin);
    }catch{}
    return;
  }
  if(window.parent===window||event.source!==window.parent||event.origin!==parentOrigin||event.data?.type!=='document-control')return;
  if(event.data.action==='reload'&&frame.src)frame.src=frame.src;
  else if(['back','forward'].includes(event.data.action))frame.contentWindow?.postMessage({type:'document-history',action:event.data.action},location.origin);
});

