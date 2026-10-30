const base='/assets/vendor/r93d51/';
const prefix=base+'nZ970vr4/';
const engines=new Map();
let runtime;
const script=src=>new Promise((resolve,reject)=>{const element=document.createElement('script');element.src=src;element.onload=resolve;element.onerror=()=>reject(Error('The page runtime could not be downloaded.'));document.head.append(element)});
async function activate(){
 if(!navigator.serviceWorker||!isSecureContext)throw Error('Open this page over HTTPS or localhost.');
 runtime ||= (async()=>{
  await script('/assets/vendor/r93d51/LyzaHBeO/hdr6ZzzC.js');
  await script('/assets/vendor/r93d51/LyzaHBeO/msJpa98j.js');
  await script('/assets/vendor/r93d51/index-k9v3f1.js');
  const registration=await navigator.serviceWorker.register('/assets/vendor/r93d51/bx1wY8X9.js',{scope:base,updateViaCache:'none'});
  const worker=registration.installing||registration.waiting||registration.active;
  if(worker?.state!=='activated')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker?.removeEventListener('statechange',changed);reject(Error('The page worker did not activate.'))},15000);function changed(){if(worker.state==='activated'){clearTimeout(timer);worker.removeEventListener('statechange',changed);resolve()}else if(worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',changed);reject(Error('The page worker could not start.'))}}worker.addEventListener('statechange',changed);changed()});
  return worker;
 })().catch(error=>{runtime=null;throw error});
 return runtime;
}
const target=value=>{const url=new URL(value);if(!/^https?:$/.test(url.protocol)||url.username||url.password)throw Error('Enter an http or https address.');return url.href};
export async function prepareDocumentEngine(relay,transport='libcurl'){
 transport=String(transport).toLowerCase();if(transport==='auto'||transport==='libcurlraw')transport='libcurl';
 const endpoint=new URL(relay);if(!/^wss?:$/.test(endpoint.protocol))throw Error('Invalid connection address.');
 if(!['libcurl','epoxy'].includes(transport))throw Error('Unknown connection type.');
 const key=transport+':'+relay;
 if(!engines.has(key)){const pending=(async()=>{
  await globalThis[Symbol.for('nyx.direct-s3.ready')];
  let bridge;
  if(endpoint.pathname==='/api/tutsi-relay/socket/'){const {installHttpRelaySocket,createHttpRelayEndpoint}=await import('/apps/tutsi/http-relay.mjs');installHttpRelaySocket();bridge=createHttpRelayEndpoint();}
  try{
   const worker=await activate();let client;
   if(transport==='epoxy'){const {default:Transport}=await import('/assets/vendor/r93d51/LyzaHBeO/SwzzeJZG.mjs');client=new Transport({wisp:bridge?.url||relay});}
   else client=new globalThis.L1bcTransport.L1bcClient({w1p:bridge?.url||relay});
   await client.init();
   const controller=new globalThis.$K4q9p2XvController.Controller({serviceworker:worker,transport:client,config:{prefix,K4q9p2XvPath:'/assets/vendor/r93d51/LyzaHBeO/hdr6ZzzC.js',injectPath:'/assets/vendor/r93d51/LyzaHBeO/jtqxcoHL.js',wasmPath:'/assets/vendor/r93d51/LyzaHBeO/jCC9IUDB.wasm'}});
   await controller.wait();
   const views=new WeakMap();
   const view=element=>{let frame=views.get(element);if(!frame){frame=controller.createFrame(element);views.set(element,frame)}return frame};
   return {openView(element,value){view(element).go(target(value));},encodeRef(value){const element=document.createElement('iframe');view(element).go(target(value));return element.src;},sourceOf:documentSource};
  }catch(error){bridge?.close();throw error}
 })();engines.set(key,pending);pending.catch(()=>{if(engines.get(key)===pending)engines.delete(key)})}
 return engines.get(key);
}
export function documentSource(element){
 try{const current=new URL(element.contentWindow.location.href);if(current.origin!==location.origin||!current.pathname.startsWith(prefix))return '';const match=current.pathname.slice(prefix.length).match(/^[^/]+\/[^/]+\/(.+)$/);if(!match)return '';return target(decodeURIComponent(match[1])+current.search+current.hash)}catch{return ''}
}
