const {spawn} = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const {Broker} = require('../src/broker.cjs');
const {powershell} = require('../src/processes.cjs');
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-uia-')); fs.mkdirSync(path.join(root, 'project'));
  const child = spawn(powershell, ['-NoProfile', '-NonInteractive', '-STA', '-File', path.join(__dirname, '..', 'test', 'uia-fixture.ps1')], {windowsHide: false, stdio: 'ignore'});
  try {
    const broker = new Broker({backup: path.join(root, 'backups'), helper: path.join(__dirname, '..', 'resources', 'automation.ps1'), approve: async () => true}); broker.grant(path.join(root, 'project'), 3);
    let controls;
    for (let i = 0; i < 15; i++) { await new Promise(resolve => setTimeout(resolve, 500)); controls = (await broker.run('ui.inspect', {pid: child.pid})).result; if (controls.some(c => c.name === 'Nook test action')) break; }
    const button = controls.find(c => c.name === 'Nook test action'), field = controls.find(c => c.name === 'Nook test field');
    assert(button); assert(field);
    assert((await broker.run('ui.setValue', {pid: child.pid, id: field.id, value: 'edited by UIA'})).result.dispatched);
    assert.equal((await broker.run('ui.inspect', {pid: child.pid})).result.find(c => c.id === field.id).value, 'edited by UIA');
    assert((await broker.run('ui.invoke', {pid: child.pid, id: button.id})).result.dispatched);
    assert.equal((await broker.run('ui.inspect', {pid: child.pid})).result.find(c => c.id === field.id).value, 'invoked');
    await assert.rejects(broker.run('ui.invoke', {pid: child.pid, id: '0.0.0'}), /no longer exists/);
    console.log('PASS real Windows UI Automation inspect, ValuePattern, InvokePattern and stale-control rejection against a dedicated test application');
  } finally { child.kill(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
