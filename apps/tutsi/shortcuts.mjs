const bound=new WeakSet();
export function installShortcuts(doc, actions, depth=0){
  if(!doc||bound.has(doc)||depth>6)return;bound.add(doc);
  doc.addEventListener('keydown',event=>{
    if(!event.isTrusted||event.defaultPrevented||event.repeat||event.isComposing||!event.altKey||event.ctrlKey||event.metaKey||event.location===2||event.getModifierState?.('AltGraph'))return;
    const key=event.key.toLowerCase();
    const action=event.shiftKey?(key==='t'?'restore':null):({h:'home',l:'address',d:'address',t:'newTab',w:'close',r:'reload',arrowleft:'back',arrowright:'forward'}[key]||(/^[1-9]$/.test(key)?'select':null));
    if(action){event.preventDefault();event.stopImmediatePropagation();actions[action]?.(Number(key)-1);return;}
    const target=event.target,editable=target?.matches?.('input:not([type=button]):not([type=checkbox]),textarea,[contenteditable=true]');
    if(!event.shiftKey&&editable&&['a','c','x','v','z','y'].includes(key)){
      event.preventDefault();event.stopImmediatePropagation();
      if(key==='a'){if(target.select)target.select();else doc.execCommand('selectAll');return;}
      if(key==='v'){
        if(!navigator.clipboard?.readText){actions.notice?.('Use your browser paste menu.');return;}
        void navigator.clipboard.readText().then(text=>{
          if(target.setRangeText){target.setRangeText(text,target.selectionStart,target.selectionEnd,'end');target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:text}));}
          else doc.execCommand('insertText',false,text);
        }).catch(()=>actions.notice?.('Clipboard access was denied. Use your browser paste menu.'));return;
      }
      doc.execCommand({c:'copy',x:'cut',z:'undo',y:'redo'}[key]);
    }
  },true);
  const bind=frame=>{try{installShortcuts(frame.contentDocument,actions,depth+1)}catch{}};
  doc.querySelectorAll('iframe,frame').forEach(bind);
  doc.addEventListener('load',event=>{if(event.target?.matches?.('iframe,frame'))bind(event.target)},true);
}
