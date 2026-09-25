import {httpRelayUrl} from "./http-relay.mjs";
﻿export function normalizeRelay(value, protocol = globalThis.location?.protocol || 'https:') {
  try {
    const url=new URL(value);
    if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||url.hash||(protocol==='https:'&&url.protocol!=='wss:'))return '';
    return url.href;
  }catch{return '';}
}
export function relayCandidates(settings, config = globalThis.__NYX_RUNTIME_CONFIG__ || {}, page = location) {
  const own=`${page.protocol==='https:'?'wss:':'ws:'}//${page.host}/resources/live/`;
  const primary=normalizeRelay(settings.relay,page.protocol)||normalizeRelay(config.wispUrl,page.protocol)||own;
  if(settings.autoRelay===false)return [primary];
  return [...new Set([primary,own,...(Array.isArray(config.wispUrls)?config.wispUrls:[]),'wss://copium-wisp-9529463.onrender.com/wisp/'].map(url=>normalizeRelay(url,page.protocol)).filter(Boolean))].slice(0,6);
}
export function transportCandidates(settings,config=globalThis.__NYX_RUNTIME_CONFIG__||{},page=location){
  const bridge=httpRelayUrl(page),relays=relayCandidates(settings,config,page);
  if(settings.httpBridge===false){
    const directSettings=settings.relay===bridge?{...settings,relay:''}:settings;
    const directConfig=config.wispUrl===bridge?{...config,wispUrl:''}:config;
    return relayCandidates(directSettings,directConfig,page).filter(url=>url!==bridge);
  }
  if(!settings.relay||settings.relay===bridge)return [...new Set([bridge,...(settings.autoRelay===false?[]:relays)])];
  return [...new Set([...relays,...(settings.autoRelay===false?[]:[bridge])])];
}
export function probeWisp(url, {timeout=7000, Socket=WebSocket}={}) {
  return new Promise(resolve=>{
    let socket,done=false;
    const finish=ok=>{if(done)return;done=true;clearTimeout(timer);if(socket){socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close()}catch{}}resolve(ok)};
    const timer=setTimeout(()=>finish(false),timeout);
    try {
      socket=new Socket(url);socket.binaryType='arraybuffer';
      socket.onmessage=event=>{
        if(!(event.data instanceof ArrayBuffer))return;
        const bytes=new Uint8Array(event.data);
        if(bytes.length>=9&&bytes[0]===3&&new DataView(event.data).getUint32(1,true)===0)finish(true);
      };
      socket.onerror=socket.onclose=()=>finish(false);
    }catch{finish(false)}
  });
}
export class RelayTransport {
  constructor({urls,createClient,probe=probeWisp,onStatus=()=>{},storage=globalThis.sessionStorage,monitorMs=30000,rank=async urls=>urls,online=()=>globalThis.navigator?.onLine!==false,visible=()=>!globalThis.document?.hidden}) {
    Object.assign(this,{urls,createClient,probe,onStatus,storage,monitorMs,rank,online,visible});
    this.ready=false;this.closed=false;this.url='';this.client=null;this.switching=null;this.failures=0;this.retired=[];
  }
  async init(){await this.select();this.ready=true;this.schedule();}
  async select(failed='') {
    if(this.closed)throw new Error('Relay connection closed.');
    if(this.switching)return this.switching;
    if(!this.online())throw new Error('You are offline. Reconnect to Wi-Fi and try again.');
    let remembered='';try{remembered=this.storage?.getItem('tutsi.workingRelay:'+this.urls.join('|'))||''}catch{}
    const order=[...new Set([this.url,remembered,...this.urls])].filter(url=>this.urls.includes(url)&&url!==failed);
    this.switching=(async()=>{
      // Classification is advisory. A slow checker must not hold up connection startup.
      let rankTimer;
      const ranked=await Promise.race([
        Promise.resolve().then(()=>this.rank(order)).catch(()=>order),
        new Promise(resolve=>{rankTimer=setTimeout(()=>resolve(order),300);})
      ]).finally(()=>clearTimeout(rankTimer));
      for(const url of ranked){
        if(this.closed)throw new Error('Relay connection closed.');
        this.onStatus({state:'checking',url});
        if(!await this.probe(url))continue;
        let next;
        try{next=await this.createClient(url)}catch{continue}
        if(this.closed){next.close?.();throw new Error('Relay connection closed.')}
        if(this.client)this.retired.push(this.client);
        while(this.retired.length>2)try{this.retired.shift()?.close?.()}catch{}
        this.client=next;this.url=url;this.failures=0;
        try{this.storage?.setItem('tutsi.workingRelay:'+this.urls.join('|'),url)}catch{}
        this.onStatus({state:failed?'switched':'connected',url});
        return;
      }
      this.onStatus({state:'unavailable',url:''});
      throw new Error('No configured Wisp relay is reachable from this device. Try again or change the relay in Settings.');
    })();
    try{return await this.switching}finally{this.switching=null}
  }
  async recover(failedClient,force=false) {
    if(this.closed||!this.online())return false;
    if(this.client!==failedClient)return true;
    if(this.switching){await this.switching;return this.client!==failedClient;}
    if(!force&&await this.probe(this.url))return false;
    if(this.client!==failedClient)return true;
    await this.select(this.url);
    return this.client!==failedClient;
  }
  async request(...args) {
    if(this.closed)throw new Error("Relay connection closed.");
    if(!this.ready)await this.init();
    const client=this.client;
    try{return await client.request(...args)}catch(error){
      if(args[4]?.aborted||error?.name==='AbortError')throw error;
      let changed=false;try{changed=await this.recover(client)}catch{}
      // Never replay form submissions or other writes after an ambiguous failure.
      // A cold connection may time out its first read despite a healthy handshake.
      // Retry once, directly on the client, so repeated failures cannot loop.
      const timedOut=error?.name==='TimeoutError'||/\b(?:timed?\s*out|timeout|ETIMEDOUT)\b/i.test(String(error?.message||''));
      if((changed||timedOut)&&/^(GET|HEAD)$/i.test(String(args[1]||'GET'))&&!args[4]?.aborted&&!this.closed&&this.online())return this.client.request(...args);
      throw error;
    }
  }
  connect(...args) {
    const client=this.client;
    const original=args[6];
    args[6]=(...events)=>{void this.recover(client).catch(()=>{});original?.(...events)};
    try{return client.connect(...args)}catch(error){void this.recover(client).catch(()=>{});throw error}
  }
  async check() {
    if(this.closed||!this.client||!this.online()||!this.visible())return;
    const client=this.client,url=this.url;
    const ok=await this.probe(url);
    if(this.closed||client!==this.client)return;
    this.failures=ok?0:this.failures+1;
    if(this.failures>=2)await this.recover(client,true).catch(()=>{});
  }
  schedule(){if(this.closed||!this.monitorMs)return;this.timer=setTimeout(async()=>{await this.check();this.schedule()},this.monitorMs)}
  close(){this.closed=true;clearTimeout(this.timer);for(const client of [this.client,...this.retired])try{client?.close?.()}catch{}this.retired=[];}
}
const filterCache=new Map();
export async function rankForBlocker(urls, vendor, {fetcher=fetch,onHint=()=>{}}={}) {
  if(!/^[a-z0-9_-]{1,64}$/.test(vendor||''))return urls;
  const results=await Promise.all(urls.map(async url=>{
    const host=new URL(url).hostname;
    if(host==='localhost'||host.endsWith('.local')||/^[\d.]+$/.test(host)||host.includes(':'))return {url,blocked:null};
    const key=vendor+':'+host;const cached=filterCache.get(key);
    if(cached&&cached.until>Date.now())return {url,blocked:cached.blocked};
    let blocked=null;
    const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),4000);
    try{
      // The checker accepts HTTPS domains, not WebSocket URLs. Never send relay
      // tokens, query strings or paths to the classification provider.
      const response=await fetcher('/api/link-checker/check',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://'+host+'/',vendor})});
      if(response.ok){const data=await response.json();const value=data?.vendors?.[vendor];if(!value?.error&&typeof value?.blocked==='boolean')blocked=value.blocked;}
    }catch{}finally{clearTimeout(timer)}
    filterCache.set(key,{blocked,until:Date.now()+(blocked===null?30000:600000)});
    if(filterCache.size>100)filterCache.delete(filterCache.keys().next().value);
    return {url,blocked};
  }));
  onHint({vendor,results});
  // Reports only change preference. A real Wisp handshake remains authoritative.
  return results.sort((a,b)=>Number(a.blocked===true)-Number(b.blocked===true)).map(item=>item.url);
}
