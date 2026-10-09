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
let window, store, broker, engine, provider, tray, profileRoot, testWorkspace = null, accountBusy = false, chosenRoot = '', toolController = null, approvalWindow = null, quitting = false;
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
  if (engine.active || toolController || accountBusy) throw Error('Another task is running. Stop it before manual actions.');
  toolController = new AbortController();
  try { const result = await broker.run(tool, args, toolController.signal); store.event('', 'manual', {tool, result}); return result; }
  finally { toolController = null; }
}
function activateProfile() {
  broker?.revoke();store?.close();chosenRoot='';testWorkspace=null;
  const uid=provider.account.session?.uid;
  const base=app.getPath('userData'),hash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');
  const identity=uid||(provider.key?'key:'+hash(provider.key):'signed-out');
  profileRoot=path.join(base,'profiles',hash(identity));
  fs.mkdirSync(profileRoot,{recursive:true});
  const marker=path.join(base,'legacy-profile.json');
  if(!uid&&provider.key&&!fs.existsSync(marker)&&fs.existsSync(path.join(base,'nook.sqlite'))){
    const legacy=new Store(path.join(base,'nook.sqlite'));legacy.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');legacy.close();
    for(const name of ['nook.sqlite','project.json']){const original=path.join(base,name),target=path.join(profileRoot,name);if(fs.existsSync(original)&&!fs.existsSync(target)){fs.copyFileSync(original,target);if(hash(fs.readFileSync(original))!==hash(fs.readFileSync(target)))throw Error('Local data migration could not be verified.');}}
    if(fs.existsSync(path.join(base,'backups'))&&!fs.existsSync(path.join(profileRoot,'backups')))fs.cpSync(path.join(base,'backups'),path.join(profileRoot,'backups'),{recursive:true,errorOnExist:true,force:false});
    fs.writeFileSync(marker,JSON.stringify({profile:hash(identity),copiedAt:Date.now()}));
  }
  try { const saved=JSON.parse(fs.readFileSync(path.join(profileRoot,'project.json'),'utf8'));if(typeof saved.root==='string'&&path.isAbsolute(saved.root)&&fs.statSync(saved.root).isDirectory())chosenRoot=saved.root; } catch {}
  store=new Store(path.join(profileRoot,'nook.sqlite'));
  broker=new Broker({backup:path.join(profileRoot,'backups'),approve,helper:path.join(resources,'automation.ps1'),emit});
  engine=new Engine({provider,broker,store,emit});
}
async function changeAccount(action) {
  if(engine.active||toolController||accountBusy||approvalWindow)throw Error('Finish the current action before changing accounts.');
  accountBusy=true;broker.revoke();
  try{const result=await action();activateProfile();return result;}finally{accountBusy=false;}
}
function register() {
  const actions = {
    status: () => ({version: app.getVersion(), permissions: broker.status(), vmAvailable:fs.existsSync(path.join(process.env.LOCALAPPDATA || '','NyxCloud','nook-agent.json')), chosenRoot, testWorkspace:testWorkspace?.status()||null, connected: provider.connected(), account:provider.account.session?{uid:provider.account.session.uid,email:provider.account.session.email}:null,tasks: store.tasks(), memories: store.memories(), tray: !!tray}),
    signIn: data => changeAccount(()=>provider.signIn(data)),
    accountDetails: () => provider.account.details(),
    resetPassword: ({email}) => provider.account.reset(email),
    revokeDesktopKey: () => changeAccount(async()=>{if(!await approve('Revoke your desktop key?','All desktop sessions using this account key will stop working. Your existing developer API key is unchanged.'))throw Error('Revocation cancelled.');await provider.account.revoke();provider.forget();return true;}),
    connectVM: async () => {if(engine.active||toolController||accountBusy)throw Error('Stop the current task first.');const vm=new (require('./vm.cjs').PrivateVM)();await vm.status();const owner=profileRoot;if(!await approve('Use your private Nyx VM?', 'File and terminal tools will use /home/nook-agent/workspace inside your Debian VM for 60 minutes. Nook uses a dedicated unprivileged guest account. Commands and edits still require approval. Windows files are not automatically copied. Existing local project access is replaced.'))throw Error('VM connection declined.');if(owner!==profileRoot||engine.active||toolController||accountBusy)throw Error('Workspace changed.');testWorkspace=null;return broker.grantVM(vm);},
    chooseFolder: async () => { if (engine.active || toolController || accountBusy) throw Error('Stop the current task first.'); const owner=profileRoot; const result = await dialog.showOpenDialog(window, {title: 'Choose a project folder', properties: ['openDirectory']}); if (result.canceled) return null; if(owner!==profileRoot||engine.active||toolController||accountBusy)throw Error('Workspace changed while choosing a folder. Try again.'); broker.revoke(); testWorkspace=null; chosenRoot = result.filePaths[0]; fs.writeFileSync(path.join(profileRoot, 'project.json'), JSON.stringify({root: chosenRoot})); return chosenRoot; },
    grant: async ({level, minutes}) => { if (engine.active || toolController || accountBusy) throw Error('Stop the current task first.'); if (!Number.isInteger(level) || !levels[level]) throw Error('Invalid permission level.'); if (await approve('Approve local permissions?', `${levels[level]}\n\nProject: ${testWorkspace?.root || chosenRoot || 'None'}\nDuration: ${minutes} minutes\n\nPermissions expire automatically and are not restored after restarting Nook.`)) return broker.grant(testWorkspace?.root||chosenRoot, level, minutes); throw Error('Permission change declined.'); },
    revoke: () => { stop(); broker.revoke(); return broker.status(); },
    saveKey: ({key}) => changeAccount(()=>provider.save(key)),
    forgetKey: () => changeAccount(()=>{provider.forget();return true;}),
    models: () => provider.models(),
    start: async data => { if (toolController || engine.active || accountBusy) throw Error('Another action is running.'); if (broker.status().level > 0 && !await approve('Start this task?', `Task:\n${data.prompt}\n\nModel: ${data.model}\nProject: ${broker.status().root}\n\nThe task can read permitted project files and send their contents and tool output to Nook and its model provider. Current permission level: ${broker.status().level}.`)) throw Error('Task declined.'); if (toolController || engine.active || accountBusy) throw Error('Another action is running.'); return engine.start(data); },
    createTestWorkspace: async () => {
      if(engine.active||toolController||accountBusy||testWorkspace)throw Error('Stop current work and return to the original project before creating another test copy.');
      if(broker.status().target==='vm')throw Error('The VM already has a separate workspace.');if(!chosenRoot)throw Error('Choose a project folder first.');
      const owner=profileRoot,original=chosenRoot;
      if(!await approve('Create a test workspace?', `Copy project: ${original}\n\nThe agent will work in a separate copy. Credentials, links, node_modules and files over 4 MB are excluded. Dependencies may need installing in the copy. Commands still run with your Windows user permissions; this is not OS-level isolation. Changes return to the original only when you review and apply them. This grants level 3 access to the copy for 60 minutes; edits and commands still request approval.`))throw Error('Test workspace cancelled.');
      if(owner!==profileRoot||original!==chosenRoot||engine.active||toolController||accountBusy)throw Error('Workspace changed. Try again.');
      testWorkspace=new (require('./test-workspace.cjs').TestWorkspace)(original,path.join(profileRoot,'test-workspaces'),path.join(profileRoot,'backups'));
      broker.grant(testWorkspace.root,3,60);return testWorkspace.status();
    },
    testChanges: () => {if(!testWorkspace)throw Error('Create a test workspace first.');return testWorkspace.changes();},
    applyTestChange: async ({path:relative,hash}) => {
      if(!testWorkspace||engine.active||toolController||accountBusy)throw Error('Stop the current task before applying changes.');
      const copy=testWorkspace,content=copy.copy.read(relative);
      if(content.hash!==hash)throw Error('Test copy changed. Refresh the review.');
      if(!await approve('Apply this file to the original project?', `${copy.original.root}\n${relative}\n\n${content.content}\n\nNewer original edits will not be overwritten. A recovery copy is saved.`))throw Error('Apply cancelled.');
      if(copy!==testWorkspace||engine.active||toolController||accountBusy)throw Error('Workspace changed.');
      const result=copy.apply(relative,hash);store.event('','apply-test-change',result);return result;
    },
    leaveTestWorkspace: async () => {if(engine.active||toolController||accountBusy)throw Error('Stop the current task first.');if(!testWorkspace)return;const location=testWorkspace.root;if(!await approve('Return to your original project?', `The test copy remains at ${location}. Unapplied changes are not copied back. Local tool access will be revoked.`))return false;testWorkspace=null;broker.revoke();return true;},
    pause: () => engine.pause(), resume: () => engine.resume(), stop,
    tool: ({tool, args}) => manual(tool, args),
    history: ({id}) => store.events(String(id)),
    workspace: () => ({items: store.workspace.items(), sessions: store.workspace.sessions(), memories: store.memories(), tasks: store.tasks()}),
    reviewQueue: ({steps, model}) => { if (engine.active || toolController || accountBusy || !Array.isArray(steps) || !steps.length || steps.length > 10 || typeof model !== 'string' || steps.some(step => typeof step.title !== 'string' || typeof step.prompt !== 'string' || step.prompt.length > 8000)) throw Error('Invalid queue or another action is running.'); return approve('Run this sequence?', `Model: ${model}\n\n${steps.map((step,index) => `${index+1}. ${step.title}\n${step.prompt}`).join('\n\n')}\n\nThese steps use your Nook account allowance and share conversation context. Current local approvals still apply. The queue stops on failure and never starts automatically.`); },
    saveItem: data => store.workspace.save(data),
    removeItem: ({id}) => store.workspace.remove(id),
    session: ({id}) => store.workspace.messages(id),
    memoryContext: ({id, enabled}) => store.workspace.memory(id, enabled),
    remember: ({text}) => { store.remember(text); return store.memories(); },
    forgetMemory: ({id}) => { store.forget(String(id)); return store.memories(); },
    export: async () => { const target = await dialog.showSaveDialog(window, {defaultPath: 'nook-history.json', filters: [{name: 'JSON', extensions: ['json']}]}); if (target.canceled) return false; const tasks = store.tasks(); fs.writeFileSync(target.filePath, JSON.stringify({tasks: tasks.map(task => ({...task, events: store.events(task.id)})), memories: store.memories()}, null, 2)); return true; },
    clear: async () => { if (engine.active || toolController || accountBusy) throw Error('Stop the current task first.'); if (await approve('Clear local workspace?', 'This removes local sessions, activity, memory, skills, profiles, task lists and queues. Project files, recovery backups and web conversations remain.')) { store.clear(); return true; } return false; },
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
    provider = new Provider({file: path.join(data, 'account.dpapi'), safeStorage});
    try { provider.load(); } catch {}
    activateProfile();
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
