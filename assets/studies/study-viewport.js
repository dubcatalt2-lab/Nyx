(() => {
  if (window.__nyxGameViewport) return;
  window.__nyxGameViewport = true;
  const style = document.createElement("style");
  style.textContent =
    "html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#05070d}canvas,object,embed,ruffle-player,ruffle-object{max-width:100%;max-height:100%}[data-game-fill-parent]{position:relative!important;inset:auto!important;transform:none!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;box-sizing:border-box!important}[data-game-fill-surface]{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;transform:none!important;border:0!important;object-fit:contain}";
  (document.head || document.documentElement).append(style);
  let queued = false;
  function fit() {
    queued = false;
    let changed = false;
    const surfaces = [
      ...document.querySelectorAll("canvas,object,embed,ruffle-player,ruffle-object,iframe"),
    ]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.width >= 256 && rect.height >= 144 && getComputedStyle(node).visibility !== "hidden"
        );
      })
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    const primary = surfaces[0];
    if (primary && !primary.hasAttribute("data-game-fill-surface")) {
      primary.setAttribute("data-game-fill-surface", "");
      for (
        let node = primary.parentElement;
        node && node !== document.body;
        node = node.parentElement
      )
        node.setAttribute("data-game-fill-parent", "");
      changed = true;
    }
    for (const surface of document.querySelectorAll(
      "canvas,object,embed,ruffle-player,ruffle-object",
    )) {
      const parents = [];
      for (
        let node = surface.parentElement;
        node && node !== document.body;
        node = node.parentElement
      )
        parents.unshift(node);
      for (const node of parents) {
        if (getComputedStyle(node).display === "none") break;
        const rect = node.getBoundingClientRect();
        if (rect.height < 1 && node.style.height !== "100%") {
          node.style.height = "100%";
          changed = true;
        }
        if (rect.width < 1 && node.style.width !== "100%") {
          node.style.width = "100%";
          changed = true;
        }
      }
    }
    if (changed) window.dispatchEvent(new Event("resize"));
  }
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(fit);
    }
  };
  new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("DOMContentLoaded", queue);
  addEventListener("resize", queue);
  addEventListener("load", queue);
})();
