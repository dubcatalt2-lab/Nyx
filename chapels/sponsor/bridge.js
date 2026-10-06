(() => {
  let ready = false;
  const seen = new WeakSet();
  const documents = new WeakSet();
  const observers = [];
  const report = () => {
    if (ready) return;
    ready = true;
    observers.forEach(observer => observer.disconnect());
    clearTimeout(timer);
    parent.postMessage({type: 'nyx:sponsor-ready'}, '*');
  };
  const inspect = doc => {
    if (ready) return;
    for (const creative of doc.querySelectorAll('iframe,img,video')) {
      if (seen.has(creative)) continue;
      seen.add(creative);
      if (creative.tagName === 'IMG') {
        const loaded = () => {if (creative.naturalWidth > 1 && creative.naturalHeight > 1) report();};
        creative.addEventListener('load', loaded, {once: true});
        if (creative.complete) loaded();
      } else if (creative.tagName === 'VIDEO') {
        creative.addEventListener('loadeddata', report, {once: true});
      } else {
        const loaded = () => {
          try {
            const child = creative.contentDocument;
            if (child) {watch(child);return;}
          } catch {}
          if (Number(creative.width) > 20 && Number(creative.height) > 20) report();
        };
        creative.addEventListener('load', loaded);
        try {if (creative.contentDocument?.readyState === 'complete') loaded();} catch {}
      }
    }
    if (doc !== document && [...doc.querySelectorAll('a[href]')].some(link => link.textContent.trim())) report();
  };
  function watch(doc) {
    if (!doc.body || documents.has(doc)) return;
    documents.add(doc);
    const observer = new MutationObserver(() => inspect(doc));
    observer.observe(doc.body, {childList: true, subtree: true});
    observers.push(observer);
    inspect(doc);
  }
  const timer = setTimeout(() => {
    if (!ready) {
      observers.forEach(observer => observer.disconnect());
      parent.postMessage({type: 'nyx:sponsor-unavailable'}, '*');
    }
  }, 12000);
  watch(document);
  if (document.body.hasAttribute('data-resize-ad')) {
    const resized = () => parent.postMessage({type:'nyx:sponsor-size',height:document.body.scrollHeight},'*');
    new ResizeObserver(resized).observe(document.body);
  }
})();
