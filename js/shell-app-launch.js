(() => {
  document.addEventListener('click', (event) => {
    const tile = event.target.closest('[data-app-url]');
    if (!tile) return;
    const address = tile.getAttribute('data-app-url');
    if (!address) return;
    event.preventDefault();
    parent.postMessage({ type: 'nyx:navigate', url: address }, '*');
  });
})();
