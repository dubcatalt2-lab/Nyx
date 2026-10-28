(()=>{let gesture=0,at=0;const input=event=>{if(!event.isTrusted)return;if(event.type==='pointerdown'||event.type==='click'&&!event.detail||Date.now()-at>1000){gesture++;at=Date.now();}};
for(const type of ['pointerdown','mousedown','touchstart','click'])window.addEventListener(type,input,true);
Object.defineProperty(window,'open',{configurable:false,writable:false,value(url){if(!gesture||!navigator.userActivation?.isActive)return null;let target;try{if(url==null||!String(url).trim())return null;target=new URL(String(url),location.href);if(!['https:','http:'].includes(target.protocol)||target.origin===location.origin)return null;}catch{return null;}parent.postMessage({type:'nyx:offer-open',url:target.href,gesture},'*');return null;}});
const tags=[['12131526','https://al5sm.com/tag.min.js'],['302534','https://quge5.com/88/tag.min.js']];
if(new URL(location.href).searchParams.has('haven'))tags.push(['','https://bicea.org/14/b0b1c25c4ae7561cc499d10cf1eb88fd']);
const action=document.querySelector('[aria-label="Open sponsored offer"]');let loaded=0,failed=0;
for(const [zone,src] of tags){const script=document.createElement('script');script.dataset.zone=zone;script.dataset.cfasync='false';script.onload=()=>{loaded++;if(action)action.disabled=false;document.dispatchEvent(new Event('nyx:placement-ready'));};script.onerror=()=>{if(++failed===tags.length&&!loaded)parent.postMessage({type:'nyx:sponsor-unavailable'},'*');};script.src=src;document.head.append(script);}
})();
