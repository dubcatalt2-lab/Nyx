(()=>{let gesture=0,at=0;document.addEventListener('click',event=>{if(event.isTrusted){gesture++;at=Date.now();}},true);
Object.defineProperty(window,'open',{configurable:false,writable:false,value(url){if(!gesture||Date.now()-at>1000||!navigator.userActivation?.isActive)return null;let target;try{target=new URL(String(url),location.href);if(!['https:','http:'].includes(target.protocol))return null;}catch{return null;}parent.postMessage({type:'nyx:offer-open',url:target.href,gesture},'*');return null;}});
})();
