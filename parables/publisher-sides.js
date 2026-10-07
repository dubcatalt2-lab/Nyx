import {publisherConfig, publisherHostAllowed, publisherMode} from './publisher-config.js';
import {createPublisherFrame} from './publisher-frame.js';

export function startHomeSponsors() {
  if (!publisherHostAllowed() || publisherConfig.homeBanners.length !== 2) return;
  const states = new Map();
  let scheduled = false;
  let deadline = 0;
  let expired = false;
  const dismissed = new Set();
  const style = document.createElement('style');
  style.textContent = '.nyx-home-sponsor{position:absolute;bottom:24px;width:64px;z-index:3;color:var(--obsidian-muted,#aaa);font:10px/1.4 system-ui;text-align:center}.nyx-home-sponsor[data-side="left"]{left:24px}.nyx-home-sponsor[data-side="right"]{right:24px}.nyx-home-sponsor>span{display:block;margin-bottom:8px}.nyx-home-sponsor .nyx-home-creative{width:64px;height:240px;overflow:hidden}.nyx-home-sponsor iframe{transform:scale(.4);transform-origin:top left;display:block;width:160px;height:600px;border:0;background:transparent}.nyx-home-sponsor:not([data-ready]){visibility:hidden}.nyx-home-sponsor[hidden]{display:none!important}';
  document.head.append(style);
  style.textContent += '.nyx-home-sponsor header{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:4px;font-size:8px}.nyx-home-sponsor button{display:grid;place-items:center;flex:none;width:24px;height:24px;border:1px solid #ffffff30;border-radius:6px;background:#151515;color:#eee;cursor:pointer}.nyx-home-sponsor button svg{width:12px;height:12px}';

  function clear(state) {
    for (const slot of state.slots) {slot.frame.destroy();slot.host.remove();}
    state.slots = [];
  }
  function update() {
    scheduled = false;
    if (deadline && Date.now() >= deadline) expired = true;
    const mode = publisherMode();
    const eligible = !expired && !['off', 'pending'].includes(mode);
    const homes = [...document.querySelectorAll('.workspace-home.nyx-minimal-home')];
    for (const home of homes) {
      if (!states.has(home)) states.set(home, {slots: [], attempted: false});
      const state = states.get(home);
      const rect = home.getBoundingClientRect();
      const available = eligible && window.__nyxPublisherHome?.() === home;
      const visible = available && !document.hidden && !home.classList.contains('hidden') &&
        home.closest('.workspace-window.workspace-blank') && rect.width >= 900 && rect.height >= 520 &&
        getComputedStyle(home).visibility !== 'hidden' && !document.body.classList.contains('nyx-loading-active');
      if (!visible) {clear(state);state.attempted = false;continue;}
      for (const slot of state.slots) slot.host.hidden = !visible || slot.failed;
      if (!visible || state.attempted) continue;
      state.attempted = true;
      publisherConfig.homeBanners.forEach((placement, index) => {
        if (dismissed.has(index)) return;
        const host = document.createElement('aside');
        host.className = 'nyx-home-sponsor';
        host.setAttribute('data-nyx-owned-overlay', '');
        host.dataset.side = index ? 'right' : 'left';
        host.setAttribute('aria-label', 'Sponsored placement');
        const header = document.createElement('header');
        const label = document.createElement('span');
        label.textContent = 'Ad';
        label.setAttribute('aria-label', 'Advertisement');
        const close = document.createElement('button');
        close.type = 'button';
        close.setAttribute('aria-label',`Close ${index ? 'right' : 'left'} advertisement`);
        close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M6 18 18 6"/></svg>';
        close.addEventListener('click',()=>{
          dismissed.add(index);
          for (const state of states.values()) state.slots = state.slots.filter(slot=>{
            if (slot.index !== index) return true;
            slot.frame.destroy();slot.host.remove();return false;
          });
        });
        header.append(label,close);
        host.append(header);
        const slot = {host, index, failed: false};
        slot.frame = createPublisherFrame({...placement,
          onReady: () => {host.dataset.ready = 'true';if (!deadline) {deadline = Date.now() + 300000;setTimeout(update,300000);}},
          onUnavailable: () => {slot.failed = true;host.hidden = true;}
        });
        const creative = document.createElement('div');
        creative.className = 'nyx-home-creative';
        creative.append(slot.frame.element);
        host.append(creative);
        state.slots.push(slot);
        home.append(host);
      });
    }
    for (const [home, state] of states) {
      if (!home.isConnected) {clear(state);states.delete(home);}
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(update);
  }
  new MutationObserver(schedule).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  window.addEventListener('resize', schedule);
  window.addEventListener('nyx:publisher-change', schedule);
  document.addEventListener('visibilitychange', schedule);
  update();
}
