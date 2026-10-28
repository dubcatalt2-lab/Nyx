import {publisherHostAllowed,publisherMode,publisherSurface} from './publisher-config.js';
import {createPublisherFrame} from './publisher-frame.js';
const key='nyx.publisher.popunders.v1',period=300000;
let surface=null,frame=null,scheduled=false;const used=new Set();
function reserve(){const now=Date.now();let state;try{state=JSON.parse(localStorage.getItem(key)||'null');}catch{return false;}
 if(state?.version===2){state={version:3,count:state.until>now?2:state.count===1?1:0,until:now+period};}
 if(!state||state.version!==3||!Number.isFinite(state.until)||state.until<=now)state={version:3,count:0,until:now+period};
 if(!Number.isInteger(state.count)||state.count<0||state.count>=2)return false;
 state.count++;try{localStorage.setItem(key,JSON.stringify(state));return true;}catch{return false;}}

function update(){
 scheduled=false;const next=publisherMode()==='standard'?publisherSurface():null;if(next===surface)return;
 frame?.destroy();frame=null;surface=next;used.clear();if(!surface)return;
 const slot=createPublisherFrame({path:'/apps/sponsor/offers.html',width:380,height:220});frame=slot;
 slot.element.setAttribute('data-n7x-owned-overlay','');slot.element.title='Sponsored offers';
 slot.element.style.cssText+=';position:absolute;right:16px;top:76px;width:min(380px,calc(100% - 32px));height:min(220px,28vh);border:0;z-index:2;background:transparent';surface.append(slot.element);
}
function schedule(){if(!scheduled){scheduled=true;queueMicrotask(update);}}
addEventListener('message',event=>{
 const data=event.data,source=frame?.element;
 if(!source||event.source!==source.contentWindow||data?.type!=='nyx:offer-open'||publisherMode()!=='standard'||publisherSurface()!==surface||!navigator.userActivation?.isActive||!Number.isSafeInteger(data.gesture)||used.has(data.gesture))return;
 let url;try{url=new URL(data.url);if(!['https:','http:'].includes(url.protocol))return;}catch{return;}
 used.add(data.gesture);
 const open=()=>{if(source!==frame?.element||publisherMode()!=='standard'||publisherSurface()!==surface||!navigator.userActivation?.isActive||!reserve())return;(window.__nyxNativeOpen||window.open.bind(window))(url.href,'_blank','noopener,noreferrer');};
 if(navigator.locks)void navigator.locks.request('nyx-ad-popup',open);else open();
});
if(publisherHostAllowed()){
 const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
 addEventListener('nyx:publisher-change',schedule);addEventListener('nyx:publisher-navigation',schedule);document.addEventListener('visibilitychange',schedule);document.addEventListener('fullscreenchange',schedule);
 addEventListener('pagehide',()=>{frame?.destroy();observer.disconnect();},{once:true});update();
}
