(function(){
  'use strict';
  const source='/assets/icons/nyx-monogram.png';
  const smallSource='/assets/icons/nyx-monogram-small.png';
  // Preserve the supplied artwork, without the legacy crescent crop or tint.
  async function themedUrl(){return source}
  async function croppedUrl(){return smallSource}
  async function apply(theme='default',root=document){
    root.documentElement?.style.setProperty('--nyx-themed-logo-url','url("'+source+'")');
    root.body?.style.setProperty('--nyx-themed-logo-url','url("'+source+'")');
    root.querySelectorAll?.('[data-nyx-logo],img[src$="/assets/icons/nyx-monogram.png"],img[src$="/assets/icons/nyx-logo.png"],img[src$="firefly-tab-logo-bold.png"]').forEach(element=>{
      element.dataset.nyxLogo='true';
      if(element.tagName==='IMG') element.src=source;
      if(element.tagName==='LINK') element.href=smallSource;
    });
    return source;
  }
  window.NyxLogo={apply,themedUrl,croppedUrl,source,smallSource};
})();
