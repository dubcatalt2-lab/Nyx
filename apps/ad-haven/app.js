import {publisherAccountMode} from '/js/publisher-config.js';
import {createPublisherFrame} from '/js/publisher-frame.js';
const start=document.getElementById('start'),stopButton=document.getElementById('stop'),status=document.getElementById('status'),wall=document.getElementById('wall');
let host=window;try{if(parent!==window&&parent.location.origin===location.origin)host=parent;}catch{}
let active=false,manuallyStopped=false,slots=[],disposeTags=null;
const panels=new Set();
function visible(){try{return !document.hidden&&(!frameElement||frameElement.getClientRects().length>0);}catch{return false;}}
function eligible(){return publisherAccountMode(host.__nyxPublisherAccount)==='standard'&&visible();}
function closePanel(panel){panels.delete(panel);panel.remove();}
function showPopup(raw){
 if(!active||!eligible())return null;
 let url;try{url=new URL(String(raw),location.href);}catch{return null;}
 if(!['http:','https:'].includes(url.protocol))return null;
 if(panels.size>=3)closePanel(panels.values().next().value);
 const panel=document.createElement('section');panel.className='ad-popup';panel.setAttribute('aria-label','Ad popup');panel.style.setProperty('--offset',String(panels.size));
 const close=document.createElement('button');close.textContent='\u00d7 Close ad';close.setAttribute('aria-label','Close ad popup');close.onclick=()=>closePanel(panel);
 const frame=document.createElement('iframe');frame.title='Ad popup';frame.sandbox='allow-scripts allow-forms';frame.src=url.href;panel.append(close,frame);wall.append(panel);panels.add(panel);return null;
}
function stop(){active=false;disposeTags?.();disposeTags=null;for(const slot of slots)slot.destroy();slots=[];for(const panel of [...panels])closePanel(panel);wall.replaceChildren();sync();}
function sync(){
 if(active&&!eligible()){stop();return;}
 start.disabled=active||!eligible();stopButton.disabled=!active;
 status.textContent=active?'Ads are on. Stop all clears the page.':publisherAccountMode(host.__nyxPublisherAccount)==='off'?'Ads are turned off.':eligible()?'Ads stopped.':'Open Ad Haven from the Apps page.';
 if(!active&&!manuallyStopped&&eligible())begin();
}
function begin(){
 if(active||!eligible())return;active=true;manuallyStopped=false;wall.replaceChildren();sync();
 const placements=[['banner',468,60],['native',468,240],['side',160,600],['banner',468,60],['native',468,240],['banner',468,60],['side',160,600],['banner',468,60]];
 for(let i=placements.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[placements[i],placements[j]]=[placements[j],placements[i]];}
 for(const [name,width,height] of placements){
  const card=document.createElement('article');card.className='ad-piece';if(name==='side')card.classList.add('ad-piece-tall');else card.classList.add('ad-piece-wide');card.setAttribute('aria-label','Advertisement');
  const slot=createPublisherFrame({path:'/apps/sponsor/'+name+'.html',width,height,dynamicHeight:name==='native',onReady:()=>card.setAttribute('data-ready',''),onUnavailable:()=>card.remove()});card.append(slot.element);wall.append(card);slots.push(slot);
 }
 const mixed=createPublisherFrame({path:'/apps/sponsor/offers.html?haven=1',width:430,height:360});mixed.element.title='Mixed ads';mixed.element.className='ad-mixed';wall.append(mixed.element);slots.push(mixed);
 const seen=new Set();
 const receive=event=>{if(event.source!==mixed.element.contentWindow||event.data?.type!=='nyx:offer-open'||!Number.isSafeInteger(event.data.gesture)||seen.has(event.data.gesture)||!navigator.userActivation?.isActive)return;seen.add(event.data.gesture);showPopup(event.data.url);};
 addEventListener('message',receive);disposeTags=()=>removeEventListener('message',receive);
}
start.addEventListener('click',begin);stopButton.addEventListener('click',()=>{manuallyStopped=true;stop();});host.addEventListener('nyx:publisher-change',sync);document.addEventListener('visibilitychange',sync);
const observer=new MutationObserver(sync);if(host!==window)observer.observe(host.document.body,{subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
addEventListener('pagehide',()=>{manuallyStopped=true;stop();observer.disconnect();host.removeEventListener('nyx:publisher-change',sync);},{once:true});sync();
