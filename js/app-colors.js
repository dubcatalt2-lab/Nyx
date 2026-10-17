                                                                    
(() => {
  const root = document.documentElement;
  let parentRoot;
  try { if (parent !== window && parent.location.origin === location.origin) parentRoot = parent.document.documentElement; } catch {}
  function apply() {
    let theme = 'default', appearance = 'dark', custom = '';
    try {
      theme = localStorage.getItem('nyx.theme') || theme;
      appearance = localStorage.getItem('nyx.appearance') || appearance;
      custom = localStorage.getItem('nyx.customThemeColor') || '';
    } catch {}
    root.dataset.n7xTheme = parentRoot?.dataset.n7xTheme || theme;
    root.dataset.n7xAppearance = parentRoot?.dataset.n7xAppearance || appearance;
    const inherited = parentRoot?.style.getPropertyValue('--n7x-custom-base');
    if (/^#[0-9a-f]{6}$/i.test((inherited || custom).trim())) root.style.setProperty('--n7x-custom-base', (inherited || custom).trim());
  }
  apply();
  window.addEventListener('storage', apply);
  if (parentRoot) new MutationObserver(apply).observe(parentRoot, {attributes:true, attributeFilter:['data-n7x-theme','data-n7x-appearance','style']});
})();
