const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
class PrivateVM {
  constructor({config = path.join(process.env.LOCALAPPDATA || '', 'NyxCloud', 'nook-agent.json'), fetcher = fetch} = {}) {
    this.fetcher = fetcher;
    const data = JSON.parse(fs.readFileSync(config, 'utf8'));
    if (!/^[a-f0-9]{64}$/.test(data.token) || data.port !== 48764) throw Error('Invalid private VM connection');
    this.token = data.token;
  }
  async request(route, body, signal) {
    let response;
    try { response = await this.fetcher('http://127.0.0.1:48764' + route, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+this.token}, body:JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(route === '/run' ? 65000 : 5000), redirect:'error'}); }
    catch { throw Error(signal?.aborted ? 'Stopped.' : 'Private Nyx VM is offline or its agent is unavailable. Start NyxCloud; no Windows command was run.'); }
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>400000)throw Error('VM response exceeded the limit');chunks.push(Buffer.from(chunk));}
    const result=JSON.parse(Buffer.concat(chunks).toString());
    if(!response.ok)throw Error(result.error || 'VM request failed');
    return result;
  }
  project(id) {
    if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid test workspace');
    const parent=this, prefix='projects/'+id;
    return {run:async(tool,args,signal)=>{
      if(tool.startsWith('project.')){
        const helper='.nook-project-transfer-'+require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../resources/project-transfer.py'))).digest('hex').slice(0,16)+'.py';
        const content=fs.readFileSync(path.join(__dirname,'../resources/project-transfer.py'),'utf8');
        if(!parent.transferReady){
          let previous=null;try{previous=await parent.run('read',{path:helper},signal);}catch(error){if(!/No such file/.test(error.message))throw error;}
          if(previous?.content!==content)await parent.run('write',{path:helper,content,expectedHash:previous?.hash||null},signal);
          parent.transferReady=true;
        }
        const request='.nook-transfer-'+randomUUID()+'.json';
        await parent.run('write',{path:request,content:JSON.stringify(args),expectedHash:null},signal);
        if(!['project.upload','project.download','project.manifest'].includes(tool))throw Error('Invalid transfer operation');
        const result=await parent.run('command',{shell:'bash',command:'python3 /home/nook-agent/workspace/'+helper+' /home/nook-agent/workspace/'+prefix+' '+tool+' /home/nook-agent/workspace/'+request},signal);
        if(result.exitCode!==0||result.stopped)throw Error('Project transfer failed: '+(result.stderr||result.stopped).slice(-1200));
        return JSON.parse(result.stdout);
      }
      if(tool==='command'){
        const cwd=args.cwd||'';if(typeof cwd!=='string'||cwd.startsWith('/')||cwd.split('/').includes('..')||cwd.includes('\\'))throw Error('Use a relative test directory');
        return parent.run(tool,{...args,cwd:[prefix,cwd].filter(Boolean).join('/')},signal);
      }
      throw Error('Unsupported test workspace tool');
    }};
  }
  async status() { const result=await this.request('/status',{});if(result.service!=='nook-private-vm'||result.platform!=='linux')throw Error('Unexpected VM service');return result; }
  async run(tool,args,signal){
    if(signal?.aborted)throw Error('Stopped.');
    const id=randomUUID();
    const cancel=()=>{this.request('/cancel',{id}).catch(()=>{});};
    signal?.addEventListener('abort',cancel,{once:true});
    try{return await this.request('/run',{id,tool,args,project:this.projectId},signal);}catch(error){await this.request('/cancel',{id}).catch(()=>{});throw error;}finally{signal?.removeEventListener('abort',cancel);}
  }
}
module.exports={PrivateVM};
