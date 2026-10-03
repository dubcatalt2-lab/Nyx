import RFB from '/assets/vendor/novnc/core/rfb.js';
import {loremDesktop} from './lorem.js';
const $=id=>document.getElementById(id);
let auth,rfb,socket,timer,renewTimer,generation=0,attempt=0,wanted=false;
let closeLorem;
const status=text=>{$('status').textContent=text;};
async function api(path,method='GET',refresh=false){
  const token=await auth?.currentUser?.getIdToken(refresh);if(!token)throw Object.assign(Error('Sign in to Nyx with your owner account.'),{status:401});
  const response=await fetch('/api/nyxcloud'+path,{method,headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(path.startsWith('/lorem/')?50000:12000)});
  if(response.status===401&&!refresh)return api(path,method,true);
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(data.error||'Not available.'),{status:response.status});return data;
}
function stop(){generation++;closeLorem?.();closeLorem=null;clearTimeout(timer);clearTimeout(renewTimer);rfb?.disconnect();rfb=null;socket?.close();socket=null;$('screen').replaceChildren();$('fullscreen').disabled=true;$('disconnect').disabled=true;}
function renew(version,delay=60000){renewTimer=setTimeout(async()=>{
  if(version!==generation)return;
  try{await api('/session','POST');}catch(error){if(version===generation){if([401,403,404].includes(error.status))retry(error);else renew(version,5000);}return;}
  if(version===generation)renew(version);
},delay);}
function retry(error){stop();if([401,403,404].includes(error.status)){wanted=false;status('Sign in to Nyx again to reconnect.');return;}if(!wanted)return;const delay=Math.min(30000,2000*2**Math.min(attempt++,4));status(error.message+' Retrying in '+delay/1000+' seconds…');timer=setTimeout(connect,delay);$('disconnect').disabled=false;}
async function connect(){
  if(new URLSearchParams(location.search).get('desktop')!=='local'){
    stop();wanted=false;const version=generation;$('connect').disabled=true;
    try{await api('/session','POST');if(version!==generation)return;
      closeLorem=loremDesktop({api,screen:$('screen'),status,reconnect:connect,connected:()=>{$('fullscreen').disabled=false;$('disconnect').disabled=false;}});
      $('disconnect').disabled=false;
    }catch(error){status(error.message);}finally{if(version===generation)$('connect').disabled=false;}
    return;
  }
  stop();wanted=true;const version=generation;$('connect').disabled=true;status('Connecting…');
  try{
    await api('/session','POST');const {ticket}=await api('/connect','POST');if(version!==generation)return;
    socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/nyxcloud/socket');const ws=socket;ws.binaryType='arraybuffer';
    const failed=message=>{if(version===generation)retry({message,status:503});};
    timer=setTimeout(()=>failed('The VM connection timed out.'),15000);
    ws.onopen=()=>ws.send(JSON.stringify({ticket}));
    ws.onmessage=event=>{if(version!==generation||typeof event.data!=='string')return;let data;try{data=JSON.parse(event.data);}catch{return;}if(!data.ready)return;
      rfb=new RFB($('screen'),ws,{credentials:{password:data.password}});rfb.scaleViewport=true;rfb.resizeSession=false;rfb.qualityLevel=9;rfb.compressionLevel=2;
      rfb.addEventListener('connect',()=>{if(version!==generation)return;clearTimeout(timer);attempt=0;renew(version);status('Connected');$('fullscreen').disabled=false;$('disconnect').disabled=false;});
      rfb.addEventListener('disconnect',()=>setTimeout(()=>{if(version===generation)failed('VM connection ended.');},0));
      rfb.addEventListener('securityfailure',()=>{wanted=false;stop();status('VM authentication failed.');$('connect').disabled=false;});
    };
    ws.addEventListener('close',event=>{if(version!==generation)return;retry({message:'VM connection ended.',status:event.code===4003?403:503});});
    ws.onerror=()=>{};
  }catch(error){if(version===generation)retry(error);}finally{if(version===generation)$('connect').disabled=false;}
}
$('connect').onclick=()=>{document.querySelector('.session-menu').open=false;attempt=0;connect();};

$('disconnect').onclick=()=>{
  document.querySelector('.session-menu').open=false;wanted=false;stop();status('Disconnected');$('connect').disabled=false;
  const panel=document.createElement('div');panel.className='vm-loading';panel.innerHTML='<section class="boot-card"><p class="boot-eyebrow">NYXCLOUD</p><h1>Desktop disconnected</h1><p class="boot-message">Your desktop follows its normal inactivity limits.</p><button class="boot-retry">Open desktop</button></section>';
  panel.querySelector('button').onclick=connect;$('screen').append(panel);
};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('screen').requestFullscreen();}catch{status('Fullscreen is unavailable in this browser.');}};
window.addEventListener('pagehide',()=>{wanted=false;stop();});
async function initialize(){try{
  const response=await fetch('/api/founder-profile/auth-config',{cache:'no-store'});if(!response.ok)throw Error('Account service unavailable.');const config=await response.json();
  const [apps,accounts]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);
  const app=apps.getApps().find(item=>item.name==='nyx-founder-owner')||apps.initializeApp({apiKey:config.apiKey,authDomain:config.projectId+'.firebaseapp.com',projectId:config.projectId},'nyx-founder-owner');
  auth=accounts.getAuth(app);await accounts.setPersistence(auth,accounts.browserLocalPersistence);
  accounts.onAuthStateChanged(auth,async user=>{wanted=false;stop();$('connect').disabled=true;if(!user){status('Sign in to Nyx, then reopen NyxCloud from the owner dashboard.');return;}try{await api('/access');$('connect').disabled=false;connect();}catch{status('Not available for this account.');}});
}catch(error){status(error.message);}}
initialize();
