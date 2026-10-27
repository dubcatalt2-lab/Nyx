import {publisherAccountMode} from '/js/publisher-config.js';

const start=document.getElementById('start'),stopButton=document.getElementById('stop'),status=document.getElementById('status');
let host=window;try{if(parent!==window&&parent.location.origin===location.origin)host=parent;}catch{}
let active=false,slots=[],generation=0,startedOnce=false;
function visible(){try{return !document.hidden&&(!frameElement||frameElement.getClientRects().length>0);}catch{return false;}}
function eligible(){return publisherAccountMode(host.__nyxPublisherAccount)==='standard'&&visible();}
let popup=null;
function closePopup(){popup?.remove();popup=null;}
function stop(){closePopup();active=false;generation++;for(const slot of slots)slot.destroy();slots=[];for(const id of ['banner','multitag','native']){const box=document.getElementById(id);box.replaceChildren();const note=document.createElement('p');note.textContent='Session stopped';box.append(note);}stopButton.disabled=true;sync();}
function sync(){if(!startedOnce&&eligible()){startedOnce=true;queueMicrotask(()=>start.click());}const mode=publisherAccountMode(host.__nyxPublisherAccount);if(active&&!eligible()){stop();return;}start.disabled=active||!eligible();status.textContent=active?'Ads are on. Stop all ends this session.':mode==='off'?'Ads are turned off for your account.':mode==='standard'?'Ads stopped. Show ads starts them again.':host===window?'Open Ad Haven from the Nyx Apps page.':'Checking your ad settings...';}
start.addEventListener('click',async()=>{
 if(!eligible()||active)return;active=true;const version=++generation;stopButton.disabled=false;sync();
 for(const [name,width,height] of [['banner',468,60],['multitag',468,420],['native',468,120]]){
  const box=document.getElementById(name);box.replaceChildren();const element=document.createElement('iframe');element.title='Advertisement';element.width=width;element.height=height;element.sandbox='allow-scripts';element.src='/apps/ad-haven/'+name+'.html';box.append(element);slots.push({destroy:()=>element.remove()});
 }

});
stopButton.addEventListener('click',stop);host.addEventListener('nyx:publisher-change',sync);document.addEventListener('visibilitychange',sync);
const observer=new MutationObserver(sync);if(host!==window)observer.observe(host.document.body,{subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
addEventListener('pagehide',()=>{stop();observer.disconnect();host.removeEventListener('nyx:publisher-change',sync);},{once:true});sync();

addEventListener('message',event=>{
 if(!active||!eligible()||event.data?.type!=='haven:open')return;
 if(![...document.querySelectorAll('.slot iframe')].some(frame=>frame.contentWindow===event.source))return;
 let url;try{url=new URL(event.data.url);}catch{return;}
 if(!['https:','http:'].includes(url.protocol))return;
 closePopup();popup=document.createElement('section');popup.className='ad-popup';popup.style.top=Math.min(innerHeight-120,Math.max(12,document.querySelector('.controls').getBoundingClientRect().bottom+12))+'px';popup.setAttribute('aria-label','Ad popup');
 const close=document.createElement('button');close.textContent='\u00d7 Close ad';close.setAttribute('aria-label','Close ad popup');close.onclick=closePopup;
 const frame=document.createElement('iframe');frame.title='Ad popup';frame.sandbox='allow-scripts allow-forms';frame.src=url.href;
 popup.append(close,frame);document.body.append(popup);
});
