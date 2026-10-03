// Let game engines own their canvas dimensions. Pulling the canvas out of flow
// collapses wrappers that Phaser uses to measure its available drawing area.
(() => {
  const style=document.createElement('style');
  style.textContent='html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden;background:#05070d}canvas,object,embed,ruffle-player,ruffle-object{max-width:100%;max-height:100%}';
  (document.head||document.documentElement).append(style);
  let queued=false;
  function fit(){
    queued=false;
    let changed=false;
    for(const surface of document.querySelectorAll('canvas,object,embed,ruffle-player,ruffle-object')){
      const parents=[];
      for(let node=surface.parentElement;node&&node!==document.body;node=node.parentElement)parents.unshift(node);
      for(const node of parents){
        if(getComputedStyle(node).display==='none')break;
        const rect=node.getBoundingClientRect();
        if(rect.height<1&&node.style.height!=='100%'){node.style.height='100%';changed=true;}
        if(rect.width<1&&node.style.width!=='100%'){node.style.width='100%';changed=true;}
      }
    }
    if(changed)window.dispatchEvent(new Event('resize'));
  }
  const queue=()=>{if(!queued){queued=true;requestAnimationFrame(fit);}};
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('DOMContentLoaded',queue);addEventListener('resize',queue);addEventListener('load',queue);
})();
