(() => {
  const excluded='script,style,code,pre,input,textarea,[contenteditable],[data-user-content]';
  const written=new WeakMap();
  function text(node){
    const parent=node.parentElement;
    if(!parent||parent.closest(excluded)||written.get(node)===node.nodeValue)return;
    const plain=node.nodeValue;
    if(!/[A-Za-z]/.test(plain))return;
    const control=parent.closest('button,a,h1,h2,h3,option,[role="status"]');
    if(control&&!control.hasAttribute('aria-label'))control.setAttribute('aria-label',control.textContent);
    if(parent.tagName==='OPTION'&&!parent.hasAttribute('value'))parent.value=plain;
    const rendered=plain.replace(/[A-Za-z]/g,ch=>String.fromCodePoint((ch<='Z'?0x1d5a0:0x1d5ba)+ch.toLowerCase().charCodeAt(0)-97));
    written.set(node,rendered);node.nodeValue=rendered;
  }
  function scan(node){if(node.nodeType===3)return text(node);if(node.nodeType!==1||node.closest(excluded))return;const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);while(walker.nextNode())text(walker.currentNode);}
  function start(){scan(document.body);new MutationObserver(records=>{for(const r of records)if(r.type==='characterData')text(r.target);else r.addedNodes.forEach(scan);}).observe(document.body,{subtree:true,childList:true,characterData:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
