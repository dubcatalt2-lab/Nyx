import {pack,unpack} from './frames.mjs';

export class EventLines{
  constructor(emit,retry){this.emit=emit;this.retry=retry;this.text='';this.data=[];this.name='';this.id='';}
  write(text){
    this.text+=text;
    if(this.text.length>1048576)throw new Error('Event line limit');
    let index;
    while((index=this.text.search(/[\r\n]/))!==-1){
      if(this.text[index]==='\r'&&index===this.text.length-1)return;
      const line=this.text.slice(0,index),size=this.text[index]==='\r'&&this.text[index+1]==='\n'?2:1;
      this.text=this.text.slice(index+size);
      if(!line){
        if(this.data.length)this.emit({type:this.name||'message',data:this.data.join('\n'),lastEventId:this.id});
        this.data=[];this.name='';continue;
      }
      const colon=line.indexOf(':'),name=colon===-1?line:line.slice(0,colon);
      const value=colon===-1?'':line.slice(colon+1).replace(/^ /,'');
      if(name==='data')this.data.push(value);
      if(name==='event')this.name=value;
      if(name==='id'&&!value.includes('\0'))this.id=value;
      if(name==='retry'&&/^\d+$/.test(value))this.retry(Math.min(Number(value),2147483647));
      if(this.data.reduce((size,part)=>size+part.length,0)>1048576)throw new Error('Event data limit');
    }
  }
}

export function eventClass(Original,base,readyAt,restore=value=>value){
  return class Events extends EventTarget{
    static CONNECTING=0;static OPEN=1;static CLOSED=2;
    CONNECTING=0;OPEN=1;CLOSED=2;
    onopen=null;onmessage=null;onerror=null;
    #url;#state=0;#socket;#timer;#retry=3000;#credentials;#last='';#target;#redirects=0;
    constructor(value,options={}){
      super();
      const url=new URL(restore(value),base);
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new DOMException('Invalid event address','SyntaxError');
      if(!Number.isFinite(readyAt)||readyAt<=0)throw new DOMException('A user action is required','InvalidStateError');
      this.#url=this.#target=url.href;
      if(options.withCredentials)throw new DOMException('Authenticated event streams are not available yet','NotSupportedError');
      this.#credentials=!!options.withCredentials;
      this.#timer=setTimeout(()=>this.#connect(),Math.max(0,readyAt-Date.now()));
    }
    get url(){return this.#url;}
    get readyState(){return this.#state;}
    get withCredentials(){return this.#credentials;}
    #emit(event){this.dispatchEvent(event);const handler=this['on'+event.type];if(typeof handler==='function')handler.call(this,event);}
    #connect(){
      if(this.#state===2)return;
      const endpoint=new URL('/api/events',location.origin);
      endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';
      const socket=this.#socket=new Original(endpoint);
      socket.binaryType='arraybuffer';
      const decoder=new TextDecoder();
      const lines=new EventLines(value=>{
        this.#last=value.lastEventId;
        this.#emit(new MessageEvent(value.type,{data:value.data,lastEventId:value.lastEventId,origin:new URL(this.#target).origin}));
      },value=>{this.#retry=value;});
      lines.id=this.#last;
      let opened=false,redirect=false;
      socket.onopen=()=>socket.send(pack(1,0,{url:this.#target,method:'GET',headers:[['accept','text/event-stream'],['cache-control','no-cache'],...(this.#last?[['last-event-id',this.#last]]:[])]}));
      socket.onmessage=event=>{
        try{
          const frame=unpack(event.data);
          if(frame.id!==1||frame.type!==0)throw new Error('Event request failed');
          if(!opened){
            const headers=new Headers(frame.metadata.headers);
            if([301,302,303,307,308].includes(frame.metadata.status)&&headers.has('location')&&this.#redirects++<10){
              const target=new URL(headers.get('location'),this.#target);
              if(!['http:','https:'].includes(target.protocol))throw new Error('Invalid redirect');
              this.#target=target.href;redirect=true;socket.close();return;
            }
            if(frame.metadata.status!==200||!/^text\/event-stream(?:;|$)/i.test(headers.get('content-type')||'')){
              this.close();this.#emit(new Event('error'));return;
            }
            this.#state=1;opened=true;this.#emit(new Event('open'));
          }
          lines.write(decoder.decode(frame.body,{stream:true}));
        }catch{socket.close();}
      };
      socket.onerror=()=>{};
      socket.onclose=()=>{
        if(this.#state===2)return;
        this.#last=lines.id;
        this.#state=0;
        if(!redirect)this.#emit(new Event('error'));
        this.#timer=setTimeout(()=>this.#connect(),redirect?0:this.#retry);
      };
    }
    close(){this.#state=2;clearTimeout(this.#timer);this.#socket?.close();}
  };
}
