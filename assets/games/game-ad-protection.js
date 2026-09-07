(() => {
  'use strict';

  if (globalThis.__nyxGameAdProtection) return;

  const blockedHostSuffixes = Object.freeze([
    'adnxs.com',
    'ads.emulatorjs.org',
    'adsrvr.org',
    'adsterra.com',
    'adtrafficquality.google',
    'amazon-adsystem.com',
    'cdn.r9x.in',
    'clickadu.com',
    'criteo.com',
    'doubleclick.net',
    'exoclick.com',
    'gamemonetize.com',
    'googleadservices.com',
    'googlesyndication.com',
    'hilltopads.net',
    'html5.api.gamedistribution.com',
    'imasdk.googleapis.com',
    'mgid.com',
    'monetag.com',
    'onclickads.net',
    'openx.net',
    'outbrain.com',
    'pagead2.googlesyndication.com',
    'playwire.com',
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'pubmatic.com',
    'rubiconproject.com',
    'sdk.poki.com',
    'taboola.com',
    'trafficjunky.com',
    'venatusmedia.com'
  ]);
  const blockedPathPattern = /(?:^|\/)(?:ads?|ad[-_.]?(?:loader|manager|script)|jump[_-]gamemonetize|poki-(?:master-loader|sdk))\.(?:js|mjs)(?:$|\/)/i;
  const blockedCampaignPattern = /\/ad-campaigns\//i;
  const adElementSelector = [
    '.adsbygoogle',
    '[data-ad-client]',
    '[data-ad-slot]',
    '[id^="google_ads"]',
    '[id*="google_ads"]',
    '[id^="ad-container"]',
    '[class~="ad-container"]',
    '[class~="ad-banner"]',
    '[class~="ad-wrapper"]',
    '[class~="ad-overlay"]',
    '[class~="advertisement"]',
    '[aria-label="Advertisement"]'
  ].join(',');
  const blockedElements = new WeakSet();

  function parsedResource(value) {
    const raw = String(value || '').trim();
    if (!raw || /^(?:about|blob|data|javascript):/i.test(raw)) return null;
    try {
      return new URL(raw, document.baseURI || location.href);
    } catch {
      return null;
    }
  }

  function hostMatches(hostname, suffix) {
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }

  function isBlockedResource(value) {
    const url = parsedResource(value);
    if (!url) return false;
    const hostname = url.hostname.toLowerCase();
    if (blockedHostSuffixes.some(suffix => hostMatches(hostname, suffix))) return true;
    if (hostname === 'serve.app.playsaurus.com' && blockedCampaignPattern.test(url.pathname)) return true;
    return blockedPathPattern.test(url.pathname);
  }

  function resourceValue(node) {
    return node?.getAttribute?.('src')
      || node?.getAttribute?.('href')
      || node?.getAttribute?.('data-src')
      || node?.getAttribute?.('data')
      || '';
  }

  function neutralResource(node) {
    const tag = String(node?.tagName || '').toUpperCase();
    if (tag === 'IMG') return 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    if (tag === 'SCRIPT') return 'data:text/javascript,';
    if (tag === 'LINK') return 'data:text/css,';
    return 'about:blank';
  }

  function markBlocked(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    let blocked = blockedElements.has(node);
    try {
      blocked ||= node.matches(adElementSelector) || isBlockedResource(resourceValue(node));
    } catch {}
    if (!blocked) return false;
    blockedElements.add(node);
    try { node.remove(); } catch {}
    return true;
  }

  function clean(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE && markBlocked(root)) return;
    try {
      root.querySelectorAll?.(adElementSelector)?.forEach(markBlocked);
      root.querySelectorAll?.('[src],[href],[data-src],[data]')?.forEach(node => {
        if (isBlockedResource(resourceValue(node))) markBlocked(node);
      });
    } catch {}
  }

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    const key = String(name || '').toLowerCase();
    if (['src', 'href', 'data-src', 'data'].includes(key) && isBlockedResource(value)) {
      blockedElements.add(this);
      if (String(this.tagName || '').toUpperCase() === 'SCRIPT') {
        try { nativeSetAttribute.call(this, 'type', 'application/x-nyx-blocked'); } catch {}
      }
      return nativeSetAttribute.call(this, key, neutralResource(this));
    }
    return nativeSetAttribute.call(this, name, value);
  };

  function patchResourceProperty(Ctor, property) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(Ctor?.prototype, property);
      if (!descriptor?.set || !descriptor.get) return;
      Object.defineProperty(Ctor.prototype, property, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() { return descriptor.get.call(this); },
        set(value) {
          if (isBlockedResource(value)) {
            blockedElements.add(this);
            if (String(this.tagName || '').toUpperCase() === 'SCRIPT') {
              try { nativeSetAttribute.call(this, 'type', 'application/x-nyx-blocked'); } catch {}
            }
            return descriptor.set.call(this, neutralResource(this));
          }
          return descriptor.set.call(this, value);
        }
      });
    } catch {}
  }

  [
    [HTMLScriptElement, 'src'],
    [HTMLIFrameElement, 'src'],
    [HTMLImageElement, 'src'],
    [HTMLLinkElement, 'href'],
    [HTMLSourceElement, 'src'],
    [HTMLMediaElement, 'src'],
    [HTMLEmbedElement, 'src'],
    [HTMLObjectElement, 'data']
  ].forEach(([Ctor, property]) => patchResourceProperty(Ctor, property));

  const nativeAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    clean(node);
    if (node?.nodeType === Node.ELEMENT_NODE && markBlocked(node)) return node;
    return nativeAppendChild.call(this, node);
  };

  const nativeInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, before) {
    clean(node);
    if (node?.nodeType === Node.ELEMENT_NODE && markBlocked(node)) return node;
    return nativeInsertBefore.call(this, node, before);
  };

  const nativeReplaceChild = Node.prototype.replaceChild;
  Node.prototype.replaceChild = function (node, oldNode) {
    clean(node);
    if (node?.nodeType === Node.ELEMENT_NODE && markBlocked(node)) {
      return oldNode;
    }
    return nativeReplaceChild.call(this, node, oldNode);
  };

  try {
    const nativeFetch = globalThis.fetch?.bind(globalThis);
    if (nativeFetch) {
      globalThis.fetch = (input, init) => {
        const value = input instanceof Request ? input.url : input;
        if (isBlockedResource(value)) return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }));
        return nativeFetch(input, init);
      };
    }
  } catch {}

  try {
    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      return nativeOpen.call(this, method, isBlockedResource(url) ? 'data:,' : url, ...rest);
    };
  } catch {}

  try {
    if (navigator.sendBeacon) {
      const nativeBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url, data) => isBlockedResource(url) || nativeBeacon(url, data);
    }
  } catch {}

  function patchWorker(name) {
    try {
      const NativeWorker = globalThis[name];
      if (typeof NativeWorker !== 'function') return;
      const ProtectedWorker = function (url, options) {
        return new NativeWorker(isBlockedResource(url) ? 'data:text/javascript,' : url, options);
      };
      ProtectedWorker.prototype = NativeWorker.prototype;
      Object.setPrototypeOf(ProtectedWorker, NativeWorker);
      globalThis[name] = ProtectedWorker;
    } catch {}
  }
  patchWorker('Worker');
  patchWorker('SharedWorker');

  const resolved = value => Promise.resolve(value);
  if (!globalThis.PokiSDK) {
    globalThis.PokiSDK = {
      init: () => resolved(),
      initWithVideoHB: () => resolved(),
      commercialBreak: () => resolved(),
      rewardedBreak: () => resolved(true),
      displayAd: () => {},
      gameplayStart: () => {},
      gameplayStop: () => {},
      gameLoadingStart: () => {},
      gameLoadingFinished: () => {},
      happyTime: () => {},
      setDebug: () => {},
      getURLParam: () => null,
      getLanguage: () => navigator.language || 'en'
    };
  }
  if (!globalThis.gdsdk) {
    globalThis.gdsdk = {
      showAd: () => resolved(),
      preloadAd: () => resolved(),
      openConsole: () => {},
      isAdblockEnabled: true
    };
  }

  function notifyGameDistributionReady() {
    try {
      const callback = globalThis.GD_OPTIONS?.onEvent;
      if (typeof callback === 'function') callback({ name: 'SDK_READY' });
    } catch {}
  }

  try {
    const style = document.createElement('style');
    style.id = 'nyx-game-ad-protection-style';
    style.textContent = `${adElementSelector}{display:none!important;visibility:hidden!important;pointer-events:none!important;width:0!important;height:0!important;min-width:0!important;min-height:0!important}`;
    (document.head || document.documentElement).appendChild(style);
  } catch {}

  try {
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(clean);
        else clean(record.target);
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href', 'data-src', 'data', 'class', 'id']
    });
  } catch {}

  globalThis.__nyxGameAdProtection = Object.freeze({ isBlockedResource });
  clean(document);
  queueMicrotask(notifyGameDistributionReady);
  document.addEventListener('DOMContentLoaded', () => {
    clean(document);
    notifyGameDistributionReady();
  }, { once: true });
})();
