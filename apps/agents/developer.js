import {readResponse} from './response.js';
import {renderReply} from './reply-content.js';
export function setupDeveloper({account,user,nook,secret,refresh}){
 const $=id=>document.getElementById(id);let controller,revision=0;
 $('keyDialog').classList.toggle('nook-developer',nook);
 const clear=()=>{revision++;controller?.abort();controller=null;$('playKey').value='';$('playResult').replaceChildren();$('playStatus').textContent='';$('playRun').disabled=false;$('playCancel').hidden=true;};
 function tab(name){document.querySelectorAll('[data-key-tab]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.keyTab===name)));document.querySelectorAll('[data-key-page]').forEach(el=>el.hidden=el.dataset.keyPage!==name);if(name==='playground'&&!$('playKey').value)$('playKey').value=$('createdKey').value||secret();if(name==='usage')void refresh();}
 document.querySelectorAll('[data-key-tab]').forEach(el=>el.onclick=()=>tab(el.dataset.keyTab));
 $('usagePage').hidden=!nook;$('developerTabs').hidden=!nook;
 $('usagePage').onclick=()=>{if(!user()){$('account').click();return;}$('keyDialog').showModal();tab('usage');};
 $('refreshUsage').onclick=()=>void refresh();
 $('enableNookKey').onclick=async()=>{try{$('enableNookKey').disabled=true;await account('/enable',{});await refresh();}catch(error){$('keyError').textContent=error.message;}finally{$('enableNookKey').disabled=false;}};
 function usage(value,prefix=''){
  if(!value)return;
  for(const [name,metric]of [['Total',value.total],['Expensive',value.expensive]]){
   $(prefix+'usage'+name).textContent=value.unlimited?'Unlimited':metric.remaining.toLocaleString()+' / '+metric.limit.toLocaleString()+' left';
   $(prefix+'meter'+name).max=metric.limit||1;$(prefix+'meter'+name).value=value.unlimited?1:Math.max(0,metric.limit-metric.used);
  }
  $(prefix+'usageReset').textContent=value.unlimited?'Your account has no token quota.':value.resetAt?'Resets '+new Date(value.resetAt).toLocaleString():'The four-day window starts with your first request.';
 }
 function update(next){
  if(!nook)return;
  $('enableNookKey').hidden=!next.key||next.key.app==='nook';
  const chosen=$('playModel').value;$('playModel').replaceChildren();
  for(const model of next.catalog||[]){const option=document.createElement('option');option.value=model.id;option.textContent=model.label||model.id;$('playModel').append(option);}
  if([...$('playModel').options].some(o=>o.value===chosen))$('playModel').value=chosen;
  $('modelAccess').textContent=(next.models?.length||0)+' models · same access as your account';
  usage(next.usage);$('otherBrowserUsage').hidden=!next.currentBrowserUsage;if(next.currentBrowserUsage)usage(next.currentBrowserUsage,'current');
  const requests=next.usage?.requestsToday||0;$('usageRequests').textContent=requests.toLocaleString()+(requests===1?' request today':' requests today')+(next.usage?.pending?' · request in progress':'');
  $('usageScope').textContent=next.keyUsesCurrentBrowser?'Chat and this key share this browser’s allowance.':'Your key uses the browser allowance it was first created with. This browser’s chat allowance is shown separately.';
  example();
 }
 function example(){const model=$('playModel').value||'MODEL_ID';$('apiEndpoint').textContent=location.origin+'/api/v1/ai';$('apiExample').textContent=`curl "${location.origin}/api/v1/ai" \\\n  -H "Authorization: Bearer $NOOK_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({model,messages:[{role:'user',content:'Hello'}],max_tokens:512})}'`;}
 $('playModel').onchange=example;
 $('playForm').onsubmit=async event=>{
  event.preventDefault();if(controller)return;const key=$('playKey').value.trim();if(!/^n_api_[A-Za-z0-9_-]{43}$/.test(key)){$('playStatus').textContent='Enter your account API key.';return;}
  const mine=++revision,active=new AbortController();controller=active;const timer=setTimeout(()=>active.abort(),125000),started=performance.now();
  $('playRun').disabled=true;$('playCancel').hidden=false;$('playStatus').textContent='Generating…';$('playResult').textContent='';
  try{
   const response=await fetch('/api/v1/ai',{method:'POST',signal:active.signal,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:$('playModel').value,messages:[{role:'user',content:$('playPrompt').value}],max_tokens:Number($('playTokens').value)})});
   const result=await readResponse(response);if(mine!==revision)return;
   const choice=result.choices?.[0];renderReply($('playResult'),choice?.message?.content||'The model returned no text.');
   $('playStatus').textContent=`${((performance.now()-started)/1000).toFixed(1)}s · ${result.usage?.prompt_tokens??0} input + ${result.usage?.completion_tokens??0} output tokens`+(choice?.finish_reason==='length'?' · Output limit reached':'');
  }catch(error){if(mine===revision)$('playStatus').textContent=active.signal.aborted?'Stopped. Check Usage for tokens already processed.':error.message.replaceAll(key,'[key]');}
  finally{clearTimeout(timer);if(mine===revision){controller=null;$('playRun').disabled=false;$('playCancel').hidden=true;await refresh();}}
 };
 $('playCancel').onclick=()=>controller?.abort();
 $('copyExample').onclick=async()=>{try{await navigator.clipboard.writeText($('apiExample').textContent);$('copyExample').textContent='Copied';}catch{$('keyError').textContent='Select and copy the example manually.';}};
 window.addEventListener('pagehide',clear);
 return {tab,update,clear};
}
