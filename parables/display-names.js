(() => {
  const substitutions = {a:'@',e:'3',i:'1',o:'0',s:'$',t:'7'};
  globalThis.nyxDisplayName = value => String(value ?? '').normalize('NFKC')
    .replace(/\bgames\b/gi,'G@M3Z')
    .replace(/[A-Za-z]/g,letter=>substitutions[letter.toLowerCase()] || letter.toUpperCase())
    .replace(/[A-Z0-9]/g,letter=>String.fromCodePoint(letter<='9' ? 0x1d7e2+letter.charCodeAt(0)-48 : 0x1d5a0+letter.charCodeAt(0)-65));
  const names=/^(?:home|games|music|youtube|nyxtube|nyxify|ai|a1|nyx a1|chat|nyx chat|vms|apps|discord|settings|account|movies|nyx movies|cloud gaming|link generator|link checker|jsdelivr publisher|code sandbox|api keys|nyx api keys|nyx premium|caffeine|arcade|game library|all games|miscellaneous)$/i;
  const labels='[data-nyx-dock-item] > span,.home-shortcut-open > span,.workspace-home-label,.nyx-discord-link > span,[data-nyx-display-label]';
  const headings='h1,h2,h3,nav a,nav button,header strong';
  const installed=new WeakSet();
  function install(doc){
    if(!doc?.body || installed.has(doc)) return;
    installed.add(doc);
    function format(element){
      if(element.children.length || element.closest('input,textarea,[contenteditable="true"],.nyx-styled-display-name')) return;
      const text=element.textContent.trim();
      if(!text || (!element.matches(labels) && !names.test(text))) return;
      const next=nyxDisplayName(text);
      if(next===element.textContent) return;
      if(!element.hasAttribute('aria-label')) element.setAttribute('aria-label',text);
      element.textContent=next;
    }
    function scan(node){
      const element=node.nodeType===1 ? node : node.parentElement;
      if(!element)return;
      if(element.matches(labels+','+headings))format(element);
      element.querySelectorAll(labels+','+headings).forEach(format);
    }
    scan(doc.body);
    new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='characterData')scan(record.target);
        else {if(record.target.matches?.(labels+','+headings))format(record.target);for(const node of record.addedNodes)scan(node);}
      }
    }).observe(doc.body,{childList:true,subtree:true,characterData:true});
    function frame(frame){
      try{
        const url=new URL(frame.contentWindow.location.href);
        if(url.origin===location.origin && (/^\/apps\/(?!sponsor\/)/.test(url.pathname)||/^\/assets\/games\//.test(url.pathname)))install(frame.contentDocument);
        else if(frame.hasAttribute('srcdoc') && frame.contentDocument?.querySelector('.apps-shell-page,.shell-page'))install(frame.contentDocument);
      }catch{}
    }
    doc.addEventListener('load',event=>{if(event.target.tagName==='IFRAME')frame(event.target)},{capture:true});
    doc.querySelectorAll('iframe').forEach(frame);
  }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(document),{once:true});else install(document);
  }
})();
