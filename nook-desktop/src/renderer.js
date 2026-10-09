const $ = id => document.getElementById(id);
let currentFile = null, currentFolder = '', busy = false, connected = false, activityCount = 0, accountEditing = false, manualCount = 0;
const welcomeTemplate=document.querySelector('.intro').cloneNode(true);
let signedAccount = null, createAccount = false, authBusy = false, lastUsage = 0, sessionId = '', activeModel = '', modelCatalog = [], queueRunning = false;
const invoke = async (name, data) => { if (name === 'tool') { manualCount++; $('stop').hidden = false; } try { return await window.nook.invoke(name, data); } finally { if (name === 'tool') { manualCount--; $('stop').hidden = !busy && !manualCount; } } };
function error(message) { $('error').textContent = message; $('error').hidden = !message; }
function guard(fn) { return async event => { event?.preventDefault(); error(''); try { await fn(event); } catch (issue) { error(issue.message); } }; }
function button(text, action) { const node = document.createElement('button'); node.textContent = text; node.onclick = guard(action); return node; }
function page(name) { document.querySelectorAll('[data-panel]').forEach(node => node.hidden = node.dataset.panel !== name); document.querySelectorAll('nav [data-page]').forEach(node => { if (node.dataset.page === name) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); }); }
function setup() { if (queueRunning || busy) { error('Stop the current run before switching accounts.'); return; } accountEditing = true; page('agent'); $('accountSetup').hidden = false; $('email').focus(); }
function running(value) { busy = value; $('run').disabled = value || !connected || !$('model').value; $('stop').hidden = !value && !manualCount; $('pause').hidden = !value; if (!value) $('resume').hidden = true; }
document.querySelectorAll('[data-page]').forEach(node => node.onclick = guard(async () => { page(node.dataset.page); if (node.dataset.page === 'history' || node.dataset.page === 'memory') await refresh(); }));
function renderMemories(items) { renderMemoryItems(items); }
async function refresh() {
  const status = await invoke('status');
  connected = status.connected;
  signedAccount = status.account;
  $('accountName').textContent = status.account?.email || (connected ? 'Connected with an API key' : 'Not signed in');
  $('accountUsage').hidden = !status.account;
  $('accountSetup').hidden = connected && !accountEditing;
  running(busy);
  $('version').textContent = 'Windows · v' + status.version;
  $('connection').textContent = status.account?.email || (status.connected ? 'API key connected' : 'Not signed in');
  $('selectedRoot').textContent = status.chosenRoot || 'No folder selected';
  const access = status.permissions;
  $('scope').textContent = access.level ? `Project access until ${new Date(access.expires).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}` : status.chosenRoot ? 'Access paused · click folder to reconnect' : 'No folder needed for chat';
  $('quickFolder').textContent = status.chosenRoot ? status.chosenRoot.split(/[\\/]/).pop() : '+ Open folder';
  $('quickFolder').title = status.chosenRoot || 'Choose a project folder';
  $('tray').checked = status.tray;
  renderTestWorkspace(status.testWorkspace);
  $('taskList').replaceChildren();
  for (const task of status.tasks) $('taskList').append(button(`${task.title} — ${task.state}`, async () => { $('historyDetail').textContent = JSON.stringify(await invoke('history', {id: task.id}), null, 2); }));
  renderMemories(status.memories);
  await refreshWorkspace();
  if(signedAccount && Date.now()-lastUsage>60000) loadUsage().catch(issue => { $('usageStatus').textContent = issue.message; });
  return status;
}
async function loadUsage() {
  if(!signedAccount)return;const uid=signedAccount.uid;lastUsage=Date.now();
  const account=await invoke('accountDetails');if(signedAccount?.uid!==uid)return;
  const usage=account.usage,total=usage.total,format=value=>Number(value||0).toLocaleString();
  $('accountName').textContent=account.name+(account.name!==account.email?' · '+account.email:'');
  $('tokenSummary').textContent=usage.unlimited?'No personal token limit':format(total.remaining)+' of '+format(total.limit)+' tokens remaining';
  $('tokenMeter').max=total.limit||1;$('tokenMeter').value=usage.unlimited?0:total.used;
  $('usageReset').textContent=usage.resetAt?'Resets '+new Date(usage.resetAt).toLocaleString():'Your '+usage.periodDays+'-day window starts with your first message.';
  $('modelLimits').replaceChildren();
  for(const text of ['Higher-cost models: '+(usage.unlimited?'no personal limit':format(usage.expensive.remaining)+' tokens remaining'), 'Haiku 4.5 allowance: '+(usage.unlimited?'no personal limit':'$'+Number(usage.haiku.remainingUsd||0).toFixed(3)+' remaining'), 'Haiku 5.5 uses your normal token pool.']){const row=document.createElement('p');row.textContent=text;$('modelLimits').append(row);}
  $('usageHint').textContent=usage.unlimited?'Nook account · no personal token limit':format(total.remaining)+' tokens remaining · shared with your Nook account';
  $('usageStatus').textContent='Updated '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
}
function resetAccountView() { resetConsole(); currentFile=null;currentFolder='';activityCount=0;lastUsage=0;for(const id of ['conversation','activity','files','controls','taskList','memories'])$(id).replaceChildren();$('conversation').append(welcomeTemplate.cloneNode(true));bindSuggestions();for(const id of ['editor','prompt','command','adminCommand','memoryText','key'])$(id).value='';for(const id of ['terminalOutput','computerResult','historyDetail','fileStatus','activityCount'])$(id).textContent='';$('saveFile').disabled=true;$('model').replaceChildren(new Option('Sign in to load models',''));$('usageHint').textContent='Enter to send · Shift + Enter for a new line'; }
$('authSwitch').onclick=()=>{if(authBusy)return;createAccount=!createAccount;$('setupTitle').textContent=createAccount?'Create your Nook account':'Sign in to Nook';$('signIn').textContent=createAccount?'Create account':'Sign in';$('authSwitch').textContent=createAccount?'Already have an account? Sign in':'Create account';$('usernameLabel').hidden=!createAccount;$('username').disabled=!createAccount;$('username').required=createAccount;$('password').autocomplete=createAccount?'new-password':'current-password';$('password').minLength=createAccount?8:1;$('authStatus').textContent='';};
$('signInForm').onsubmit=guard(async()=>{if(authBusy)return;authBusy=true;$('signIn').disabled=true;$('authStatus').textContent=createAccount?'Creating your account…':'Signing in…';try{await invoke('signIn',{email:$('email').value,password:$('password').value,username:$('username').value,create:createAccount});resetAccountView();accountEditing=false;await refresh();await models();$('authStatus').textContent='';$('prompt').focus();}catch(issue){$('authStatus').textContent=issue.message;}finally{$('password').value='';authBusy=false;$('signIn').disabled=false;}});
$('resetPassword').onclick=guard(async()=>{if(authBusy)return;await invoke('resetPassword',{email:$('email').value});$('authStatus').textContent='If an account exists for that email, check your inbox for a reset link.';});
$('refreshUsage').onclick=guard(loadUsage);
$('revokeDesktopKey').onclick=guard(async()=>{await invoke('revokeDesktopKey');resetAccountView();await refresh();});
async function models(items) { const list = items || await invoke('models'); modelCatalog = list; const old = $('model').value || localStorage.getItem('nook.model'); $('model').replaceChildren(); for (const model of list) $('model').append(new Option(model.label || model.name || model.id, model.id)); const selected = list.find(model => model.id === old) || list.find(model => model.id === 'anthropic/claude-haiku-5.5') || list[0]; if (selected) $('model').value = selected.id; syncModelPicker(); running(busy); }
$('model').onchange = () => { localStorage.setItem('nook.model', $('model').value); syncModelPicker(); };
function message(role, text, model = '', reasoning = '') { return renderReply(role, text, model, reasoning); }
window.nook.subscribe(event => {
  if (event.type === 'state') { if (event.state === 'planning') showThinking(activeModel); else document.querySelector('.thinking-message')?.remove(); $('state').textContent = ({planning:'Thinking…',executing:'Working…',observing:'Checking…',completed:'Done',cancelled:'Stopped',failed:'Needs attention',paused:'Paused'})[event.state] || event.state; $('resume').hidden = event.state !== 'paused'; $('pause').hidden = !busy || event.state === 'paused'; }
  if (event.type === 'message') { if (event.session) sessionId = event.session; message(event.body.role, event.body.text, event.body.model, event.body.reasoning); }
  if (event.type === 'terminal') { $('terminalOutput').textContent = ($('terminalOutput').textContent + event.body.text).slice(-64000); }
  if (event.type === 'error') error(event.body.message);
  if (['tool', 'result', 'approval'].includes(event.type)) { const row = document.createElement('article'), label = document.createElement('strong'), content = document.createElement('pre'); label.textContent = event.body.tool || event.type; content.textContent = JSON.stringify(event.body, null, 2); row.append(label, content); $('activity').append(row); $('activityCount').textContent = '(' + (++activityCount) + ')'; }
  if (event.type === 'pause-requested') $('state').textContent = 'Pausing after current step';
  if (event.type === 'stopped') $('state').textContent = 'Stop requested';
});
$('web').onclick = guard(() => invoke('web'));
$('setupWeb').onclick = guard(() => invoke('web'));
$('manageAccount').onclick = setup;
$('accountShortcut').onclick = setup;
$('newChat').onclick = guard(async () => { if (busy || queueRunning) throw Error('Stop the current task before starting a new conversation.'); sessionId = ''; $('conversation').replaceChildren(); $('activity').replaceChildren(); $('activityCount').textContent = ''; activityCount = 0; $('prompt').value = ''; $('state').textContent = 'Ready'; page('agent'); $('prompt').focus(); });
function bindSuggestions(){document.querySelectorAll('[data-prompt]').forEach(node => node.onclick = () => { $('prompt').value = node.dataset.prompt; $('prompt').focus(); });}
bindSuggestions();
$('prompt').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy && connected && $('model').value) $('taskForm').requestSubmit(); else if (!connected) setup(); } };
$('quickFolder').onclick = guard(async () => { if (busy) throw Error('Stop the current task before changing project access.'); const status = await invoke('status'); if (status.chosenRoot && status.permissions.level === 0) { await invoke('grant', {level:3,minutes:60}); } else { const folder = await invoke('chooseFolder'); if (!folder) return; currentFile = null; currentFolder = ''; $('editor').value = ''; $('files').replaceChildren(); $('saveFile').disabled = true; await invoke('grant', {level:3,minutes:60}); } await refresh(); $('prompt').focus(); });
$('downloads').onclick = guard(() => invoke('downloads'));
$('stop').onclick = guard(() => { queueRunning = false; return invoke('stop'); });
$('pause').onclick = guard(() => invoke('pause'));
$('resume').onclick = guard(() => invoke('resume'));
$('taskForm').onsubmit = guard(async () => { if (busy || queueRunning) return; if (!connected) return setup(); const prompt = $('prompt').value; activeModel = $('model').value; running(true); try { const result = await invoke('start', {prompt, model: activeModel, session: sessionId}); sessionId = result.session || sessionId; if ($('prompt').value === prompt) $('prompt').value = ''; lastUsage=0;await refresh(); } finally { running(false); document.querySelector('.thinking-message')?.remove(); } });
$('chooseFolder').onclick = guard(async () => { await invoke('chooseFolder'); currentFile = null; $('editor').value = ''; $('files').replaceChildren(); $('saveFile').disabled = true; await refresh(); });
$('permissionForm').onsubmit = guard(async () => { await invoke('grant', {level: Number($('level').value), minutes: Number($('minutes').value)}); await refresh(); });
$('revoke').onclick = guard(async () => { await invoke('revoke'); await refresh(); });
$('keyForm').onsubmit = guard(async () => { const key = $('key').value; $('connectAccount').disabled = true; $('setupStatus').textContent = 'Connecting…'; try { const list=await invoke('saveKey', {key});resetAccountView();await models(list); accountEditing = false; $('key').value = ''; $('setupStatus').textContent = ''; await refresh(); $('prompt').focus(); } catch (issue) { $('setupStatus').textContent = issue.message; } finally { $('connectAccount').disabled = false; } });
$('loadModels').onclick = guard(() => models());
$('forgetKey').onclick = guard(async () => { await invoke('forgetKey'); resetAccountView();accountEditing=false;await refresh(); });
$('tray').onchange = guard(() => invoke('tray', {enabled: $('tray').checked}));
$('export').onclick = guard(() => invoke('export'));
$('clear').onclick = guard(async () => { if (await invoke('clear')) { resetConsole(); $('activity').replaceChildren(); $('conversation').replaceChildren(); $('historyDetail').textContent = ''; } await refresh(); });
$('memoryForm').onsubmit = guard(async () => { renderMemories(await invoke('remember', {text: $('memoryText').value})); $('memoryText').value = ''; });
async function files(folder = '') { const result = await invoke('tool', {tool: 'list', args: {path: folder}}); currentFolder = folder; $('currentFolder').textContent = folder || 'Project root'; $('files').replaceChildren(); if (folder) $('files').append(button('← Parent folder', () => files(folder.split('/').slice(0, -1).join('/')))); for (const entry of result.entries) $('files').append(button((entry.directory ? '▸ ' : '') + entry.name, async () => { if (entry.directory) return files(entry.path); currentFile = await invoke('tool', {tool: 'read', args: {path: entry.path}}); $('fileName').textContent = entry.path; $('editor').value = currentFile.content; $('saveFile').disabled = false; $('fileStatus').textContent = ''; })); }
$('refreshFiles').onclick = guard(() => files(currentFolder));
$('saveFile').onclick = guard(async () => { if (!currentFile) return; const result = await invoke('tool', {tool: 'write', args: {path: currentFile.path, expectedHash: currentFile.hash, content: $('editor').value}}); currentFile.hash = result.hash; $('fileStatus').replaceChildren(document.createTextNode('Saved and verified. '), button('Undo this edit', async () => { await invoke('tool', {tool: 'undo', args: {id: result.id}}); currentFile = await invoke('tool', {tool: 'read', args: {path: currentFile.path}}); $('editor').value = currentFile.content; $('fileStatus').textContent = 'Restored.'; })); });
$('commandForm').onsubmit = guard(async () => { $('terminalOutput').textContent = ''; const result = await invoke('tool', {tool: 'command', args: {command: $('command').value, shell: $('shell').value, cwd: $('cwd').value}}); $('terminalOutput').textContent += `\nExit: ${result.exitCode} · ${result.durationMs} ms${result.stopped ? ' · ' + result.stopped : ''}`; });
$('inspectForm').onsubmit = guard(async () => { const pid = Number($('processId').value), data = await invoke('tool', {tool: 'ui.inspect', args: {pid}}); $('controls').replaceChildren(); for (const control of data.result) { const row = document.createElement('article'), text = document.createElement('p'); text.textContent = `${control.type} · ${control.name || '(unnamed)'} · ${control.id}`; const value = document.createElement('input'); value.setAttribute('aria-label', 'New value for ' + (control.name || control.id)); row.append(text, button('Invoke', async () => { $('computerResult').textContent = JSON.stringify(await invoke('tool', {tool: 'ui.invoke', args: {pid, id: control.id}}), null, 2); }), value, button('Set value', async () => { $('computerResult').textContent = JSON.stringify(await invoke('tool', {tool: 'ui.setValue', args: {pid, id: control.id, value: value.value}}), null, 2); })); $('controls').append(row); } });
$('elevateForm').onsubmit = guard(async () => { $('computerResult').textContent = JSON.stringify(await invoke('tool', {tool: 'elevate', args: {command: $('adminCommand').value}}), null, 2); });
refresh().then(status => { if (status.connected) return models(); }).catch(issue => error(issue.message));
setInterval(() => refresh().catch(() => {}), 30000);
