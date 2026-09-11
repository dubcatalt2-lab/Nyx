(()=>{'use strict';
const $=s=>document.querySelector(s),GEMINI='google/gemini-2.5-flash-lite',LUNA='openai/gpt-5.6-luna';
let localAuth=null,loadedUid='',accountOwner=false,playController=null;
function showTab(name){if(!['keys','usage','playground','owner'].includes(name))name='keys';if(name==='owner'&&!accountOwner)name='keys';document.querySelectorAll('[data-page]').forEach(el=>el.hidden=el.dataset.page!==name);document.querySelectorAll('[data-tab]').forEach(el=>{if(el.dataset.tab===name)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});}
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{location.hash=button.dataset.tab;showTab(button.dataset.tab);});addEventListener('hashchange',()=>showTab(location.hash.slice(1)));showTab(location.hash.slice(1));
// Embedded apps inherit the existing Nyx wallpaper. Standalone /api reuses
// the same wallpaper renderers and saved preferences, without changing them.
const embedded=window.parent!==window;
const setting=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
function syncAppearance(){
  if(embedded){try{document.documentElement.style.setProperty('--nyx-font',getComputedStyle(parent.document.body).fontFamily);}catch{}return;}
  const fonts={outfit:'Outfit',raleway:'Raleway',nunito:'Nunito',inter:'Inter',poppins:'Poppins',quicksand:'Quicksand',lexend:'Lexend',montserrat:'Montserrat',atkinson:'Atkinson Hyperlegible'};
  const family=fonts[setting('nyx.font','outfit')]||'Outfit';document.documentElement.style.setProperty('--nyx-font',`"${family}",Arial,sans-serif`);
  let fontLink=document.getElementById('nyx-api-font');if(!fontLink){fontLink=document.createElement('link');fontLink.id='nyx-api-font';fontLink.rel='stylesheet';document.head.append(fontLink);}const fontUrl=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll('%20','+')}:wght@400;500;600;700&display=swap`;if(fontLink.href!==fontUrl)fontLink.href=fontUrl;
  const preset=setting('nyx.beamWallpaper','frost');document.documentElement.dataset.nyxBeamWallpaper=preset;
  const color=setting('nyx.customThemeColor','');const options=setting('nyx.theme','default')==='custom'&&/^#[a-f0-9]{6}$/i.test(color)?{lightColor:color}:{};
  window.NyxBeamsWallpaper?.apply(preset,options);window.NyxLineWavesWallpaper?.apply(preset,{colorVariant:setting('nyx.lineWaves.colorVariant','frost')});
}
if(!embedded){document.documentElement.classList.add('nyx-api-standalone');for(const id of ['nyxBeamsBg','nyxLineWavesBg']){const canvas=document.createElement('canvas');canvas.id=id;canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);}void(async()=>{for(const src of ['/assets/vendor/three.r134.min.js','/js/beams-wallpaper.js','/js/line-waves-wallpaper.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});syncAppearance();})().catch(()=>{});}
syncAppearance();addEventListener('storage',syncAppearance);addEventListener('message',event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.type==='nyx:theme-sync')syncAppearance();});
const note=m=>{$('#notice').textContent=m;};
  async function parentToken(){
    if(window.parent===window)return '';
    const requestId=`keys-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise(resolve=>{
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('message',receive);resolve(String(value||''))};
      const receive=event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.type==='nyx:account-token-response'&&event.data.requestId===requestId)finish(event.data.token)};
      const timer=setTimeout(()=>finish(''),2500);addEventListener('message',receive);parent.postMessage({type:'nyx:account-token-request',requestId},location.origin);
    });
  }
  async function firebaseToken(local=false){
    const token=await parentToken();
    if(token&&!local)return token;
    const configResponse=await fetch('/api/founder-profile/auth-config',{cache:'no-store'});
    const config=await configResponse.json();
    if(!config?.enabled||!config?.apiKey||!config?.projectId)return '';
    const [{initializeApp,getApps},{getAuth,setPersistence,browserLocalPersistence}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')
    ]);
    const app=getApps().find(item=>item.name==='nyx-founder-owner')||initializeApp({apiKey:config.apiKey,authDomain:`${config.projectId}.firebaseapp.com`,projectId:config.projectId},'nyx-founder-owner');
    const auth=getAuth(app); localAuth=auth;try{await setPersistence(auth,browserLocalPersistence)}catch{}
    if(typeof auth.authStateReady==='function')await auth.authStateReady();
    return auth.currentUser?auth.currentUser.getIdToken():'';
  }

async function api(path,body,method){const token=await firebaseToken();if(!token)throw Error('Sign in to Nyx first, then refresh this page.');const response=await fetch('/api/developer'+path,{method:method||(body?'POST':'GET'),cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed.');return data;}
const task=fn=>async event=>{event?.preventDefault();const button=event?.submitter||event?.currentTarget;if(button?.tagName==='BUTTON')button.disabled=true;try{await fn(event);}catch(e){note(e.message);}finally{if(button?.tagName==='BUTTON'&&button.id!=='create-button')button.disabled=false;else if(button?.id==='create-button')await refresh().catch(()=>{});}};
async function refresh(){const d=await api('/me');$('#account').textContent=`${d.balance.toLocaleString()} tokens remaining | ${d.usedTokens||0} used | ${d.dailyRequests} requests/day | ${d.minuteRequests}/minute. User ID: ${d.uid}`;$('#verify').hidden=d.verified||d.owner;$('#create-button').disabled=Boolean(d.key)||(!d.verified&&!d.owner)||!d.configured;$('#revoke').hidden=!d.key;$('#key').textContent=d.key?`${d.key.label}: ${d.key.prefix}...`:'No active key.';accountOwner=d.owner;$('#owner-tab').hidden=!d.owner;showTab(location.hash.slice(1));renderUsage(d);syncModels(d);$('#management').hidden=!d.unlocked;$('#unlock').hidden=Boolean(d.unlocked);if(!$('#uid').value)$('#uid').value=d.uid;}
$('#refresh').onclick=task(refresh);
$('#create').onsubmit=task(async e=>{const d=await api('/keys',{label:e.target.elements.label.value});$('#secret').value=d.key;$('#playground-key').value=d.key;$('#reveal').hidden=false;note('Key created. Copy it now.');await refresh();});
$('#revoke').onclick=task(async()=>{await api('/keys',null,'DELETE');$('#playground-key').value='';$('#secret').value='';$('#reveal').hidden=true;note('Key revoked. Your balance is preserved.');await refresh();});
$('#copy').onclick=task(async()=>{await navigator.clipboard.writeText($('#secret').value);note('Key copied.');});
$('#dismiss').onclick=()=>{$('#secret').value='';$('#reveal').hidden=true;};
$('#verify').onclick=task(async()=>{await firebaseToken(true);if(!localAuth?.currentUser)throw Error('Open /api directly after signing in to Nyx.');if(!localAuth.currentUser.email)throw Error('Add an email address in your Nyx profile first, then return here to verify it.');const {sendEmailVerification}=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');await sendEmailVerification(localAuth.currentUser);note('Verification email sent. Open its link, then click Refresh access. If you have no email, add one in your Nyx profile first.');});
$('#unlock').onsubmit=task(async e=>{try{await api('/unlock',{password:e.target.elements.password.value});await refresh();note('Owner management unlocked for 15 minutes.');}finally{e.target.elements.password.value='';}});
$('#lock').onclick=task(async()=>{await api('/lock',{});await refresh();note('Owner management locked.');});
function renderTarget(d){loadedUid=d.uid;$('#target').textContent=`${d.uid}: ${d.balance} tokens remaining; ${d.usedTokens||0} tokens used. ${d.key?'Active key: '+d.key.prefix+'...':'No key.'}`;const f=$('#limits').elements;for(const n of ['dailyRequests','minuteRequests','maxOutput'])f[n].value=d[n];f.addTokens.value=0;f.gemini.checked=d.models.includes(GEMINI);f.luna.checked=d.models.includes(LUNA);}
$('#uid').oninput=()=>{loadedUid='';};
$('#lookup').onsubmit=task(async()=>renderTarget(await api('/owner/account/'+encodeURIComponent($('#uid').value.trim()))));
$('#limits').onsubmit=task(async e=>{if(!loadedUid)throw Error('Load an account first.');const f=e.target.elements;const body={models:[...(f.gemini.checked?[GEMINI]:[]),...(f.luna.checked?[LUNA]:[])]};for(const n of ['addTokens','dailyRequests','minuteRequests','maxOutput'])body[n]=Number(f[n].value);renderTarget(await api('/owner/account/'+encodeURIComponent(loadedUid),body));note('Token balance and limits saved.');await refresh();});
$('#owner-revoke').onclick=task(async()=>{if(!loadedUid)throw Error('Load an account first.');await api('/owner/account/'+encodeURIComponent(loadedUid)+'/key',null,'DELETE');renderTarget(await api('/owner/account/'+encodeURIComponent(loadedUid)));note('User key revoked.');});
function syncModels(d){const select=$('#playground-model'),chosen=select.value;select.replaceChildren();for(const id of d.models||[GEMINI]){const option=document.createElement('option');option.value=id;option.textContent=id===LUNA?'GPT-5.6 Luna':'Gemini 2.5 Flash Lite';select.append(option);}if([...select.options].some(o=>o.value===chosen))select.value=chosen;}
function renderUsage(d){$('#usage-remaining').textContent=Math.max(0,d.balance).toLocaleString();$('#usage-used').textContent=(d.usedTokens||0).toLocaleString();$('#usage-requests').textContent=`${d.requestsToday||0} / ${d.dailyRequests}`;$('#usage-meter').max=Math.max(1,d.grantedTokens||d.balance+(d.usedTokens||0));$('#usage-meter').value=Math.max(0,d.balance);$('#usage-limits').textContent=`${d.minuteRequests} requests/minute. Maximum ${d.maxOutput} output tokens/request. Daily requests reset at 00:00 UTC; token balances do not refill automatically.${d.pending?' A request is in progress; its tokens are reserved.':''}`;const rows=$('#usage-rows');rows.replaceChildren();for(const item of d.recent||[]){const tr=document.createElement('tr');for(const value of [new Date(item.at).toLocaleString(),item.model===LUNA?'GPT-5.6 Luna':'Gemini 2.5 Flash Lite',item.tokens.toLocaleString(),({completed:'Completed',not_sent:'Not sent',unconfirmed:'Unconfirmed'})[item.status]||'Unconfirmed']){const td=document.createElement('td');td.textContent=value;tr.append(td);}rows.append(tr);}if(!rows.children.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='No requests yet. Try your first prompt in the playground.';tr.append(td);rows.append(tr);}}
$('#usage-refresh').onclick=task(refresh);
$('#playground').onsubmit=async event=>{event.preventDefault();if(playController)return;playController=new AbortController();const controller=playController,started=performance.now();const timer=setTimeout(()=>controller.abort(),125000);$('#playground-send').disabled=true;$('#playground-cancel').hidden=false;$('#playground-send .spinner').hidden=false;$('#send-label').textContent='Generating';$('#playground-result').hidden=false;$('#playground-meta').textContent='Waiting for a response...';$('#playground-response').textContent='';try{const response=await fetch('/api/v1/ai',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+$('#playground-key').value.trim(),'Content-Type':'application/json'},body:JSON.stringify({model:$('#playground-model').value,messages:[{role:'user',content:$('#playground-prompt').value}],max_tokens:Number($('#playground-tokens').value)})});const result=await response.json();if(!response.ok)throw Error(result.error||'The request failed.');$('#playground-response').textContent=result.choices?.[0]?.message?.content||'The model returned no text.';$('#playground-meta').textContent=`${((performance.now()-started)/1000).toFixed(1)} seconds | ${result.usage?.prompt_tokens||0} input + ${result.usage?.completion_tokens||0} output tokens`;}catch(error){$('#playground-meta').textContent=controller.signal.aborted?'Request stopped':'Request failed';$('#playground-response').textContent=controller.signal.aborted?'The request was stopped. Check Usage for any reserved tokens.':error.message;}finally{clearTimeout(timer);playController=null;$('#playground-send').disabled=false;$('#playground-cancel').hidden=true;$('#playground-send .spinner').hidden=true;$('#send-label').textContent='Run prompt';await refresh().catch(()=>{});}};
$('#playground-cancel').onclick=()=>playController?.abort();
$('#example').textContent=String.raw`curl ${location.origin}/api/v1/ai \
  -H "Authorization: Bearer YOUR_NYX_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"${GEMINI}","messages":[{"role":"user","content":"Hello"}],"max_tokens":128}'`;
refresh().catch(e=>note(e.message));
})();
