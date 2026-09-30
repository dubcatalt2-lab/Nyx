import {enhanceDesktop} from './desktop-controls.js';
const $=id=>document.getElementById(id);
let auth,socket,rfb,frameUrl,lastMove=0,generation=0,desktopControls;
const notice=text=>{$('notice').textContent=text;};
async function api(path,body,method){
 const token=await auth?.currentUser?.getIdToken();if(!token)throw Error('Sign in to Nyx with your owner account.');
 const response=await fetch('/api/private-remote'+path,{method:method||(body?'POST':'GET'),headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.error||'Not available.');}return response;
}
const run=fn=>async event=>{event?.preventDefault();try{await fn(event);}catch(error){notice(error.message);}};
function send(value){if(socket?.readyState===1)socket.send(JSON.stringify(value));}
function disconnect(){generation++;desktopControls?.destroy();desktopControls=null;rfb?.disconnect();rfb=null;send({type:'release'});socket?.close();socket=null;if(frameUrl)URL.revokeObjectURL(frameUrl);frameUrl=null;$('frame').removeAttribute('src');$('frame').hidden=false;$('screen').replaceChildren($('frame'));$('screen').classList.remove('vnc-screen');$('secureAttention').hidden=true;$('session').hidden=true;$('setup').hidden=false;}
async function list(){
 const data=await(await api('/devices')).json();$('devices').replaceChildren();
 if(!data.devices.length){const text=document.createElement('p');text.textContent='No paired computers.';$('devices').append(text);}
 for(const device of data.devices){const row=document.createElement('div');row.className='device';const label=document.createElement('span');label.textContent=device.name;const state=document.createElement('small');state.textContent=device.connected?'In use':device.online?'Online':'Offline';label.append(state);const connect=document.createElement('button');connect.textContent='Connect';connect.disabled=!device.online||device.connected;connect.onclick=run(()=>start(device));const remove=document.createElement('button');remove.textContent='Remove';remove.onclick=run(async()=>{if(!confirm('Remove '+device.name+' and revoke its remote access?'))return;await api('/devices/'+device.id,null,'DELETE');await list();});const codeButton=document.createElement('button');codeButton.textContent='Generate new code';codeButton.onclick=run(async()=>{const result=await(await api('/devices/'+device.id+'/code',{})).json();notice('Code: '+result.code.match(/.{1,4}/g).join('-')+' ? valid for 5 minutes, for your owner account only.');});row.append(label,connect,codeButton,remove);$('devices').append(row);}
}
async function start(device){
 disconnect();const version=++generation;const RFB=device.mode==='vnc'?(await import('/assets/vendor/novnc/core/rfb.js')).default:null;const releaseCapture=device.mode==='vnc'?(await import('/assets/vendor/novnc/core/util/events.js')).releaseCapture:null;const {ticket}=await(await api('/connect',{id:device.id})).json();if(version!==generation)return;
 $('session').hidden=false;$('setup').hidden=true;$('computerName').textContent=device.name;$('sessionState').textContent='Connecting…';notice('');
 socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/private-remote/socket');socket.binaryType='blob';const current=socket;
 socket.onopen=()=>current.send(JSON.stringify({type:'viewer',ticket}));
 socket.onmessage=event=>{if(version!==generation)return;if(event.data instanceof Blob){const next=URL.createObjectURL(event.data),old=frameUrl;frameUrl=next;$('frame').src=next;if(old)URL.revokeObjectURL(old);$('sessionState').textContent='Connected';}else{const data=JSON.parse(event.data);if(data.type==='status')$('sessionState').textContent=data.message;if(data.type==='vnc'&&RFB){$('frame').hidden=true;screen.classList.add('vnc-screen');rfb=new RFB(screen,current,{credentials:{password:data.password}});desktopControls=enhanceDesktop(rfb,screen,releaseCapture);rfb.scaleViewport=true;rfb.qualityLevel=6;rfb.compressionLevel=2;rfb.addEventListener('connect',()=>{$('sessionState').textContent='Connected · Windows service';$('secureAttention').hidden=false;});rfb.addEventListener('disconnect',()=>{if(version!==generation)return;disconnect();notice('Desktop disconnected. Refresh to reconnect.');list().catch(()=>{});});rfb.addEventListener('securityfailure',()=>notice('Windows desktop authentication failed.'));}}};
 socket.onclose=()=>{if(version!==generation)return;disconnect();notice('Disconnected. Refresh your computers to reconnect.');list().catch(()=>{});};
 socket.onerror=()=>{if(version===generation)notice('Connection unavailable. Check that your PC is awake and the helper is running.');};
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
$('refresh').onclick=run(list);$('disconnect').onclick=()=>{disconnect();list().catch(()=>{});};$('fullscreen').onclick=run(async()=>{if(document.fullscreenElement){document.exitPointerLock();await document.exitFullscreen();return;}const lock=desktopControls?.lock();const full=screen.requestFullscreen();await Promise.all([lock,full]);});
$('lockMouse').onclick=run(()=>desktopControls?.lock());
$('secureAttention').onclick=()=>rfb?.sendCtrlAltDel();
$('pair').onsubmit=run(async()=>{await api('/pair/approve',{code:$('code').value});$('code').value='';notice('Computer paired. It should appear online shortly.');await list();});
$('download').onclick=run(async()=>{const blob=await(await api('/host.zip')).blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Nyx-Remote.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
async function initialize(){try{
 const config=await(await fetch('/api/founder-profile/auth-config')).json();if(!config.enabled)throw Error('Account sign-in is unavailable.');
 const [appModule,module]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);
 const app=appModule.getApps().find(item=>item.name==='nyx-founder-owner')||appModule.initializeApp({apiKey:config.apiKey,authDomain:config.projectId+'.firebaseapp.com',projectId:config.projectId},'nyx-founder-owner');
 auth=module.getAuth(app);await module.setPersistence(auth,module.browserLocalPersistence);
 module.onAuthStateChanged(auth,async user=>{disconnect();$('workspace').hidden=true;$('locked').hidden=false;if(!user){$('accessState').textContent='Sign in to Nyx, then return here.';return;}try{await api('/access');$('locked').hidden=true;$('workspace').hidden=false;await list();}catch{$('accessState').textContent='This workspace is not available to your account.';}});
}catch(error){$('accessState').textContent=error.message;}}
void initialize();
