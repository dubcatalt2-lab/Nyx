import {publisherAccountMode,publisherSurface,publisherHostAllowed} from './publisher-config.js';
import {createPublisherFrame} from './publisher-frame.js';

export function startPlacements(kind){
  if(!publisherHostAllowed())return;
  let parentWindow=null;try{if(parent!==window&&parent.location.origin===location.origin)parentWindow=parent;}catch{}
  let current=null,slots=[],scheduled=false;
  const style=document.createElement('style');
  style.textContent='.n7x-custom-sponsor{box-sizing:border-box;margin:12px auto;max-width:100%;text-align:center;font:10px system-ui;color:#aaa}.n7x-custom-sponsor iframe{display:block;border:0;max-width:100%;margin:auto}.n7x-custom-sponsor[data-placement="social"]{position:absolute;bottom:12px;right:100px;width:320px;height:280px;z-index:3}.n7x-custom-sponsor[data-placement="banner"] iframe{width:468px;height:60px}@media(max-width:500px){.n7x-custom-sponsor[data-placement="social"]{right:8px;width:min(320px,90vw)}.n7x-custom-sponsor[data-placement="banner"]{overflow:auto}}';
  document.head.append(style);
  function clear(){for(const s of slots){s.frame.destroy();s.host.remove();}slots=[];}
  function update(){
    scheduled=false;
    const account=parentWindow?.__nyxPublisherAccount||window.__nyxPublisherAccount;
    const eligible=publisherAccountMode(account)==='standard'&&!document.hidden&&!document.fullscreenElement;
    let surface=null;
    if(eligible&&kind==='home')surface=publisherSurface();
    if(eligible&&kind==='games'&&(!window.frameElement||window.frameElement.getClientRects().length)&&!document.querySelector('[role="dialog"][aria-modal="true"]:not([hidden])'))surface=document.querySelector('main.library');
    if(surface===current)return;
    clear();current=surface;if(!surface)return;
    for(const name of kind==='home'?['social']:['banner','native']){
      const host=document.createElement('aside');host.className='n7x-custom-sponsor';host.dataset.placement=name;host.setAttribute('aria-label','Advertisement');
      const label=document.createElement('div');label.textContent='Ad';host.append(label);
      const frame=createPublisherFrame({path:'/apps/sponsor/'+name+'.html',width:name==='social'?320:468,height:name==='banner'?60:name==='social'?260:120,dynamicHeight:name==='native',onReady:()=>{host.dataset.ready='true';},onUnavailable:()=>host.remove()});
      host.append(frame.element);slots.push({host,frame});
      if(kind==='games')surface.querySelector('header')?.after(host);else surface.append(host);
    }
  }
  function schedule(){if(!scheduled){scheduled=true;queueMicrotask(update);}}
  const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
  let parentObserver;if(parentWindow){parentObserver=new MutationObserver(schedule);parentObserver.observe(parentWindow.document.body,{subtree:true,attributes:true,attributeFilter:['class','hidden','style']});parentWindow.addEventListener('nyx:publisher-change',schedule);}
  addEventListener('nyx:publisher-change',schedule);addEventListener('resize',schedule);document.addEventListener('visibilitychange',schedule);document.addEventListener('fullscreenchange',schedule);
  addEventListener('pagehide',()=>{clear();observer.disconnect();parentObserver?.disconnect();parentWindow?.removeEventListener('nyx:publisher-change',schedule);},{once:true});
  update();
}
