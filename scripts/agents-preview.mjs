import http from 'node:http';
import {agentInstruction,parseAgentReply} from '../lib/agent-protocol.mjs';
import {companionZip} from '../lib/agent-download.mjs';
import {fileURLToPath} from 'node:url';

const port=6769,upstream='http://localhost:6767';
const projectRoot=fileURLToPath(new URL('..',import.meta.url));
let catalogDates=null,catalogDateTime=0;
const hosts=new Set([`localhost:${port}`,`127.0.0.1:${port}`,`[::1]:${port}`]);
const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  if(!hosts.has(req.headers.host)||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Local preview only.'});
  if(req.headers.origin){try{if(!hosts.has(new URL(req.headers.origin).host))return send(403,{error:'Origin not allowed.'});}catch{return send(403,{error:'Origin not allowed.'});}}
  if(req.url==='/'){res.writeHead(302,{location:'/apps/agents/'});res.end();return;}
  const abort=new AbortController();res.on('close',()=>{if(!res.writableFinished)abort.abort();});
  try{
    if(req.url==='/download/nyx-agents.zip'){
      const zip=await companionZip(projectRoot,{localOrigin:`http://localhost:${port}`});
      res.writeHead(200,{'content-type':'application/zip','content-disposition':'attachment; filename="Nyx-Agents-Local.zip"'});res.end(zip);return;
    }
    let body;
    if(!['GET','HEAD'].includes(req.method)){
      const chunks=[];let bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>400000)return send(413,{error:'Request too large.'});chunks.push(chunk);}
      body=Buffer.concat(chunks);
    }
    const chat=req.url==='/api/nyx-ai'&&req.method==='POST';
    let agent=false;
    if(chat){
      if(!req.headers.authorization?.startsWith('Bearer '))return send(401,{error:'Sign in first.'});
      const payload=JSON.parse(body.toString());
      if((payload.task&&payload.task!=='computer-agent')||payload.stream!==false)return send(400,{error:'Use the chat or computer interface.'});
      agent=payload.task==='computer-agent';
      const history=Array.isArray(payload.messages)?payload.messages:[];
      if(history.length>18)return send(413,{error:'Start a new task to reset the preview context.'});
      payload.messages=agent?[{role:'user',content:agentInstruction},...history]:history;
      payload.temporaryChat=true;
      delete payload.task;
      body=Buffer.from(JSON.stringify(payload));
    }
    const headers={...req.headers,host:'localhost:6767'};
    delete headers['content-length'];delete headers.connection;delete headers['accept-encoding'];
    if(headers.origin)headers.origin=upstream;
    if(headers.referer)headers.referer=upstream+'/apps/agents/';
    const response=await fetch(upstream+req.url,{method:req.method,headers,body,signal:abort.signal,redirect:'manual'});
    if(req.method==='GET'&&req.url==='/api/nyx-ai/models'&&response.ok){
      const data=await response.json();
      try{if(!catalogDates||Date.now()-catalogDateTime>1200000){const catalog=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(5000)});if(catalog.ok){const json=await catalog.json();catalogDates=new Map((json.data||[]).filter(item=>typeof item.id==='string'&&Number.isFinite(item.created)).map(item=>[item.id,item.created]));catalogDateTime=Date.now();}}
      if(catalogDates)data.models=(data.models||[]).map(item=>({...item,created:item.created||catalogDates.get(item.id)||null}));}catch{}
      return send(response.status,data);
    }
    if(agent){const data=await response.json();if(response.ok){try{parseAgentReply(data.text);}catch{return send(502,{error:'The model did not return a valid agent action. No action was executed. Try another model.'});}}return send(response.status,data);}
    const outputHeaders=Object.fromEntries(response.headers);delete outputHeaders['content-encoding'];delete outputHeaders['content-length'];delete outputHeaders['transfer-encoding'];
    res.writeHead(response.status,outputHeaders);res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){if(!res.headersSent&&!abort.signal.aborted)send(502,{error:'Local Agents preview could not reach the Nyx backend.'});}
});
server.listen(port,'localhost',()=>console.log(`Nyx Agents preview: http://localhost:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.closeAllConnections();server.close();});
