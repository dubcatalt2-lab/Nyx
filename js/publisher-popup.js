import {publisherHostAllowed,publisherMode,publisherSurface} from './publisher-config.js';
const key='nyx.publisher.popunders.v1',period=300000;
let surface=null,frame=null,multitag=null,scheduled=false,used=new Set();
function reserve(){const now=Date.now();let state;try{state=JSON.parse(localStorage.getItem(key)||'null');}catch{return false;}
 if(state?.version===2){state={version:3,count:state.until>now?2:state.count===1?1:0,until:now+period};}
 if(!state||state.version!==3||!Number.isFinite(state.until)||state.until<=now)state={version:3,count:0,until:now+period};
 if(!Number.isInteger(state.count)||state.count<0||state.count>=2)return false;
 state.count++;try{localStorage.setItem(key,JSON.stringify(state));return true;}catch{return false;}}
function update(){scheduled=false;const next=publisherMode()==='standard'?publisherSurface():null;if(next===surface)return;frame?.remove();multitag?.remove();frame=null;multitag=null;used.clear();surface=next;if(!surface)return;
 const create=multi=>{const item=document.createElement('iframe');item.title=multi?'Sponsored MultiTag offers':'Sponsored offers';item.setAttribute('data-n7x-owned-overlay','');item.sandbox='allow-scripts';item.src='/apps/sponsor/offers.html'+(multi?'?multitag=1':'');item.style.cssText='display:block;width:min(300px,40%);height:180px;border:0;border-radius:12px;position:absolute;'+(multi?'left':'right')+':100px;bottom:16px;z-index:2;background:#101014';surface.append(item);return item;};frame=create(false);multitag=create(true);}
function schedule(){if(!scheduled){scheduled=true;queueMicrotask(update);}}
addEventListener('message',event=>{const data=event.data;const source=[frame,multitag].find(item=>item&&event.source===item.contentWindow);const multi=source===multitag;const gesture=(multi?'multi:':'pair:')+data?.gesture;if(!source||data?.type!=='nyx:offer-open'||publisherMode()!=='standard'||publisherSurface()!==surface||!navigator.userActivation?.isActive||!Number.isSafeInteger(data.gesture)||used.has(gesture))return;
 let url;try{url=new URL(data.url);if(!['https:','http:'].includes(url.protocol))return;}catch{return;}
 used.add(gesture);const open=()=>{if(source!==(multi?multitag:frame)||publisherMode()!=='standard'||publisherSurface()!==surface||!navigator.userActivation?.isActive||(!multi&&!reserve()))return;const openAd=window.__nyxNativeOpen||window.open.bind(window);openAd(url.href,'_blank','noopener,noreferrer');};
 if(navigator.locks)void navigator.locks.request('nyx-ad-popup',open);else open();
});
if(publisherHostAllowed()){const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});addEventListener('nyx:publisher-change',schedule);addEventListener('nyx:publisher-navigation',schedule);document.addEventListener('visibilitychange',schedule);document.addEventListener('fullscreenchange',schedule);addEventListener('pagehide',()=>{frame?.remove();multitag?.remove();observer.disconnect();},{once:true});update();}
