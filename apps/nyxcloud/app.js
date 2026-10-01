import RFB from '/assets/vendor/novnc/core/rfb.js';
const $=id=>document.getElementById(id);
let auth,rfb,socket,timer,generation=0,attempt=0,wanted=false;
const status=text=>{$('status').textContent=text;};
async function api(path,method='GET'){
  const token=await auth?.currentUser?.getIdToken();if(!token)throw Object.assign(Error('Sign in to Nyx with your owner account.'),{status:401});
  const response=await fetch('/api/nyxcloud'+path,{method,headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(12000)});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(data.error||'Not available.'),{status:response.status});return data;
}
function stop(){generation++;clearTimeout(timer);rfb?.disconnect();rfb=null;socket?.close();socket=null;$('screen').replaceChildren();$('fullscreen').disabled=true;$('disconnect').disabled=true;}
function retry(error){stop();if([401,403,404].includes(error.status)){wanted=false;status('Sign in to Nyx again to reconnect.');return;}if(!wanted)return;const delay=Math.min(30000,2000*2**Math.min(attempt++,4));status(error.message+' Retrying in '+delay/1000+' seconds…');timer=setTimeout(connect,delay);$('disconnect').disabled=false;}
async function connect(){
  stop();wanted=true;const version=generation;$('connect').disabled=true;status('Connecting…');
  try{
    await api('/session','POST');const {ticket}=await api('/connect','POST');if(version!==generation)return;
    socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/nyxcloud/socket');const ws=socket;ws.binaryType='arraybuffer';
    const failed=message=>{if(version===generation)retry({message,status:ws.code===4003?403:503});};
    timer=setTimeout(()=>failed('The VM connection timed out.'),15000);
    ws.onopen=()=>ws.send(JSON.stringify({ticket}));
    ws.onmessage=event=>{if(version!==generation||typeof event.data!=='string')return;let data;try{data=JSON.parse(event.data);}catch{return;}if(!data.ready)return;
      rfb=new RFB($('screen'),ws,{credentials:{password:data.password}});rfb.scaleViewport=true;rfb.resizeSession=false;rfb.qualityLevel=9;rfb.compressionLevel=2;
      rfb.addEventListener('connect',()=>{if(version!==generation)return;clearTimeout(timer);attempt=0;status('Connected');$('fullscreen').disabled=false;$('disconnect').disabled=false;});
      rfb.addEventListener('securityfailure',()=>{wanted=false;stop();status('VM authentication failed.');$('connect').disabled=false;});
    };
    ws.addEventListener('close',event=>{if(version!==generation)return;retry({message:'VM connection ended.',status:event.code===4003?403:503});});
    ws.onerror=()=>{};
  }catch(error){if(version===generation)retry(error);}finally{if(version===generation)$('connect').disabled=false;}
}
$('connect').onclick=()=>{attempt=0;connect();};
$('disconnect').onclick=()=>{wanted=false;stop();status('Disconnected.');$('connect').disabled=false;};
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
