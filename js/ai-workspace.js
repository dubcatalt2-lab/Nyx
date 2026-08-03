(function(){
  'use strict';

  const MESSAGE_KEY='nyx.aiMessages';
  const MODEL_KEY='nyx.aiModel';
  const DEFAULT_MODEL='chatgpt-5.4-mini';
  const MAX_MESSAGES=40;
  const MAX_INPUT_HEIGHT=190;

  const app=document.querySelector('[data-ai-app]');
  const feed=document.getElementById('feed');
  const conversation=document.getElementById('conversation');
  const form=document.getElementById('form');
  const input=document.getElementById('input');
  const send=document.getElementById('send');
  const model=document.getElementById('model');
  const modelPicker=document.getElementById('modelPicker');
  const modelTrigger=document.getElementById('modelTrigger');
  const modelSelected=document.getElementById('modelSelected');
  const modelMenu=document.getElementById('modelMenu');
  const modelOptionsHost=document.getElementById('modelOptions');
  const clear=document.getElementById('clear');
  const threadTitle=document.getElementById('threadTitle');
  const characterCount=document.getElementById('characterCount');
  if(!app||!feed||!conversation||!form||!input||!send||!model||!modelPicker||!modelTrigger||!modelSelected||!modelMenu||!modelOptionsHost||!clear||!threadTitle) return;

  let activeController=null;
  let followStream=true;
  let modelCatalog=[{id:DEFAULT_MODEL,label:'GPT-5.4 Mini',company:'ChatGPT'}];

  function themeHex(value,fallback='#6687b2'){
    const raw=String(value||'').trim();
    return /^#[0-9a-f]{6}$/i.test(raw)?raw.toLowerCase():fallback;
  }

  function shadeThemeHex(value,percent=0){
    const color=themeHex(value);
    const amount=Math.max(-100,Math.min(100,Number(percent)||0))/100;
    const channel=index=>{
      const current=parseInt(color.slice(index,index+2),16);
      return Math.round(amount>=0?current+(255-current)*amount:current*(1+amount));
    };
    return '#'+[1,3,5].map(index=>channel(index).toString(16).padStart(2,'0')).join('');
  }

  function themeForeground(value){
    const color=themeHex(value);
    const channels=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255).map(channel=>channel<=.04045?channel/12.92:Math.pow((channel+.055)/1.055,2.4));
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.48?'#071018':'#f7f9ff';
  }

  function parentThemePalette(){
    try{
      if(parent===window||parent.location.origin!==location.origin) return null;
      const parentDocument=parent.document;
      const bodyStyle=parent.getComputedStyle(parentDocument.body);
      const rootStyle=parent.getComputedStyle(parentDocument.documentElement);
      const read=(name,fallback='')=>bodyStyle.getPropertyValue(name).trim()||rootStyle.getPropertyValue(name).trim()||fallback;
      const accent=read('--nyx-chrome-accent',read('--theme-a','#6687b2'));
      const bright=read('--nyx-final-shortcut-icon',read('--nyx-chrome-bright',accent));
      return {
        canvas:read('--nyx-unified-canvas',read('--nyx-chrome-deep','#080e18')),
        deep:read('--nyx-unified-top',read('--nyx-chrome-deep','#050912')),
        surface:read('--nyx-home-panel',read('--nyx-chrome-base','#101827')),
        raised:read('--nyx-home-panel-soft',read('--nyx-chrome-active','#141f31')),
        hover:read('--nyx-chrome-hover',read('--nyx-home-panel-soft','#1a293e')),
        line:read('--nyx-home-line','#2a3b54'),
        text:read('--nyx-home-text',read('--theme-strong','#d4deec')),
        muted:read('--nyx-home-muted','#899bb5'),
        accent,
        bright
      };
    }catch{return null}
  }

  function fallbackThemePalette(theme){
    const stored=theme==='custom'?localStorage.getItem('nyx.customThemeColor'):'';
    const accent=themeHex(stored||window.NyxLogo?.colors?.[theme]||window.NyxLogo?.colors?.default||'#6687b2');
    return {
      canvas:shadeThemeHex(accent,-84),
      deep:shadeThemeHex(accent,-91),
      surface:shadeThemeHex(accent,-74),
      raised:shadeThemeHex(accent,-68),
      hover:shadeThemeHex(accent,-58),
      line:shadeThemeHex(accent,-30),
      text:'#f4f7ff',
      muted:shadeThemeHex(accent,48),
      accent:shadeThemeHex(accent,8),
      bright:shadeThemeHex(accent,38)
    };
  }

  function applyWorkspaceTheme(theme=localStorage.getItem('nyx.theme')||'default'){
    const clean=String(theme||'default').trim().toLowerCase()||'default';
    const palette=parentThemePalette()||fallbackThemePalette(clean);
    const root=document.documentElement;
    const values={
      '--ai-bg':palette.canvas,
      '--ai-bg-deep':palette.deep,
      '--ai-surface':palette.surface,
      '--ai-surface-raised':palette.raised,
      '--ai-surface-hover':palette.hover,
      '--ai-border':`color-mix(in srgb,${palette.line} 62%,transparent)`,
      '--ai-border-strong':`color-mix(in srgb,${palette.bright} 34%,${palette.line})`,
      '--ai-text':palette.text,
      '--ai-text-soft':`color-mix(in srgb,${palette.text} 84%,${palette.muted})`,
      '--ai-muted':palette.muted,
      '--ai-muted-dark':`color-mix(in srgb,${palette.muted} 72%,${palette.canvas})`,
      '--ai-accent':palette.accent,
      '--ai-accent-bright':palette.bright,
      '--ai-accent-soft':`color-mix(in srgb,${palette.accent} 14%,transparent)`,
      '--ai-accent-border':`color-mix(in srgb,${palette.bright} 42%,transparent)`,
      '--ai-accent-foreground':themeForeground(palette.accent),
      '--ai-accent-glow':`color-mix(in srgb,${palette.accent} 28%,transparent)`
    };
    Object.entries(values).forEach(([name,value])=>root.style.setProperty(name,value));
    root.dataset.nyxTheme=clean;
    document.body.dataset.nyxTheme=clean;
    document.body.className=document.body.className.replace(/\btheme-[\w-]+\b/g,'').trim();
    document.body.classList.add(`theme-${clean}`);
    applyLogoTheme(clean);
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,character=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[character]);
  }

  function savedMessages(){
    try{
      const value=JSON.parse(localStorage.getItem(MESSAGE_KEY)||'[]');
      return Array.isArray(value)
        ? value.filter(item=>item&&['user','assistant'].includes(item.role)&&String(item.content||'').trim()).slice(-MAX_MESSAGES)
        : [];
    }catch{return[]}
  }

  function saveMessages(value){
    try{localStorage.setItem(MESSAGE_KEY,JSON.stringify(value.slice(-MAX_MESSAGES)))}catch{}
  }

  function applyLogoTheme(theme){
    return window.NyxLogo?.apply(theme||localStorage.getItem('nyx.theme')||'default',document).catch?.(()=>{});
  }

  function inlineMarkdown(value){
    const code=[];
    let source=String(value??'').replace(/`([^`\n]+)`/g,(_match,text)=>{
      const token=`@@NYX_INLINE_${code.length}@@`;
      code.push(`<code>${escapeHtml(text)}</code>`);
      return token;
    });
    let html=escapeHtml(source);
    html=html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html=html.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
    html=html.replace(/__([^_\n]+)__/g,'<strong>$1</strong>');
    html=html.replace(/~~([^~\n]+)~~/g,'<s>$1</s>');
    html=html.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');
    code.forEach((token,index)=>{html=html.replace(`@@NYX_INLINE_${index}@@`,token)});
    return html;
  }

  function tableCells(line){
    return String(line).trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());
  }

  function isTableDivider(line){
    const cells=tableCells(line);
    return cells.length>1&&cells.every(cell=>/^:?-{3,}:?$/.test(cell));
  }

  function isBlockStart(lines,index){
    const line=lines[index]||'';
    return /^```/.test(line)||/^#{1,3}\s+/.test(line)||/^>\s?/.test(line)||/^\s*[-*+]\s+/.test(line)||/^\s*\d+[.)]\s+/.test(line)||/^\s*(?:---+|___+)\s*$/.test(line)||(line.includes('|')&&isTableDivider(lines[index+1]||''));
  }

  function markdown(value){
    const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n');
    const blocks=[];
    for(let index=0;index<lines.length;){
      const line=lines[index];
      if(!line.trim()){index+=1;continue}

      const fence=line.match(/^```([^\s`]*)\s*$/);
      if(fence){
        const language=(fence[1]||'code').slice(0,24);
        const code=[];
        index+=1;
        while(index<lines.length&&!/^```\s*$/.test(lines[index])){code.push(lines[index]);index+=1}
        if(index<lines.length) index+=1;
        blocks.push(`<div class="ai-code-block"><div class="ai-code-head"><span>${escapeHtml(language)}</span><button class="ai-code-copy" type="button" data-copy-code aria-label="Copy code"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg><span>Copy</span></button></div><pre><code>${escapeHtml(code.join('\n'))}</code></pre></div>`);
        continue;
      }

      if(line.includes('|')&&isTableDivider(lines[index+1]||'')){
        const headers=tableCells(line);
        index+=2;
        const rows=[];
        while(index<lines.length&&lines[index].includes('|')&&lines[index].trim()){
          rows.push(tableCells(lines[index]));
          index+=1;
        }
        blocks.push(`<div class="ai-table-wrap"><table><thead><tr>${headers.map(cell=>`<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${headers.map((_header,cellIndex)=>`<td>${inlineMarkdown(row[cellIndex]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }

      const heading=line.match(/^(#{1,3})\s+(.+)$/);
      if(heading){
        const level=heading[1].length;
        blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        index+=1;
        continue;
      }

      if(/^>\s?/.test(line)){
        const quote=[];
        while(index<lines.length&&/^>\s?/.test(lines[index])){quote.push(lines[index].replace(/^>\s?/,''));index+=1}
        blocks.push(`<blockquote>${quote.map(inlineMarkdown).join('<br>')}</blockquote>`);
        continue;
      }

      const unordered=/^\s*[-*+]\s+/.test(line);
      const ordered=/^\s*\d+[.)]\s+/.test(line);
      if(unordered||ordered){
        const items=[];
        const pattern=ordered?/^\s*\d+[.)]\s+/:/^\s*[-*+]\s+/;
        while(index<lines.length&&pattern.test(lines[index])){items.push(lines[index].replace(pattern,''));index+=1}
        const tag=ordered?'ol':'ul';
        blocks.push(`<${tag}>${items.map(item=>`<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`);
        continue;
      }

      if(/^\s*(?:---+|___+)\s*$/.test(line)){
        blocks.push('<hr>');
        index+=1;
        continue;
      }

      const paragraph=[line];
      index+=1;
      while(index<lines.length&&lines[index].trim()&&!isBlockStart(lines,index)){
        paragraph.push(lines[index]);
        index+=1;
      }
      blocks.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`);
    }
    return blocks.join('');
  }

  function messageCopyButton(){
    return `<button class="ai-message-copy" type="button" data-copy-message title="Copy message" aria-label="Copy message"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg></button>`;
  }

  function setMessageContent(message,text,{error=false,thinking=false}={}){
    const content=message.querySelector('.ai-message-content');
    if(!content) return;
    message._nyxMessageText=String(text||'');
    message.classList.toggle('ai-message-error',error);
    message.classList.toggle('is-thinking',thinking);
    if(thinking){
      content.innerHTML='<span class="ai-thinking" aria-label="Nyx AI is thinking"><i></i><i></i><i></i></span>';
      return;
    }
    if(message.classList.contains('ai-message-user')||error){
      content.textContent=String(text||'');
      return;
    }
    content.innerHTML=markdown(text);
  }

  function addMessage(role,text,{error=false,thinking=false}={}){
    conversation.querySelector('[data-ai-welcome]')?.remove();
    conversation.classList.remove('is-empty');
    const assistant=role!=='user';
    const message=document.createElement('article');
    message.className=`ai-message ai-message-${assistant?'assistant':'user'}`;
    message.innerHTML=`
      <div class="ai-message-avatar" ${assistant?'data-nyx-logo aria-hidden="true"':'aria-hidden="true"'}>${assistant?'':'You'}</div>
      <div class="ai-message-body">
        <div class="ai-message-meta"><strong>${assistant?'Nyx AI':'You'}</strong><div class="ai-message-actions">${messageCopyButton()}</div></div>
        <div class="ai-message-content"></div>
      </div>`;
    setMessageContent(message,text,{error,thinking});
    conversation.appendChild(message);
    applyLogoTheme();
    scrollToBottom(true);
    return message;
  }

  function starterIcon(kind){
    const icons={
      project:'<path d="M4 7.5h16M7.5 4v7M16.5 4v7M5 12h14v8H5z"/>',
      explain:'<path d="M12 3a7 7 0 0 0-4 12.74V19h8v-3.26A7 7 0 0 0 12 3Z"/><path d="M9 22h6M9.5 15h5"/>',
      code:'<path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/>',
      ideas:'<path d="M12 3v3M4.22 6.22l2.12 2.12M3 14h3M18 14h3M17.66 8.34l2.12-2.12"/><path d="M8.5 18h7M9.5 21h5M12 8a5 5 0 0 0-3 9h6a5 5 0 0 0-3-9Z"/>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24">${icons[kind]||icons.ideas}</svg>`;
  }

  function starter(prompt,title,description,kind){
    return `<button class="ai-starter" type="button" data-prompt="${escapeHtml(prompt)}"><span class="ai-starter-icon">${starterIcon(kind)}</span><span class="ai-starter-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><svg class="ai-starter-arrow" aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4 6 6-6 6"/></svg></button>`;
  }

  function welcome(){
    return `<section class="ai-welcome" data-ai-welcome>
      <div class="ai-welcome-mark" data-nyx-logo aria-hidden="true"></div>
      <p class="ai-welcome-kicker">NYX INTELLIGENCE</p>
      <h2>What can I help you create?</h2>
      <p class="ai-welcome-copy">Ask a question, explore an idea, or work through something complex. Choose a starting point or write your own prompt below.</p>
      <div class="ai-starters">
        ${starter('Help me plan and build a new project from scratch','Help me build a project','Turn an idea into clear next steps','project')}
        ${starter('Explain quantum computing in simple terms with a useful analogy','Explain a complex topic','Make difficult ideas easier to understand','explain')}
        ${starter('Review this code for bugs, clarity, and performance improvements','Review my code','Find issues and suggest improvements','code')}
        ${starter('Brainstorm ten original ideas for a creative side project','Brainstorm ideas','Generate thoughtful directions to explore','ideas')}
      </div>
    </section>`;
  }

  function updateThreadTitle(items){
    const first=items.find(item=>item.role==='user')?.content||'';
    threadTitle.textContent=first ? (first.length>58?`${first.slice(0,58)}…`:first) : 'New conversation';
  }

  function render(){
    const items=savedMessages();
    conversation.innerHTML='';
    if(!items.length){
      conversation.classList.add('is-empty');
      conversation.innerHTML=welcome();
    }else{
      conversation.classList.remove('is-empty');
      items.forEach(item=>addMessage(item.role,item.content));
    }
    updateThreadTitle(items);
    applyLogoTheme();
  }

  function modelLabel(id){
    return modelCatalog.find(item=>item.id===id)?.label||id;
  }

  function groupedModels(models){
    const groups=new Map();
    models.forEach(item=>{
      const company=item.company||'Other models';
      if(!groups.has(company)) groups.set(company,[]);
      groups.get(company).push(item);
    });
    return [...groups];
  }

  function modelOptions(models){
    return groupedModels(models).map(([company,items])=>`<optgroup label="${escapeHtml(company)}">${items.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('')}</optgroup>`).join('');
  }

  function modelMenuOptions(models,selected){
    return groupedModels(models).map(([company,items],groupIndex)=>{
      const groupId=`modelGroup${groupIndex}`;
      return `<section class="ai-model-group" role="group" aria-labelledby="${groupId}">
        <p class="ai-model-group-label" id="${groupId}">${escapeHtml(company)}</p>
        ${items.map(item=>`<button class="ai-model-option" type="button" role="option" data-model-id="${escapeHtml(item.id)}" aria-selected="${item.id===selected?'true':'false'}">
          <span class="ai-model-option-label">${escapeHtml(item.label)}</span>
          <span class="ai-model-option-check" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m5 10 3 3 7-7"/></svg></span>
        </button>`).join('')}
      </section>`;
    }).join('');
  }

  function syncModelControl(){
    const selected=model.value||DEFAULT_MODEL;
    const label=modelLabel(selected);
    modelSelected.textContent=label;
    modelTrigger.title=`Model: ${label}`;
    modelTrigger.setAttribute('aria-label',`AI model: ${label}`);
    modelOptionsHost.querySelectorAll('[data-model-id]').forEach(option=>{
      option.setAttribute('aria-selected',String(option.dataset.modelId===selected));
    });
  }

  function renderModelOptions(models,selected){
    model.innerHTML=modelOptions(models);
    model.value=selected;
    modelOptionsHost.innerHTML=modelMenuOptions(models,selected);
    const count=modelMenu.querySelector('[data-model-count]');
    if(count) count.textContent=`${models.length} available`;
    syncModelControl();
  }

  function modelOptionElements(){
    return [...modelOptionsHost.querySelectorAll('[data-model-id]')];
  }

  function closeModelMenu({restoreFocus=false}={}){
    if(modelMenu.hidden) return;
    modelMenu.hidden=true;
    modelPicker.classList.remove('is-open');
    modelTrigger.setAttribute('aria-expanded','false');
    if(restoreFocus) modelTrigger.focus();
  }

  function openModelMenu(direction=0){
    if(modelTrigger.disabled) return;
    modelMenu.hidden=false;
    modelPicker.classList.add('is-open');
    modelTrigger.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>{
      const options=modelOptionElements();
      const selectedIndex=Math.max(0,options.findIndex(option=>option.getAttribute('aria-selected')==='true'));
      const index=direction<0?options.length-1:(direction>0?0:selectedIndex);
      options[index]?.focus({preventScroll:true});
      options[index]?.scrollIntoView({block:'nearest'});
    });
  }

  function selectModel(id){
    if(!modelCatalog.some(item=>item.id===id)) return;
    model.value=id;
    model.dispatchEvent(new Event('change',{bubbles:true}));
    closeModelMenu({restoreFocus:true});
  }

  async function loadModels(){
    const status=document.querySelector('.ai-model-status');
    model.disabled=true;
    modelTrigger.disabled=true;
    modelTrigger.setAttribute('aria-busy','true');
    try{
      const response=await fetch('/api/nyx-ai/models',{headers:{accept:'application/json'}});
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error||`Model catalog failed (${response.status})`);
      const next=Array.isArray(data?.models)?data.models.flatMap(item=>{
        const id=String(item?.id||'').trim();
        const label=String(item?.label||id).trim();
        const company=String(item?.company||'').trim();
        return id&&label?[{id,label,company}]:[];
      }):[];
      if(!next.length) throw new Error('No models are currently available.');
      modelCatalog=next;
      const saved=localStorage.getItem(MODEL_KEY)||DEFAULT_MODEL;
      const selected=next.some(item=>item.id===saved)?saved:(next.some(item=>item.id===DEFAULT_MODEL)?DEFAULT_MODEL:next[0].id);
      renderModelOptions(next,selected);
      localStorage.setItem(MODEL_KEY,selected);
      if(status) status.title=`${next.length} models available`;
    }catch(error){
      console.warn('Nyx AI model catalog could not be loaded:',error);
      if(status){status.classList.add('is-warning');status.title='Using the default model'}
    }finally{
      model.disabled=false;
      modelTrigger.disabled=false;
      modelTrigger.removeAttribute('aria-busy');
    }
  }

  function autoGrow(){
    input.style.height='auto';
    input.style.height=`${Math.min(input.scrollHeight,MAX_INPUT_HEIGHT)}px`;
    if(characterCount) characterCount.textContent=`${input.value.length} / ${input.maxLength}`;
  }

  function scrollToBottom(force=false){
    if(!force&&!followStream) return;
    requestAnimationFrame(()=>{feed.scrollTop=feed.scrollHeight});
  }

  function setBusy(busy){
    feed.setAttribute('aria-busy',String(busy));
    form.classList.toggle('is-busy',busy);
    input.disabled=busy;
    send.disabled=busy;
    send.setAttribute('aria-label',busy?'Waiting for Nyx AI':'Send message');
  }

  function clearChat(){
    activeController?.abort();
    activeController=null;
    setBusy(false);
    localStorage.removeItem(MESSAGE_KEY);
    render();
    input.value='';
    autoGrow();
    input.focus();
  }

  async function copyText(value){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(String(value||''));return}
    const helper=document.createElement('textarea');
    helper.value=String(value||'');
    helper.style.position='fixed';
    helper.style.opacity='0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }

  function showCopied(button){
    const label=button.querySelector('span');
    const previous=label?.textContent||'';
    button.classList.add('is-copied');
    button.setAttribute('aria-label','Copied');
    if(label) label.textContent='Copied';
    setTimeout(()=>{
      button.classList.remove('is-copied');
      button.setAttribute('aria-label',button.hasAttribute('data-copy-code')?'Copy code':'Copy message');
      if(label) label.textContent=previous||'Copy';
    },1200);
  }

  async function submitPrompt(){
    const prompt=input.value.trim();
    if(!prompt||send.disabled) return;
    const history=savedMessages();
    if(!history.length) updateThreadTitle([{role:'user',content:prompt}]);
    history.push({role:'user',content:prompt});
    addMessage('user',prompt);
    input.value='';
    autoGrow();
    const pending=addMessage('assistant','',{thinking:true});
    const requestedModel=model.value||DEFAULT_MODEL;
    activeController=new AbortController();
    setBusy(true);
    let answer='';
    let renderFrame=0;
    const renderAnswer=()=>{
      renderFrame=0;
      setMessageContent(pending,answer);
      scrollToBottom();
    };
    try{
      const response=await fetch('/api/nyx-ai',{
        method:'POST',
        signal:activeController.signal,
        headers:{'content-type':'application/json'},
        body:JSON.stringify({model:requestedModel,message:prompt,messages:history,stream:true})
      });
      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        throw new Error(data?.error||`Nyx AI failed (${response.status})`);
      }
      if(!response.body) throw new Error('The selected model did not return a stream.');
      const reader=response.body.getReader();
      const decoder=new TextDecoder();
      let buffer='';
      for(;;){
        const part=await reader.read();
        if(part.done) break;
        buffer+=decoder.decode(part.value,{stream:true});
        const lines=buffer.split(/\r?\n/);
        buffer=lines.pop()||'';
        for(const line of lines){
          if(!line.startsWith('data:')) continue;
          const raw=line.slice(5).trim();
          if(!raw||raw==='[DONE]') continue;
          try{
            const data=JSON.parse(raw);
            const token=data?.choices?.[0]?.delta?.content||data?.choices?.[0]?.text||'';
            if(token){
              answer+=token;
              if(!renderFrame) renderFrame=requestAnimationFrame(renderAnswer);
            }
          }catch{}
        }
      }
      if(renderFrame){cancelAnimationFrame(renderFrame);renderAnswer()}
      const clean=answer.trim();
      if(!clean) throw new Error('The selected model returned an empty response.');
      setMessageContent(pending,clean);
      history.push({role:'assistant',content:clean});
      saveMessages(history);
    }catch(error){
      if(error?.name==='AbortError') return;
      setMessageContent(pending,error?.message||'Nyx AI could not complete that request.',{error:true});
    }finally{
      activeController=null;
      setBusy(false);
      input.focus();
      scrollToBottom();
    }
  }

  applyWorkspaceTheme();
  addEventListener('message',event=>{
    if(event.data?.type==='nyx:theme-sync') applyWorkspaceTheme(event.data.theme);
  });
  addEventListener('storage',event=>{
    if(['nyx.theme','nyx.customThemeColor'].includes(event.key)) applyWorkspaceTheme();
  });
  feed.addEventListener('scroll',()=>{
    followStream=feed.scrollHeight-feed.scrollTop-feed.clientHeight<100;
  },{passive:true});
  feed.addEventListener('click',async event=>{
    const starter=event.target.closest('[data-prompt]');
    if(starter){
      input.value=starter.dataset.prompt||'';
      autoGrow();
      input.focus();
      form.requestSubmit();
      return;
    }
    const copyCode=event.target.closest('[data-copy-code]');
    if(copyCode){
      await copyText(copyCode.closest('.ai-code-block')?.querySelector('pre code')?.textContent||'');
      showCopied(copyCode);
      return;
    }
    const copyMessage=event.target.closest('[data-copy-message]');
    if(copyMessage){
      const message=copyMessage.closest('.ai-message');
      await copyText(message?._nyxMessageText||'');
      showCopied(copyMessage);
    }
  });
  form.addEventListener('submit',event=>{event.preventDefault();void submitPrompt()});
  input.addEventListener('input',autoGrow);
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.isComposing){
      event.preventDefault();
      form.requestSubmit();
    }
  });
  modelTrigger.addEventListener('click',()=>{
    if(modelMenu.hidden) openModelMenu();
    else closeModelMenu();
  });
  modelTrigger.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      openModelMenu(event.key==='ArrowDown'?1:-1);
    }else if(event.key==='Escape'){
      event.preventDefault();
      closeModelMenu();
    }
  });
  modelMenu.addEventListener('click',event=>{
    const option=event.target.closest('[data-model-id]');
    if(option) selectModel(option.dataset.modelId||'');
  });
  modelMenu.addEventListener('keydown',event=>{
    const option=event.target.closest('[data-model-id]');
    const options=modelOptionElements();
    const index=Math.max(0,options.indexOf(option));
    let target=-1;
    if(event.key==='ArrowDown') target=Math.min(options.length-1,index+1);
    else if(event.key==='ArrowUp') target=Math.max(0,index-1);
    else if(event.key==='Home') target=0;
    else if(event.key==='End') target=options.length-1;
    else if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      if(option) selectModel(option.dataset.modelId||'');
      return;
    }else if(event.key==='Escape'){
      event.preventDefault();
      closeModelMenu({restoreFocus:true});
      return;
    }else if(event.key==='Tab'){
      closeModelMenu();
      return;
    }
    if(target>=0){
      event.preventDefault();
      options[target]?.focus();
      options[target]?.scrollIntoView({block:'nearest'});
    }
  });
  document.addEventListener('pointerdown',event=>{
    if(!modelMenu.hidden&&!modelPicker.contains(event.target)) closeModelMenu();
  });
  model.addEventListener('change',()=>{
    localStorage.setItem(MODEL_KEY,model.value||DEFAULT_MODEL);
    model.title=modelLabel(model.value);
    syncModelControl();
  });
  clear.addEventListener('click',clearChat);

  renderModelOptions(modelCatalog,model.value||DEFAULT_MODEL);
  render();
  autoGrow();
  void loadModels();
  input.focus();
})();
