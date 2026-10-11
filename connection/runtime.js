import {socketClass} from './socket.mjs';
import {Cookies} from './cookies.mjs';
import {eventClass} from './events.mjs';
import {source} from './address.mjs';
import {fragment,stylesheet,candidates} from './transform.mjs';

(() => {
  const current = globalThis.document?.currentScript;
  const path = location.pathname.match(/^\/content\/[a-z0-9-]+\//i)?.[0];
  const prefix = current?.dataset.route || globalThis.documentContext?.prefix || path;
  const base = current?.dataset.document || globalThis.documentContext?.base || (path ? decodeURIComponent(location.pathname.slice(path.length)) : '');
  const readyAt=Number(current?.dataset.readyAt||globalThis.documentContext?.readyAt||new URL(location.href).searchParams.get('document-ready-at')||0);
  if (!base || !prefix) return;
  const initial=current?.dataset.location||base;
  const pageAddress=()=>{
    try{
      if(location.pathname.startsWith(prefix)){
        const value=new URL(location.href);
        if(!globalThis.document){value.searchParams.delete('document-mode');value.searchParams.delete('document-ready-at');}
        return new URL(source(value.href,prefix));
      }
    }catch{}
    return new URL(initial);
  };
  const currentBase=()=>globalThis.document?.querySelector('base[href]')?base:pageAddress().href;
  if(typeof document!=='undefined')globalThis.addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='document-history')return;
    if(event.data.action==='back')history.back();
    else if(event.data.action==='forward')history.forward();
  });
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const address = (value, parent = currentBase()) => {
    const text = String(value);
    if (text.startsWith(prefix)) return new URL(text, location.origin).href;
    let url = new URL(text, parent);
    if (url.origin === location.origin && url.pathname.startsWith(prefix)) return url.href;
    if (url.origin === location.origin) url = new URL(url.pathname + url.search + url.hash, parent);
    if (!['http:', 'https:'].includes(url.protocol)) return text;
    const hash = url.hash;
    url.hash = '';
    return prefix + encodeURIComponent(url.href) + hash;
  };
  Object.defineProperty(globalThis, 'documentAddress', {value: address, configurable: true});
  const destination={
    assign(value){location.assign(address(value));},
    replace(value){location.replace(address(value));},
    reload(){location.reload();},
    toString(){return pageAddress().href;},
    valueOf(){return pageAddress().href;}
  };
  for(const key of ['href','protocol','host','hostname','port','pathname','search','hash','origin']){
    Object.defineProperty(destination,key,{enumerable:true,get:()=>pageAddress()[key],...(key==='origin'?{}:{set(value){
      if(key==='href'){location.assign(address(value));return;}
      const next=pageAddress();
      next[key]=value;
      if(key==='hash')location.hash=next.hash;
      else location.assign(address(next.href));
    }})});
  }
  Object.defineProperty(globalThis,'documentLocation',{value:destination,configurable:true});
  const owner={};
  Object.defineProperty(owner,'location',{get:()=>destination,set:value=>{destination.href=value;}});
  Object.defineProperty(globalThis,'documentOwner',{value:value=>value===globalThis||(globalThis.document&&value===globalThis.document)?owner:value,configurable:true});
  const publish=()=>{
    if(typeof document==='undefined'||parent===globalThis)return;
    parent.postMessage({type:'document-navigation',url:pageAddress().href,title:document.title},location.origin);
  };
  if(globalThis.history){
    for(const key of ['pushState','replaceState']){
      const original=history[key];
      history[key]=function(state,title,value){
        if(value!==undefined&&value!==null){
          const next=new URL(String(value),pageAddress());
          if(next.origin!==pageAddress().origin)throw new DOMException('The address must have the same origin.','SecurityError');
          value=address(next.href);
        }
        const result=original.call(this,state,title,value);
        publish();
        return result;
      };
    }
    addEventListener('popstate',publish);
    addEventListener('hashchange',publish);
  }
  globalThis.fetch = (input, init) => {
    if (input instanceof Request) return nativeFetch(new Request(address(input.url), input), init);
    return nativeFetch(address(input), init);
  };
  if (globalThis.XMLHttpRequest) {
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) { return open.call(this, method, address(url), ...rest); };
  }
  const restore=value=>{
    const url=new URL(value,String(value).startsWith(prefix)?location.href:base);
    if(url.origin===location.origin&&url.pathname.startsWith(prefix))return decodeURIComponent(url.pathname.slice(prefix.length))+url.search+url.hash;
    return value;
  };
  if(globalThis.WebSocket){
    const Original=globalThis.WebSocket;
    if(globalThis.EventSource)globalThis.EventSource=eventClass(Original,base,readyAt,restore);
    globalThis.WebSocket=socketClass(Original,base,readyAt,restore);
  }
  for (const name of ['Worker','SharedWorker']) {
    const Original = globalThis[name];
    if (!Original) continue;
    const Replacement = function(value, options) {
      const target = new URL(address(value), location.origin);
      target.searchParams.set('document-mode', options?.type === 'module' ? 'module' : 'classic');
      target.searchParams.set('document-ready-at',String(readyAt));
      return Reflect.construct(Original, [target.href, options], new.target || Replacement);
    };
    Object.setPrototypeOf(Replacement, Original);
    Replacement.prototype = Original.prototype;
    globalThis[name] = Replacement;
  }
  if (globalThis.importScripts) {
    const load = globalThis.importScripts.bind(globalThis);
    globalThis.importScripts = (...values) => load(...values.map(value => address(value)));
  }
  if (!globalThis.document) return;
  let cookies=new Cookies(current?.dataset.cookies?JSON.parse(current.dataset.cookies):undefined);
  const cookieDescriptor=Object.getOwnPropertyDescriptor(Document.prototype,'cookie');
  if(cookieDescriptor?.configurable)Object.defineProperty(Document.prototype,'cookie',{
    configurable:true,enumerable:cookieDescriptor.enumerable,
    get(){return cookies.visible(pageAddress().href);},
    set(value){
      cookies.set(pageAddress().href,String(value));
      navigator.serviceWorker.controller?.postMessage({type:'cookie',value:String(value)});
    }
  });
  navigator.serviceWorker?.addEventListener('message',event=>{
    if(event.data?.type==='cookies'&&event.data.base===pageAddress().href)cookies=new Cookies(event.data.value);
  });
  document.addEventListener('DOMContentLoaded',publish,{once:true});
  document.addEventListener('click',event=>{
    const link=event.composedPath().find(node=>node?.matches?.('a[href],area[href]'));
    if(!link)return;
    const value=link.getAttribute('href');
    if(value&&!value.startsWith('#'))link.setAttribute('href',address(value));
    if(['_blank','_top','_parent'].includes((link.getAttribute('target')||'').toLowerCase()))link.setAttribute('target','_self');
  },true);
  const nativeSet = Element.prototype.setAttribute;
  const css=(value,context='stylesheet')=>{
    const text=String(value??'');
    if(!/url\s*\(|@import/i.test(text))return text;
    try{return stylesheet(text,currentBase(),prefix,context);}catch{return text;}
  };
  const attribute=(name,value)=>{
    name=String(name).toLowerCase();
    if(['src','href','action','formaction','poster','data-src'].includes(name))return address(value);
    if(name==='srcset')return candidates(String(value),currentBase(),prefix);
    if(name==='style')return css(value,'declarationList');
    return value;
  };
  Element.prototype.setAttribute = function(name, value) {
    return nativeSet.call(this, name, attribute(name,value));
  };
  for (const [name, keys] of Object.entries({HTMLImageElement:['src','srcset'],HTMLScriptElement:['src'],HTMLLinkElement:['href'],HTMLAnchorElement:['href'],HTMLIFrameElement:['src'],HTMLFormElement:['action'],HTMLInputElement:['src','formAction'],HTMLButtonElement:['formAction'],HTMLMediaElement:['src'],HTMLVideoElement:['poster'],HTMLSourceElement:['src','srcset']})) {
    const prototype = globalThis[name]?.prototype;
    if (!prototype) continue;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
      if (descriptor?.set) Object.defineProperty(prototype, key, {...descriptor, set(value) { descriptor.set.call(this, attribute(key,value)); }});
    }
  }
  const html=(value,context)=>context?.localName==='style'?css(value):fragment(value==null?'':String(value),currentBase(),prefix,context);
  for(const prototype of [Element.prototype,globalThis.ShadowRoot?.prototype].filter(Boolean)){
    for(const key of ['innerHTML','outerHTML']){
      const descriptor=Object.getOwnPropertyDescriptor(prototype,key);
      if(descriptor?.set)Object.defineProperty(prototype,key,{...descriptor,set(value){
        descriptor.set.call(this,html(value,key==='outerHTML'?this.parentElement:this));
      }});
    }
  }
  const adjacent=Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML=function(position,text){
    const outside=['beforebegin','afterend'].includes(String(position).toLowerCase());
    return adjacent.call(this,position,html(text,outside?this.parentElement:this));
  };
  const contextual=Range.prototype.createContextualFragment;
  Range.prototype.createContextualFragment=function(text){
    const context=this.startContainer.nodeType===1?this.startContainer:this.startContainer.parentElement;
    return contextual.call(this,html(text,context));
  };
  const text=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  Object.defineProperty(Node.prototype,'textContent',{...text,set(value){
    if(this.nodeType===1&&this.localName==='style')value=css(value);
    text.set.call(this,value);
  }});
  const styles=CSSStyleDeclaration.prototype;
  const setProperty=styles.setProperty;
  styles.setProperty=function(name,value,priority){return setProperty.call(this,name,css(value,'value'),priority);};
  for(const key of Object.getOwnPropertyNames(styles)){
    const descriptor=Object.getOwnPropertyDescriptor(styles,key);
    if(!descriptor?.set)continue;
    Object.defineProperty(styles,key,{...descriptor,set(value){
      descriptor.set.call(this,css(value,key==='cssText'?'declarationList':'value'));
    }});
  }
  const declaration=document.createElement('div').style;
  const getProperty=styles.getPropertyValue;
  for(const key of Object.getOwnPropertyNames(declaration)){
    if(typeof declaration[key]!=='string'||Object.getOwnPropertyDescriptor(styles,key))continue;
    const property=key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()).replace(/^(webkit|moz|ms|o)-/,'-$1-');
    Object.defineProperty(styles,key,{configurable:true,enumerable:true,
      get(){return getProperty.call(this,property);},
      set(value){setProperty.call(this,property,css(value,'value'),'');}
    });
  }
  for(const key of ['insertRule','replace','replaceSync']){
    const original=CSSStyleSheet.prototype[key];
    if(original)CSSStyleSheet.prototype[key]=function(text,...args){return original.call(this,css(text),...args);};
  }
})();

