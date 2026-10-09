const fs = require('node:fs');
const path = require('node:path');
const {Workspace} = require('./files.cjs');
const {command, execute, powershell} = require('./processes.cjs');
const denied = message => Object.assign(Error(message), {code: 'DENIED'});
class Broker {
  constructor({backup, approve, helper, emit = () => {}}) { Object.assign(this, {backup, approve, helper, emit}); this.level = 0; this.expires = 0; this.workspace = null; this.generation = 0; }
  status() { return {level: Date.now() < this.expires ? this.level : 0, root: this.workspace?.root || '', expires: this.expires, target: this.vm ? 'vm' : 'local', platform: this.vm ? 'linux' : 'windows'}; }
  grant(root, level, minutes = 30) {
    if (!Number.isInteger(level) || level < 0 || level > 5 || !Number.isInteger(minutes) || minutes < 1 || minutes > 60) throw Error('Invalid permission scope.');
    const workspace = root ? new Workspace(root, this.backup) : null;
    if (level > 0 && !workspace) throw Error('Choose a project folder first.');
    this.vm = null; this.generation++; this.workspace = workspace; this.level = level; this.expires = Date.now() + minutes * 60000; return this.status();
  }
  async grantVM(vm) { const info=await vm.status();this.generation++;this.vm=vm;this.workspace={root:info.root};this.level=3;this.expires=Date.now()+3600000;return this.status(); }
  stop() { this.generation++; }
  revoke() { this.generation++; this.level = 0; this.expires = 0; }
  async run(tool, args, signal = new AbortController().signal) {
    const revision = this.generation;
    const minimum = ['list', 'read', 'search'].includes(tool) ? 1 : ['write', 'mkdir', 'undo'].includes(tool) ? 2 : tool === 'elevate' ? 5 : ['command', 'ui.inspect', 'ui.invoke', 'ui.setValue'].includes(tool) ? 3 : 99;
    const check = () => {
      if (signal.aborted || revision !== this.generation) throw denied('Stopped or permissions changed.');
      if (this.status().level < minimum || !this.workspace) throw denied('This tool is outside the current local permission grant.');
    };
    check();
    if (!args || typeof args !== 'object' || Array.isArray(args) || Buffer.byteLength(JSON.stringify(args)) > 280000) throw Error('Invalid tool arguments.');
    const confirm = async (title, detail) => {
      this.emit({type: 'approval', body: {tool, state: 'waiting'}});
      const accepted = await this.approve(title, detail, signal);
      check();
      if (!accepted) throw denied('The requested action was declined.');
    };
    if(this.vm){
      if(!['list','read','search','write','mkdir','undo','command'].includes(tool))throw denied('Windows application control and elevation are unavailable in VM mode.');
      if(['write','mkdir','undo','command'].includes(tool))await confirm('Allow this action inside your private VM?', tool === 'command' ? args.command + '\n\nLinux bash inside NyxCloud. This cannot elevate Windows.' : tool+'\n'+JSON.stringify(args));
      check();const result=await this.vm.run(tool,args,AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,this.expires-Date.now()))]));
      if(tool==='command')this.emit({type:'terminal',body:{text:(result.stdout||'')+(result.stderr||'')}});
      return result;
    }
    if (tool === 'list') return this.workspace.list(args.path || '');
    if (tool === 'read') return this.workspace.read(args.path);
    if (tool === 'search') return this.workspace.search(args.query);
    if (tool === 'write') {
      this.workspace.resolve(args.path, true);
      if (typeof args.content !== 'string') throw Error('Text content is required.');
      if (this.level < 4) await confirm('Save this file?', `${args.path}\n\n${args.content}`);
      check(); return this.workspace.write(args.path, args.content, args.expectedHash);
    }
    if (tool === 'mkdir') { this.workspace.resolve(args.path, true); if (this.level < 4) await confirm('Create folder?', args.path); check(); return this.workspace.mkdir(args.path); }
    if (tool === 'undo') { await confirm('Restore a previous file version?', `Change ${args.id}. Newer edits will not be overwritten.`); return this.workspace.undo(args.id); }
    if (tool === 'command') {
      const cwd = this.workspace.resolve(args.cwd || '');
      if (!fs.statSync(cwd).isDirectory()) throw Error('Working directory must be a folder.');
      if (typeof args.command !== 'string' || args.command.length > 6000) throw Error('Invalid command.');
      await confirm('Run this command once?', `${args.shell || 'powershell'} in ${cwd}\n\n${args.command}\n\nThis command has your Windows user permissions. It can access files and the network outside this project. Approval is for this exact command only.`);
      this.workspace.resolve(args.cwd || ''); check();
      return command(args.command, args.shell || 'powershell', {cwd, signal, timeout: Math.max(1, Math.min(60000, this.expires - Date.now())), onOutput: output => this.emit({type: 'terminal', body: output})});
    }
    if (tool.startsWith('ui.')) {
      if (!Number.isSafeInteger(args.pid) || args.pid < 1 || args.pid === process.pid) throw Error('Specify another application process ID.');
      if (tool !== 'ui.inspect' && (typeof args.id !== 'string' || !/^[\d.-]{1,160}$/.test(args.id))) throw Error('Inspect the application and use its returned control ID.');
      if (tool === 'ui.setValue' && (typeof args.value !== 'string' || args.value.length > 4000)) throw Error('Invalid control value.');
      await confirm('Allow application control once?', `Process ID: ${args.pid}\nAction: ${tool}\nControl: ${args.id || 'Read visible accessible controls'}\n${args.value || ''}\n\nUI content may be sent to the selected AI model. Do not approve actions in password managers, authentication or administrator prompts.`);
      const request = Buffer.from(JSON.stringify({action: tool.slice(3), pid: args.pid, id: args.id, value: args.value})).toString('base64');
      const result = await execute(powershell, ['-NoProfile', '-NonInteractive', '-File', this.helper, '-Request', request], {signal, timeout: 20000});
      if (result.exitCode !== 0 || result.stopped) throw Error(result.stderr.slice(0, 1500) || 'Application control did not finish.');
      return {result: JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim())};
    }
    if (tool === 'elevate') {
      if (typeof args.command !== 'string' || !args.command.trim() || args.command.length > 6000) throw Error('Invalid administrator command.');
      await confirm('Request administrator access for this command?', `${args.command}\n\nWindows UAC will request your approval separately. The administrator process is not sandboxed. STOP cannot guarantee termination of an elevated process. Approval does not carry over to future commands.`);
      const encoded = Buffer.from(args.command, 'utf16le').toString('base64');
      const script = `$p=Start-Process -FilePath '${powershell.replaceAll("'", "''")}' -Verb RunAs -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}' -Wait -PassThru; Write-Output $p.ExitCode; exit $p.ExitCode`;
      const result = await command(script, 'powershell', {cwd: this.workspace.root, signal, timeout: 120000});
      return {...result, elevated: true, note: 'UAC was requested for one command. Output is limited to its exit code; inspect the target to verify effects. An elevated child may continue after cancellation.'};
    }
    throw denied('Unknown capability.');
  }
}
module.exports = {Broker};
