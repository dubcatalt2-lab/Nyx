import { publisherConfig, publisherHostAllowed, publisherMode, publisherSurface } from "./publisher-config.js";
import { createPublisherFrame } from "./publisher-frame.js";
import "./publisher-popup.js";
import {startPlacements} from './publisher-placements.js';

export function startHomeSponsors() {
  if (!publisherHostAllowed() || publisherConfig.homeBanners.length !== 2) return;
  const states = new Map();
  let scheduled = false;
  const dismissed = new Map();
  let visitHome = null;
  const style = document.createElement("style");
  style.textContent =
    '.n7x-home-sponsor{position:absolute;bottom:24px;width:64px;z-index:3;color:var(--obsidian-muted,#aaa);font:10px/1.4 system-ui;text-align:center}.n7x-home-sponsor[data-side="left"]{left:24px}.n7x-home-sponsor[data-side="right"]{right:24px}.n7x-home-sponsor>span{display:block;margin-bottom:8px}.n7x-home-sponsor .n7x-home-creative{width:64px;height:240px;overflow:hidden}.n7x-home-sponsor iframe{transform:scale(.4);transform-origin:top left;display:block;width:160px;height:600px;border:0;background:transparent}.n7x-home-sponsor:not([data-ready]){visibility:hidden}.n7x-home-sponsor[hidden]{display:none!important}';
  document.head.append(style);
  style.textContent +=
    ".n7x-home-sponsor header{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:4px;font-size:8px}.n7x-home-sponsor button{display:grid;place-items:center;flex:none;width:24px;height:24px;border:1px solid #ffffff30;border-radius:6px;background:#151515;color:#eee;cursor:pointer}.n7x-home-sponsor button svg{width:12px;height:12px}";

  function clear(state) {
    for (const slot of state.slots) {
      slot.frame.destroy();
      slot.host.remove();
    }
    state.slots = [];
  }
  function update() {
    scheduled = false;
    const visit = [...document.querySelectorAll('.n2ac0604c6ebc.q6139d8ecebcdf8e8c1 .n7x-minimal-home:not(.hidden)')].find(node => node.getClientRects().length) || null;
    if (visit !== visitHome) {
      for (const timer of dismissed.values()) clearTimeout(timer);
      dismissed.clear();
      for (const state of states.values()) state.attempted = false;
      visitHome = visit;
    }
    const mode = publisherMode();
    const eligible = !["off", "pending"].includes(mode);
    const surface = publisherSurface();
    const homes = [...new Set([...states.keys(), ...(surface ? [surface] : [])])];
    for (const home of homes) {
      if (!states.has(home)) states.set(home, { slots: [], attempted: false });
      const state = states.get(home);
      const available = eligible && surface === home;
      const visible =
        available &&
        !document.hidden &&
        !home.classList.contains("hidden") &&
        getComputedStyle(home).visibility !== "hidden" &&
        !document.body.classList.contains("n7x-loading-active");
      if (!visible) {
        clear(state);
        if(home.classList.contains('n7x-sponsored-page'))home.classList.remove('n7x-sponsored-page');
        state.attempted = false;
        continue;
      }
      for (const slot of state.slots) slot.host.hidden = !visible || slot.failed;
      if (!visible || state.attempted) continue;
      state.attempted = true;
      publisherConfig.homeBanners.forEach((placement, index) => {
        if (dismissed.has(index)) return;
        const host = document.createElement("aside");
        host.className = "n7x-home-sponsor";
        host.setAttribute("data-n7x-owned-overlay", "");
        host.dataset.side = index ? "right" : "left";
        host.setAttribute("aria-label", "Sponsored placement");
        const header = document.createElement("header");
        const label = document.createElement("span");
        label.textContent = "Ad";
        label.setAttribute("aria-label", "Advertisement");
        const close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", `Close ${index ? "right" : "left"} advertisement`);
        close.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M6 18 18 6"/></svg>';
        close.addEventListener("click", () => {
          dismissed.set(index, setTimeout(() => {
            dismissed.delete(index);
            for (const state of states.values()) {
              clear(state);
              state.attempted = false;
            }
            schedule();
          }, 5 * 60 * 1000));
          for (const state of states.values())
            state.slots = state.slots.filter((slot) => {
              if (slot.index !== index) return true;
              slot.frame.destroy();
              slot.host.remove();
              return false;
            });
          if(!state.slots.length && home.classList.contains('n7x-sponsored-page'))home.classList.remove('n7x-sponsored-page');
        });
        header.append(label, close);
        host.append(header);
        const slot = { host, index, failed: false };
        slot.frame = createPublisherFrame({
          ...placement,
          onReady: () => {
            host.dataset.ready = "true";
          },
          onUnavailable: () => {
            slot.failed = true;
            host.hidden = true;
            if(state.slots.every(item=>item.failed)&&home.classList.contains('n7x-sponsored-page'))home.classList.remove('n7x-sponsored-page');
          },
        });
        const creative = document.createElement("div");
        creative.className = "n7x-home-creative";
        creative.append(slot.frame.element);
        host.append(creative);
        state.slots.push(slot);
        home.append(host);
      });
    }
    for (const [home, state] of states) {
      if (!home.isConnected) {
        clear(state);
        states.delete(home);
      }
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(update);
  }
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("resize", schedule);
  window.addEventListener("nyx:publisher-change", schedule);
  document.addEventListener('fullscreenchange', schedule);
  document.addEventListener("visibilitychange", schedule);
  update();
}

startHomeSponsors();
// Homepage social bars are omitted; offers are isolated in publisher-popup.
