import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isResourceRequest} from './lib/resource-routing.mjs';
export function createResourceServer(app){
 const server=createServer((req,res)=>{
  if(req.url==='/healthz'&&['GET','HEAD'].includes(req.method)){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,service:'nyx-resources'}));return;}
  if(!isResourceRequest(req)){res.statusCode=404;res.end();return;}
  app(req,res);
 });
 server.on('upgrade',(_req,socket)=>socket.destroy());
 return server;
}
async function main(){
 const port=Number(process.argv.find(a=>a.startsWith('--port='))?.slice(7)||18180);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose an unprivileged resource port.');
 const root=resolve(process.env.NYX_PROJECT_ROOT||'.');
 // Resource routing must never create a second chat/Discord or relay runtime.
 process.env.NYX_CHAT_ENABLED='0';
 process.env.NYX_TRAFFIC_PEER_FILES='';
 process.env.NYX_TRAFFIC_FILE=join(process.env.NYX_RESOURCE_TRAFFIC_DIR||'/var/lib/nyx','resource-traffic-'+port+'.json');
 process.env.NYX_TRAFFIC_FLUSH_MS='5000';
 const {app}=await import(pathToFileURL(join(root,'server.js')).href);
 const server=createResourceServer(app);
 server.listen(port,'127.0.0.1');
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;server.close(()=>Promise.resolve(app.locals.nyxTraffic?.close()).finally(()=>process.exit(0)));setTimeout(()=>{server.closeAllConnections();void Promise.resolve(app.locals.nyxTraffic?.close()).finally(()=>process.exit(0));},30000).unref();};
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
 server.once('error',()=>{console.error('Nyx resource worker could not listen.');process.exit(1)});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void main().catch(()=>{console.error('Nyx resource worker could not start.');process.exitCode=1});
