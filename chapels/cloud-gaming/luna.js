(() => {
  'use strict';
  const dialog = document.querySelector('[data-luna-dialog]');
  const host = document.querySelector('[data-luna-host]');
  const status = document.querySelector('[data-luna-status]');
  const opener = document.querySelector('[data-luna-open]');
  let loadTimer;
  function notify(active) {
    document.documentElement.classList.toggle('cloud-session-active', active);
    if (parent !== window) parent.postMessage({type: 'nyx:cloud-player', active}, location.origin);
  }
  opener.addEventListener('click', () => {
    if (dialog.open || document.documentElement.classList.contains('cloud-session-active')) return;
    const frame = document.createElement('iframe');
    frame.title = 'Luna cloud gaming';
    frame.allow = 'autoplay; fullscreen; gamepad; clipboard-read; clipboard-write';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'no-referrer';
    status.textContent = 'Loading Luna…';
    loadTimer = setTimeout(() => {
      status.textContent = 'Taking longer than expected. Try opening Luna in a new tab.';
    }, 20000);
    frame.addEventListener('load', () => {
      clearTimeout(loadTimer);
      status.textContent = 'CloudMoon games';
    });
    frame.src = 'https://luna.loan/';
    host.replaceChildren(frame);
    dialog.showModal();
    notify(true);
  });
  document.querySelector('[data-luna-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    clearTimeout(loadTimer);
    host.replaceChildren();
    if (document.fullscreenElement === dialog) void document.exitFullscreen().catch(() => {});
    const stratusActive = !document.querySelector('[data-player-layer]').hidden
      || !document.querySelector('[data-launch-layer]').hidden;
    notify(stratusActive);
    opener.focus();
  });
  document.querySelector('[data-luna-fullscreen]').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === dialog) await document.exitFullscreen();
      else await dialog.requestFullscreen();
    } catch {
      status.textContent = 'Fullscreen is unavailable in this workspace.';
    }
  });
  if (new URLSearchParams(location.search).get('provider') !== 'stratus') opener.click();
})();
