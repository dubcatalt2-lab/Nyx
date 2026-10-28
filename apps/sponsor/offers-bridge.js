(()=>{let gesture=0,at=0;document.addEventListener('pointerdown',event=>{if(event.isTrusted){gesture++;at=Date.now();}},true);document.addEventListener('click',event=>{if(event.isTrusted&&(!event.detail||Date.now()-at>1000)){gesture++;at=Date.now();}},true);
Object.defineProperty(window,'open',{configurable:false,writable:false,value(url){if(!gesture||Date.now()-at>1000||!navigator.userActivation?.isActive)return null;let target;try{target=new URL(String(url),location.href);if(!['https:','http:'].includes(target.protocol))return null;}catch{return null;}parent.postMessage({type:'nyx:offer-open',url:target.href,gesture},'*');return null;}});
const tags=[['12131526','https://al5sm.com/tag.min.js'],['302534','https://quge5.com/88/tag.min.js']];
if(new URL(location.href).searchParams.has('haven'))tags.push(['','https://bicea.org/14/b0b1c25c4ae7561cc499d10cf1eb88fd']);
for(const [zone,src] of tags){const script=document.createElement('script');script.dataset.zone=zone;script.dataset.cfasync='false';script.src=src;document.head.append(script);}
})();
