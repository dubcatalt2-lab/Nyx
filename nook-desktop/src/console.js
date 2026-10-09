let workspaceData = {items: [], sessions: [], tasks: []};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('icon');
  for (const [tag, attributes] of window.NookIcons[name] || []) {
    const node = document.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attributes)) if (key !== 'key') node.setAttribute(key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), value);
    svg.append(node);
  }
  return svg;
}
document.querySelectorAll('[data-icon]').forEach(node => node.prepend(icon(node.dataset.icon)));
function company(id) { return window.NookBranding.companies[id.split('/')[0]]?.[0] || id.split('/')[0] || 'Other'; }
function modelIcon(id = '') {
  const key = Object.keys(window.NookBranding.models).sort((a,b) => b.length-a.length).find(key => id.toLowerCase().startsWith(key));
  const item = window.NookBranding.models[key];
  if (!item) { const label = document.createElement('span'); label.className = 'model-fallback'; label.textContent = company(id).slice(0,2).toUpperCase(); label.setAttribute('aria-hidden','true'); return label; }
  const img = document.createElement('img'); img.src = '../resources/model-icons/' + item.file; img.alt = ''; img.className = 'model-icon' + (item.mask ? ' mono' : ''); return img;
}
function modelName(id) { return modelCatalog.find(item => item.id === id)?.label || modelCatalog.find(item => item.id === id)?.name || id || 'Nook'; }
function renderReply(role, text, model = '', reasoning = '') {
  $('conversation').querySelector('.intro')?.remove();
  document.querySelector('.thinking-message')?.remove();
  const row = document.createElement('article'), header = document.createElement('div'), name = document.createElement('strong'), content = document.createElement('pre');
  row.className = 'message ' + (role === 'user' ? 'user' : 'assistant'); header.className = 'message-heading';
  name.textContent = role === 'user' ? 'You' : modelName(model);
  if (role !== 'user') header.append(modelIcon(model));
  header.append(name); row.append(header);
  if (reasoning) {
    const details = document.createElement('details'), summary = document.createElement('summary'), body = document.createElement('pre');
    details.className = 'reasoning-summary'; summary.textContent = 'Thinking summary'; body.textContent = reasoning; details.append(summary, body); row.append(details);
  }
  content.textContent = text; row.append(content); $('conversation').append(row); row.scrollIntoView({block:'nearest'}); return row;
}
function showThinking(model) {
  const row = renderReply('assistant', '', model); row.classList.add('thinking-message'); row.setAttribute('role','status');
  const content = row.querySelector('pre'); content.className = 'thinking-content';
  const dot = document.createElement('span'); dot.className = 'thinking-dot'; dot.setAttribute('aria-hidden','true'); content.append(dot, document.createTextNode('Thinking…'));
}
function renderModels() {
  const query = $('modelQuery').value.trim().toLowerCase(), selectedCompany = $('modelCompany').value;
  const filtered = modelCatalog.filter(item => (!selectedCompany || company(item.id) === selectedCompany) && [item.id, item.label, item.name, company(item.id)].join(' ').toLowerCase().includes(query));
  $('modelCount').textContent = filtered.length + ' of ' + modelCatalog.length + ' models available to your account'; $('modelOptions').replaceChildren();
  for (const item of filtered) {
    const node = button('', () => { if (busy || queueRunning) throw Error('Wait for the current run before changing models.'); if (item.text === false) return invoke('web'); $('model').value = item.id; $('model').dispatchEvent(new Event('change')); $('modelDialog').close(); $('prompt').focus(); });
    node.className = 'model-option'; node.setAttribute('aria-pressed', String(item.id === $('model').value));
    const copy = document.createElement('span'), title = document.createElement('strong'), detail = document.createElement('small');
    title.textContent = item.label || item.name || item.id;
    detail.textContent = [company(item.id), item.vision ? 'Vision' : '', item.reasoning ? 'Reasoning' : '', item.allowanceLabel || '', item.text === false ? 'Open on Nook web' : ''].filter(Boolean).join(' · ');
    copy.append(title, detail); node.append(modelIcon(item.id), copy); $('modelOptions').append(node);
  }
  if (!filtered.length) $('modelOptions').append(empty('No models match this filter.'));
}
function syncModelPicker() {
  const name = document.createElement('span'); name.textContent = modelName($('model').value) || 'Choose model';
  $('modelTrigger').replaceChildren(modelIcon($('model').value), name); $('modelTrigger').disabled = !modelCatalog.length;
  const filter = $('modelCompany').value;
  $('modelCompany').replaceChildren(new Option('All companies',''), ...[...new Set(modelCatalog.map(item=>company(item.id)))].sort().map(name=>new Option(name,name)));
  $('modelCompany').value = filter;
  const preferred = $('profileModel').value;
  $('profileModel').replaceChildren(new Option('Keep current model',''), ...modelCatalog.filter(item=>item.text !== false).map(item=>new Option(item.label || item.name || item.id,item.id)));
  $('profileModel').value = preferred;
  renderModels();
}
$('modelTrigger').onclick = () => { renderModels(); $('modelDialog').showModal(); $('modelQuery').focus(); };
$('closeModels').onclick = () => $('modelDialog').close();
$('modelQuery').oninput = renderModels; $('modelCompany').onchange = renderModels;
$('collapseSidebar').onclick = () => { const collapsed = document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem('nook.sidebar',String(collapsed)); $('collapseSidebar').replaceChildren(icon(collapsed?'expand':'collapse')); $('collapseSidebar').setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar'); $('collapseSidebar').title = collapsed?'Expand sidebar':'Collapse sidebar'; };
if (localStorage.getItem('nook.sidebar') === 'true') $('collapseSidebar').click();
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); page('search'); $('sessionQuery').focus(); } });
function empty(text) { const node = document.createElement('p'); node.className = 'empty'; node.textContent = text; return node; }
function itemRow(title, text = '') { const row = document.createElement('article'), copy = document.createElement('div'), heading = document.createElement('strong'); row.className = 'item-row'; copy.className = 'item-copy'; heading.textContent = title; copy.append(heading); if (text) { const body = document.createElement('pre'); body.textContent = text; copy.append(body); } row.append(copy); return {row, copy}; }
function toggle(label, checked, change) { const node = document.createElement('label'), input = document.createElement('input'); node.className = 'check'; input.type = 'checkbox'; input.checked = checked; input.onchange = guard(async () => { try { await change(input.checked); } catch (error) { input.checked = !input.checked; throw error; } }); node.append(input, document.createTextNode(label)); return node; }
function renderMemoryItems(items) {
  $('memories').replaceChildren();
  for (const item of items) {
    const {row,copy} = itemRow(new Date(item.updated).toLocaleDateString(), item.text);
    copy.append(toggle('Use in conversations', !!item.enabled, async enabled => { await invoke('memoryContext', {id:item.id,enabled}); await refreshWorkspace(); }));
    row.append(button('Delete', async()=>{ await invoke('forgetMemory',{id:item.id}); await refreshWorkspace(); })); $('memories').append(row);
  }
  if (!items.length) $('memories').append(empty('No saved memory yet. Add a decision or preference above.'));
}
async function openSession(id) {
  if (busy || queueRunning) throw Error('Stop the current run before switching sessions.');
  const messages = await invoke('session',{id}); sessionId = id; $('conversation').replaceChildren(); $('activity').replaceChildren(); activityCount = 0; $('activityCount').textContent = ''; $('prompt').value = '';
  messages.forEach(item=>message(item.role,item.text,item.model,item.reasoning)); page('agent'); renderSessions();
}
function renderSessions() {
  $('sessions').replaceChildren(); $('sessionResults').replaceChildren(); const query = $('sessionQuery').value.trim().toLowerCase();
  for (const item of workspaceData.sessions.slice(0,8)) { const node = button(item.title,()=>openSession(item.id)); node.title = item.title; if (item.id === sessionId) node.setAttribute('aria-current','true'); $('sessions').append(node); }
  for (const item of workspaceData.sessions.filter(item=>item.title.toLowerCase().includes(query))) { const node = button(item.title,()=>openSession(item.id)); node.className = 'session-result'; const date = document.createElement('small'); date.textContent = new Date(item.updated).toLocaleDateString(); node.append(date); $('sessionResults').append(node); }
  if (!$('sessions').children.length) $('sessions').append(empty('Your conversations appear here.'));
  if (!$('sessionResults').children.length) $('sessionResults').append(empty('No matching sessions.'));
}
$('sessionQuery').oninput = renderSessions;
function renderLibrary(kind) {
  const target = $(kind === 'skill' ? 'skillsList' : 'profilesList'); target.replaceChildren();
  for (const item of workspaceData.items.filter(item=>item.kind === kind)) {
    const {row,copy} = itemRow(item.title,item.body);
    copy.append(toggle(kind === 'skill' ? 'Use in conversations' : 'Active profile', !!item.enabled, async enabled => {
      if (busy || queueRunning) throw Error('Wait until the current run finishes.');
      if (kind === 'profile' && enabled && item.model) { if (!modelCatalog.some(model=>model.id === item.model && model.text !== false)) throw Error('This profile’s model is no longer available. Edit its model first.'); $('model').value = item.model; $('model').dispatchEvent(new Event('change')); }
      await invoke('saveItem',{...item,enabled}); await refreshWorkspace();
    }));
    const actions = document.createElement('div'); actions.className = 'row';
    actions.append(button('Edit',()=>{ $(kind+'Id').value=item.id; $(kind+'Title').value=item.title; $(kind+'Body').value=item.body; if (kind==='profile') $('profileModel').value=item.model; $(kind+'Title').focus(); }),button('Delete',async()=>{await invoke('removeItem',{id:item.id});await refreshWorkspace();})); row.append(actions); target.append(row);
  }
  if (!target.children.length) target.append(empty(kind === 'skill' ? 'Save your first skill above.' : 'No profiles yet. Your current model works without one.'));
}
for (const kind of ['skill','profile']) $(kind+'Form').onsubmit = guard(async()=>{
  const id = $(kind+'Id').value, old = workspaceData.items.find(item=>item.id===id);
  if (busy || queueRunning) throw Error('Wait until the current run finishes.');
  await invoke('saveItem',{id:id||undefined,kind,title:$(kind+'Title').value,body:$(kind+'Body').value,model:kind==='profile'?$('profileModel').value:'',enabled:!!old?.enabled}); $(kind+'Form').reset(); await refreshWorkspace();
});
$('todoForm').onsubmit = guard(async()=>{await invoke('saveItem',{kind:'task',title:$('todoTitle').value});$('todoForm').reset();await refreshWorkspace();});
$('queueForm').onsubmit = guard(async()=>{if(queueRunning)throw Error('Stop the queue before editing it.');await invoke('saveItem',{kind:'queue',title:$('queueTitle').value,body:$('queueBody').value});$('queueForm').reset();await refreshWorkspace();});
function renderTasks() {
  for (const [kind,host] of [['task','todosList'],['queue','queueList']]) {
    $(host).replaceChildren();
    const items = workspaceData.items.filter(item=>item.kind===kind).sort((a,b)=>a.updated-b.updated);
    for (const item of items) {
      const {row,copy}=itemRow(item.title,kind==='queue'?item.body:'');
      copy.append(toggle(kind==='queue'?'Completed':'Done',!!item.enabled,async enabled=>{if(queueRunning)throw Error('Stop the queue before editing it.');await invoke('saveItem',{...item,enabled});await refreshWorkspace();}));
      row.append(button('Open in chat',()=>{page('agent');$('prompt').value=item.body||item.title;$('prompt').focus();}),button('Delete',async()=>{if(queueRunning)throw Error('Stop the queue before editing it.');await invoke('removeItem',{id:item.id});await refreshWorkspace();}));$(host).append(row);
    }
    if (!items.length) $(host).append(empty(kind==='task'?'Nothing on your list yet.':'Add the prompts you want to run, in order.'));
  }
}
$('runQueue').onclick = guard(async()=>{
  if(busy||queueRunning)throw Error('A run is already active.');if(!connected)return setup();
  const queue=workspaceData.items.filter(item=>item.kind==='queue'&&!item.enabled).sort((a,b)=>a.updated-b.updated);
  if(!queue.length)throw Error('Add a step, or uncheck a completed step to run it again.');if(queue.length>10)throw Error('Run at most 10 steps at a time.');
  activeModel=$('model').value;
  if(!activeModel)throw Error('Choose a model first.');
  if(!await invoke('reviewQueue',{steps:queue.map(item=>({title:item.title,prompt:item.body})),model:activeModel}))return;
  queueRunning=true;sessionId='';$('conversation').replaceChildren();page('agent');
  try { for(const [index,item] of queue.entries()) {
    if(!queueRunning)break;running(true);$('queueStatus').textContent=`Running ${index+1} of ${queue.length}: ${item.title}`;
    const result=await invoke('start',{prompt:item.body||item.title,model:activeModel,session:sessionId});sessionId=result.session||sessionId;
    if(result.state!=='completed')throw Error('Queue stopped: '+result.state+'. Remaining steps were not run.');
    await invoke('saveItem',{...item,enabled:true});await refreshWorkspace();
  } $('queueStatus').textContent=queueRunning?'Queue complete.':'Queue stopped. Remaining steps were not run.'; }
  catch(issue) { $('queueStatus').textContent=issue.message; throw issue; }
  finally { queueRunning=false;running(false);document.querySelector('.thinking-message')?.remove();lastUsage=0;await refresh(); }
});
$('stopQueue').onclick=guard(async()=>{queueRunning=false;await invoke('stop');$('queueStatus').textContent='Stopping. Remaining steps will not run.';});
async function refreshWorkspace() {
  workspaceData=await invoke('workspace');renderSessions();renderMemoryItems(workspaceData.memories);renderLibrary('skill');renderLibrary('profile');renderTasks();
  $('dashboardStats').replaceChildren();
  for(const [label,value] of [['Sessions',workspaceData.sessions.length],['Completed jobs',workspaceData.tasks.filter(item=>item.state==='completed').length],['Open tasks',workspaceData.items.filter(item=>item.kind==='task'&&!item.enabled).length],['Enabled memories',workspaceData.memories.filter(item=>item.enabled).length]]) { const group=document.createElement('div'),term=document.createElement('dt'),count=document.createElement('dd');term.textContent=label;count.textContent=value;group.append(term,count);$('dashboardStats').append(group); }
  $('recentWork').replaceChildren();for(const task of workspaceData.tasks.slice(0,6))$('recentWork').append(button(task.title+' · '+task.state,async()=>{page('history');$('historyDetail').textContent=JSON.stringify(await invoke('history',{id:task.id}),null,2);}));
  if(!workspaceData.tasks.length)$('recentWork').append(empty('Start a conversation to create your first run.'));
}
function resetConsole() { sessionId='';queueRunning=false;modelCatalog=[];workspaceData={items:[],sessions:[],tasks:[],memories:[]};$('modelDialog').close();for(const id of ['skillForm','profileForm','todoForm','queueForm'])$(id).reset();$('sessionQuery').value='';$('modelQuery').value='';$('queueStatus').textContent='Nothing starts automatically.';syncModelPicker(); }
function renderTestWorkspace(copy) {
  $('createTest').hidden=!!copy;$('reviewTest').hidden=!copy;$('leaveTest').hidden=!copy;
  $('testWorkspaceStatus').textContent=copy?`Test copy: ${copy.root} · ${copy.copied} files copied · ${copy.skipped.length} excluded entries. Dependencies are not copied.`:'Work on a separate project copy before applying changes.';
  if(copy)$('scope').textContent='Test workspace · '+$('scope').textContent;
  if(!copy)$('testChanges').replaceChildren();
}
function resetFileView() { currentFile=null;currentFolder='';$('files').replaceChildren();$('editor').value='';$('saveFile').disabled=true; }
$('createTest').onclick=guard(async()=>{await invoke('createTestWorkspace');resetFileView();await refresh();await files();});
$('leaveTest').onclick=guard(async()=>{if(await invoke('leaveTestWorkspace')){resetFileView();await refresh();}});
async function reviewTestChanges() {
  const changes=await invoke('testChanges');$('testChanges').replaceChildren();
  for(const change of changes){const {row,copy}=itemRow(change.path,change.kind);if(change.preview){const details=document.createElement('details'),summary=document.createElement('summary'),preview=document.createElement('pre');summary.textContent='Preview updated file';preview.textContent=change.preview;details.append(summary,preview);copy.append(details);}if(change.applicable)row.append(button('Review & apply',async()=>{await invoke('applyTestChange',{path:change.path,hash:change.hash});await reviewTestChanges();}));else copy.append(empty('Deleted, binary or oversized files must be reviewed manually; they are not applied automatically.'));$('testChanges').append(row);}
  if(!changes.length)$('testChanges').append(empty('No changes to apply.'));
}
$('reviewTest').onclick=guard(reviewTestChanges);
