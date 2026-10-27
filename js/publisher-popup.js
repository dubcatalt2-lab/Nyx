import {publisherHostAllowed,publisherMode,publisherSurface} from './publisher-config.js';
import {loadPublisherScripts} from './publisher-script-scope.js';
const tags=[{zone:'12131526',src:'https://al5sm.com/tag.min.js'},{zone:'12131528',src:'https://n6wxm.com/vignette.min.js'},{zone:'302534',src:'https://quge5.com/88/tag.min.js'}];
const popunderCooldownMs=120000;
const popunderStorageKey='nyx.publisher.popunders.v1';
let popunderState={version:2,count:0,until:0};
const popupEvents=new WeakSet();
function reservePopunder(event){
 if(!event||popupEvents.has(event))return false;
 const now=Date.now();
 try {
  const saved=JSON.parse(localStorage.getItem(popunderStorageKey)||'null');
  if(saved?.version===2&&[0,1].includes(saved.count)&&Number.isFinite(saved.until))popunderState=saved;
  else if(saved&&Number.isFinite(saved.start)&&Number.isInteger(saved.count))popunderState={version:2,count:saved.count===1?1:0,until:saved.count>=2?saved.start+popunderCooldownMs:0};
 } catch {}
 if(popunderState.until>now)return false;
 popupEvents.add(event);
 popunderState=popunderState.count===1?{version:2,count:0,until:now+popunderCooldownMs}:{version:2,count:1,until:0};
 try {localStorage.setItem(popunderStorageKey,JSON.stringify(popunderState));} catch {}
 return true;
}
if(publisherHostAllowed()){
 let home=null,dispose=null,scheduled=false;
 function update(){
  scheduled=false;const next=publisherMode()==='standard'?publisherSurface():null;if(next===home)return;
  dispose?.();dispose=null;home=next;if(!home)return;const visit=home;
  const cleanups = tags.map(tag => loadPublisherScripts(
    [tag],
    () => publisherMode() === 'standard' && publisherSurface() === visit,
    (event, nodes) =>
      (tag.zone !== '12131526' && [...nodes].some(node => node.contains?.(event.target))) ||
      (!event.target?.closest?.('input,textarea,select,[contenteditable],.n7x-home-sponsor,[aria-label^="Close "]') && visit.contains(event.target)),
    {nonBlocking: tag.zone === '12131526' ? true : tag.zone === '302534' ? 'empty' : false, reservePopup: reservePopunder}
  ));
  dispose=()=>cleanups.forEach(cleanup=>cleanup());
 }
 function schedule(){if(!scheduled){scheduled=true;queueMicrotask(update);}}
 const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
 addEventListener('nyx:publisher-change',schedule);addEventListener('nyx:publisher-navigation',schedule);
 document.addEventListener('visibilitychange',schedule);document.addEventListener('fullscreenchange',schedule);
 addEventListener('pagehide',()=>{dispose?.();observer.disconnect();},{once:true});update();
}
