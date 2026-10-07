import {startHomeSponsors} from './publisher-sides.js';
import {startSocialSponsor} from './publisher-social.js';
import {startAdcoins} from './adcoins.js';
import {publisherConfig, publisherHostAllowed, publisherMode, popupPolicy} from './publisher-config.js';

const key = 'nyx.publisher.home.v1';
const lockName = 'nyx.publisher.home';

function visibleHome(target) {
  if (document.hidden || !document.body.classList.contains('workspace-shell') || document.body.classList.contains('nyx-loading-active')) return null;
  const home = target?.closest?.('.workspace-home.nyx-minimal-home:not(.hidden)');
  if (!home?.isConnected || !home.getClientRects().length || !home.closest('.workspace-window.workspace-blank')) return null;
  if (getComputedStyle(home).visibility !== 'visible') return null;
  return home;
}

function visibleSurface(target, frame) {
  if (publisherMode() !== 'adkid') return frame ? null : visibleHome(target);
  if (document.hidden || !document.body.classList.contains('workspace-shell') || document.body.classList.contains('nyx-loading-active')) return null;
  const surface = frame || target;
  if (!surface?.isConnected || !surface.getClientRects().length || getComputedStyle(surface).visibility !== 'visible') return null;
  if (frame && !firstPartyApp(frame)) return null;
  return surface;
}

function firstPartyApp(frame) {
  try {
    const url = new URL(frame.contentWindow.location.href);
    return frame.matches('iframe.view') && url.origin === location.origin &&
      (/^\/apps\/(?!sponsor\/)/.test(url.pathname) || /^\/assets\/games\/(?:index\.html)?$/.test(url.pathname));
  } catch {return false;}
}

if (publisherConfig.homeLink && publisherHostAllowed() && navigator.locks) {
  function handleClick(event, frame) {
    if (!event.isTrusted || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (event.target?.closest?.('a,button,textarea,select,[contenteditable="true"],.nyx-home-sponsor,.nyx-social-sponsor')) return;
    const home = visibleSurface(event.target, frame);
    if (!home) return;
    void navigator.locks.request(lockName, {ifAvailable: true}, lock => {
      if (!lock || visibleSurface(event.target, frame) !== home || !navigator.userActivation?.isActive) return;
      try {
        const policy = popupPolicy();
        if (!policy) return;
        const now = Date.now();
        const stored = localStorage.getItem(key);
        const history = stored === null ? [] : JSON.parse(stored);
        if (!Array.isArray(history) || history.some(time => !Number.isFinite(time) || time < 0)) return;
        const recent = history.filter(time => now - time < policy.period);
        if (recent.length >= policy.limit || recent.some(time => now - time < policy.spacing)) return;
        const open = window.__nyxNativeOpen;
        if (typeof open !== 'function') return;
        const retained = history.filter(time => now - time < publisherConfig.homePeriodMs);
        localStorage.setItem(key, JSON.stringify([...retained, now]));
        const popup = open('about:blank', '_blank');
        if (!popup) {
          if (stored === null) localStorage.removeItem(key);
          else localStorage.setItem(key, stored);
          return;
        }
        try {
          popup.opener = null;
          const referrer = popup.document.createElement('meta');
          referrer.name = 'referrer';
          referrer.content = 'no-referrer';
          popup.document.head.append(referrer);
          popup.location.replace(publisherConfig.homeLink);

        } catch {popup.close();}
      } catch {}
    }).catch(() => {});
  }
  document.addEventListener('click', event => handleClick(event), {capture: true});
  const attached = new WeakSet();
  function attach(frame) {
    if (!firstPartyApp(frame)) return;
    const doc = frame.contentDocument;
    if (!doc || attached.has(doc)) return;
    attached.add(doc);
    doc.addEventListener('click', event => handleClick(event, frame), {capture: true});
  }
  document.addEventListener('load', event => {
    if (event.target?.matches?.('iframe.view')) attach(event.target);
  }, {capture: true});
  document.querySelectorAll('iframe.view').forEach(attach);
}

startAdcoins();
startHomeSponsors();
startSocialSponsor();
