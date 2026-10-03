// Only diagnostic categories leave this page; no screenshots, URLs, saves or user content.
(() => {
 const script=document.currentScript,provider=script?.dataset.provider;
 if(provider){
  const game=new URLSearchParams(location.search).get('game');
  const sent=new Set();
  const report=reason=>{if(!game||sent.has(reason)||sent.size>=2)return;sent.add(reason);fetch('/api/games/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,game,reason}),keepalive:true}).catch(()=>{});};
  window.nyxReportGameFailure=report;
  addEventListener('message',event=>{const frame=document.querySelector('#gameFrame,#game');if(event.source!==frame?.contentWindow||event.data?.type!=='nyx:game-health')return;if(['no-render','resource-error'].includes(event.data.reason))report(event.data.reason);});
  return;
 }
 let drew=false,resourceFailure=false,visibleMs=0,last=performance.now();
 const restore=[];
 const mark=()=>{drew=true;for(const undo of restore)undo();restore.length=0;};
 for(const [name,methods] of [['CanvasRenderingContext2D',['drawImage','fillText','stroke','putImageData']],['WebGLRenderingContext',['drawArrays','drawElements']],['WebGL2RenderingContext',['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']]]){
  const proto=globalThis[name]?.prototype;if(!proto)continue;
  for(const method of methods){const original=proto[method];if(typeof original!=='function')continue;const wrapped=function(...args){const result=Reflect.apply(original,this,args);mark();return result;};try{proto[method]=wrapped;restore.push(()=>{if(proto[method]===wrapped)proto[method]=original;});}catch{}}
 }
 addEventListener('error',event=>{if(event.target?.tagName==='SCRIPT'||event.target?.tagName==='LINK')resourceFailure=true;},true);
 addEventListener('unhandledrejection',()=>{resourceFailure=true;});
 const timer=setInterval(()=>{
  const now=performance.now();if(!document.hidden)visibleMs+=Math.min(5000,now-last);last=now;
  if(drew){clearInterval(timer);return;}
  if(visibleMs<60000)return;
  clearInterval(timer);for(const undo of restore)undo();
  const canvas=[...document.querySelectorAll('canvas')].some(el=>el.width>40&&el.height>40);
  const text=(document.body?.innerText||'').trim();
  if(canvas||(!text&&!document.querySelector('iframe,object,embed,ruffle-player')))
   parent.postMessage({type:'nyx:game-health',reason:resourceFailure?'resource-error':'no-render'},'*');
 },5000);
 addEventListener('pagehide',()=>{clearInterval(timer);for(const undo of restore)undo();},{once:true});
})();
