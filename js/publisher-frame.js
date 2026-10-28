import {requestPublisherOpen} from './publisher-open.js';
import {publisherDocumentUrl,publisherAccountMode} from './publisher-config.js';
export function createPublisherFrame({
  path,
  width,
  height,
  onReady,
  onUnavailable,
  dynamicHeight = false,
  onClick,
}) {
  const element = document.createElement("iframe");
  element.title = "Advertisement";
  element.width = width;
  element.height = height;
  element.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin",
  );
  element.dataset.nyxSponsorPath = path;
  element.referrerPolicy = "strict-origin-when-cross-origin";
  element.style.visibility = "hidden";
  element.src = "data:text/html;charset=utf-8,";
  let finished = false;const clicked=new Set();
  function clickAllowed(){let account=window.__nyxPublisherAccount;try{if(parent!==window&&parent.location.origin===location.origin)account=parent.__nyxPublisherAccount||account;}catch{}return publisherAccountMode(account)==='standard'&&!document.hidden&&element.isConnected&&element.getClientRects().length>0&&getComputedStyle(element).visibility==='visible'&&document.activeElement===element&&(!window.frameElement||window.frameElement.getClientRects().length>0);}
  const timer = setTimeout(unavailable, 18000);
  function cleanup(keepMessages = false) {
    clearTimeout(timer);
    if (!keepMessages) window.removeEventListener("message", receive);
    element.removeEventListener("error", unavailable);
  }
  function unavailable() {
    if (finished) return;
    finished = true;
    cleanup();
    element.remove();
    onUnavailable?.();
  }
  function receive(event) {
    if (event.source !== element.contentWindow) return;
    if(event.data?.type==='nyx:sponsor-click'){
      if(!clickAllowed()||!navigator.userActivation?.isActive||!Number.isSafeInteger(event.data.gesture)||clicked.has(event.data.gesture))return;
      let address;try{address=new URL(event.data.url);if(!['https:','http:'].includes(address.protocol)||address.username||address.password||address.origin===new URL(element.src).origin||address.origin===location.origin)return;}catch{return;}
      clicked.add(event.data.gesture);if(onClick)onClick(address.href);else requestPublisherOpen(address.href,clickAllowed);return;
    }
    if (
      dynamicHeight &&
      event.data?.type === "nyx:sponsor-size" &&
      Number.isFinite(event.data.height)
    ) {
      element.style.height = Math.max(120, Math.min(1200, Math.ceil(event.data.height))) + "px";
      return;
    }
    if (finished) return;
    if (event.data?.type === "nyx:sponsor-unavailable") return unavailable();
    if (event.data?.type !== "nyx:sponsor-ready") return;
    finished = true;
    cleanup(true);
    element.style.visibility = "visible";
    onReady?.();
  }
  void (async () => {
    try {
      const url = new URL(path, location.href);
      if (
        url.origin !== location.origin ||
        ![
          "/apps/sponsor/banner.html",
          "/apps/sponsor/side.html",
          "/apps/sponsor/native.html",
          "/apps/sponsor/social.html",
          "/apps/sponsor/offers.html",
        ].includes(url.pathname)
      )
        throw new Error("Unknown placement");
      if (finished) return;
      // A real document origin is required by the provider's cookie/storage APIs.
      // Its separate origin prevents provider code from reaching Nyx controls.
      element.src = publisherDocumentUrl(url.pathname+url.search);
    } catch {
      if (!finished) unavailable();
    }
  })();
  window.addEventListener("message", receive);
  element.addEventListener("error", unavailable);
  return {
    element,
    destroy() {
      finished = true;
      cleanup();
      element.remove();
    },
  };
}
