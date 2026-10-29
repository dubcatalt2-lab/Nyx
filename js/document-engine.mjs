const prefix = '/apps/r7f29c1/view/';
let preparation;
let connection;
let configuredRelay = '';
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('The page engine could not be downloaded.'));
    document.head.append(script);
  });
}
async function prepare() {
  if (!navigator.serviceWorker || !isSecureContext) throw new Error('Open this page over HTTPS or localhost.');
  preparation ||= (async () => {
    await loadScript('/assets/vendor/r7f29c1/x9K2m.js');
    await loadScript('/assets/vendor/r7f29c1/8b3rt.js');
    await loadScript('/apps/r7f29c1/r41c9.js');
    const registration = await navigator.serviceWorker.register('/apps/r7f29c1/r21e8.js', {scope:'/apps/r7f29c1/'});
    const worker = registration.installing || registration.waiting || registration.active;
    if (worker?.state !== 'activated') await new Promise((resolve,reject) => {
      const timer=setTimeout(()=>{worker?.removeEventListener('statechange',changed);reject(new Error('The page worker did not activate.'));},15000);
      function changed(){if(worker.state==='activated'){clearTimeout(timer);worker.removeEventListener('statechange',changed);resolve();}else if(worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',changed);reject(new Error('The page worker could not start.'));}}
      worker.addEventListener('statechange',changed);changed();
    });
    connection = new globalThis.W1I41.W1I41Connection('/assets/vendor/r7f29c1/8hF6n.js');
  })().catch(error=>{preparation=null;throw error});
  await preparation;
}
let configuration=Promise.resolve();
export async function prepareDocumentEngine(relay) {
  await prepare();
  const endpoint=new URL(relay);
  if(!/^wss?:$/.test(endpoint.protocol))throw new Error('Invalid connection address.');
  const next=configuration.catch(()=>{}).then(async()=>{
    if(configuredRelay===relay)return;
    if(endpoint.pathname==='/api/tutsi-relay/socket/') {
      await connection.setManualzIWyC(`const {installHttpRelaySocket}=await import('/apps/tutsi/http-relay.mjs');installHttpRelaySocket();const {default:Transport}=await import('/assets/vendor/r7f29c1/index-1OTY61e4.min.mjs');return [Transport,'/assets/vendor/r7f29c1/index-1OTY61e4.min.mjs'];`,[{WeZaN:relay}]);
    } else await connection.setzIWyC('/assets/vendor/r7f29c1/index-1OTY61e4.min.mjs',[{WeZaN:relay}]);
    configuredRelay=relay;
  });
  configuration=next;await next;
  return {encodeRef(raw){const url=new URL(raw);if(!/^https?:$/.test(url.protocol)||url.username||url.password)throw new Error('Enter an http or https address.');return prefix+globalThis.__u22$config.encodeUrl(url.href)}};
}
export function documentSource(frame) {
  try {return String(frame.contentWindow.__u22?.meta?.url||'')}catch{return ''}
}
