(() => {
  'use strict';
  const dialog = document.querySelector('[data-luna-dialog]');
  const host = document.querySelector('[data-luna-host]');
  const status = document.querySelector('[data-luna-status]');
  const opener = document.querySelector('[data-luna-open]');
  let loadTimer;
  let launchController;
  function notify(active) {
    document.documentElement.classList.toggle('cloud-session-active', active);
    if (parent !== window) parent.postMessage({type: 'nyx:cloud-player', active}, location.origin);
  }
  opener.addEventListener('click', () => {
    if (dialog.open || document.documentElement.classList.contains('cloud-session-active')) return;
    clearTimeout(loadTimer);
    launchController?.abort();
    const frame = document.createElement('iframe');
    frame.title = 'Luna cloud gaming';
    frame.allow = 'autoplay; fullscreen; gamepad; clipboard-read; clipboard-write';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'no-referrer';
    const controller = new AbortController();
    launchController = controller;
    const active = () => launchController === controller && !controller.signal.aborted && dialog.open && frame.isConnected;
    status.textContent = 'Loading Luna…';
    loadTimer = setTimeout(() => {
      if (active()) status.textContent = 'Taking longer than expected. Close and reopen Luna to retry.';
    }, 20000);
    frame.addEventListener('load', () => {
      if (!active() || !frame.getAttribute('src') || frame.getAttribute('src') === 'about:blank') return;
      clearTimeout(loadTimer);
      status.textContent = 'CloudMoon games';
    });
    host.replaceChildren(frame);
    dialog.showModal();
    notify(true);
    void import('./luna-connection.mjs').then(({launchLunaConnection}) => {
      if (active()) return launchLunaConnection(frame, controller.signal);
    }).catch(error => {
      if (!active() || error.name === 'AbortError') return;
      clearTimeout(loadTimer);
      controller.abort();
      host.replaceChildren();
      status.textContent = 'Luna could not connect. Close and reopen it to retry.';
    });
  });
  document.querySelector('[data-luna-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (dialog.open) return; // A queued close event must not cancel a reopened player.
    clearTimeout(loadTimer);
    launchController?.abort();
    launchController = null;
    host.replaceChildren();
    if (document.fullscreenElement === dialog) void document.exitFullscreen().catch(() => {});
    const stratusActive = !document.querySelector('[data-player-layer]').hidden
      || !document.querySelector('[data-launch-layer]').hidden;
    notify(stratusActive);
    opener.focus();
  });
  window.addEventListener('pagehide', () => { clearTimeout(loadTimer); launchController?.abort(); });
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
