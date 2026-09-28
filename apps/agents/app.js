import {readResponse} from './response.js';
import {supportsConversationVoice} from './voice-capabilities.js';
import {setupChats} from './chats.js?v=20260928-projects-v1';
import {setupScreen} from './screen.js?v=20260927-chat';
import {setupPicker} from './models.js?v=20260928-voice-v2';
import {setupMedia} from './media.js?v=20260928-voice-v2';
const $=id=>document.getElementById(id);
$('model').addEventListener('change',()=>media.stopVoice());
const iconPaths={account:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',code:'m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18',chat:'M4 4h16v12H9l-5 4z',sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',moon:'M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11z',compose:'M9 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5 M16 3a2 2 0 0 1 3 3l-9 9-4 1 1-4z',pin:'M8 3h8l-1 6 4 4v2H5v-2l4-4z M12 15v6',folder:'M3 7V5h6l2 2h10v13H3z',file:'M6 3h8l4 4v14H6z M14 3v5h5',refresh:'M20 11a8 8 0 1 0-2.35 5.65 M20 4v7h-7',plus:'M12 5v14 M5 12h14',send:'m21 3-8.5 18-3.2-7.3L2 10.5 21 3z M9.3 13.7l4.2-4.2',stop:'M6 6h12v12H6z',close:'m6 6 12 12 M18 6 6 18',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',connect:'M8 3v5 M16 3v5 M5 8h14v3a7 7 0 0 1-14 0z M12 18v3',download:'m3 7 9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M7 5l9 4',spark:'m12 3 2 6 6 3-6 2-2 6-2-6-6-2 6-3z'};
function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+iconPaths[name]+'"></path></svg>';}
for(const [id,name,label] of [['refresh','refresh',''],['newTask','compose','New chat'],['send','send',''],['stop','stop','Stop'],['closeLogin','close',''],['connect','connect','Connect folder'],['activityTab','spark','Activity'],['fileTab','file','Preview']]){const button=$(id);button.innerHTML=icon(name);if(label)button.append(document.createTextNode(label));}
function updateTheme(){const light=document.documentElement.dataset.theme==='light';$('themeToggle').innerHTML=icon(light?'moon':'sun')+(light?'Dark mode':'Light mode');$('themeToggle').setAttribute('aria-label',light?'Use dark mode':'Use light mode');}
$('themeToggle').onclick=()=>{const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('nook.theme',theme);}catch{}updateTheme();};updateTheme();
const download=document.querySelector('.aside-bottom a');download.innerHTML=icon('download')+'Download companion';
const welcomeTemplate=document.getElementById('welcome').cloneNode(true);
const picker=setupPicker($('model'));
const media=setupMedia({notice,sizePrompt,canSend:()=>!running&&(chatMode||connected)&&!!auth?.currentUser&&!!$('model').value,voiceModel:()=>{if(!chatMode){notice('Switch to Chat for model voice conversations.');return false;}if(!supportsConversationVoice(models.find(item=>item.id===$('model').value))){picker.openVoice();notice('Choose a model with native voice output.');return false;}return true;}});
const screen=setupScreen({notice});
const chats=setupChats({notice,busy:()=>running,changed:renderRecentSuggestions,open:item=>{
 media.reset();screen.stop();history=item.messages||[];
 if(typeof item.computer==='boolean'&&chatMode===item.computer)changeMode(!item.computer,false);
 if(item.model&&[...$('model').options].some(option=>option.value===item.model)){$('model').value=item.model;$('model').dispatchEvent(new Event('change'));}
 $('effort').value=['low','medium','high'].includes(item.effort)?item.effort:'medium';$('effort').dispatchEvent(new Event('change'));
 $('feed').replaceChildren();if(!history.length)renderWelcome();for(const entry of history){let text=entry.content;if(!chatMode&&entry.role==='assistant')try{text=JSON.parse(text).message||text;}catch{}message(entry.role,text,entry.model,entry.metadata,entry);}
 $('taskTitle').textContent=item.temporary?'Temporary chat':item.title||'New chat';$('prompt').value='';sizePrompt();sync();
}});
let welcomeName='',greetingIndex=0;
let capturing=false;
let chatMode=true;
let auth,authModule,connected=false,running=false,controller=null,models=[],history=[],currentPath='';
const pairing=new URLSearchParams(location.hash.slice(1));
if(/^[a-f0-9]{64}$/.test(pairing.get('companion')||'')&&pairing.get('port')==='6768')sessionStorage.setItem('nyx.agents.pair',pairing.get('companion'));
if(location.hash)window.history.replaceState(null,'',location.pathname+location.search);
const pairingToken=()=>sessionStorage.getItem('nyx.agents.pair')||'';
function notice(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notice').hidden=true,7000);}
function message(role,text,replyModel,metadata,entry){
 $('welcome')?.remove();if(role!=='user')$('feed').querySelector('.thinking-message')?.remove();
 const row=document.createElement('article');row.className='message '+role;
 const header=document.createElement('div');header.className='message-heading';
 const id=replyModel||$('model').value;
 if(role==='assistant'&&id){const logo=document.createElement('span');logo.className='reply-logo';logo.innerHTML=picker.icon(id);header.append(logo);}
 const name=document.createElement('strong');name.textContent=role==='user'?'You':role==='error'?'Stopped':(models.find(item=>item.id===id)?.label||id||'Assistant');header.append(name);row.append(header);
 if(entry&&!chats.temporary()){entry.id||=crypto.randomUUID();row.dataset.messageId=entry.id;const pin=document.createElement('button');pin.type='button';pin.className='message-pin';pin.innerHTML=icon('pin');const update=()=>{pin.setAttribute('aria-pressed',String(!!entry.pinned));pin.setAttribute('aria-label',entry.pinned?'Unpin message':'Pin message');pin.title=entry.pinned?'Unpin message':'Pin message';};update();pin.onclick=()=>{if(running)return;if(!entry.pinned&&history.filter(m=>m.pinned).length>=20){notice('You can pin up to 20 messages per chat.');return;}entry.pinned=!entry.pinned;update();chats.save(history,$('model').value,!chatMode,$('effort').value);};header.append(pin);}

 if(typeof metadata?.summary==='string'&&metadata.summary.trim()){const details=document.createElement('details');details.className='reasoning-summary';const summary=document.createElement('summary');summary.textContent='Thinking summary';const content=document.createElement('div');content.textContent=metadata.summary.slice(0,2400);details.append(summary,content);row.append(details);}
 const content=document.createElement('div');content.className='message-content';content.textContent=text;row.append(content);$('feed').append(row);$('feed').scrollTop=$('feed').scrollHeight;return row;
}
function showThinking(model){$('feed').querySelector('.thinking-message')?.remove();const row=message('assistant','',model);row.classList.add('thinking-message');row.setAttribute('role','status');const content=row.querySelector('.message-content');content.innerHTML='<span class="thinking-dot"></span><span>Thinking...</span>';row.dataset.started=Date.now();}

function sync(){ $('send').disabled=running||(!chatMode&&!connected)||!auth?.currentUser||!$('model').value;$('stop').hidden=!running;$('model').disabled=running;$('effortTrigger').disabled=running;$('newTask').disabled=running;$('chatMode').disabled=running;$('computerMode').disabled=running;$('connection').classList.toggle('online',connected);$('connection').innerHTML=connected?'<i></i> Companion connected':'<i></i> Companion offline';}
async function local(route,body,signal){if(!pairingToken())throw Error('Open this page from Start-Nyx-Agents.cmd to pair your companion.');let response;try{response=await fetch('http://127.0.0.1:6768'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+pairingToken(),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal,targetAddressSpace:'loopback'});}catch(error){if(error.name==='AbortError')throw error;throw Error('Cannot reach the companion. Keep its window open and allow local-network access in your browser.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Companion request failed.');return data;}
async function api(route,body,signal,onProgress){const token=await auth?.currentUser?.getIdToken();if(!token)throw Error('Sign in to your account first.');const response=await fetch(route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'x-nyx-ai-provider':'shared',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal});return readResponse(response,onProgress);}

async function loadModels(){try{const data=await api('/api/nyx-ai/models');models=(data.models||[]).filter(item=>(item.text!==false||item.outputModalities?.includes('audio'))&&!item.id.endsWith(':batch'));$('model').replaceChildren(...models.map(item=>new Option(item.label||item.id,item.id)));picker.set(models);sync();}catch(error){notice(error.message);}}
async function files(path=''){const result=await local('/tool',{tool:'list',args:{path}});currentPath=path;$('files').replaceChildren();const add=(label,click,directory=false)=>{const button=document.createElement('button');button.className='file'+(directory?' directory':'');button.innerHTML=icon(directory?'folder':'file');button.append(document.createTextNode(label));button.onclick=()=>click().catch(error=>notice(error.message));$('files').append(button);};if(path)add('Parent folder',()=>files(path.split('/').slice(0,-1).join('/')),true);for(const entry of result.entries)add(entry.name,async()=>{if(entry.directory)return files(entry.path);const file=await local('/tool',{tool:'read',args:{path:entry.path}});$('previewPath').textContent=entry.path;$('previewContent').textContent=file.content;selectPanel(true);},entry.directory);}
function selectPanel(file){$('preview').hidden=!file;$('activity').hidden=file;$('fileTab').classList.toggle('selected',file);$('activityTab').classList.toggle('selected',!file);}
$('activityTab').onclick=()=>selectPanel(false);$('fileTab').onclick=()=>selectPanel(true);
$('refresh').onclick=()=>files(currentPath).catch(error=>notice(error.message));
$('connect').onclick=async()=>{try{if(!auth?.currentUser){$('login').showModal();return;}notice('Confirm the connection in the Windows dialog.');const result=await local('/connect',{});connected=result.connected;if(!connected)throw Error('Connection declined.');const status=await local('/status');$('folder').textContent=status.workspace;await files();notice('Connected to '+status.workspace);}catch(error){connected=false;notice(error.message);}finally{sync();}};
async function initialize(){try{const config=await(await fetch('/api/founder-profile/auth-config',{cache:'no-store'})).json();if(!config.enabled)throw Error('Account sign-in is unavailable on this server.');const [appModule,module]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);authModule=module;const app=appModule.getApps().find(item=>item.name==='nyx-founder-owner')||appModule.initializeApp({apiKey:config.apiKey,authDomain:config.projectId+'.firebaseapp.com',projectId:config.projectId},'nyx-founder-owner');auth=module.getAuth(app);await module.setPersistence(auth,module.browserLocalPersistence);module.onAuthStateChanged(auth,user=>{welcomeName=cleanGreetingName(user?.displayName);greetingIndex=0;chats.bind(user?.uid);if(user)loadGreetingName(user);$('account').innerHTML=icon('account')+(user?'Sign out':'Sign in');$('account').title=user?'Sign out':'Sign in';$('account').setAttribute('aria-label',user?'Sign out':'Sign in');if(user)loadModels();else{$('model').replaceChildren(new Option('Sign in to load models',''));picker.set([]);media.reset();}sync();});}catch(error){notice(error.message);}}
$('account').onclick=async()=>{if(auth?.currentUser){await stop();await authModule.signOut(auth);connected=false;history=[];$('feed').replaceChildren();sync();}else $('login').showModal();};
let creatingAccount=false,authBusy=false;
function setAuthMode(create){
 if(authBusy)return;creatingAccount=create;
 $('authTitle').textContent=create?'Create an account':'Sign in';
 $('authSubmit').textContent=create?'Create account':'Sign in';
 $('authSwitchHint').textContent=create?'Already have an account?':'New here?';
 $('authSwitch').textContent=create?'Sign in':'Create an account';
 $('confirmPasswordLabel').hidden=!create;$('confirmPassword').disabled=!create;$('confirmPassword').required=create;
 $('password').autocomplete=create?'new-password':'current-password';$('password').minLength=create?8:1;$('password').maxLength=256;
 $('signupUsernameLabel').hidden=!create;$('signupUsername').disabled=!create;$('signupUsername').required=create;
 $('confirmPassword').value='';$('loginError').textContent='';
}
$('authSwitch').onclick=()=>setAuthMode(!creatingAccount);
$('closeLogin').onclick=()=>{if(!authBusy)$('login').close();};
$('login').addEventListener('cancel',event=>{if(authBusy)event.preventDefault();});
$('login').addEventListener('close',()=>{$('password').value='';$('confirmPassword').value='';$('loginError').textContent='';});
$('loginForm').onsubmit=async event=>{
 event.preventDefault();if(authBusy)return;
 $('loginError').textContent='';
 if(creatingAccount&&$('password').value!==$('confirmPassword').value){$('loginError').textContent='Passwords do not match.';$('confirmPassword').focus();return;}
 authBusy=true;for(const id of ['authSubmit','authSwitch','closeLogin','email','password','confirmPassword','signupUsername'])$(id).disabled=true;
 $('authSubmit').textContent=creatingAccount?'Creating account...':'Signing in...';
 try{
  if(!auth)throw Error('Sign-in is still loading. Try again shortly.');
  if(creatingAccount){
   const response=await fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('signupUsername').value.trim().toLowerCase(),email:$('email').value.trim(),password:$('password').value})});
   const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Could not create your account.'),{registration:true});
   if(!data.customToken)throw Error('Missing sign-in token');
   try{await authModule.signInWithCustomToken(auth,data.customToken);}catch{throw Object.assign(new Error('Account created. Switch to Sign in to access it.'),{registration:true});}
  }else await authModule.signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);
  $('login').close();if(creatingAccount)notice('Account created. You are signed in.');
 }catch(error){
  const messages={'auth/invalid-credential':'Email or password is incorrect.','auth/email-already-in-use':'This email already has an account. Sign in instead.','auth/weak-password':'Choose a stronger password with at least 6 characters.','auth/password-does-not-meet-requirements':'This password does not meet the account password requirements.','auth/invalid-email':'Enter a valid email address.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/network-request-failed':'Could not connect. Check your connection and try again.','auth/operation-not-allowed':'Account registration is not enabled on this server.'};
  $('loginError').textContent=error.registration?error.message:messages[error.code]||'Unable to continue. Please try again.';
 }finally{
  authBusy=false;for(const id of ['authSubmit','authSwitch','closeLogin','email','password'])$(id).disabled=false;
  $('confirmPassword').disabled=!creatingAccount;$('signupUsername').disabled=!creatingAccount;$('authSubmit').textContent=creatingAccount?'Create account':'Sign in';
 }
};
function sizePrompt(){const input=$('prompt');input.style.height='40px';input.style.height=Math.min(180,Math.max(40,input.scrollHeight))+'px';}
$('prompt').addEventListener('input',sizePrompt);
function cleanGreetingName(value){return String(value||'').replace(/^[ @]+/,'').replace(/[&§][0-9a-fk-or]/gi,'').trim().slice(0,48);}
function refreshGreeting(animate=false){
 const heading=document.querySelector('#welcome h1');if(!heading)return;
 const name=welcomeName;
 const greetings=name?[`What's on your mind, ${name}?`,"How can I help?","What are we exploring?","What's next?"]:["What's on your mind?","How can I help?","What are we exploring?","What's next?"];
 heading.textContent=greetings[greetingIndex%greetings.length];
 if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)heading.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'ease-out'});
}
async function loadGreetingName(user){try{const data=await api('/api/profiles/me');if(auth?.currentUser?.uid!==user.uid)return;welcomeName=cleanGreetingName(data.profile?.username||data.profile?.handle||data.profile?.displayName||user.displayName);refreshGreeting();}catch{}}
function recentActivityIcon(activity){
 if(activity==='github')return '<img class="recent-brand" src="/apps/agents/icons/github.svg" alt="GitHub">';
 const paths={chat:'M4 4h16v12H9l-5 4z',code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',image:'M3 3h18v18H3z M3 16l5-5 4 4 3-3 6 6 M8 7h.01',deploy:'M7 17H5a4 4 0 0 1-.8-7.9A7 7 0 0 1 18 8a4.5 4.5 0 0 1 1 9h-2 M12 21V11m-4 4 4-4 4 4',search:iconPaths.search,file:iconPaths.file};
 return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[activity]||paths.chat)+'"/></svg>';
}
function renderRecentSuggestions(){
 const welcome=$('welcome');if(!welcome)return;
 welcome.querySelector('.recent-suggestions')?.remove();
 const recent=chats.recent();if(!recent.length)return;
 const section=document.createElement('div');section.className='recent-suggestions';section.setAttribute('aria-label','Continue a recent chat');
 for(const item of recent){const button=document.createElement('button');button.type='button';button.innerHTML=recentActivityIcon(item.activity);button.dataset.activity=item.activity;const label=document.createElement('span');const hint=document.createElement('small');hint.textContent='Continue';const title=document.createElement('strong');title.textContent=item.title;label.append(hint,title);button.append(label);button.title='Continue: '+item.title;button.onclick=()=>chats.resume(item.id);section.append(button);}
 welcome.append(section);
}
function renderWelcome(){ $('feed').replaceChildren(welcomeTemplate.cloneNode(true));refreshGreeting();renderRecentSuggestions();}
setInterval(()=>{if(document.hidden||!document.querySelector('#welcome h1'))return;greetingIndex++;refreshGreeting(true);},7000);
$('newTask').onclick=()=>chats.fresh(false);
function actionCard(action){selectPanel(false);$('activity').querySelector('.muted')?.remove();const row=document.createElement('article');row.className='action';const title=document.createElement('strong');title.textContent=action.tool+' · '+(action.args.path||action.args.cwd||'workspace');const detail=document.createElement('pre');detail.textContent=action.tool==='write'?action.args.content:JSON.stringify(action.args,null,2);const status=document.createElement('p');status.textContent=['write','delete','command'].includes(action.tool)?'Waiting for desktop approval…':'Reading workspace…';row.append(title,detail,status);$('activity').append(row);return {row,status};}
async function stop(){media.stopVoice();controller?.abort();try{if(pairingToken())await local('/stop',{});}catch{} }
$('stop').onclick=stop;
$('composer').onsubmit=async event=>{event.preventDefault();if(running||(!chatMode&&!connected)||!auth?.currentUser)return;const voice=media.voiceActive();let image=media.image();if(capturing)return;if(!image){capturing=true;try{image=await screen.capture();}catch(error){notice(error.message);return;}finally{capturing=false;}}const prompt=$('prompt').value.trim()||(image?'Use this image as context for the task.':'');if(!prompt||media.preparing())return;media.pause();running=true;controller=new AbortController();sync();$('prompt').value='';sizePrompt();$('taskTitle').textContent=prompt;history.push({role:'user',content:prompt,id:crypto.randomUUID()});message('user',prompt,null,null,history.at(-1));if(image){const preview=document.createElement('img');preview.src=image.dataUrl;preview.alt='Attached image';preview.className='message-image';$('feed').lastElementChild.append(preview);}media.clearImage();const model=$('model').value;
  try{
    if(chatMode){
      if([...chats.context(),...history].reduce((total,item)=>total+item.content.length,0)>21000)throw Error('This conversation is full. Start a new chat to continue.');
      showThinking(model);
      let partial;
      const update=data=>{if(!data.text)return;partial||=message('assistant','',data.model||model);const follow=$('feed').scrollHeight-$('feed').scrollTop-$('feed').clientHeight<100;partial.querySelector('.message-content').textContent=data.text;if(follow)$('feed').scrollTop=$('feed').scrollHeight;};
      const data=await api('/api/nyx-ai',{model,message:prompt,messages:[...chats.context(),...history.slice(-18)],stream:!voice,temporaryChat:true,responseDepth:({low:'off',medium:'normal',high:'extended'})[$('effort').value],reasoningEffort:$('effort').value,...(voice?{generateAudio:true,voice:$('voiceName').value.trim()||'alloy'}:{}),...(image?{image}:{})},controller.signal,update);
      if(typeof data.text!=='string'||!data.text.trim())throw Error('The model returned no text. Try again or select another model.');
      partial?.remove();
      history.push({role:'assistant',content:data.text,model:data.model||model,metadata:{summary:String(data.metadata?.summary||'').slice(0,2400)}});message('assistant',data.text,data.model||model,data.metadata,history.at(-1));media.reply(data.text,data.audio);return;
    }
    for(let step=0;step<12;step++){
    if(controller.signal.aborted)throw new DOMException('Stopped','AbortError');
    if([...chats.context(),...history].reduce((total,item)=>total+item.content.length,0)>21000)throw Error('This task has filled its context. Start a new task; your file changes are saved.');
    showThinking(model);
    const data=await api('/api/nyx-ai',{task:'computer-agent',model,message:prompt,messages:[...chats.context(),...history.slice(-19)],stream:false,temporaryChat:true,responseDepth:({low:'off',medium:'normal',high:'extended'})[$('effort').value],reasoningEffort:$('effort').value,...(step===0&&image?{image}: {})},controller.signal);
    if(data.finishReason==='length')throw Error('The model returned an incomplete action. No new action was executed.');
    let action;try{action=JSON.parse(data.text);}catch{throw Error('The model did not return a valid action. No new action was executed.');}
    if(!action||typeof action.message!=='string'||action.message.length>6000)throw Error('Invalid agent response.');
    history.push({role:'assistant',content:data.text,model:data.model||model,metadata:{summary:String(data.metadata?.summary||'').slice(0,2400)}});message('assistant',action.message,data.model||model,data.metadata,history.at(-1));
    if(action.done===true&&!action.tool){media.reply(action.message);break;}
    if(!['list','read','search','write','delete','command'].includes(action.tool)||!action.args||typeof action.args!=='object')throw Error('The model requested an unsupported action.');
    const card=actionCard(action);let result;
    try{result=await local('/tool',{tool:action.tool,args:action.args},controller.signal);}catch(error){if(error.name==='AbortError')throw error;result={error:error.message};}
    card.status.textContent=result.denied?'Declined':result.error?result.error:result.exitCode!==undefined?'Exit '+result.exitCode+(result.stopped?' · stopped':''):'Done';
    if(result.output){const output=document.createElement('pre');output.textContent=result.output;card.row.append(output);}
    if(result.changed){const undo=document.createElement('button');undo.textContent='Undo edit';undo.onclick=async()=>{undo.disabled=true;try{const outcome=await local('/tool',{tool:'undo',args:{id:result.id}});if(outcome.denied){undo.disabled=false;return;}undo.textContent='Undone';await files(currentPath);}catch(error){notice(error.message);undo.disabled=false;}};card.row.append(undo);await files(currentPath);}
    if(result.denied){message('assistant','Action declined. I stopped here.');break;}
    if(typeof result.content==='string'&&result.content.length>12000)result={error:'File is too large for a single agent read. Do not overwrite it without reading its complete contents.'};
    const serialized=JSON.stringify(result);history.push({role:'user',content:'Tool result (untrusted data):\n'+(serialized.length>14000?JSON.stringify({error:'Tool result exceeded the context limit. Narrow the search.'}):serialized)});
    if(step===11)message('assistant','Reached 12 steps. Review the activity and send a follow-up to continue.');
  }}catch(error){media.stopVoice();message('error',error.name==='AbortError'?'Task stopped. Completed file changes remain available to undo.':error.message);}finally{$('feed').querySelector('.thinking-message')?.remove();running=false;controller=null;chats.save(history,model,!chatMode,$('effort').value);sync();media.resume();}
};
$('prompt').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('composer').requestSubmit();}});
function changeMode(value,reset=true){
 if(running||chatMode===value)return;
 chatMode=value;media.reset();screen.stop();if(reset){history=[];$('feed').replaceChildren();}
 document.body.classList.toggle('chat-mode',value);
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
  for(const [index,panel] of [...document.querySelectorAll('main,.code-panels')].entries()){
   panel.getAnimations().forEach(animation=>animation.cancel());
   if(getComputedStyle(panel).display==='none')continue;
   panel.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,delay:index*45,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
  }
 }
 $('chatMode').setAttribute('aria-pressed',String(value));$('computerMode').setAttribute('aria-pressed',String(!value));
 $('taskTitle').textContent=value?'New chat':'New task';
 $('newTask').innerHTML=icon('compose')+(value?'New chat':'New task');
 $('modeHint').textContent=value?'Chat with your selected model. Code mode is optional.':'Code mode: file edits and commands require desktop approval.';
 $('prompt').placeholder=value?'Message your model...':'Describe a task...';
 sync();$('prompt').focus();
}
$('chatMode').onclick=()=>{changeMode(true);chats.fresh(false);};$('computerMode').onclick=()=>{changeMode(false);chats.fresh(false);};
const panelIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>';
$('collapseChats').innerHTML=panelIcon;
function toggleSidebar(){const collapsed=document.body.classList.toggle('sidebar-collapsed');$('collapseChats').setAttribute('aria-expanded',String(!collapsed));$('collapseChats').setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');$('collapseChats').title=collapsed?'Expand sidebar':'Collapse sidebar';try{localStorage.setItem('agents.sidebar.collapsed',String(collapsed));}catch{}}
$('collapseChats').onclick=toggleSidebar;
try{if(localStorage.getItem('agents.sidebar.collapsed')==='true')toggleSidebar();}catch{}
for(const [id,name,label] of [['chatMode','chat','Chat'],['computerMode','code','Code']]){$(id).insertAdjacentHTML('afterbegin',icon(name));$(id).title=label;$(id).setAttribute('aria-label',label);}
for(const id of ['sidebarNewChat','tempChat','pinnedMessages']){$(id).title=$(id).textContent;$(id).setAttribute('aria-label',$(id).textContent);}
$('sidebarNewChat').insertAdjacentHTML('afterbegin',icon('compose'));
$('tempChat').insertAdjacentHTML('afterbegin','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9M12 7v5l3 2M17 3h4v4"/></svg>');
$('taskTitle').textContent='New chat';
initialize();

const voiceDialog=$('voiceDialog');
function renderVoiceSettings(){
 const item=models.find(item=>item.id===$('model').value),native=chatMode&&supportsConversationVoice(item);
 $('voiceModelLabel').textContent=item?.label||'No model selected';
 $('voicePresets').replaceChildren();
 if(native&&item.id.startsWith('openai/'))for(const name of ['alloy','echo','fable','onyx','nova','shimmer']){const button=document.createElement('button');button.type='button';button.textContent=name[0].toUpperCase()+name.slice(1);button.setAttribute('aria-pressed',String($('voiceName').value===name));button.onclick=()=>{$('voiceName').value=name;renderVoiceSettings();};$('voicePresets').append(button);}
 $('voiceName').disabled=!native;$('voiceName').parentElement.hidden=!native;
 $('voiceHelp').textContent=native?'Uses the selected model’s audio. Voice availability varies by provider.':'This model does not support voice output in Chat. Choose a voice-capable model.';
 $('chooseVoiceModel').hidden=!!native;
}
$('voiceSettings').onclick=()=>{renderVoiceSettings();voiceDialog.showModal();};$('closeVoiceSettings').onclick=$('doneVoiceSettings').onclick=()=>voiceDialog.close();$('chooseVoiceModel').onclick=()=>{voiceDialog.close();picker.openVoice();};

const effortNames=['low','medium','high'];
function refreshEffort(){const index=Math.max(0,effortNames.indexOf($('effort').value));const label=effortNames[index][0].toUpperCase()+effortNames[index].slice(1);$('effortSlider').value=index;$('effortSlider').setAttribute('aria-valuetext',label);$('effortLevel').textContent=label;$('effortSlider').style.setProperty('--effort-fill',(index*50)+'%');$('effortTrigger').title='Thinking effort: '+label;}
$('effort').addEventListener('change',refreshEffort);
$('effortSlider').oninput=()=>{$('effort').value=effortNames[Number($('effortSlider').value)];refreshEffort();};
$('effortPanel').addEventListener('beforetoggle',event=>{if(event.newState==='open'){refreshEffort();const rect=$('effortTrigger').getBoundingClientRect();const panel=$('effortPanel');panel.style.left=Math.max(12,Math.min(innerWidth-292,rect.left-90))+'px';panel.style.top=Math.max(12,$('composer').getBoundingClientRect().top-138)+'px';}});
$('effortPanel').addEventListener('toggle',event=>{$('effortTrigger').setAttribute('aria-expanded',String(event.newState==='open'));});
refreshEffort();
