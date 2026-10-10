(() => {
  const substitutions = {a:'@',e:'3',i:'1',o:'0',s:'$',t:'7'};
  globalThis.nyxDisplayName = value => String(value ?? '').normalize('NFKC')
    .replace(/\bgames\b/gi,'G@M3Z')
    .replace(/[A-Za-z]/g,letter=>substitutions[letter.toLowerCase()] || letter.toUpperCase())
    .replace(/[A-Z0-9]/g,letter=>String.fromCodePoint(letter<='9' ? 0x1d7e2+letter.charCodeAt(0)-48 : 0x1d5a0+letter.charCodeAt(0)-65))
    .replace(/(^|\s)@\u{1d7e3}(?=$|\s)/gu,(_,space)=>space+'A1');
  const names=/^(?:(?:nyx|tutsi|drop)\s+)?(?:home|games|music|youtube|nyxtube|nyxify(?:\/built in music)?|ai|a1|duck ai|duck a1|chat|vms|apps|discord|settings|account|movies|more movie sites|tiktok|animex|cloud gaming|link generator|bulk link generator|link checker|jsdelivr publisher|code sandbox|code studio|api(?: keys)?|premium|caffeine|arcade|game library|all games|miscellaneous)$/i;
  const labels='[data-nyx-dock-item] > span,.home-shortcut-open > span,.workspace-home-label,.nyx-discord-link > span,.quick-tile > span:not(.quick-icon),#all-apps button > span,[data-nyx-display-label]';
  const headings='h1,h2,h3,nav a,nav button,header strong,.nyxify-brand strong,.lc-brand strong,.utility-nav-item > span,.brand,.brand-title';
  const wordScopes='.nyx-release-notes,.nyx-tos-dialog,.nyx-terms-tab,.nyx-tos-document,[data-nyx-display-words]';
  const wordElements='p,li,strong,h1,h2,h3,a,span,button';
  const displayWords=/\b(?:link generators?|proxy|proxies|games?|gaming|AI|Discord)\b/gi;
  const interfaceWords=/\b(?:nyx|games?|gaming|arcade|play(?:ing)?|search(?:es|ing|ed)?|browsers?|brows(?:e[sd]?|ing)|proxies|proxy|scramjet|baremux|bare-mux|wisp|relay(?:s)?|movies?|videos?|shorts|music|link generators?|connections?|sites?|web|websites?|pages?|reload(?:s|ing|ed)?)\b/gi;
  function styledWords(value, pattern){
    return value.split(/((?:[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:][^\s<>"']*)?))/gi).map((part,index)=>index%2?part:part.replace(pattern,word=>nyxDisplayName(word))).join('');
  }
  const untouched='script,style,input,textarea,pre,code,kbd,[contenteditable="true"],.nyx-styled-display-name,.message,.message-content,.chat-message,.ai-message,.ai-message-content,.ai-thread-list,[data-message-id],.monaco-editor,.cm-editor,[data-nyx-keep-text]';
  const installed=new WeakSet();
  const generatedLabels=new WeakMap();
  function install(doc){
    if(!doc?.body || installed.has(doc) || doc.__nyxDisplayLabelsInstalled) return;
    installed.add(doc);
    doc.__nyxDisplayLabelsInstalled=true;
    const nyxInterface=!/^(?:nook|drop|tutsi)\./i.test(doc.location.hostname)
      && !/^\/(?:apps|chapels)\/(?:agents|drop|tutsi)(?:\/|$)/i.test(doc.location.pathname)
      && doc.documentElement.dataset.appShell!=='tutsi' && !doc.documentElement.dataset.tutsiApp
      && !doc.body.classList.contains('drop-games');
    function format(element){
      if(element.closest('input,textarea,pre,code,[contenteditable="true"],.nyx-styled-display-name,.message,.message-content,.chat-message,.ai-message,.ai-message-content,.ai-thread-list,[data-message-id]')) return;
      const nodes=[...element.childNodes].filter(node=>node.nodeType===3);
      const text=nodes.map(node=>node.textContent).join('').trim();
      if(!text || (!element.matches(labels) && !names.test(text))) return;
      const next=nyxDisplayName(text);
      if(next===text) return;
      if(!element.hasAttribute('aria-label') || element.getAttribute('aria-label')===generatedLabels.get(element)){element.setAttribute('aria-label',text);generatedLabels.set(element,text);}
      const content=nodes.find(node=>node.textContent.trim());
      if(!content)return;
      content.textContent=next;
      for(const node of nodes)if(node!==content&&node.textContent.trim())node.textContent='';
    }
    function formatWords(element){
      if((!nyxInterface && !element.closest(wordScopes)) || element.closest(untouched))return;
      for(const node of element.childNodes){
        if(node.nodeType!==3)continue;
        const next=styledWords(node.textContent,nyxInterface?interfaceWords:displayWords);
        if(next!==node.textContent && element.matches('button,a,h1,h2,h3,option') && !element.hasAttribute('aria-label'))element.setAttribute('aria-label',element.textContent.trim());
        if(next!==node.textContent)node.textContent=next;
      }
    }
    function formatAttributes(element){
      if(!nyxInterface || element.closest('pre,code,textarea,[contenteditable="true"],.monaco-editor,.cm-editor,[data-nyx-keep-text]'))return;
      for(const name of ['placeholder','title','alt']){
        const value=element.getAttribute(name);
        if(!value)continue;
        const next=styledWords(value,interfaceWords);
        if(next!==value){
          if(name==='placeholder' && !element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby'))element.setAttribute('aria-label',value);
          element.setAttribute(name,next);
        }
      }
    }
    function scan(node){
      const element=node.nodeType===1 ? node : node.parentElement;
      if(!element)return;
      if(element.matches(labels+','+headings))format(element);
      element.querySelectorAll(labels+','+headings).forEach(format);
      if(nyxInterface){formatWords(element);formatAttributes(element);element.querySelectorAll('*').forEach(child=>{formatWords(child);formatAttributes(child);});}
      else{
        if(element.matches(wordElements))formatWords(element);
        if(element.closest(wordScopes))element.querySelectorAll(wordElements).forEach(formatWords);
        else element.querySelectorAll(wordScopes).forEach(scope=>{formatWords(scope);scope.querySelectorAll(wordElements).forEach(formatWords);});
      }
    }
    function formatTitle(){
      if(!nyxInterface)return;
      const next=styledWords(doc.title,/\bnyx\b/gi);
      if(next!==doc.title)doc.title=next;
    }
    formatTitle();
    if(doc.head)new MutationObserver(formatTitle).observe(doc.head,{childList:true,subtree:true,characterData:true});
    scan(doc.body);
    new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='attributes')formatAttributes(record.target);
        else if(record.type==='characterData')scan(record.target);
        else {if(record.target.matches?.(labels+','+headings))format(record.target);if(record.target.matches?.(wordElements))formatWords(record.target);for(const node of record.addedNodes)scan(node);}
      }
    }).observe(doc.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','alt']});
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
