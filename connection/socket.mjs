import {pack,unpack} from './frames.mjs';

export function socketClass(Original,base,readyAt,restore=value=>value,endpointOrigin=()=>location.origin){
  class Connection extends EventTarget{
    static CONNECTING=0;
    static OPEN=1;
    static CLOSING=2;
    static CLOSED=3;
    CONNECTING=0;
    OPEN=1;
    CLOSING=2;
    CLOSED=3;
    #socket;
    #state=0;
    #protocol='';
    #binaryType='blob';
    #url;
    #timer;
    constructor(value,protocols=[]){
      super();
      const target=new URL(restore(value),base);
      if(target.protocol==='https:')target.protocol='wss:';
      if(target.protocol==='http:')target.protocol='ws:';
      if(!['ws:','wss:'].includes(target.protocol)||target.hash||target.username||target.password)throw new DOMException('Invalid address','SyntaxError');
      const choices=typeof protocols==='string'?[protocols]:Array.from(protocols);
      if(new Set(choices).size!==choices.length||choices.some(value=>typeof value!=='string'||!/^[-!#$%&'*+.\^_`|~0-9A-Za-z]+$/.test(value)))throw new DOMException('Invalid protocols','SyntaxError');
      if(!Number.isFinite(readyAt)||readyAt<=0)throw new DOMException('A user action is required','InvalidStateError');
      this.#url=target.href;
      this.#timer=setTimeout(()=>{
        const endpoint=new URL('/api/channel',endpointOrigin(target.href));
        endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';
        const socket=this.#socket=new Original(endpoint);
        socket.binaryType='arraybuffer';
        socket.onopen=()=>socket.send(pack(1,0,{url:target.href,method:'GET',headers:[['origin',new URL(base).origin],...(choices.length?[['sec-websocket-protocol',choices.join(', ')]]:[])]}));
        socket.onmessage=event=>{
          if(this.#state===0){
            try{
              const frame=unpack(event.data);
              if(frame.id!==1||frame.type!==0||frame.metadata.status!==101)throw new Error('Opening failed');
              this.#protocol=frame.metadata.headers.find(([name])=>name==='sec-websocket-protocol')?.[1]||'';
              this.#state=1;
              this.#emit(new Event('open'));
            }catch{this.#emit(new Event('error'));socket.close();}
            return;
          }
          if(this.#state!==1)return;
          const data=typeof event.data==='string'||this.#binaryType==='arraybuffer'?event.data:new Blob([event.data]);
          this.#emit(new MessageEvent('message',{data,origin:target.origin}));
        };
        socket.onerror=()=>this.#emit(new Event('error'));
        socket.onclose=event=>{
          this.#state=3;
          this.#emit(new CloseEvent('close',{code:event.code,reason:event.reason,wasClean:event.wasClean}));
        };
      },Math.max(0,readyAt-Date.now()));
    }
    #emit(event){this.dispatchEvent(event);const handler=this['on'+event.type];if(typeof handler==='function')handler.call(this,event);}
    get url(){return this.#url;}
    get readyState(){return this.#state;}
    get protocol(){return this.#protocol;}
    get extensions(){return '';}
    get bufferedAmount(){return this.#socket?.bufferedAmount||0;}
    get binaryType(){return this.#binaryType;}
    set binaryType(value){if(['blob','arraybuffer'].includes(value))this.#binaryType=value;}
    send(value){
      if(this.#state===0)throw new DOMException('Connection is still opening','InvalidStateError');
      if(this.#state===1)this.#socket.send(value);
    }
    close(code,reason=''){
      if(code!==undefined&&code!==1000&&(!Number.isInteger(code)||code<3000||code>4999))throw new DOMException('Invalid closing code','InvalidAccessError');
      if(new TextEncoder().encode(reason).length>123)throw new DOMException('Closing reason is too long','SyntaxError');
      if(this.#state>=2)return;
      this.#state=2;
      if(this.#socket)this.#socket.close(code,reason);
      else{clearTimeout(this.#timer);queueMicrotask(()=>{this.#state=3;this.#emit(new CloseEvent('close',{code:1006,wasClean:false}));});}
    }
  }
  for(const name of ['onopen','onmessage','onerror','onclose'])Connection.prototype[name]=null;
  return Connection;
}
