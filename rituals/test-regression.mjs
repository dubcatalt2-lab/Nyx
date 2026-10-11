import {spawn} from 'node:child_process';
import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const group = process.argv[2] || 'core';
const selected = new Set(process.argv.slice(3));
const browserNames = `account-controls account-signup activity-layout ai-workspace ai-company-icons ai-cooldown-workspace ai-history-workspace ai-usage-workspace chat-social-workspace chat-voice-relay code-studio code-studio-actions code-suggestions developer-api-ui game-cloud-save games-built movie-startup-recovery movies nyxtube nyxtube-native-ui nyxtube-segments nyxify-player nyxify-navigation-races owner-traffic owner-ai-status profile-popup storage-migration static-publisher-workspace theme-restoration wallpaper-failure workspace-settings-layout`.split(' ');
if (!['core','browser'].includes(group)) throw new Error('Use core or browser');
const output = resolve(root, '.codex-artifacts/regression-' + group);
await mkdir(output, {recursive:true});
const available = (await readdir(resolve(root, 'rituals'))).filter(name => /^test-.*\.mjs$/.test(name));
const files = [];
for (const name of available.sort()) {
  if (name === 'test-regression.mjs' || /^test-(?:drop|tutsi|remote)-/.test(name)) continue;
  const source = await readFile(resolve(root, 'rituals', name), 'utf8');
  const included = group === 'browser' ? browserNames.includes(name.slice(5,-4)) : !source.includes('playwright');
  if (included && (!selected.size || selected.has(name) || selected.has(name.slice(5,-4)))) files.push(name);
}
if (!files.length) throw new Error('No tests selected');
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata|appdata|comspec|programfiles|programfiles\(x86\)|programdata)$/i.test(name)));
Object.assign(environment, {NYX_TEST_BASE_URL:'http://127.0.0.1:8080', NYX_TEST_STATIC_ROOT:resolve(root,'dist'), NYX_TEST_ASSET_ROOT:resolve(root,'dist'), NYX_TEST_HEADLESS:'1', NYX_TEST_BUILT:'1', NYX_TEST_BRANDS:'nyx',WISP_URL:'ws://127.0.0.1:8080/resources/live/',NYX_TEST_WISP_URL:'ws://127.0.0.1:8080/resources/live/'});
const results = [];
for (const name of files) {
  const started = Date.now();
  let outputText = '', timedOut = false;
  const child = spawn(process.execPath, [resolve(root,'rituals',name)], {cwd:root,env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data', bytes => outputText += bytes);
  child.stderr.on('data', bytes => outputText += bytes);
  const timer = setTimeout(() => {
    timedOut = true;
    if (process.platform === 'win32') spawn('taskkill.exe', ['/PID',String(child.pid),'/T','/F'], {windowsHide:true,stdio:'ignore'});
    else child.kill('SIGKILL');
  }, group === 'browser' ? 150000 : 60000);
  const code = await new Promise(resolveExit => {
    child.once('error', error => {outputText += '\n'+error.stack;resolveExit(-1);});
    child.once('close', resolveExit);
  });
  clearTimeout(timer);
  const entry = {name,status:timedOut?'TIMEOUT':code===0?'PASS':'FAIL',code,milliseconds:Date.now()-started,log:name+'.log'};
  results.push(entry);
  await writeFile(resolve(output,entry.log),outputText);
  await writeFile(resolve(output,'results.json'),JSON.stringify({group,results},null,2)+'\n');
  console.log(entry.status+' '+name+' '+entry.milliseconds+'ms');
}
const counts = Object.fromEntries(['PASS','FAIL','TIMEOUT'].map(status=>[status,results.filter(row=>row.status===status).length]));
console.log(JSON.stringify({group,total:results.length,...counts,report:resolve(output,'results.json')}));
if (counts.FAIL || counts.TIMEOUT) process.exitCode = 1;
