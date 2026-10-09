const {app, BrowserWindow, ipcMain, dialog, safeStorage, shell, Menu, Tray, nativeImage, globalShortcut} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {Broker} = require('./broker.cjs');
const {Store, redact} = require('./store.cjs');
const {Engine} = require('./engine.cjs');
const {Provider, ORIGIN} = require('./provider.cjs');
if (process.env.NOOK_TEST_DATA && !app.isPackaged) app.setPath('userData', process.env.NOOK_TEST_DATA);
app.setAppUserModelId('org.nyxlearning.nook.agent');
const entry = pathToFileURL(path.join(__dirname, 'index.html')).href;
let window, store, broker, engine, provider, tray, chosenRoot = '', toolController = null, approvalWindow = null, quitting = false;
const resources = path.join(__dirname, '..', 'resources').replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
const icon = path.join(__dirname, '..', 'resources', 'nook.ico');
function emit(event) { if (window && !window.isDestroyed()) window.webContents.send('nook:event', JSON.parse(redact(JSON.stringify(event)))); }
function lockedWindow(options = {}) {
  const result = new BrowserWindow({...options, icon, webPreferences: {sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, ...(options.webPreferences || {})}});
  result.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  result.webContents.on('will-attach-webview', event => event.preventDefault());
  result.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  result.webContents.session.setPermissionCheckHandler(() => false);
  return result;
}
function approve(title, detail, signal) {
  if (signal?.aborted || approvalWindow) return Promise.resolve(false);
  return new Promise(resolve => {
    const popup = lockedWindow({width: 720, height: 640, parent: window, modal: true, title: 'Nook Agent — Local approval', autoHideMenuBar: true, webPreferences: {preload: path.join(__dirname, 'approval-preload.cjs')}});
    approvalWindow = popup;
    let settled = false;
    const finish = value => {
      if (settled) return; settled = true;
      signal?.removeEventListener('abort', cancel); ipcMain.removeListener('nook:decision', decide);
      approvalWindow = null; if (!popup.isDestroyed()) popup.destroy(); resolve(value);
    };
    const cancel = () => finish(false);
    const decide = (event, value) => { if (event.sender === popup.webContents && event.senderFrame === popup.webContents.mainFrame && event.senderFrame.url === pathToFileURL(path.join(__dirname, 'approval.html')).href) finish(value === true); };
    ipcMain.on('nook:decision', decide); signal?.addEventListener('abort', cancel, {once: true});
    popup.on('closed', cancel);
    popup.webContents.on('will-navigate', event => event.preventDefault());
    popup.loadFile(path.join(__dirname, 'approval.html'));
    popup.webContents.once('did-finish-load', () => popup.webContents.send('nook:approval', {title, detail}));
  });
}
function stop() { engine?.stop(); toolController?.abort(); broker?.stop(); approvalWindow?.close(); emit({type: 'stopped'}); }
function web() {
  const remote = lockedWindow({width: 1200, height: 850, title: 'Nook — Web account', autoHideMenuBar: true, webPreferences: {partition: 'persist:nook-web'}});
  remote.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== ORIGIN) event.preventDefault(); });
  remote.loadURL(ORIGIN).catch(() => emit({type: 'error', body: {message: 'Cannot reach the Nook website.'}}));
}
const levels = [
  'Chat only. No local tools.',
  'Read selected project files. File content used by tasks is sent to your Nook model provider.',
  'Read selected project files and request edits. Each write requires local approval.',
  'Read and edit the project; request commands and application control. Every command and UI action requires separate approval. Commands are not sandboxed.',
  'Allow file edits inside the selected project without a prompt for each edit for the selected time. Commands and application control still require individual approval.',
  'Allow project edits and request administrator commands. Each administrator command requires a separate local approval and Windows UAC. No permanent elevation.'
];
async function manual(tool, args) {
  if (engine.active || toolController) throw Error('Another task is running. Stop it before manual actions.');
  toolController = new AbortController();
  try { const result = await broker.run(tool, args, toolController.signal); store.event('', 'manual', {tool, result}); return result; }
  finally { toolController = null; }
}
function register() {
  const actions = {
    status: () => ({version: app.getVersion(), permissions: broker.status(), chosenRoot, connected: provider.connected(), tasks: store.tasks(), memories: store.memories(), tray: !!tray}),
    chooseFolder: async () => { if (engine.active || toolController) throw Error('Stop the current task first.'); const result = await dialog.showOpenDialog(window, {title: 'Choose a project folder', properties: ['openDirectory']}); if (!result.canceled) { broker.revoke(); chosenRoot = result.filePaths[0]; } return chosenRoot; },
    grant: async ({level, minutes}) => { if (engine.active || toolController) throw Error('Stop the current task first.'); if (!Number.isInteger(level) || !levels[level]) throw Error('Invalid permission level.'); if (await approve('Approve local permissions?', `${levels[level]}\n\nProject: ${chosenRoot || 'None'}\nDuration: ${minutes} minutes\n\nPermissions expire automatically and are not restored after restarting Nook.`)) return broker.grant(chosenRoot, level, minutes); throw Error('Permission change declined.'); },
    revoke: () => { stop(); broker.revoke(); return broker.status(); },
    saveKey: async ({key}) => { if (engine.active) throw Error('Stop the current task first.'); return provider.save(key); },
    forgetKey: () => { stop(); provider.forget(); return true; },
    models: () => provider.models(),
    start: async data => { if (toolController || engine.active) throw Error('Another action is running.'); if (broker.status().level > 0 && !await approve('Start this task?', `Task:\n${data.prompt}\n\nModel: ${data.model}\nProject: ${broker.status().root}\n\nThe task can read permitted project files and send their contents and tool output to Nook and its model provider. Current permission level: ${broker.status().level}.`)) throw Error('Task declined.'); if (toolController || engine.active) throw Error('Another action is running.'); return engine.start(data); },
    pause: () => engine.pause(), resume: () => engine.resume(), stop,
    tool: ({tool, args}) => manual(tool, args),
    history: ({id}) => store.events(String(id)),
    remember: ({text}) => { store.remember(text); return store.memories(); },
    forgetMemory: ({id}) => { store.forget(String(id)); return store.memories(); },
    export: async () => { const target = await dialog.showSaveDialog(window, {defaultPath: 'nook-history.json', filters: [{name: 'JSON', extensions: ['json']}]}); if (target.canceled) return false; const tasks = store.tasks(); fs.writeFileSync(target.filePath, JSON.stringify({tasks: tasks.map(task => ({...task, events: store.events(task.id)})), memories: store.memories()}, null, 2)); return true; },
    clear: async () => { if (engine.active || toolController) throw Error('Stop the current task first.'); if (await approve('Clear local task history and memory?', 'This removes local activity and notes. Project files, recovery backups and web conversations remain.')) { store.clear(); return true; } return false; },
    web,
    downloads: () => shell.openExternal(ORIGIN + '/apps/agents/download.html'),
    tray: ({enabled}) => { if (enabled && !tray) { tray = new Tray(nativeImage.createFromPath(icon)); tray.setToolTip('Nook Agent — local runtime'); tray.setContextMenu(Menu.buildFromTemplate([{label: 'Open Nook', click: () => window.show()}, {label: 'STOP AGENT', click: stop}, {label: 'Quit', click: () => { quitting = true; app.quit(); }}])); tray.on('double-click', () => window.show()); } else if (!enabled && tray) { tray.destroy(); tray = null; } return !!tray; }
  };
  ipcMain.handle('nook:invoke', async (event, name, payload = {}) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== entry) throw Error('Untrusted IPC sender.');
    if (!Object.hasOwn(actions, name) || !payload || typeof payload !== 'object' || Buffer.byteLength(JSON.stringify(payload)) > 300000) throw Error('Invalid desktop request.');
    try { return {ok: true, data: await actions[name](payload)}; }
    catch (error) { return {ok: false, error: redact(error.message)}; }
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  app.whenReady().then(() => {
    const data = app.getPath('userData'); fs.mkdirSync(data, {recursive: true});
    store = new Store(path.join(data, 'nook.sqlite'));
    provider = new Provider({file: path.join(data, 'account.dpapi'), safeStorage});
    try { provider.load(); } catch {}
    broker = new Broker({backup: path.join(data, 'backups'), approve, helper: path.join(resources, 'automation.ps1'), emit});
    engine = new Engine({provider, broker, store, emit});
    window = lockedWindow({width: 1320, height: 880, minWidth: 800, minHeight: 600, title: 'Nook Agent', autoHideMenuBar: true, backgroundColor: '#111715', webPreferences: {preload: path.join(__dirname, 'preload.cjs')}});
    Menu.setApplicationMenu(Menu.buildFromTemplate([{label: 'Nook', submenu: [{label: 'STOP AGENT', accelerator: 'CommandOrControl+Shift+Escape', click: stop}, {label: 'Reload interface', click: () => { stop(); window.reload(); }}, {role: 'quit'}]}, {label: 'Edit', submenu: [{role: 'undo'}, {role: 'redo'}, {type: 'separator'}, {role: 'cut'}, {role: 'copy'}, {role: 'paste'}, {role: 'selectAll'}]}, {label: 'View', submenu: [{role: 'resetZoom'}, {role: 'zoomIn'}, {role: 'zoomOut'}]}]));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('render-process-gone', () => { stop(); broker.revoke(); });
    window.on('close', event => { if (tray && !quitting) { event.preventDefault(); window.hide(); } else { stop(); quitting = true; app.quit(); } });
    register(); window.loadURL(entry);
    globalShortcut.register('CommandOrControl+Shift+Escape', stop);
  }).catch(error => { dialog.showErrorBox('Nook could not start', redact(error.message)); app.quit(); });
}
app.on('before-quit', () => { quitting = true; stop(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); store?.close(); });
app.on('window-all-closed', () => { if (!tray) app.quit(); });
