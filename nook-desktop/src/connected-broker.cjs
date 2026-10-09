const fs = require('node:fs');
const {PrivateVM} = require('./vm.cjs');
const {ProjectBridge} = require('./project-bridge.cjs');
class ConnectedBroker {
  constructor({local, config, directory, approve, emit = () => {}, vmFactory = () => new PrivateVM({config})}) { Object.assign(this,{local,config,directory,approve,emit,vmFactory}); this.bridge = null; }
  status() { return {...this.local.status(), testingAvailable:fs.existsSync(this.config), testing:this.bridge?.original.root === this.local.status().root ? this.bridge.status() : null}; }
  stop() { this.local.stop(); }
  project() {
    const access = this.local.status();
    if(access.level < 3 || !access.root) throw Object.assign(Error('Open a project and approve project access before using its test environment.'),{code:'DENIED'});
    if(!this.bridge || this.bridge.original.root !== access.root) this.bridge = new ProjectBridge({root:access.root,directory:this.directory,vm:this.vmFactory()});
    return this.bridge;
  }
  async run(tool, args, signal) {
    if(tool === 'browser') return this.vmFactory().run('browser', args, signal);
    if(!tool.startsWith('test.')) return this.local.run(tool,args,signal);
    const project = this.project(), revision = this.local.generation;
    signal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(Math.max(1,this.local.expires-Date.now()))]);
    const check = () => { if(signal?.aborted || revision !== this.local.generation || this.local.status().level < 3) throw Object.assign(Error('Project access expired or was revoked.'),{code:'DENIED'}); };
    check();
    if(tool === 'test.refresh') {
      if(!await this.approve('Refresh the test environment?', 'Create a new copy of '+project.original.root+' from Windows. Existing test copies stay in the VM; unapplied changes are not copied back.',signal)) throw Object.assign(Error('Refresh declined.'),{code:'DENIED'});
      check();project.state = null;
    }
    await project.prepare(signal,(done,total)=>this.emit({type:'project-progress',body:{text:'Preparing test environment: '+done+' / '+total}}));
    check();
    if(tool === 'test.prepare' || tool === 'test.refresh') return project.status();
    if(tool === 'test.changes') return {changes:await project.changes(signal)};
    if(tool === 'test.apply') return project.apply(args.paths,async(...values)=>{const accepted=await this.approve(...values);check();return accepted;},signal);
    if(tool === 'test.command') {
      const result = await project.guest().run('command',{...args,shell:'bash'},signal);
      this.emit({type:'terminal',body:{text:(result.stdout || '')+(result.stderr || '')}});
      return {...result,location:'test environment',originalFilesUnchanged:true};
    }
    throw Error('Unknown test action.');
  }
}
module.exports = {ConnectedBroker};
