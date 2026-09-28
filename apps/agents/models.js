import '/js/ai-model-search.js';
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const modelCompanies={
    openai:['OpenAI','openai'],anthropic:['Anthropic','anthropic'],google:['Google','gemini'],
    deepseek:['DeepSeek','deepseek'],qwen:['Qwen','qwen'],'x-ai':['xAI','xai'],xai:['xAI','xai'],
    mistralai:['Mistral','mistral'],moonshotai:['Moonshot','moonshot'],'z-ai':['Z.ai','zai'],
    inception:['Inception','inception'],nvidia:['NVIDIA','nvidia'],'meta-llama':['Meta','meta'],
    cohere:['Cohere','cohere'],minimax:['MiniMax','minimax'],openrouter:['OpenRouter','openrouter'],
    xiaomi:['Xiaomi','xiaomimimo'],amazon:['Amazon','aws'],microsoft:['Microsoft','microsoft'],
    perplexity:['Perplexity','perplexity'],stepfun:['StepFun','stepfun'],baidu:['Baidu','baidu'],
    bytedance:['ByteDance','bytedance'],arcee:['Arcee','arcee'],ai21:['AI21','ai21'],
    "arcee-ai":["Arcee", "arcee"],
    "bytedance-seed":["ByteDance", "bytedance"],
    "meta":["Meta", "meta"],
    "aion-labs":["Aion Labs", "aionlabs"],
    "tencent":["Tencent", "tencent"],
    "sakana":["Sakana AI", "sakana"],
    "poolside":["Poolside", "poolside"],
    "upstage":["Upstage", "upstage"],
    "nousresearch":["Nous Research", "nousresearch"],
    "perceptron":["Perceptron", "perceptron"],
    "inference-net":["Inference.net", "inference"],
    "ibm-granite":["IBM", "ibm"],
    "rekaai":["Reka", "reka"],
    "relace":["Relace", "relace"],
    "morph":["Morph", "morph"],
    "fireworks":["Fireworks", "fireworks"],
    "dots-studio":["Dots", "dotsstudio"],
    "liquid":["Liquid AI", "liquid"],
    "kwaipilot":["Kwai", "kwaipilot"],
    "meituan":["Meituan", "longcat"],
    "thinkingmachines":["Thinking Machines", "thinkingmachines"],
    "inclusionai":["InclusionAI", "inclusionai"],
    "thedrummer":["TheDrummer", "thedrummer"],
    "typesafe":["TypeSafe", "typesafe"],
    "unbiased":["Unbiased", "unbiased"],
    "writer":["Writer", "writer"],
    "stealth":["Stealth", "stealth"],
    "sao10k":["Sao10K", "sao10k"],
    "anthracite-org":["Anthracite", "anthracite-org"],
    "gryphe":["Gryphe", "gryphe"],
    "undi95":["Undi95", "undi95"],
    "cognitivecomputations":["Cognitive Computations", "cognitivecomputations"],
    "prism-ml":["PrismML", "prism-ml"],
    "mancer":["Mancer", "mancer"],
    "black-forest-labs":["Black Forest Labs", "flux"],
    "recraft":["Recraft", "recraft"],
    "runway":["Runway", "runway"],
    "kwaivgi":["Kling", "kling"],
    "elevenlabs":["ElevenLabs", "elevenlabs"],
    "assemblyai":["AssemblyAI", "assemblyai"],
    "suno":["Suno", "suno"],
    "alibaba":["Alibaba", "alibaba"]
  };
  function modelCompany(item){
    const key=item.id.split('/')[0].toLowerCase().replace(/^~/,'');
    const known=modelCompanies[key];
    return {key:known?.[1]||key,label:known?.[0]||item.company||key||'Other',icon:known?.[1]||''};
  }
  const colorCompanyIcons=new Set(["kling","assemblyai","alibaba","aionlabs", "arcee", "aws", "baidu", "bytedance", "claude", "cohere", "deepseek", "fireworks", "gemini", "gemma", "hunyuan", "kimi", "kwaipilot", "longcat", "meta", "microsoft", "minimax", "mistral", "morph", "nvidia", "openrouter", "perplexity", "poolside", "qwen", "sakana", "stepfun", "tencent", "upstage"]);
  const authorIcons={"thinkingmachines": "thinkingmachines-author.png", "inclusionai": "inclusionai-author.png", "thedrummer": "thedrummer-author.png", "typesafe": "typesafe-author.png", "unbiased": "unbiased-author.png", "writer": "writer-author.png", "stealth": "stealth-author.svg", "sao10k": "sao10k-author.webp", "anthracite-org": "anthracite-org-author.webp", "gryphe": "gryphe-author.webp", "undi95": "undi95-author.webp", "cognitivecomputations": "cognitivecomputations-author.png", "prism-ml": "prism-ml-author.png", "mancer": "mancer-author.png"};
  function modelCompanyIcon(company){
    if(authorIcons[company.icon])return `<img class="ai-company-logo ai-company-logo-color" src="/assets/icons/ai-companies/${authorIcons[company.icon]}" alt="" aria-hidden="true" width="22" height="22">`;
    if(colorCompanyIcons.has(company.icon))return `<img class="ai-company-logo ai-company-logo-color" src="/assets/icons/ai-companies/${company.icon}-color.svg" alt="" aria-hidden="true" width="22" height="22">`;
    return company.icon ? `<span class="ai-company-logo" style="--company-logo:url('/assets/icons/ai-companies/${company.icon}.svg')" aria-hidden="true"></span>` : `<span class="ai-company-initial" aria-hidden="true">${escapeHtml(company.label.slice(0,2).toUpperCase())}</span>`;
  }
  function modelIcon(item){
    const company=modelCompany(item);
    const id=item.id.toLowerCase().replace(/^~/,'');
    const family=id.startsWith('anthropic/claude')?'claude':id.startsWith('google/gemma')?'gemma':id.startsWith('moonshotai/kimi')?'kimi':id.startsWith('x-ai/grok')?'grok':id.startsWith('tencent/hunyuan')?'hunyuan':'';
    return modelCompanyIcon(family?{...company,icon:family}:company);
  }

const companyOrder=['openai','anthropic','xai','deepseek','gemini','meta','qwen','mistral','moonshot','zai','minimax'];
const companyRank=key=>companyOrder.includes(key)?companyOrder.indexOf(key):companyOrder.length;
const compareCompanies=(a,b)=>companyRank(a.key)-companyRank(b.key)||a.label.localeCompare(b.label);
export function setupPicker(select){
 const modelMenu=document.getElementById('modelMenu'),modelSearch=document.getElementById('modelSearch'),modelCompaniesHost=document.getElementById('modelCompanies'),options=document.getElementById('modelOptions'),trigger=document.getElementById('modelTrigger');
 let modelCatalog=[],modelCompanyFilter='';
  function renderModelCompanies(){
    const companies=[...new Map(modelCatalog.map(item=>{const company=modelCompany(item);return [company.key,company]})).values()].sort(compareCompanies);
    if(!companies.some(company=>company.key===modelCompanyFilter))modelCompanyFilter='';
    const button=company=>`<button type="button" data-model-company="${escapeHtml(company.key)}" title="${escapeHtml(company.label)}" aria-label="${escapeHtml(company.label)} models" aria-pressed="${modelCompanyFilter===company.key}">${modelCompanyIcon(company)}</button>`;
    modelCompaniesHost.innerHTML=[companies.filter((_,i)=>i%2===0),companies.filter((_,i)=>i%2===1)].map((items,i)=>`<div class="ai-company-rail" aria-label="${i?'Right':'Left'} company filters"><div class="ai-company-track">${items.map(button).join('')}</div></div>`).join('');
    modelCompaniesHost.querySelectorAll('.ai-company-rail').forEach(rail=>{
      const copy=rail.firstElementChild.cloneNode(true);
      copy.setAttribute('aria-hidden','true');copy.dataset.loopCopy='';
      copy.querySelectorAll('button').forEach(button=>button.tabIndex=-1);
      rail.append(copy);
      rail.addEventListener('pointerleave',()=>{rail._loopOffset=rail.scrollTop;rail._continueOnHover=false;});
      rail.addEventListener('focusout',()=>{rail._loopOffset=rail.scrollTop;});
    });
    syncCompanyMotion();
  }
  let companyFrame=0;
  function syncCompanyMotion(){
    cancelAnimationFrame(companyFrame);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stopped=reduced;
    modelMenu.querySelector('[data-model-company=""]').setAttribute('aria-pressed',String(!modelCompanyFilter));
    modelCompaniesHost.querySelectorAll('[data-loop-copy]').forEach(copy=>copy.hidden=stopped);
    if(modelMenu.hidden||stopped)return;
    let previous=0;
    const tick=time=>{
      const delta=previous?Math.min(time-previous,50):0;previous=time;
      modelCompaniesHost.querySelectorAll('.ai-company-rail').forEach((rail,index)=>{
        const track=rail.firstElementChild;
        if(track.offsetHeight<=rail.clientHeight){rail.lastElementChild.hidden=true;return;}
        if(rail.matches(':focus-within')||(rail.matches(':hover')&&!rail._continueOnHover)||document.hidden)return;
        const offset=(rail._loopOffset??rail.scrollTop)+delta*.018*(index===0?1:-1);
        rail._loopOffset=((offset%track.offsetHeight)+track.offsetHeight)%track.offsetHeight;
        rail.scrollTop=rail._loopOffset;
      });
      companyFrame=requestAnimationFrame(tick);
    };
    companyFrame=requestAnimationFrame(tick);
  }
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',syncCompanyMotion);

  function revealModelCompany(key){
    if(!key||modelMenu.hidden)return;
    const button=[...modelCompaniesHost.querySelectorAll('.ai-company-track:not([data-loop-copy]) button')].find(item=>item.dataset.modelCompany===key);
    const rail=button?.closest('.ai-company-rail');
    if(!rail)return;
    const track=rail.firstElementChild;
    const target=button.getBoundingClientRect().top-rail.getBoundingClientRect().top+rail.scrollTop-(rail.clientHeight-button.offsetHeight)/2;
    const looping=!rail.lastElementChild.hidden&&track.offsetHeight>rail.clientHeight;
    rail._loopOffset=looping?((target%track.offsetHeight)+track.offsetHeight)%track.offsetHeight:Math.max(0,Math.min(target,rail.scrollHeight-rail.clientHeight));
    rail.scrollTop=rail._loopOffset;
  }

 function render(){
 const visible=globalThis.NyxModelSearch.search(modelCatalog.filter(item=>!modelCompanyFilter||modelCompany(item).key===modelCompanyFilter),modelSearch.value.trim().toLowerCase(),modelCompany);
 document.querySelector('[data-model-count]').textContent=visible.length+' of '+modelCatalog.length;
 const groups=new Map();for(const item of visible){const company=modelCompany(item);if(!groups.has(company.key))groups.set(company.key,{company,items:[]});groups.get(company.key).items.push(item);}
 const date=item=>Number.isFinite(Number(item.created))?Number(item.created):0;
 const renderOption=(item,newest)=>'<button type="button" class="ai-model-option" role="option" aria-selected="'+(item.id===select.value)+'" data-id="'+escapeHtml(item.id)+'">'+modelIcon(item)+'<span class="ai-model-option-label"><strong>'+escapeHtml(item.label)+(newest?' <em>Newest</em>':'')+'</strong><small>'+escapeHtml(modelCompany(item).label)+(item.outputModalities?.includes('audio')?' &middot; Native voice':'')+(item.vision?' &middot; Vision':'')+(item.reasoning?' &middot; Reasoning':'')+(date(item)?' &middot; '+new Date(date(item)*1000).toLocaleDateString(undefined,{month:'short',year:'numeric'}):'')+'</small></span><span class="ai-model-option-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg></span></button>';
 options.innerHTML=[...groups.values()].sort((a,b)=>compareCompanies(a.company,b.company)).map(group=>{group.items.sort((a,b)=>date(b)-date(a)||a.label.localeCompare(b.label,undefined,{numeric:true}));const newest=Math.max(0,...modelCatalog.filter(item=>modelCompany(item).key===group.company.key).map(date));return '<section class="ai-model-group" role="group" aria-label="'+escapeHtml(group.company.label)+'"><h3 class="ai-model-group-label">'+escapeHtml(group.company.label)+' <span>'+group.items.length+'</span></h3><div class="ai-model-group-grid">'+group.items.map(item=>renderOption(item,newest>0&&date(item)===newest)).join('')+'</div></section>';}).join('');
 if(!visible.length)options.textContent='No matching models.';
 options.scrollTop=0;
 modelMenu.querySelectorAll('[data-model-company]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.modelCompany===modelCompanyFilter)));
 if(visible[0]&&(modelSearch.value||modelCompanyFilter))revealModelCompany(modelCompany(visible[0]).key);
 }
 function sync(){const item=modelCatalog.find(item=>item.id===select.value);trigger.innerHTML=item?modelIcon(item)+'<span>'+escapeHtml(item.label)+'</span>':'Choose model';trigger.disabled=select.disabled||!modelCatalog.length;}
 trigger.onclick=()=>{modelMenu.hidden=false;modelMenu.showModal();trigger.setAttribute('aria-expanded','true');render();syncCompanyMotion();modelSearch.focus();};
 document.getElementById('modelMenuClose').onclick=()=>modelMenu.close();
 modelMenu.addEventListener('close',()=>{modelMenu.hidden=true;cancelAnimationFrame(companyFrame);trigger.setAttribute('aria-expanded','false');trigger.focus();});
 modelSearch.oninput=render;
 modelMenu.addEventListener('click',event=>{const company=event.target.closest('[data-model-company]');if(company){modelCompanyFilter=company.dataset.modelCompany;render();syncCompanyMotion();return;}const option=event.target.closest('[data-id]');if(option){select.value=option.dataset.id;select.dispatchEvent(new Event('change'));sync();modelMenu.close();}});
 select.addEventListener('change',sync);
 new MutationObserver(sync).observe(select,{attributes:true,childList:true});
 return {icon(id){return modelIcon(modelCatalog.find(item=>item.id===id)||{id,company:'Assistant'});},openVoice(){trigger.click();modelSearch.value='voice';render();},set(items){modelCatalog=items.map(item=>({...item,label:item.label||item.id}));renderModelCompanies();render();sync();}};
}
