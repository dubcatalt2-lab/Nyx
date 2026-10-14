export function createPublisherFrame({path, width, height, onReady, onUnavailable, dynamicHeight = false}) {
  const element = document.createElement('iframe');
  element.title = 'Advertisement';
  element.width = width;
  element.height = height;
  element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  element.dataset.nyxSponsorPath = path;
  element.referrerPolicy = 'strict-origin-when-cross-origin';
  element.style.visibility = 'hidden';
  element.src = 'data:text/html;charset=utf-8,';
  const controller = new AbortController();
  let finished = false;
  const timer = setTimeout(unavailable, 18000);
  function cleanup(keepMessages = false) {
    clearTimeout(timer);
    controller.abort();
    if (!keepMessages) window.removeEventListener('message', receive);
    element.removeEventListener('error', unavailable);
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
    if (dynamicHeight && event.data?.type === 'nyx:sponsor-size' && Number.isFinite(event.data.height)) {
      element.style.height = Math.max(120,Math.min(1200,Math.ceil(event.data.height)))+'px';
      return;
    }
    if (finished) return;
    if (event.data?.type === 'nyx:sponsor-unavailable') return unavailable();
    if (event.data?.type !== 'nyx:sponsor-ready') return;
    finished = true;
    cleanup(dynamicHeight);
    element.style.visibility = 'visible';
    onReady?.();
  }
  void (async () => {
    try {
      const url = new URL(path, location.href);
      if (url.origin !== location.origin || !['/apps/sponsor/banner.html','/apps/sponsor/side.html','/apps/sponsor/native.html','/apps/sponsor/social.html'].includes(url.pathname)) throw new Error('Unknown placement');
      const response = await fetch(url, {signal: controller.signal});
      if (!response.ok) throw new Error('Placement unavailable');
      const html = await response.text();
      if (finished) return;
      const base = new URL('.', url).href.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      const documentHtml = html.replace(/<head(?:\s[^>]*)?>/i, match => match + '<base href="' + base + '">');
      element.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(documentHtml);
    } catch { if (!finished) unavailable(); }
  })();
  window.addEventListener('message', receive);
  element.addEventListener('error', unavailable);
  return {element, destroy() {finished = true;cleanup();element.remove();}};
}
