const key='nyx.publisher.popunders.v1',period=300000;
function reserve(){const now=Date.now();let state;try{state=JSON.parse(localStorage.getItem(key)||'null');}catch{return false;}
 if(state?.version===2){state={version:3,count:state.until>now?2:state.count===1?1:0,until:now+period};}
 if(!state||state.version!==3||!Number.isFinite(state.until)||state.until<=now)state={version:3,count:0,until:now+period};
 if(!Number.isInteger(state.count)||state.count<0||state.count>=2)return false;
 state.count++;try{localStorage.setItem(key,JSON.stringify(state));return true;}catch{return false;}}

export function requestPublisherOpen(address,valid,openings=1){
 const open=()=>{if(!valid()||!navigator.userActivation?.isActive)return;const total=openings===2?2:1;for(let i=0;i<total;i++){if(!valid()||!reserve())break;(window.__nyxNativeOpen||window.open.bind(window))(address,'_blank','noopener,noreferrer');}};
 if(navigator.locks)void navigator.locks.request('nyx-ad-popup',open);else open();
}
