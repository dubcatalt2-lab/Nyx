import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

if (process.platform !== 'win32') {
  console.log('SKIP Windows local launcher test on this platform.');
  process.exit(0);
}
                                                                             
                                                                             
const root = mkdtempSync(join(tmpdir(), 'nyx-launcher-test-'));
mkdirSync(join(root, 'scripts'));
copyFileSync(new URL('./start-local-accounts.ps1', import.meta.url), join(root, 'scripts/start-local-accounts.ps1'));
writeFileSync(join(root, 'firebase.json'), JSON.stringify({project_id:'fixture', client_email:'fixture@example.invalid', private_key:'fixture'}));
const config = {serviceAccountPath:join(root,'firebase.json'), firebaseWebApiKey:'fixture', ownerUid:'fixture'};
writeFileSync(join(root,'run.ps1'), `function global:npm {
  [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.json'), (ConvertTo-Json @{ coordinator=$env:NYXCLOUD_COORDINATOR_ORIGIN; port=$env:PORT }))
  $global:LASTEXITCODE=0
}
& (Join-Path $PSScriptRoot 'scripts/start-local-accounts.ps1')
`);
function run(setting, override='') {
  writeFileSync(join(root,'.nyx-local.json'), JSON.stringify({...config, desktopCoordinatorOrigin:setting}));
  return spawnSync('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'run.ps1')], {
    encoding:'utf8', env:{...process.env, PORT:'8080', NYX_YOUTUBE_NATIVE_ENABLED:'0', NYXCLOUD_COORDINATOR_ORIGIN:override}, timeout:15000
  });
}
for (const [setting, override, expected] of [
  ['https://queue.example/', '', 'https://queue.example'],
  ['https://queue.example', 'https://override.example', 'https://override.example'],
  ['', '', ''],
]) {
  const result=run(setting,override);
  assert.equal(result.status,0,result.stderr);
  const actual=JSON.parse(readFileSync(join(root,'result.json'),'utf8').replace(/^\uFEFF/,''));
  assert.equal(actual.coordinator || '',expected);
  assert.equal(actual.port,'8080');
}
for (const origin of ['http://queue.example','https://user:pass@queue.example','https://queue.example/path','https://queue.example/?key=x','https://queue.example/#fragment']) {
  const result=run(origin);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Desktop coordinator must be an HTTPS origin/);
}
console.log('PASS actual local launcher: shared origin, environment override, optional configuration, origin validation, port 8080 preserved.');
