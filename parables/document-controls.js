(() => {
  let blanked=false, menu=null, previousFocus=null;
  const closeMenu=()=>{menu?.remove();menu=null;};
  const awayCover=document.createElement('div');
  awayCover.id='nyxAwayCover';awayCover.dataset.nyxOwnedOverlay='';awayCover.hidden=true;awayCover.inert=true;
  awayCover.setAttribute('aria-hidden','true');awayCover.setAttribute('popover','manual');
  const awayImage=document.createElement('img');awayImage.src='/assets/backgrounds/study-away-cover.png';awayImage.alt='';awayImage.draggable=false;
  awayCover.append(awayImage);(document.getElementById('app') || document.body).append(awayCover);
  let windowAway=false,blurTimer,focusTimer;
  function syncAwayCover(){
    if(blanked)return;
    clearInterval(focusTimer);
    if(document.hidden||windowAway){
      closeMenu();awayCover.hidden=false;
      try{awayCover.showPopover?.();}catch{}
      if(windowAway&&!document.hidden)focusTimer=setInterval(()=>{if(document.hasFocus()){windowAway=false;syncAwayCover();}},100);
    }else{
      try{awayCover.hidePopover?.();}catch{}
      awayCover.hidden=true;
    }
  }
  document.addEventListener('visibilitychange',()=>{windowAway=!document.hidden&&!document.hasFocus();syncAwayCover();});
  addEventListener('blur',()=>{
    clearTimeout(blurTimer);
    blurTimer=setTimeout(()=>{windowAway=!document.hasFocus();syncAwayCover();},0);
  });
  const returnToNyx=()=>{clearTimeout(blurTimer);windowAway=false;syncAwayCover();};
  addEventListener('focus',returnToNyx);
  document.addEventListener('focusin',returnToNyx);
  addEventListener('pageshow',returnToNyx);
  syncAwayCover();
  function blankDocument(event){
    if(event.repeat)return;
    const inspect=event.key==='F12'||((event.ctrlKey||event.metaKey)&&event.shiftKey&&['i','j','c'].includes(event.key.toLowerCase()));
    if(!inspect)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(blanked)return;
    blanked=true;
    clearTimeout(blurTimer);clearInterval(focusTimer);
    closeMenu();
    window.stop();
    window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));
    document.querySelectorAll('audio,video').forEach(media=>media.pause());
    document.open();
    document.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title></title></head><body style="margin:0;background:#fff"></body></html>');
    document.close();
    const body=document.body,head=document.head;
    new MutationObserver(()=>{
      if(body.childNodes.length)body.replaceChildren();
      head.querySelectorAll('script,link,style').forEach(node=>node.remove());
    }).observe(document.documentElement,{childList:true,subtree:true});
  }
  const bound=new WeakSet();
  function bindDocument(doc){
    if(bound.has(doc))return;
    bound.add(doc);
    doc.addEventListener('keydown',blankDocument,true);
    try{
      const url=new URL(doc.URL);
      if(doc===document||(url.origin===location.origin&&/^\/(?:apps\/(?!sponsor\/)|assets\/games\/)/.test(url.pathname)))doc.addEventListener('contextmenu',event=>openMenu(event,doc));
    }catch{}
    const bindFrame=frame=>{try{if(frame.contentDocument)bindDocument(frame.contentDocument);}catch{}};
    doc.addEventListener('load',event=>{if(event.target?.tagName==='IFRAME')bindFrame(event.target);},true);
    doc.querySelectorAll('iframe').forEach(bindFrame);
  }
  bindDocument(document);
  const paths={back:'m15 18-6-6 6-6',forward:'m9 18 6-6-6-6',reload:'M20 11a8 8 0 1 0-2.35 5.65M20 4v7h-7',plus:'M12 5v14M5 12h14',settings:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',copy:'M9 9h11v11H9zM5 15H3V3h12v2'};
  function openMenu(event,doc=document){
    if(blanked)return;
    event.preventDefault();
    closeMenu();previousFocus=document.activeElement;
    const target=event.target?.closest?.('input,textarea,[contenteditable="true"]');
    const selection=target&&typeof target.selectionStart==='number'?target.value.slice(target.selectionStart,target.selectionEnd):String(doc.getSelection()||'');
    const entries=[
      ['Back','back','[data-workspace-shell-back]'],['Forward','forward','[data-workspace-shell-forward]'],
      ['Reload page','reload','[data-workspace-shell-reload]'],['New page','plus','[data-workspace-shell-new-tab]'],
      ['Settings','settings','[data-nyx-dock-item="settings"]']
    ].map(([label,icon,selector])=>({label,icon,disabled:!document.querySelector(selector)||document.querySelector(selector).disabled,run:()=>document.querySelector(selector)?.click()}));
    if(selection)entries.unshift({label:'Copy','icon':'copy',run:()=>navigator.clipboard.writeText(selection).catch(()=>{})});
    if(target&&typeof target.select==='function')entries.unshift({label:'Select all',icon:'copy',run:()=>{target.focus();target.select();}});
    menu=document.createElement('div');menu.className='nyx-context-menu';menu.dataset.nyxOwnedOverlay='';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Nyx');
    for(const entry of entries){
      const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.disabled=!!entry.disabled;
      button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[entry.icon]}"></path></svg><span></span>`;
      button.querySelector('span').textContent=entry.label;
      button.addEventListener('click',()=>{closeMenu();previousFocus?.focus?.();entry.run();});menu.append(button);
    }
    (document.getElementById('app') || document.body).append(menu);
    const bounds=menu.getBoundingClientRect();
    let x=event.clientX,y=event.clientY,view=doc.defaultView;
    try{while(view&&view!==window){const frame=view.frameElement;if(!frame)break;const rect=frame.getBoundingClientRect();x+=rect.left;y+=rect.top;view=view.parent;}}catch{}
    menu.style.left=Math.max(8,Math.min(x,innerWidth-bounds.width-8))+'px';
    menu.style.top=Math.max(8,Math.min(y,innerHeight-bounds.height-8))+'px';
    menu.querySelector('button:not(:disabled)')?.focus();
  }
  document.addEventListener('pointerdown',event=>{if(menu&&!menu.contains(event.target))closeMenu();},true);
  document.addEventListener('keydown',event=>{
    if(!menu)return;
    if(event.key==='Escape'){event.preventDefault();closeMenu();previousFocus?.focus?.();}
    else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();const buttons=[...menu.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
      buttons[next]?.focus();
    }
  });
  addEventListener('resize',closeMenu);addEventListener('blur',closeMenu);
})();
