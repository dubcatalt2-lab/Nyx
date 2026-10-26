// Installed only in the separate direct-S3 export, before app scripts execute.
(()=>{
 const backend=document.querySelector('meta[name="nyx-static-backend"]')?.content;
 if(!backend)return;
 if(!navigator.serviceWorker?.controller){location.replace('/index.html?returnTo='+encodeURIComponent(location.pathname+location.search+location.hash));return;}
 const key=Symbol.for('nyx.direct-s3.runtime');if(window[key])return;window[key]=true;
 const target=new URL(backend),NativeSocket=window.WebSocket;
 window.WebSocket=class extends NativeSocket{
  constructor(url,protocols){const parsed=new URL(url,location.href);if(parsed.host===location.host&&/^\/(?:api|socket\.io|resources\/live|wisp)(?:\/|$)/.test(parsed.pathname)){parsed.host=target.host;parsed.protocol='wss:';}super(parsed.href,...(protocols===undefined?[]:[protocols]));}
 };
})();
