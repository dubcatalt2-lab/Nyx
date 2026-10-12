import {partition} from './partition.mjs';
const form=document.querySelector('form'),input=document.querySelector('input'),frame=document.querySelector('iframe'),status=document.querySelector('output');
const configuration=fetch('/api/config',{credentials:'same-origin'}).then(response=>{if(!response.ok)throw new Error('Document setup unavailable');return response.json()});
let parentOrigin='',currentOrigin='',started=false;
try{parentOrigin=new URL(document.referrer).origin;}catch{}
function target(){try{const url=new URL(decodeURIComponent(location.hash.slice(1)));if(['http:','https:'].includes(url.protocol))input.value=url.href;}catch{}}
function ready(){target();if(parent!==window&&parentOrigin)parent.postMessage({type:'document-ready'},parentOrigin);}
async function navigate(value){
  try{
    const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw new Error('Unsupported address');
    const {suffix}=await configuration,next=new URL(location.origin);next.hostname=partition(url.origin,suffix);
    currentOrigin=next.origin;frame.src=next.origin+'/content/page/'+encodeURIComponent(url.href);
  }catch(error){if(parent!==window&&parentOrigin)parent.postMessage({type:'document-error',message:error.message},parentOrigin);else status.textContent=error.message;}
}
form.addEventListener('submit',event=>{event.preventDefault();if(event.isTrusted)void navigate(input.value);});
if(parent!==window){form.remove();status.remove();}
addEventListener('hashchange',()=>{started=false;ready();});
addEventListener('message',async event=>{
  if(event.source===frame.contentWindow&&event.origin===currentOrigin&&event.data?.type==='document-link-menu'){
    try{const url=new URL(event.data.url);if(!['http:','https:'].includes(url.protocol))return;
      const bounds=frame.getBoundingClientRect();
      if(parent!==window&&parentOrigin)parent.postMessage({type:'document-link-menu',url:url.href,x:bounds.left+Number(event.data.x||0),y:bounds.top+Number(event.data.y||0)},parentOrigin);
    }catch{}
    return;
  }
  if(event.source===frame.contentWindow&&event.data?.type==='document-navigation'){
    try{const target=new URL(event.data.url),{suffix}=await configuration;if(new URL(event.origin).hostname!==partition(target.origin,suffix))return;currentOrigin=event.origin;input.value=target.href;if(parent!==window&&parentOrigin)parent.postMessage({type:'document-navigation',url:target.href,title:String(event.data.title||'').slice(0,512)},parentOrigin);}catch{}
    return;
  }
  if(parent===window||event.source!==parent||event.origin!==parentOrigin)return;
  if(event.data?.type==='document-prepare'){started=false;ready();}
  if(event.data?.type==='document-start'&&!started&&event.data.url===input.value&&Number.isFinite(event.data.readyAt)&&event.data.readyAt>0){started=true;void navigate(input.value);}
  if(event.data?.type==='document-control'&&currentOrigin)frame.contentWindow.postMessage({type:'document-history',action:event.data.action},currentOrigin);
});
ready();
