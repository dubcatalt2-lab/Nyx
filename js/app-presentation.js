// First-party app documents only: finish initial scripts and sibling theming
// before exposing the layout. No dependency on fonts, images or API responses.
(() => {
  const root=document.documentElement;
  const style=document.createElement('style');
  style.textContent='html[data-app-presentation="pending"] body{visibility:hidden!important}';
  document.head.append(style);
  root.dataset.appPresentation='pending';
  let timer;
  const reveal=()=>{clearTimeout(timer);delete root.dataset.appPresentation;style.remove();};
  // A broken stylesheet or script must not hide the app indefinitely.
  timer=setTimeout(reveal,8000);
  const ready=()=>{
    try {window.frameElement?.dispatchEvent(new Event('nyx:app-dom-ready'));} catch {}
    const pending=[...document.querySelectorAll('#tutsi-embedded-style')].filter(link=>!link.disabled&&!link.sheet);
    if(!pending.length){reveal();return;}
    Promise.all(pending.map(link=>new Promise(resolve=>{
      const done=()=>{link.removeEventListener('load',done);link.removeEventListener('error',done);resolve();};
      link.addEventListener('load',done,{once:true});link.addEventListener('error',done,{once:true});
      if(link.sheet)done();
    }))).then(reveal);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
