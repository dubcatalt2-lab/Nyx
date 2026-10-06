(function(){
  'use strict';
  window.createNyxScreenChat=function({conversation,input,form,stop,status,brand}){
    let panel,chat,composer,send,popout,host,observer,statusObserver,timer,opening=false,session=0;
    function refresh(){
      if(!panel)return;
      const nearBottom=chat.scrollHeight-chat.scrollTop-chat.clientHeight<48;
      chat.replaceChildren(...[...conversation.querySelectorAll('.ai-message')].slice(-8).map(message=>{
        const copy=message.cloneNode(true);
        copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
        copy.removeAttribute('id');copy.querySelectorAll('.ai-message-actions,button').forEach(el=>el.remove());
        return copy;
      }));
      if(nearBottom)chat.scrollTop=chat.scrollHeight;
      send.disabled=input.disabled;composer.disabled=input.disabled;
      panel.querySelector('[data-screen-chat-status]').textContent=status.textContent;
      panel.querySelector('[data-screen-chat-title]').textContent=brand()+' · Screen share';
    }
    function destroy(){
      session++;observer?.disconnect();statusObserver?.disconnect();clearTimeout(timer);
      panel?.remove();panel=null;
      const previous=host;host=null;if(previous&&!previous.closed)previous.close();
    }
    async function detach(automatic=false){
      if(opening||host||!panel)return;
      opening=true;const current=session;
      let next;
      try{
        let pip;try{pip=window.top.documentPictureInPicture||window.documentPictureInPicture}catch{}
        if(pip?.requestWindow){
          try{next=await pip.requestWindow({width:560,height:380});}catch{}
        }
        if(!next&&!automatic)next=window.open('about:blank','', 'popup,width=560,height=380');
        if(!next){if(!automatic)panel.querySelector('[data-screen-chat-status]').textContent='Allow popups to open a separate window.';return;}
        if(current!==session||!panel){next.close();return;}
        host=next;const doc=next.document;
        doc.title=brand()+' screen share';doc.documentElement.dataset.tutsiApp=document.documentElement.dataset.tutsiApp||'';
        for(const sheet of document.querySelectorAll('link[rel="stylesheet"],style')){
          const copy=sheet.cloneNode(true);if(copy.tagName==='LINK')copy.href=sheet.href;doc.head.append(copy);
        }
        const theme=getComputedStyle(document.documentElement);
        for(let i=0;i<theme.length;i++){const key=theme[i];if(key.startsWith('--'))doc.documentElement.style.setProperty(key,theme.getPropertyValue(key));}
        doc.body.className='ai-screen-chat-window';doc.body.style.fontFamily=getComputedStyle(document.body).fontFamily;
        doc.body.append(panel);panel.classList.add('is-detached');popout.hidden=true;
        next.addEventListener('pagehide',()=>{if(host===next){host=null;stop();}},{once:true});
        composer.focus();
      }finally{opening=false;}
    }
    function start(){
      destroy();
      panel=document.createElement('section');panel.className='ai-screen-chat';panel.setAttribute('role','region');panel.setAttribute('aria-label','Screen-sharing chat');
      panel.innerHTML='<header><strong data-screen-chat-title></strong><div><button type="button" data-screen-chat-popout aria-label="Pop out screen chat">↗</button><button type="button" data-screen-chat-stop>Stop sharing</button></div></header><div class="ai-screen-chat-messages" role="log" aria-label="Screen chat replies"></div><form><label for="screenChatInput">Ask about your screen</label><div class="ai-screen-chat-compose"><textarea id="screenChatInput" rows="2" placeholder="Ask about your screen…"></textarea><button type="submit" aria-label="Send screen chat message">Send</button></div></form><small data-screen-chat-status role="status"></small>';
      document.body.append(panel);chat=panel.querySelector('.ai-screen-chat-messages');composer=panel.querySelector('textarea');send=panel.querySelector('[type=submit]');popout=panel.querySelector('[data-screen-chat-popout]');
      popout.onclick=()=>void detach();panel.querySelector('[data-screen-chat-stop]').onclick=stop;
      panel.querySelector('form').onsubmit=event=>{event.preventDefault();if(input.disabled||!composer.value.trim())return;input.value=composer.value;input.dispatchEvent(new Event('input',{bubbles:true}));form.requestSubmit();composer.value='';refresh();};
      composer.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();panel.querySelector('form').requestSubmit();}};
      observer=new MutationObserver(()=>{if(timer)return;timer=setTimeout(()=>{timer=0;refresh()},80)});observer.observe(conversation,{childList:true,subtree:true,characterData:true});
      statusObserver=new MutationObserver(refresh);statusObserver.observe(status,{childList:true,subtree:true,characterData:true});statusObserver.observe(input,{attributes:true,attributeFilter:['disabled']});
      refresh();composer.focus();void detach(true);
    }
    return {start,destroy,refresh};
  };
})();
