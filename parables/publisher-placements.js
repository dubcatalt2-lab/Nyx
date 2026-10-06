import {createPublisherFrame} from './publisher-frame.js';
import {publisherConfig, publisherHostAllowed, publisherMode} from './publisher-config.js';

export function createGameSponsors(grid) {
  if (!publisherHostAllowed() || !grid || !globalThis.IntersectionObserver) return null;
  const slots = [];
  const visibility = new WeakMap();
  const frames = new WeakMap();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      visibility.set(entry.target, entry.isIntersecting);
      load(entry.target);
    }
  }, {threshold: 0.1});

  function load(slot) {
    if (['off','pending'].includes(publisherMode()) || slot.hidden || slot.dataset.dismissed || !visibility.get(slot) || slot.dataset.loaded || document.hidden) return;
    slot.dataset.loaded = 'true';
    const frame = createPublisherFrame({
      path: slot.dataset.native ? '/apps/sponsor/native.html' : publisherConfig.bannerPath,
      width: slot.dataset.native ? 720 : publisherConfig.bannerWidth,
      height: slot.dataset.native ? 320 : publisherConfig.bannerHeight,
      dynamicHeight: !!slot.dataset.native,
      onReady: () => {slot.dataset.ready = 'true';},
      onUnavailable: () => {slot.dataset.failed = 'true';slot.hidden = true;}
    });
    frames.set(slot, frame);
    slot.append(frame.element);
  }

  for (let index = 0; index < 3; index++) {
    const slot = document.createElement('aside');
    slot.className = 'nyx-sponsor-slot';
    if (index === 2) {slot.classList.add('nyx-sponsor-native');slot.dataset.native = 'true';}
    slot.setAttribute('aria-label', 'Sponsored placement');
    slot.hidden = true;
    const label = document.createElement('span');
    label.textContent = 'Advertisement';
    const header = document.createElement('header');
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label',index===2?'Close native advertisement':`Close banner advertisement ${index+1}`);
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M6 18 18 6"/></svg>';
    close.addEventListener('click',()=>{slot.dataset.dismissed='true';slot.hidden=true;frames.get(slot)?.destroy();frames.delete(slot);});
    header.append(label,close);
    slot.append(header);
    slots.push(slot);
    grid.append(slot);
    observer.observe(slot);
  }

  let count = 0;
  function update() {
    for (let index = 0; index < slots.length; index++) {
      const slot = slots[index];
      slot.hidden = !!slot.dataset.dismissed || count < 2 || ['off','pending'].includes(publisherMode()) || grid.clientWidth < (slot.dataset.native ? 280 : publisherConfig.bannerWidth) || slot.dataset.failed === 'true';
      if (['off','pending'].includes(publisherMode())) {
        frames.get(slot)?.destroy();
        delete slot.dataset.loaded;
        delete slot.dataset.ready;
      }
      load(slot);
    }
  }
  const resize = new ResizeObserver(update);
  resize.observe(grid);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('message', event => {
    if (event.data?.type === 'nyx:publisher-change' && event.source === parent && event.origin === location.origin) { update(); return; }

  });

  return {
    render(games, makeCard) {
      count = games.length;
      for (const card of grid.querySelectorAll(':scope > .game-card')) card.remove();
      const step = Math.max(1, Math.ceil(games.length / 3));
      for (let start = 0; start < games.length; start += step) {
        const fragment = document.createDocumentFragment();
        for (const game of games.slice(start, start + step)) fragment.append(makeCard(game));
        grid.insertBefore(fragment, slots[start / step] || null);
      }
      update();
    }
  };
}
