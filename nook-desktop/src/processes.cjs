const {spawn} = require('node:child_process');
const path = require('node:path');
const system = process.env.SystemRoot || 'C:\\Windows';
const powershell = path.join(system, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const cmd = path.join(system, 'System32', 'cmd.exe');
function execute(executable, args, {cwd, signal, input, timeout = 60000, onOutput = () => {}} = {}) {
  if (signal?.aborted) return Promise.reject(Error('Stopped.'));
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(executable, args, {cwd, windowsHide: true, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIAL|ELECTRON_RUN_AS_NODE|NODE_OPTIONS/i.test(key)))});
    let stdout = '', stderr = '', reason = '';
    const stop = why => {
      if (reason) return;
      reason = why;
      if (child.pid) spawn(path.join(system, 'System32', 'taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'});
    };
    const abort = () => stop('cancelled');
    const timer = setTimeout(() => stop('timeout'), timeout);
    signal?.addEventListener('abort', abort, {once: true});
    for (const [name, stream] of [['stdout', child.stdout], ['stderr', child.stderr]]) stream.on('data', chunk => {
      const text = chunk.toString();
      if (name === 'stdout') stdout += text; else stderr += text;
      onOutput({stream: name, text: text.slice(0, 16000)});
      if (stdout.length + stderr.length > 64000) { stdout = stdout.slice(0, 32000); stderr = stderr.slice(0, 32000); stop('output limit'); }
    });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', code => { cleanup(); resolve({stdout, stderr, exitCode: code, durationMs: Date.now() - started, stopped: reason || false}); });
    child.stdin.on('error', () => {});
    child.stdin.end(input || '');
    if (signal?.aborted) abort();
  });
}
function command(command, shell, options) {
  if (typeof command !== 'string' || !command.trim() || command.length > 6000 || command.includes('\0')) throw Error('Enter a command of 1–6000 characters.');
  if (!['powershell', 'cmd'].includes(shell)) throw Error('Choose PowerShell or CMD.');
  return shell === 'cmd' ? execute(cmd, ['/d', '/s', '/c', command], options) : execute(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], options);
}
module.exports = {execute, command, powershell};
