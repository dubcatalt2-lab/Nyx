import {enhanceDesktop} from './desktop-controls.js';
const $=id=>document.getElementById(id);
let auth,socket,rfb,frameUrl,lastMove=0,generation=0,desktopControls,reconnectTimer,connectTimer,renewTimer,reconnectAttempts=0;
const notice=text=>{$('notice').textContent=text;};
const retryable=error=>![401,403,404].includes(error.status)&&!['auth/user-disabled','auth/user-token-expired','auth/invalid-user-token'].includes(error.code);
const connectionError=error=>error instanceof TypeError||['TimeoutError','auth/network-request-failed'].includes(error.name)||error.code==='auth/network-request-failed'?'The connection request could not reach the server.':error.message;
let accessTimer,accessVersion=0,initializeTimer;
async function api(path,body,method,refresh=false){
 const token=await auth?.currentUser?.getIdToken(refresh);if(!token)throw Object.assign(Error('Sign in to Nyx with your owner account.'),{status:401});
 const response=await fetch('/api/private-remote'+path,{method:method||(body?'POST':'GET'),headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(response.status===401&&!refresh)return api(path,body,method,true);
 if(!response.ok){const result=await response.json().catch(()=>({}));throw Object.assign(Error(result.error||'Not available.'),{status:response.status});}return response;
}
function renewSession(session,device,version,delay=60000){renewTimer=setTimeout(async()=>{
 if(version!==generation)return;
 try{await api('/renew',{session});}catch(error){if(version===generation){if(error.status===409||!retryable(error))reconnect(device,connectionError(error),retryable(error));else renewSession(session,device,version,5000);}return;}
 if(version===generation)renewSession(session,device,version);
},delay);}
const run=fn=>async event=>{event?.preventDefault();try{await fn(event);}catch(error){notice(error.message);}};
function send(value){if(socket?.readyState===1)socket.send(JSON.stringify(value));}
function disconnect(){clearTimeout(reconnectTimer);clearTimeout(connectTimer);clearTimeout(renewTimer);$('cancelReconnect').hidden=true;generation++;desktopControls?.destroy();desktopControls=null;rfb?.disconnect();rfb=null;send({type:'release'});socket?.close();socket=null;if(frameUrl)URL.revokeObjectURL(frameUrl);frameUrl=null;$('frame').removeAttribute('src');$('frame').hidden=false;$('screen').replaceChildren($('frame'));$('screen').classList.remove('vnc-screen');$('secureAttention').hidden=true;$('session').hidden=true;$('setup').hidden=false;}
async function list(){
 const data=await(await api('/devices')).json();$('devices').replaceChildren();
 if(!data.devices.length){const text=document.createElement('p');text.textContent='No paired computers.';$('devices').append(text);}
 for(const device of data.devices){const row=document.createElement('div');row.className='device';const label=document.createElement('span');label.textContent=device.name;const state=document.createElement('small');state.textContent=device.connected?'In use':device.online?'Online':'Offline';label.append(state);const connect=document.createElement('button');connect.textContent='Connect';connect.disabled=!device.online||device.connected;connect.onclick=run(()=>start(device));const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=run(async()=>{if(!confirm('Remove '+device.name+' and revoke its remote access?'))return;await api('/devices/'+device.id,null,'DELETE');await list();});const codeButton=document.createElement('button');codeButton.textContent='Generate new code';codeButton.onclick=run(async()=>{const result=await(await api('/devices/'+device.id+'/code',{})).json();notice('Code: '+result.code.match(/.{1,4}/g).join('-')+' ? valid for 5 minutes, for your owner account only.');});row.append(label,connect);if(!document.documentElement.hasAttribute('data-direct-desktop'))row.append(codeButton,remove);$('devices').append(row);}
}
function reconnect(device,reason,allowed=true){
 disconnect();list().catch(()=>{});
 if(!allowed){notice(reason);return;}
 const attempt=++reconnectAttempts,version=generation,delay=Math.min(30000,3000*2**Math.min(attempt-1,4));
 notice(reason+' Reconnecting in '+delay/1000+' seconds...');$('cancelReconnect').hidden=false;
 reconnectTimer=setTimeout(()=>{if(generation!==version)return;start(device,true).catch(error=>{if(generation===version+2)reconnect(device,error.message,![401,403,404].includes(error.status)&&!['auth/user-disabled','auth/user-token-expired','auth/invalid-user-token'].includes(error.code));});},delay);
}
async function start(device,retry=false){
 if(!retry)reconnectAttempts=0;
 disconnect();const version=++generation;$('cancelReconnect').hidden=false;
 try{
 const RFB=device.mode==='vnc'?(await import('/assets/vendor/novnc/core/rfb.js')).default:null;const releaseCapture=device.mode==='vnc'?(await import('/assets/vendor/novnc/core/util/events.js')).releaseCapture:null;if(version!==generation)return;const {ticket}=await(await api('/connect',{id:device.id})).json();if(version!==generation)return;
 $('session').hidden=false;$('setup').hidden=true;$('computerName').textContent=device.name;$('sessionState').textContent='Connecting…';notice('');
 socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/private-remote/socket');socket.binaryType='blob';const current=socket;let closeCode=1006,failedSecurity=false;
 current.addEventListener('close',event=>{closeCode=event.code;},{capture:true});
 const ended=()=>{if(version!==generation)return;const reasons={4001:'Session authorization needs refreshing.',4003:'Remote access was refused.',4008:'Remote traffic limit reached.',4009:'Computer is already in use.',4010:'Connection could not keep up with the desktop stream.',4011:'The Windows desktop stream ended.',4012:'The Windows bridge disconnected.'};reconnect(device,failedSecurity?'Windows desktop authentication failed.':reasons[closeCode]||'Desktop connection interrupted (code '+closeCode+').',!failedSecurity&&![4003,4009].includes(closeCode));};
 const connected=()=>{clearTimeout(connectTimer);reconnectAttempts=0;$('cancelReconnect').hidden=true;};
 connectTimer=setTimeout(()=>{if(version===generation)reconnect(device,'The desktop connection timed out.');},15000);
 socket.onopen=()=>current.send(JSON.stringify({type:'viewer',ticket}));
 socket.onmessage=event=>{if(version!==generation)return;if(event.data instanceof Blob){connected();const next=URL.createObjectURL(event.data),old=frameUrl;frameUrl=next;$('frame').src=next;if(old)URL.revokeObjectURL(old);$('sessionState').textContent='Connected';}else{const data=JSON.parse(event.data);if(data.type==='ready'&&data.session)renewSession(data.session,device,version);if(data.type==='status')$('sessionState').textContent=data.message;if(data.type==='vnc'&&RFB){$('frame').hidden=true;screen.classList.add('vnc-screen');rfb=new RFB(screen,current,{credentials:{password:data.password}});desktopControls=enhanceDesktop(rfb,screen,releaseCapture);rfb.scaleViewport=true;rfb.qualityLevel=6;rfb.compressionLevel=2;rfb.addEventListener('connect',()=>{if(version!==generation)return;connected();$('sessionState').textContent='Connected · Windows service';$('secureAttention').hidden=false;});rfb.addEventListener('disconnect',()=>setTimeout(ended,0));rfb.addEventListener('securityfailure',()=>{failedSecurity=true;notice('Windows desktop authentication failed.');});}}};
 socket.onclose=ended;
 socket.onerror=()=>{if(version===generation)notice('Connection unavailable. Check that your PC is awake and the helper is running.');};
 }catch(error){if(version===generation)reconnect(device,connectionError(error),retryable(error));}
}
function point(event){const rect=$('frame').getBoundingClientRect();if(!rect.width||!$('frame').naturalWidth)return null;return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};}
const screen=$('screen');
screen.addEventListener('pointerdown',event=>{if(rfb)return;const p=point(event);if(!p)return;event.preventDefault();screen.focus();screen.setPointerCapture(event.pointerId);send({type:'pointer',action:'down',button:event.button,...p});});
screen.addEventListener('pointerup',event=>{if(rfb)return;const p=point(event);if(p)send({type:'pointer',action:'up',button:event.button,...p});});
screen.addEventListener('pointermove',event=>{if(rfb||performance.now()-lastMove<35)return;lastMove=performance.now();const p=point(event);if(p)send({type:'pointer',action:'move',button:0,...p});});
screen.addEventListener('pointercancel',()=>send({type:'release'}));screen.addEventListener('contextmenu',event=>event.preventDefault());
screen.addEventListener('wheel',event=>{if(rfb)return;event.preventDefault();send({type:'wheel',delta:Math.sign(event.deltaY)});},{passive:false});
for(const action of ['keydown','keyup'])screen.addEventListener(action,event=>{if(rfb)return;if(event.key==='Escape'){send({type:'release'});screen.blur();return;}event.preventDefault();send({type:'key',action:action==='keydown'?'down':'up',key:event.keyCode});});
screen.addEventListener('blur',()=>send({type:'release'}));window.addEventListener('blur',()=>send({type:'release'}));window.addEventListener('pagehide',disconnect);
$('refresh').onclick=run(list);$('disconnect').onclick=$('cancelReconnect').onclick=()=>{disconnect();notice('Disconnected.');list().catch(()=>{});};$('fullscreen').onclick=run(async()=>{if(document.fullscreenElement){document.exitPointerLock();await document.exitFullscreen();return;}const lock=desktopControls?.lock();const full=screen.requestFullscreen();await Promise.all([lock,full]);});
$('lockMouse').onclick=run(()=>desktopControls?.lock());
$('secureAttention').onclick=()=>rfb?.sendCtrlAltDel();
$('pair').onsubmit=run(async()=>{await api('/pair/approve',{code:$('code').value});$('code').value='';notice('Computer paired. It should appear online shortly.');await list();});
$('download').onclick=run(async()=>{const blob=await(await api('/host.zip')).blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Nyx-Remote.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
async function initialize(){try{
 const response=await fetch('/api/founder-profile/auth-config',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Account service is temporarily unavailable.');const config=await response.json();if(!config.enabled)throw Error('Account sign-in is unavailable.');
 const [appModule,module]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);
 const app=appModule.getApps().find(item=>item.name==='nyx-founder-owner')||appModule.initializeApp({apiKey:config.apiKey,authDomain:config.projectId+'.firebaseapp.com',projectId:config.projectId},'nyx-founder-owner');
 auth=module.getAuth(app);await module.setPersistence(auth,module.browserLocalPersistence);
 module.onAuthStateChanged(auth,user=>{disconnect();clearTimeout(accessTimer);const version=++accessVersion;$('workspace').hidden=true;$('locked').hidden=false;if(!user){$('accessState').textContent='Sign in to Nyx, then return here.';return;}void openWorkspace(user,version);});
}catch(error){$('accessState').textContent=connectionError(error)+' Retrying…';initializeTimer=setTimeout(initialize,5000);}}
async function openWorkspace(user,version){
 try{await api('/access');if(version!==accessVersion||auth.currentUser!==user)return;await list();if(version!==accessVersion||auth.currentUser!==user)return;$('locked').hidden=true;$('workspace').hidden=false;}
 catch(error){if(version!==accessVersion||auth.currentUser!==user)return;const again=retryable(error);$('accessState').textContent=again?'Connection unavailable. Retrying…':'This workspace is not available to your account.';if(again)accessTimer=setTimeout(()=>openWorkspace(user,version),5000);}
}
window.addEventListener('pagehide',()=>{accessVersion++;clearTimeout(accessTimer);clearTimeout(initializeTimer);});
void initialize();
