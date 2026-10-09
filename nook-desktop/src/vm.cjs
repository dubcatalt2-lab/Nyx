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
    try { response = await this.fetcher('http://127.0.0.1:48764' + route, {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+this.token}, body:JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(5000), redirect:'error'}); }
    catch { throw Error(signal?.aborted ? 'Stopped.' : 'Private Nyx VM is offline or its agent is unavailable. Start NyxCloud; no Windows command was run.'); }
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>400000)throw Error('VM response exceeded the limit');chunks.push(Buffer.from(chunk));}
    const result=JSON.parse(Buffer.concat(chunks).toString());
    if(!response.ok)throw Error(result.error || 'VM request failed');
    return result;
  }
  async status() { const result=await this.request('/status',{});if(result.service!=='nook-private-vm'||result.platform!=='linux')throw Error('Unexpected VM service');return result; }
  async run(tool,args,signal){
    if(signal?.aborted)throw Error('Stopped.');
    const id=randomUUID();
    const cancel=()=>{this.request('/cancel',{id}).catch(()=>{});};
    signal?.addEventListener('abort',cancel,{once:true});
    try{return await this.request('/run',{id,tool,args},signal);}finally{signal?.removeEventListener('abort',cancel);}
  }
}
module.exports={PrivateVM};
