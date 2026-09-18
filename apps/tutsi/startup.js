// A startup cover only: routes, accounts and saved preferences stay intact.
window.tutsiStartupReady = new Promise(resolve => {
  const frame = document.getElementById('studyready-startup');
  let timer, finished = false, staying = false;
  const listeners = new AbortController();
  const finish = () => {
    if (finished || staying) return;
    finished = true;
    clearTimeout(timer);
    clearTimeout(fallback);
    listeners.abort();
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
    frame.dataset.staying = 'true';
  };
  const start = () => {
    if (finished || staying) return;
    try {
      for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'])
        frame.contentDocument.addEventListener(type, stay, {capture:true, passive:true, signal:listeners.signal});
    } catch {}
    if (!timer) timer = setTimeout(finish, 4000);
  };
  // A failed or stalled lesson request must never trap the user.
  const fallback = setTimeout(finish, 8000);
  frame?.addEventListener('load', start, {once:true});
  frame?.addEventListener('error', start, {once:true});
  try {
    if (!frame || (frame.contentDocument?.readyState === 'complete' && frame.contentWindow.location.pathname.endsWith('/studyready/index.html'))) start();
  } catch { start(); }
});
