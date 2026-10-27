(() => {
  const root = document.documentElement;
  let parentRoot;
  try {
    if (parent !== window && parent.location.origin === location.origin)
      parentRoot = parent.document.documentElement;
  } catch {}
  function apply() {
    let theme = "default",
      appearance = "dark",
      custom = "";
    try {
      theme = localStorage.getItem("nyx.theme") || theme;
      appearance = localStorage.getItem("nyx.appearance") || appearance;
      custom = localStorage.getItem("nyx.customThemeColor") || "";
    } catch {}
    root.dataset.n7xTheme = parentRoot?.dataset.n7xTheme || theme;
    root.dataset.n7xAppearance = parentRoot?.dataset.n7xAppearance || appearance;
    const inherited = parentRoot?.style.getPropertyValue("--n7x-custom-base");
    if (/^#[0-9a-f]{6}$/i.test((inherited || custom).trim()))
      root.style.setProperty("--n7x-custom-base", (inherited || custom).trim());
  }
  apply();
  window.addEventListener("storage", apply);
  if (parentRoot)
    new MutationObserver(apply).observe(parentRoot, {
      attributes: true,
      attributeFilter: ["data-n7x-theme", "data-n7x-appearance", "style"],
    });
})();

function q73e8() {
  let image = "",
    variant = "";
  try {
    const host =
      window.parent !== window && parent.location.origin === location.origin ? parent : null;
    if (host) {
      document.documentElement.setAttribute('data-nyx-embedded-background', '');
      const root = host.document.documentElement,
        body = host.document.body;
      variant = root.getAttribute("data-n7x-beam-wallpaper") || "";
      image = body.classList.contains("custom-bg-active")
        ? host.getComputedStyle(root).getPropertyValue("--bg-render").trim()
        : host.getComputedStyle(body, "::before").backgroundImage;
      image = image.replace(
        /url\(["']?([^"')]+)["']?\)/g,
        (_m, url) => `url("${new URL(url, host.document.baseURI).href}")`,
      );
    }
    if (!image || image === "none") {
      const custom =
        localStorage.getItem("nyx.customBgData") || localStorage.getItem("nyx.customBgUrl");
      variant = localStorage.getItem("nyx.beamWallpaper") || "obsidian";
      const family = variant.match(/^photo-(leaves|moonlight|rain|halloween)-/)?.[1];
      image = custom
        ? `url(${JSON.stringify(custom)})`
        : family
          ? `url("/assets/backgrounds/${family}.jpg")`
          : "";
    }
    document.documentElement.style.setProperty(
      "--q73e8-wallpaper",
      image || 'url("/assets/backgrounds/@r61db98a407ce!.jpg")',
    );
    document.documentElement.style.setProperty("--q73e8", variant.endsWith("-mono") ? "1" : "0");
  } catch {}
}
q73e8();
addEventListener("storage", q73e8);
addEventListener("focus", q73e8);
try {
  if (parent !== window && parent.location.origin === location.origin) {
    const qo = new MutationObserver(q73e8);
    qo.observe(parent.document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "data-n7x-beam-wallpaper"],
    });
    qo.observe(parent.document.body, { attributes: true, attributeFilter: ["class"] });
    addEventListener("pagehide", () => qo.disconnect(), { once: true });
  }
} catch {}

addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.q73e8 = "";
  if (!document.querySelector(".q48e2") && !location.pathname.includes("/chat/")) {
    const layer = document.createElement("div");
    layer.className = "q73e8";
    layer.setAttribute("aria-hidden", "true");
    document.body.prepend(layer);
  }
});
