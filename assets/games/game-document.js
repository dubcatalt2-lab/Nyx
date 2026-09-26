import {gameResourceUrl, normalizeGameCdnUrl, repairGameResourcePath} from './game-cdn.js';

    export function prepareGameDocument(html,path,sourceUrl){
      if(path==='116.html')html=String(html).replaceAll('/bike.loader.js','/bike1.loader.js');
      // Archived Cloudflare Rocket Loader types are inert outside their host.
      if(/type=["'][a-f0-9]+-(?:module|text\/javascript)["']/i.test(html))html=String(html)
        .replace(/(type=["'])[a-f0-9]+-(module|text\/javascript)(["'])/gi,'$1$2$3')
        .replace(/<script\b[^>]*src=["'][^"']*\/rocket-loader\.min\.js["'][^>]*>\s*<\/script>/gi,'');
      const rawBase=sourceUrl || `https://raw.githubusercontent.com/freebuisness/html/main/${path}`;
      const baseUrl=rawBase.slice(0,rawBase.lastIndexOf('/') + 1);
      const repoRoot='https://raw.githubusercontent.com/freebuisness/html/main/';
      const proxyUrl=url=>gameResourceUrl(url, undefined, location.origin);
      const adProtection=`<script src="${location.origin}/assets/games/game-runtime-compat.js"><\/script><script src="${location.origin}/assets/games/game-health.js"><\/script><script src="${location.origin}/assets/games/game-ad-protection.js?v=20260903-game-ads-v1"><\/script>`;
      const sourceHtml=String(html || '').replace(
        /https?:\/\/cdn\.jsdelivr\.net\/gh\/genizy\/fnaf@[^/"'<>\s]+/gi,
        'https://cdn.jsdelivr.net/gh/bubblfan/fnaf@latest'
      )
        // This folder was deleted upstream. Retain its last public revision.
        .replace(/\/axo323lotl-bit\/elitecomposite@main\/2048-merge-run\//g,'/axo323lotl-bit/elitecomposite@dee1ce45905c0d8f3524c4468074671762e48e9c/2048-merge-run/')
        .replace(/\/giorgirick2-gif\/game-webports-onawebsite@master\/yandere-simulator\//g,'/giorgirick2-gif/game-webports-onawebsite@main/yandere-simulator/')
        .replace(/((?:wasmCodeUrl|wasmFrameworkUrl)\s*:\s*["'])(YandereSim\.wasm\.(?:code|framework)\.unityweb)/g,'$1Build/$2')
        // Old GN Math pages sometimes include a cloaking helper from the
        // deleted gn-math/storage repository. It is unrelated to the game,
        // but its 404 used to abort otherwise healthy Unity builds.
        .replace(
          /<script\b[^>]*src=["'][^"']*(?:(?:\.\.\/)+storage\/js\/cloak(?:i)?\.js|(?:raw\.githubusercontent\.com|cdn\.jsdelivr\.net\/gh)\/gn-math\/storage[^"']*cloak(?:i)?\.js)[^"']*["'][^>]*>\s*<\/script>/gi,
          ''
        );
      const originalBase=(sourceHtml.match(/<base\b[^>]*href=["']([^"']+)/i)?.[1] || baseUrl).trim();
      const baseHref=normalizeGameCdnUrl(originalBase)?.href || originalBase;
      const toProxy=(raw,base=baseHref)=>{
        try{
          const value=String(raw || '').trim();
          const url=value.startsWith('//')?new URL('https:'+value):new URL(value.startsWith('/') ? value.slice(1) : value,value.startsWith('/') ? repoRoot : base);
          if(!['cdn.jsdelivr.net','raw.githubusercontent.com','rawcdn.githack.com','raw.githack.com'].includes(url.hostname)) return raw;
          if(/adinplay|googletagmanager|google-analytics|googlesyndication|doubleclick|facebook|recaptcha|pagead|cdn\.r9x\.in/i.test(url.href)) return raw;
          return proxyUrl(url.href);
        }catch{
          return raw;
        }
      };
      const proxiedHtml=sourceHtml
        .replace(/<script\b[^>]*src=["'][^"']*\/ytgame\.js[^"']*["'][^>]*>\s*<\/script>/gi,'')
        .replace(/<script\b[^>]*src=["']\/js\/(?:main|lib|all(?:\.min)?)\.js["'][^>]*>\s*<\/script>/gi,'')
        .replace(/<base\b[^>]*>/gi,'')
        .replace(/((?:src|href)=["'])(?![a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:)([^"']+)/gi,(_match,prefix,raw)=>`${prefix}${toProxy(raw)}`)
        .replace(/((?:dataUrl|codeUrl|wasmCodeUrl|wasmFrameworkUrl|asmUrl|memUrl|frameworkUrl|loaderUrl|streamingAssetsUrl)\s*[:=]\s*["'])(?![a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:)([^"']+)/gi,(_match,prefix,raw)=>`${prefix}${toProxy(raw)}`)
        .replace(/https?:\/\/[^\s"'<>\\)]+/gi,raw=>toProxy(raw));
      const safeFetchGuard=`<script>(()=>{
        const memoryStorage=()=>{
          const values=new Map();
          const api={
            get length(){return values.size},
            key:index=>[...values.keys()][Number(index)] ?? null,
            getItem:key=>values.has(String(key)) ? values.get(String(key)) : null,
            setItem:(key,value)=>values.set(String(key),String(value)),
            removeItem:key=>values.delete(String(key)),
            clear:()=>values.clear()
          };
          return new Proxy(api,{
            get:(target,key)=>key in target ? Reflect.get(target,key,target) : api.getItem(key),
            set:(target,key,value)=>{if(key in target)return Reflect.set(target,key,value,target);api.setItem(key,value);return true},
            deleteProperty:(_target,key)=>{api.removeItem(key);return true}
          });
        };
        for(const name of ['localStorage','sessionStorage']){
          try{window[name].getItem('__nyx_storage_probe__')}
          catch{try{Object.defineProperty(window,name,{configurable:true,value:memoryStorage()})}catch{}}
        }
        try{void document.cookie}
        catch{
          try{
            const cookies=new Map();
            Object.defineProperty(document,'cookie',{
              configurable:true,
              get:()=>[...cookies].map(([key,value])=>key+'='+value).join('; '),
              set:value=>{
                const parts=String(value || '').split(';');
                const pair=parts.shift() || '';
                const split=pair.indexOf('=');
                if(split<1)return;
                const key=pair.slice(0,split).trim();
                const content=pair.slice(split+1).trim();
                const expired=parts.some(part=>/^\\s*max-age\\s*=\\s*0\\s*$/i.test(part) || /^\\s*expires\\s*=.*1970/i.test(part));
                if(expired)cookies.delete(key);else cookies.set(key,content);
              }
            })
          }catch{}
        }
        const nativeFetch=window.fetch?.bind(window);
        if(nativeFetch)window.fetch=(input,init)=>{
          const url=input instanceof Request?input.url:String(input||'');
          if(/^about:/i.test(url))return Promise.resolve(new Response(null,{status:204,statusText:'No Content'}));
          return nativeFetch(input,init)
        };
        try{
          const nativeOpen=XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open=function(method,url,...rest){
            if(/^about:/i.test(String(url||'')))url='data:,';
            return nativeOpen.call(this,method,url,...rest)
          }
        }catch{}
        try{
          const sw=navigator.serviceWorker;
          const getRegistration=sw?.getRegistration?.bind(sw);
          if(getRegistration)sw.getRegistration=url=>{
            try{if(url&&new URL(url,document.baseURI).origin!==location.origin)return Promise.resolve(undefined)}catch{}
            return getRegistration(url)
          }
        }catch{}
      })()<\/script>`;
      const guard=`<script>
        (() => {
          const ready=()=>parent.postMessage({type:'gn-math:ready'},'*');
          const fail=(message,url='')=>parent.postMessage({type:'gn-math:error',message,url},'*');
           const ignorable=/adinplay|googletagmanager|google-analytics|googlesyndication|doubleclick|facebook|recaptcha|cdn\\.r9x\\.in|pagead/i;
          const important=/\\.(?:wasm|data|unityweb|json|swf|zip|7z|js)(?:[?#]|$)|\\/Build\\//i;
          const repoRoot='https://raw.githubusercontent.com/freebuisness/html/main/';
          const prox='${location.origin}/gn-math-resource/';
          const proxHosts=['cdn.jsdelivr.net','raw.githubusercontent.com','rawcdn.githack.com','raw.githack.com'];
          const repairPath=${repairGameResourcePath.toString()};
          // Some older Unity loaders prepend their asset directory to blob URLs.
          // Recover only URLs created in this document, never arbitrary blob text.
          const objectUrls=new Set();
          const createObjectURL=URL.createObjectURL.bind(URL),revokeObjectURL=URL.revokeObjectURL.bind(URL);
          URL.createObjectURL=value=>{const url=createObjectURL(value);objectUrls.add(url);return url};
          URL.revokeObjectURL=url=>{objectUrls.delete(String(url));return revokeObjectURL(url)};
          const own=url=>{
            try{
              const raw=String(url || '').trim();
              if(raw.startsWith('/gn-math-resource/'))return new URL(raw,prox).href;
              for(const blob of objectUrls)if(raw.endsWith('/'+blob))return blob;
              // Laya derives about:// from srcdoc instead of honoring <base>.
              if(/^about:\\/\\//i.test(raw))return new URL(raw.slice(8),document.baseURI).href;
              if(!raw || raw.startsWith('#') || /^(?:javascript|data|blob|about):/i.test(raw)) return raw || 'about:blank';
              const parsed=raw.startsWith('//')?new URL('https:'+raw):new URL(raw.startsWith('/') ? raw.slice(1) : raw,raw.startsWith('/') ? repoRoot : (document.baseURI || repoRoot));
              if(parsed.hostname==='cdn.jsdelivr.net'||parsed.href.startsWith(prox))parsed.pathname=repairPath(parsed.pathname);
              if(ignorable.test(parsed.href)) return 'about:blank';
              if(proxHosts.includes(parsed.hostname)) {
                if(parsed.hostname==='cdn.jsdelivr.net' && /^\\/(?!gh\\/|npm\\/|combine\\/)[\\w.-]+\\/[\\w.-]+@[^/]+\\//.test(parsed.pathname))parsed.pathname='/gh'+parsed.pathname;
                return prox+parsed.protocol.slice(0,-1)+'/'+parsed.host+parsed.pathname+parsed.search+parsed.hash;
              }
              return parsed.href;
            }catch{return url}
          };
          const nativeFetch=window.fetch?.bind(window);
          if(nativeFetch) window.fetch=(input,init)=>{
            try{
              if(input instanceof Request) return nativeFetch(new Request(own(input.url),input),init);
              return nativeFetch(own(input),init);
            }catch{return nativeFetch(input,init)}
          };
          const nativeOpen=XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open=function(method,url,...rest){return nativeOpen.call(this,method,own(url),...rest)};
          const NativeWorker=window.Worker;
          if(NativeWorker){
            window.Worker=function(url,opts){
              const target=own(url);
              if(!/^https?:/i.test(target)) return new NativeWorker(target,opts);
              const isModule=opts?.type==='module';
              const source=isModule ? 'import '+JSON.stringify(target)+';' : 'importScripts('+JSON.stringify(target)+');';
              const blob=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
              const worker=new NativeWorker(blob,opts);
              setTimeout(()=>URL.revokeObjectURL(blob),5000);
              return worker;
            };
            window.Worker.prototype=NativeWorker.prototype;
            Object.setPrototypeOf(window.Worker,NativeWorker);
          }
          const nativeAlert=window.alert?.bind(window);
          window.alert=message=>{
            const text=String(message || '');
            if(/error occurred running the unity content|uncaught syntaxerror|a required game file failed|failed to load/i.test(text)){
              fail(text);
              return;
            }
            nativeAlert?.(message);
          };
          window.open=()=>null;
          window.addEventListener('load',()=>setTimeout(ready,650));
          document.addEventListener('DOMContentLoaded',()=>setTimeout(ready,1800));
          setTimeout(ready,4500);
          const visibleGameSurface=()=>[...document.querySelectorAll('canvas,object,embed,ruffle-player,ruffle-object,iframe,#game,#game-container,#unity-container,#unity-canvas,#ruffle,#player')]
            .some(element=>{
              const box=element.getBoundingClientRect?.();
              return box && box.width>40 && box.height>40 && getComputedStyle(element).display!=='none';
            });
          window.addEventListener('error',event=>{
            const target=event.target;
            const url=target && (target.src || target.href);
            if(url && important.test(String(url)) && !ignorable.test(String(url))){
              setTimeout(()=>{
                if(!visibleGameSurface()) fail('A required game file failed to load.',url);
              },2200);
            }
          },true);
        })();
      <\/script>`;
      let output=proxiedHtml
        .replace(/<script\b[^>]*src=["']\/js\/(?:main|lib|all(?:\.min)?)\.js["'][^>]*>\s*<\/script>/gi,'')
        .replace(/<script\b[^>]*googletagmanager[^>]*>[\s\S]*?<\/script>/gi,'')
        .replace(/<script\b[^>]*google-analytics[^>]*>[\s\S]*?<\/script>/gi,'')
        .replace(/<script\b[^>]*(?:adinplay|imasdk|pagead2|googlesyndication|doubleclick|connect\.facebook|cdn\.r9x\.in|(?:\/|["'])ads?\.js(?:[?"']|$)|jump[_-]gamemonetize|poki-(?:master-loader|sdk)|html5\.api\.gamedistribution\.com)[^>]*>[\s\S]*?<\/script>/gi,'')
        .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(tag,attrs,code)=>! /\bsrc\s*=/i.test(attrs) && /^\s*(?:window\.)?dataLayer\s*=/.test(code)?'':tag);
      if(!/<base\b/i.test(output)){
        output=/<head([^>]*)>/i.test(output)
          ? output.replace(/<head([^>]*)>/i,`<head$1><base href="${proxyUrl(baseHref)}">`)
          : `<base href="${proxyUrl(baseHref)}">${output}`;
      }
      return /<head([^>]*)>/i.test(output)
        ? output.replace(/<head([^>]*)>/i,`<head$1>${adProtection}${safeFitScript()}${safeFetchGuard}${guard}`)
        : `${adProtection}${safeFitScript()}${safeFetchGuard}${guard}${output}`;
    }
    function safeFitScript(){
      return `<style>html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#05070d!important}.ads,.ad,.adsbygoogle,iframe[src*="googlesyndication"],iframe[src*="doubleclick"],iframe[src*="recaptcha"]{display:none!important;pointer-events:none!important}</style><script>(()=>{const q='canvas,object,embed,ruffle-player,ruffle-object,iframe,#game,#game-container,#unity-container,#unity-canvas,#ruffle,#player';const visible=el=>{const r=el.getBoundingClientRect();return r.width>20&&r.height>20&&getComputedStyle(el).display!=='none'};const editing=()=>{const a=document.activeElement;return !!(a&&(a.isContentEditable||a.matches?.('input,textarea,select,[contenteditable=\"\"],[contenteditable=\"true\"]')))};const fit=()=>{try{if(editing())return;document.documentElement.style.setProperty('overflow','hidden','important');document.body?.style.setProperty('overflow','hidden','important');const target=[...document.querySelectorAll(q)].filter(visible).sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return br.width*br.height-ar.width*ar.height})[0];if(!target)return;const r=target.getBoundingClientRect();const baseW=Number(target.getAttribute('width'))||r.width||innerWidth;const baseH=Number(target.getAttribute('height'))||r.height||innerHeight;const ratio=Math.max(.05,baseW/baseH);let w=innerWidth,h=innerHeight;if(w/h>ratio)w=h*ratio;else h=w/ratio;target.style.setProperty('position','fixed','important');target.style.setProperty('left','50%','important');target.style.setProperty('top','50%','important');target.style.setProperty('width',Math.round(w)+'px','important');target.style.setProperty('height',Math.round(h)+'px','important');target.style.setProperty('margin','0','important');target.style.setProperty('max-width','100vw','important');target.style.setProperty('max-height','100vh','important');target.style.setProperty('transform','translate(-50%,-50%)','important');target.style.setProperty('transform-origin','center center','important');target.style.setProperty('object-fit','contain','important');target.style.setProperty('pointer-events','auto','important')}catch{}};addEventListener('load',()=>{fit();setTimeout(fit,350);setTimeout(fit,1400)});addEventListener('resize',fit);document.addEventListener('DOMContentLoaded',fit);setInterval(fit,350)})()<\/script>`;
    }
