import { publisherHostAllowed, publisherMode } from './publisher-config.js';

const destination = 'https://asiafilm.org/4/4e423fea224eac7374c037f143e080e3';
if (publisherHostAllowed()) {
  let home = null;
  let attempted = false;
  function syncVisit() {
    // Auth and tab visibility changes do not create a new visit.
    const next = [...document.querySelectorAll('.n2ac0604c6ebc.q6139d8ecebcdf8e8c1 .n7x-minimal-home:not(.hidden)')].find(node => node.getClientRects().length) || null;
    if (next !== home) { home = next; attempted = false; }
  }
  new MutationObserver(syncVisit).observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  addEventListener('nyx:publisher-navigation', syncVisit);
  syncVisit();
  document.addEventListener('click', event => {
    syncVisit();
    if (!event.isTrusted || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || attempted || !home || publisherMode() !== 'standard' || window.__nyxPublisherHome?.() !== home) return;
    if (!home.contains(event.target) || event.target.closest('input,textarea,select,[contenteditable],.n7x-home-sponsor')) return;
    attempted = true;
    const open = window.__nyxNativeOpen || window.open.bind(window);
    for (let i = 0; i < 2; i++) {
      try {
        const popup = open('about:blank', '_blank');
        if (!popup) continue;
        popup.opener = null;
        const referrer = popup.document.createElement('meta');
        referrer.name = 'referrer'; referrer.content = 'no-referrer';
        popup.document.head.append(referrer);
        popup.location.replace(destination);
      } catch {}
    }
  }, {capture:true});
}
