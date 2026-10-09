const fs = require('node:fs');
const path = require('node:path');
const {execute} = require('./processes.cjs');
function binary(name) {
  const candidates = name === 'gh' ? [path.join(process.env.ProgramFiles || 'C:\\Program Files','GitHub CLI','gh.exe')] : [path.join(process.env.ProgramFiles || 'C:\\Program Files','Git','cmd','git.exe')];
  for(const folder of (process.env.PATH || '').split(path.delimiter)) candidates.push(path.join(folder,name+'.exe'));
  const found = candidates.find(file => path.isAbsolute(file) && fs.existsSync(file));
  if(!found) throw Error((name === 'gh' ? 'GitHub CLI' : 'Git') + ' is not installed. Install it using the link in Connections, then reopen Nook.');
  return found;
}
class Connections {
  constructor({run = execute, find = binary, emit = () => {}} = {}) { Object.assign(this,{run,find,emit}); }
  async status(signal) {
    try {
      const result = await this.run(this.find('gh'),['api','user','--jq','.login'],{signal,timeout:15000});
      const login = result.stdout.trim();
      return result.exitCode === 0 && /^[a-z\d-]{1,39}$/i.test(login) ? {connected:true,login} : {connected:false,message:'Sign in to GitHub to load your repositories.'};
    } catch(error) { return {connected:false,message:error.message}; }
  }
  async login(signal) {
    const result = await this.run(this.find('gh'),['auth','login','--hostname','github.com','--git-protocol','https','--web'],{signal,timeout:300000,onOutput:output=>this.emit(output.text)});
    if(result.exitCode !== 0 || result.stopped) throw Error('GitHub sign-in did not complete. '+(result.stopped || result.stderr).slice(0,300));
    const setup = await this.run(this.find('gh'),['auth','setup-git','--hostname','github.com'],{signal});
    if(setup.exitCode !== 0) throw Error('GitHub connected, but Git credential setup failed.');
    return this.status(signal);
  }
  async repositories(signal) {
    const result = await this.run(this.find('gh'),['repo','list','--limit','100','--json','nameWithOwner,isPrivate,url'],{signal,timeout:30000});
    if(result.exitCode !== 0) throw Error('Could not load repositories. Check GitHub sign-in.');
    return JSON.parse(result.stdout);
  }
  async clone(repository, destination, signal) {
    if(typeof repository !== 'string' || !/^[a-z\d][a-z\d-]{0,38}\/[a-z\d_.-]{1,100}$/i.test(repository) || repository.endsWith('/..')) throw Error('Enter a GitHub repository as owner/name.');
    if(fs.existsSync(destination)) throw Error('Destination already exists. Open that folder or choose another location.');
    this.find('git');
    const result = await this.run(this.find('gh'),['repo','clone',repository,destination],{signal,timeout:300000,onOutput:output=>this.emit(output.text)});
    if(result.exitCode !== 0 || result.stopped) throw Error('Clone did not complete. '+(result.stopped || result.stderr).slice(-500));
    return destination;
  }
}
module.exports = {Connections};
