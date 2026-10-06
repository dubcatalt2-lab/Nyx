import {publisherBaseMode, publisherHostAllowed} from './publisher-config.js';

export const adcoinsPeriod = 600000;
export const adcoinsBreak = 180000;
export const adcoinsKey = 'nyx.adcoins.v1';

export function advanceAdcoins(value, start, now, visible) {
  const continuous = now >= start && now - start <= 5000;
  const number = value => Number.isFinite(value) ? Math.max(0, value) : 0;
  const state = {
    progress: Math.min(adcoinsPeriod, number(value?.progress)),
    freeUntil: number(value?.freeUntil),
    lastEnd: number(value?.lastEnd)
  };
  if (state.freeUntil > now) return state;
  if (state.freeUntil) {
    start = Math.max(start, state.freeUntil);
    state.freeUntil = 0;
  }
  if (visible && continuous) {
    state.progress += Math.max(0, now - Math.max(start, state.lastEnd));
    state.lastEnd = Math.max(state.lastEnd, now);
    if (state.progress >= adcoinsPeriod) {
      state.progress = 0;
      state.freeUntil = now + adcoinsBreak;
    }
  }
  return state;
}

export function startAdcoins() {
  if (!publisherHostAllowed() || window.parent !== window || window.__nyxAdcoinsStarted) return;
  window.__nyxAdcoinsStarted = true;
  let lastTime = Date.now();
  let wasVisible = !document.hidden;
  let wasEligible = false;
  let state = {};
  let inBreak = false;
  const style = document.createElement('style');
  style.textContent = '.nyx-adcoins{position:absolute;bottom:48px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100% - 32px);padding:8px 12px;border:1px solid #ffffff14;border-radius:14px;background:var(--obsidian-surface,#151515);color:var(--obsidian-muted,#aaa);font-family:inherit;font-size:12px;line-height:1.4;white-space:nowrap;pointer-events:none}.nyx-adcoins svg{width:16px;height:16px;flex:none}.nyx-adcoins[hidden]{display:none}.nyx-adcoins[data-free="true"]{color:var(--obsidian-text,#eee)}';
  document.head.append(style);
  const eligible = () => ['standard', 'adkid'].includes(publisherBaseMode()) && document.body.classList.contains('browser-shell');
  function render() {
    const now = Date.now();
    const free = state.freeUntil > now;
    window.__nyxAdcoinsFreeUntil = state.freeUntil || 0;
    if (free !== inBreak) {
      inBreak = free;
      window.dispatchEvent(new Event('nyx:publisher-change'));
      document.querySelectorAll('iframe.view').forEach(frame => {
        try { frame.contentWindow?.postMessage({type: 'nyx:publisher-change'}, location.origin); } catch {}
      });
    }
    const seconds = Math.ceil((free ? state.freeUntil - now : adcoinsPeriod - (state.progress || 0)) / 1000);
    const time = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    for (const home of document.querySelectorAll('.browser-home.nyx-minimal-home')) {
      let badge = home.querySelector('.nyx-adcoins');
      if (!badge && eligible()) {
        badge = document.createElement('div');
        badge.className = 'nyx-adcoins';
        badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 13 3 3 5-7"/></svg><span></span>';
        badge.title = 'Every 10 minutes with Nyx visible earns a 3-minute ad break. Shared across tabs in this browser.';
        home.append(badge);
      }
      if (!badge) continue;
      badge.hidden = !eligible();
      badge.dataset.free = String(free);
      const label = free ? 'Adcoins · Ad-free for ' + time : 'Adcoins · Ad break in ' + time;
      if (badge.lastElementChild.textContent !== label) badge.lastElementChild.textContent = label;
    }
  }
  function read() {
    try { return JSON.parse(localStorage.getItem(adcoinsKey) || '{}'); } catch { return {}; }
  }
  function tick() {
    const now = Date.now();
    const start = lastTime;
    const active = wasVisible && wasEligible;
    lastTime = now;
    wasVisible = !document.hidden;
    wasEligible = eligible();
    const update = () => {
      state = advanceAdcoins(read(), start, now, active);
      try { localStorage.setItem(adcoinsKey, JSON.stringify(state)); } catch {}
      render();
    };
    if (navigator.locks) void navigator.locks.request(adcoinsKey, update).catch(() => {});
    else update();
  }
  window.addEventListener('storage', event => {
    if (event.key === adcoinsKey) { state = read(); render(); }
  });
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('nyx:publisher-change', tick);
  window.addEventListener('pageshow', tick);
  window.addEventListener('pagehide', tick);
  setInterval(tick, 1000);
  state = read();
  render();
  tick();
}
