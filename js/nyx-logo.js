(function(){
  'use strict';
  const source='/assets/icons/nyx-cat-moon.svg?v=3';
  const smallSource='/assets/icons/nyx-cat-moon-small.svg?v=3';

  async function themedUrl(){return source}
  async function croppedUrl(){return smallSource}
  async function apply(theme='default',root=document){
    root.documentElement?.style.setProperty('--nyx-themed-logo-url','url("'+source+'")');
    root.body?.style.setProperty('--nyx-themed-logo-url','url("'+source+'")');
    root.querySelectorAll?.('[data-nyx-logo],img[src$="/assets/icons/nyx-monogram.png"],img[src$="/assets/icons/nyx-logo.png"],img[src$="firefly-tab-logo-bold.png"]').forEach(element=>{
      element.dataset.nyxLogo='true';
      if(element.tagName==='IMG') element.src=source;
      if(element.tagName==='LINK'){
        element.href=smallSource;
        element.type='image/svg+xml';
      }
    });
    return source;
  }
  window.NyxLogo={apply,themedUrl,croppedUrl,source,smallSource};
})();
