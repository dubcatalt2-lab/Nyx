// A startup cover only: routes, accounts and saved preferences stay intact.
window.tutsiStartupReady = new Promise(resolve => {
  const frame = document.getElementById('studyready-startup');
  let timer, finished = false, staying = false;
  const listeners = new AbortController();
  const watched = new WeakSet();
  const finish = () => {
    if (finished || staying) return;
    finished = true;
    clearTimeout(timer);
    clearTimeout(fallback);
    listeners.abort();
    clearInterval(watch);
    frame?.remove();
    document.documentElement.classList.remove('startup-covered');
    resolve();
  };
  const stay = event => {
    if (!event.isTrusted || finished || staying) return;
    staying = true;
    clearTimeout(timer);
    clearTimeout(fallback);
    listeners.abort();
    clearInterval(watch);
    frame.dataset.staying = 'true';
  };
  const attach = () => {
    if (finished || staying) return;
    try {
      const doc = frame.contentDocument;
      if (!doc || watched.has(doc)) return;
      watched.add(doc);
      for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'])
        doc.addEventListener(type, stay, {capture:true, passive:true, signal:listeners.signal});
    } catch {}
  };
  const start = () => {
    if (finished || staying) return;
    attach();
    if (!timer) timer = setTimeout(finish, 4000);
  };
  // Bind as soon as the lesson document exists, before slow assets finish loading.
  const watch = setInterval(attach, 25);
  attach();
  // A failed or stalled lesson request must never trap the user.
  const fallback = setTimeout(finish, 8000);
  frame?.addEventListener('load', start, {once:true});
  frame?.addEventListener('error', start, {once:true});
  try {
    if (!frame || (frame.contentDocument?.readyState === 'complete' && frame.contentWindow.location.pathname.endsWith('/studyready/index.html'))) start();
  } catch { start(); }
});
