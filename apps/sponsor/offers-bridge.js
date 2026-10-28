(() => {
  const action = document.querySelector('[aria-label="Open sponsored offer"]');
  let directAddress = "";
  try {
    const value = new URL(location.href).searchParams.get("r");
    const address = value && new URL(value);
    if (address && ["https:", "http:"].includes(address.protocol) &&
        !address.username && !address.password && address.origin !== location.origin)
      directAddress = address.href;
  } catch {}
  let gesture = 0, at = 0, directInput = false;
  const input = event => {
    if (!event.isTrusted) return;
    if (event.type === "pointerdown" || event.type === "click" && !event.detail || Date.now() - at > 1000) {
      gesture++;
      at = Date.now();
    }
    directInput = Boolean(action && event.composedPath().includes(action));
  };
  for (const type of ["pointerdown", "mousedown", "touchstart", "click"])
    window.addEventListener(type, input, true);

  function request(url) {
    if (!gesture || !navigator.userActivation?.isActive || url == null || !String(url).trim()) return null;
    let target;
    try {
      target = new URL(String(url), location.href);
      if (!["https:", "http:"].includes(target.protocol) || target.origin === location.origin) return null;
    } catch { return null; }
    parent.postMessage({type:"nyx:offer-open", url:target.href, gesture}, "*");
    return null;
  }
  Object.defineProperty(window, "open", {
    configurable: false, writable: false,
    value(url) { return directAddress && directInput ? null : request(url); }
  });
  const ready = () => {
    if (action) action.disabled = false;
    document.dispatchEvent(new Event("nyx:placement-ready"));
  };
  if (directAddress) {
    ready();
    action?.addEventListener("click", event => {
      if (event.isTrusted) request(directAddress);
    });
  }

  const tags = [
    ["12131526", "https://al5sm.com/tag.min.js"],
    ["302534", "https://quge5.com/88/tag.min.js"]
  ];
  if (new URL(location.href).searchParams.has("haven"))
    tags.push(["", "https://bicea.org/14/b0b1c25c4ae7561cc499d10cf1eb88fd"]);
  let loaded = 0, failed = 0;
  for (const [zone, src] of tags) {
    const script = document.createElement("script");
    script.dataset.zone = zone;
    script.dataset.cfasync = "false";
    script.onload = () => { loaded++; ready(); };
    script.onerror = () => {
      if (++failed === tags.length && !loaded && !directAddress)
        parent.postMessage({type:"nyx:sponsor-unavailable"}, "*");
    };
    script.src = src;
    document.head.append(script);
  }
})();
