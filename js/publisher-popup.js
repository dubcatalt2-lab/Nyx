import {publisherHostAllowed,publisherMode,publisherSurface,publisherOfferAddress} from './publisher-config.js';
import {createPublisherFrame} from './publisher-frame.js';
import {requestPublisherOpen} from './publisher-open.js';
let surface=null,frame=null,scheduled=false;const used=new Set();

function update(){
 scheduled=false;const next=publisherMode()==='standard'?publisherSurface():null;if(next===surface)return;
 frame?.destroy();frame=null;surface=next;used.clear();if(!surface)return;
 const path=new URL('/apps/sponsor/offers.html',location.href),address=publisherOfferAddress();
 if(address)path.searchParams.set('r',address);
 const slot=createPublisherFrame({path:path.pathname+path.search,width:320,height:76});frame=slot;
 slot.element.setAttribute('data-n7x-owned-overlay','');slot.element.title='Sponsored offers';
 slot.element.style.cssText+=';position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(320px,max(112px,calc(100% - 160px)));height:76px;border:0;z-index:2;background:transparent';surface.append(slot.element);
}
function schedule(){if(!scheduled){scheduled=true;queueMicrotask(update);}}

document.addEventListener('click',event=>{
 const address=publisherOfferAddress(),home=publisherSurface(),target=event.target;
 if(!address||!event.isTrusted||event.defaultPrevented||event.button!==0||publisherMode()!=='standard'||!home||!(target instanceof Element)||!home.contains(target))return;
 if(target.closest('button,a,input,select,textarea,form,summary,label,video,audio,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[contenteditable]:not([contenteditable="false"])'))return;
 const focused=document.activeElement;
 requestPublisherOpen(address,()=>publisherMode()==='standard'&&publisherSurface()===home&&target.isConnected&&document.activeElement===focused);
});
addEventListener('message',event=>{
 const data=event.data,source=frame?.element;
 if(!source||document.activeElement!==source||event.source!==source.contentWindow||data?.type!=='nyx:offer-open'||publisherMode()!=='standard'||publisherSurface()!==surface||!navigator.userActivation?.isActive||!Number.isSafeInteger(data.gesture)||used.has(data.gesture))return;
 let url;try{url=new URL(data.url);if(!['https:','http:'].includes(url.protocol)||url.origin===location.origin||url.origin===new URL(source.src).origin)return;}catch{return;}
 used.add(data.gesture);
 requestPublisherOpen(url.href,()=>source===frame?.element&&document.activeElement===source&&publisherMode()==='standard'&&publisherSurface()===surface);
});
if(publisherHostAllowed()){
 const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
 addEventListener('nyx:publisher-change',schedule);addEventListener('nyx:publisher-navigation',schedule);document.addEventListener('visibilitychange',schedule);document.addEventListener('fullscreenchange',schedule);
 addEventListener('pagehide',()=>{frame?.destroy();observer.disconnect();},{once:true});update();
}
