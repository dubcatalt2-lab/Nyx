const $ = id => document.getElementById(id);
let currentFile = null, currentFolder = '', busy = false;
const invoke = (name, data) => window.nook.invoke(name, data);
function error(message) { $('error').textContent = message; $('error').hidden = !message; }
function guard(fn) { return async event => { event?.preventDefault(); error(''); try { await fn(event); } catch (issue) { error(issue.message); } }; }
function button(text, action) { const node = document.createElement('button'); node.textContent = text; node.onclick = guard(action); return node; }
function page(name) { document.querySelectorAll('[data-panel]').forEach(node => node.hidden = node.dataset.panel !== name); document.querySelectorAll('nav [data-page]').forEach(node => { if (node.dataset.page === name) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); }); }
document.querySelectorAll('[data-page]').forEach(node => node.onclick = guard(async () => { page(node.dataset.page); if (node.dataset.page === 'history' || node.dataset.page === 'memory') await refresh(); }));
function renderMemories(items) { $('memories').replaceChildren(); for (const item of items) { const row = document.createElement('article'), text = document.createElement('pre'); text.textContent = item.text; row.append(text, button('Delete note', async () => renderMemories(await invoke('forgetMemory', {id: item.id})))); $('memories').append(row); } }
async function refresh() {
  const status = await invoke('status');
  $('version').textContent = 'Windows · v' + status.version;
  $('connection').textContent = status.connected ? 'Nook account connected' : 'Account not connected';
  $('selectedRoot').textContent = status.chosenRoot || 'No folder selected';
  const access = status.permissions;
  $('scope').textContent = access.level ? `Level ${access.level} · ${access.root} · until ${new Date(access.expires).toLocaleTimeString()}` : 'Chat only · no project access';
  $('tray').checked = status.tray;
  $('taskList').replaceChildren();
  for (const task of status.tasks) $('taskList').append(button(`${task.title} — ${task.state}`, async () => { $('historyDetail').textContent = JSON.stringify(await invoke('history', {id: task.id}), null, 2); }));
  renderMemories(status.memories);
  return status;
}
async function models(items) { const list = items || await invoke('models'); const old = $('model').value; $('model').replaceChildren(); for (const model of list) $('model').append(new Option(model.name || model.id, model.id)); if (list.some(model => model.id === old)) $('model').value = old; }
function message(role, text) { $('conversation').querySelector('.intro')?.remove(); const row = document.createElement('article'), name = document.createElement('strong'), content = document.createElement('pre'); row.className = 'message'; name.textContent = role === 'assistant' ? 'Nook' : 'You'; content.textContent = text; row.append(name, content); $('conversation').append(row); row.scrollIntoView({block: 'nearest'}); }
window.nook.subscribe(event => {
  if (event.type === 'state') { $('state').textContent = event.state; }
  if (event.type === 'message') message(event.body.role, event.body.text);
  if (event.type === 'terminal') { $('terminalOutput').textContent = ($('terminalOutput').textContent + event.body.text).slice(-64000); }
  if (event.type === 'error') error(event.body.message);
  if (['tool', 'result', 'approval'].includes(event.type)) { const row = document.createElement('article'), label = document.createElement('strong'), content = document.createElement('pre'); label.textContent = event.type; content.textContent = JSON.stringify(event.body, null, 2); row.append(label, content); $('activity').append(row); }
  if (event.type === 'pause-requested') $('state').textContent = 'Pausing after current step';
  if (event.type === 'stopped') $('state').textContent = 'Stop requested';
});
$('web').onclick = guard(() => invoke('web'));
$('downloads').onclick = guard(() => invoke('downloads'));
$('stop').onclick = guard(() => invoke('stop'));
$('pause').onclick = guard(() => invoke('pause'));
$('resume').onclick = guard(() => invoke('resume'));
$('taskForm').onsubmit = guard(async () => { if (busy) return; busy = true; $('run').disabled = true; try { await invoke('start', {prompt: $('prompt').value, model: $('model').value}); await refresh(); } finally { busy = false; $('run').disabled = false; } });
$('chooseFolder').onclick = guard(async () => { await invoke('chooseFolder'); currentFile = null; $('editor').value = ''; $('files').replaceChildren(); $('saveFile').disabled = true; await refresh(); });
$('permissionForm').onsubmit = guard(async () => { await invoke('grant', {level: Number($('level').value), minutes: Number($('minutes').value)}); await refresh(); });
$('revoke').onclick = guard(async () => { await invoke('revoke'); await refresh(); });
$('keyForm').onsubmit = guard(async () => { const key = $('key').value; $('key').value = ''; await models(await invoke('saveKey', {key})); await refresh(); });
$('loadModels').onclick = guard(() => models());
$('forgetKey').onclick = guard(async () => { await invoke('forgetKey'); $('model').replaceChildren(new Option('Connect account to load models', '')); await refresh(); });
$('tray').onchange = guard(() => invoke('tray', {enabled: $('tray').checked}));
$('export').onclick = guard(() => invoke('export'));
$('clear').onclick = guard(async () => { if (await invoke('clear')) { $('activity').replaceChildren(); $('conversation').replaceChildren(); $('historyDetail').textContent = ''; } await refresh(); });
$('memoryForm').onsubmit = guard(async () => { renderMemories(await invoke('remember', {text: $('memoryText').value})); $('memoryText').value = ''; });
async function files(folder = '') { const result = await invoke('tool', {tool: 'list', args: {path: folder}}); currentFolder = folder; $('currentFolder').textContent = folder || 'Project root'; $('files').replaceChildren(); if (folder) $('files').append(button('← Parent folder', () => files(folder.split('/').slice(0, -1).join('/')))); for (const entry of result.entries) $('files').append(button((entry.directory ? '▸ ' : '') + entry.name, async () => { if (entry.directory) return files(entry.path); currentFile = await invoke('tool', {tool: 'read', args: {path: entry.path}}); $('fileName').textContent = entry.path; $('editor').value = currentFile.content; $('saveFile').disabled = false; $('fileStatus').textContent = ''; })); }
$('refreshFiles').onclick = guard(() => files(currentFolder));
$('saveFile').onclick = guard(async () => { if (!currentFile) return; const result = await invoke('tool', {tool: 'write', args: {path: currentFile.path, expectedHash: currentFile.hash, content: $('editor').value}}); currentFile.hash = result.hash; $('fileStatus').replaceChildren(document.createTextNode('Saved and verified. '), button('Undo this edit', async () => { await invoke('tool', {tool: 'undo', args: {id: result.id}}); currentFile = await invoke('tool', {tool: 'read', args: {path: currentFile.path}}); $('editor').value = currentFile.content; $('fileStatus').textContent = 'Restored.'; })); });
$('commandForm').onsubmit = guard(async () => { $('terminalOutput').textContent = ''; const result = await invoke('tool', {tool: 'command', args: {command: $('command').value, shell: $('shell').value, cwd: $('cwd').value}}); $('terminalOutput').textContent += `\nExit: ${result.exitCode} · ${result.durationMs} ms${result.stopped ? ' · ' + result.stopped : ''}`; });
$('inspectForm').onsubmit = guard(async () => { const pid = Number($('processId').value), data = await invoke('tool', {tool: 'ui.inspect', args: {pid}}); $('controls').replaceChildren(); for (const control of data.result) { const row = document.createElement('article'), text = document.createElement('p'); text.textContent = `${control.type} · ${control.name || '(unnamed)'} · ${control.id}`; const value = document.createElement('input'); value.setAttribute('aria-label', 'New value for ' + (control.name || control.id)); row.append(text, button('Invoke', async () => { $('computerResult').textContent = JSON.stringify(await invoke('tool', {tool: 'ui.invoke', args: {pid, id: control.id}}), null, 2); }), value, button('Set value', async () => { $('computerResult').textContent = JSON.stringify(await invoke('tool', {tool: 'ui.setValue', args: {pid, id: control.id, value: value.value}}), null, 2); })); $('controls').append(row); } });
$('elevateForm').onsubmit = guard(async () => { $('computerResult').textContent = JSON.stringify(await invoke('tool', {tool: 'elevate', args: {command: $('adminCommand').value}}), null, 2); });
refresh().then(status => { if (status.connected) return models(); }).catch(issue => error(issue.message));
setInterval(() => refresh().catch(() => {}), 30000);
