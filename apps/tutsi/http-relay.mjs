// Only the reserved relay URL uses HTTP. All other WebSockets retain native behavior.
export const httpRelayUrl = (page=location) => `${page.protocol === 'https:' ? 'wss:' : 'ws:'}//${page.host}/api/tutsi-relay/socket/`;
export class HttpRelaySocket extends EventTarget {
  static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3;
  CONNECTING=0; OPEN=1; CLOSING=2; CLOSED=3;
  readyState=0; binaryType='blob'; bufferedAmount=0; protocol=''; extensions='';
  constructor(url) {
    super(); this.url=String(url); this.abort=new AbortController(); this.sequence=0; this.tail=Promise.resolve();
    this.start();
  }
  emit(type, event = new Event(type)) { this.dispatchEvent(event); this['on'+type]?.call(this,event); }
  async request(path, options={}) {
    const response=await fetch('/api/tutsi-relay/'+path,{...options,cache:'no-store',credentials:'same-origin',signal:AbortSignal.any([this.abort.signal,AbortSignal.timeout(30000)]),
      headers:{...options.headers,...(this.token?{Authorization:'Bearer '+this.token}:{})}});
    if (!response.ok) throw new Error('Connection unavailable');
    return response;
  }
  async start() {
    try {
      this.token=(await (await this.request('sessions',{method:'POST'})).json()).token;
      if(this.readyState!==0)return this.cleanup();
      this.readyState=1; this.emit('open');
      while(this.readyState===1) {
        const response=await this.request('receive');
        if(response.status===204)continue;
        const data=await response.arrayBuffer(); const view=new DataView(data);
        for(let offset=0;offset<data.byteLength;) {
          if(offset+4>data.byteLength)throw new Error('Invalid relay frame');
          const length=view.getUint32(offset,true); offset+=4;
          if(offset+length>data.byteLength)throw new Error('Invalid relay frame');
          const frame=data.slice(offset,offset+length);offset+=length;
          if(this.readyState!==1)break;
          this.emit('message',new MessageEvent('message',{data:this.binaryType==='arraybuffer'?frame:new Blob([frame])}));
        }
      }
    } catch { if(this.readyState<2){this.emit('error');this.close(1006);} }
  }
  send(value) {
    if(this.readyState!==1)throw new DOMException('Socket is not open','InvalidStateError');
    const blob=new Blob([value]);
    if(blob.size>262144||this.bufferedAmount+blob.size>2097152){this.emit('error');this.close(1006);return;}
    this.bufferedAmount+=blob.size;
    this.tail=this.tail.then(async()=>{
      if(this.readyState!==1)return;
      await this.request('send',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Tutsi-Sequence':String(this.sequence++)},body:blob});
      this.bufferedAmount-=blob.size;
    }).catch(()=>{if(this.readyState<2){this.emit('error');this.close(1006);}});
  }
  cleanup() {
    if(this.token)fetch('/api/tutsi-relay/session',{method:'DELETE',headers:{Authorization:'Bearer '+this.token},keepalive:true}).catch(()=>{});
  }
  close(code=1000,reason='') {
    if(this.readyState===3)return;
    this.readyState=3; this.abort.abort();this.cleanup();this.bufferedAmount=0;
    this.emit('close',new CloseEvent('close',{code,reason,wasClean:code===1000}));
  }
}
const endpoints=new Map();
export function createHttpRelayEndpoint() {
  const url=httpRelayUrl()+crypto.randomUUID()+'/';
  const sockets=new Set(); endpoints.set(url,sockets);
  return {url,close(){endpoints.delete(url);for(const socket of sockets)socket.close();sockets.clear();}};
}
let installed=false;
export function installHttpRelaySocket() {
  if(installed)return; installed=true;
  const Native=globalThis.WebSocket;
  function RelaySocket(url,protocols) {
    const key=String(url), sockets=endpoints.get(key);
    if(key===httpRelayUrl()||sockets){
      const socket=new HttpRelaySocket(url);
      if(sockets){sockets.add(socket);socket.addEventListener('close',()=>sockets.delete(socket),{once:true});}
      return socket;
    }
    return protocols===undefined?new Native(url):new Native(url,protocols);
  }
  Object.setPrototypeOf(RelaySocket,Native);
  RelaySocket.prototype=Native.prototype;
  Object.defineProperty(RelaySocket,Symbol.hasInstance,{value:instance=>instance instanceof Native || instance instanceof HttpRelaySocket});
  globalThis.WebSocket=RelaySocket;
  addEventListener('pagehide',()=>{for(const sockets of endpoints.values())for(const socket of sockets)socket.close();endpoints.clear();});
}
