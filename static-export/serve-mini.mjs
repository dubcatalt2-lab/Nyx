import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
let base='/';try{base=JSON.parse(await readFile(resolve(root,'hosting.json'),'utf8')).base||'/';}catch{}
if(!/^\/(?:[a-zA-Z0-9@!._~/-]+\/)?$/.test(base)||base.includes('..')||base.startsWith('//'))throw Error('Invalid package hosting path. Extract a fresh copy.');
const port=Number(process.argv.find(v=>v.startsWith('--port='))?.slice(7)||8765);
if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port.');
const types={'.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/'){res.writeHead(302,{Location:base+'Nyx.html'});return res.end();}
  if(!pathname.startsWith(base)){res.writeHead(404);return res.end('Not found');}
  const file=resolve(root,pathname.slice(base.length)||'Nyx.html');
  if(!file.startsWith(root+sep)){res.writeHead(403);return res.end('Not allowed');}
  const info=await stat(file);if(!info.isFile()){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Service-Worker-Allowed':base});
  if(req.method==='HEAD')return res.end();
  createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{if(!res.headersSent)res.writeHead(404);res.end('File unavailable. Keep the whole mini package together.');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port '+port+' is already in use. Close the other local server or run: node serve-mini.mjs --port=8766':error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 const url='http://localhost:'+server.address().port+base+'Nyx.html';
 console.log('Open Nyx Mini: '+url+'\nKeep this window open. Press Ctrl+C to stop.');
});
