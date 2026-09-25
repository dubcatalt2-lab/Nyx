import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {domainToASCII,pathToFileURL} from 'node:url';
import {learningPage,style} from './pages.mjs';
import {textbookHtml} from './textbook.mjs';
let bookHtml;
const learningAssets=new Set(['learning.css','learning.mjs','curriculum.mjs','secondary.mjs','textbook.css']);

const blocked=new Set(['nyxlearning.org','www.nyxlearning.org','tutsi.nyxlearning.org','turn.nyxlearning.org','childsupport.donateyourboat.us']);
export function normalizeDomain(value,{allowPrimary=false}={}){
 const raw=String(value||'').trim().toLowerCase().replace(/\.$/,'');
 if(/[\s/:@?#\\]/.test(raw))throw new Error('Enter a domain name without a URL, port or path.');
 const hostname=domainToASCII(raw);
 if(hostname.length>253||!hostname.includes('.')||hostname.split('.').some(label=>!/^([a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/.test(label))||!/[a-z]/.test(hostname.split('.').at(-1))||/\.(localhost|local|internal|test|invalid)$/.test(hostname))throw new Error('Enter a valid public domain name.');
 if(blocked.has(hostname)&&!(allowPrimary&&['nyxlearning.org','www.nyxlearning.org'].includes(hostname)))throw new Error('That hostname already hosts Nyx or a related service. Use another domain or subdomain, or click Preview lessons without adding one.');
 return hostname;
}
export async function createDomainPages({dataDir=process.env.DOMAIN_PAGES_DATA_DIR||join(homedir(),'.nyx','domain-pages'),adminPort=9092,publicPort=9093}={}){
 const file=join(dataDir,'domains.json');
 await mkdir(dataDir,{recursive:true,mode:0o700});
 let domains=[];
 try{domains=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(domains)||domains.length>100)throw new Error('Invalid domain registry');for(const row of domains){if(normalizeDomain(row.hostname)!==row.hostname||typeof row.title!=='string'||!row.title.trim()||row.title.length>80)throw new Error('Invalid domain registry');}}catch(error){if(error.code!=='ENOENT')throw error;}
 let queue=Promise.resolve();
 const mutate=operation=>{const work=queue.then(async()=>{const next=operation(domains);await writeFile(file+'.tmp',JSON.stringify(next,null,2)+'\n',{mode:0o600});await rename(file+'.tmp',file);domains=next;});queue=work.catch(()=>{});return work;};
 function send(res,status,body,type='application/json'){
  res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});res.end(type==='application/json'?JSON.stringify(body):body);
 }
 async function serveLearning(req,res,pathname){
  if(!['GET','HEAD'].includes(req.method))return false;
  if(pathname==='/textbook'){bookHtml??=textbookHtml();send(res,200,bookHtml,'text/html');return true;}
  if(pathname==='/textbook.pdf'){try{const pdf=await readFile(join(dataDir,'textbook.pdf'));res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="StudyReady-Mathematics.pdf"','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:pdf);}catch(error){send(res,error.code==='ENOENT'?404:500,'PDF is not available yet. Open /textbook to read or print the book.','text/plain');}return true;}
  if(pathname.startsWith('/learning/')){const name=pathname.slice('/learning/'.length);if(learningAssets.has(name)){send(res,200,await readFile(new URL('./'+name,import.meta.url),'utf8'),name.endsWith('.css')?'text/css':'text/javascript');return true;}}
  return false;
 }
 const admin=createServer(async(req,res)=>{
  try{
   const allowedHosts=new Set([`127.0.0.1:${admin.address().port}`,`localhost:${admin.address().port}`]);
   if(!allowedHosts.has(req.headers.host)||req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Open this panel through localhost.'});
   const origin=`http://${req.headers.host}`,url=new URL(req.url,origin);
   if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return send(res,403,{error:'Local admin origin required.'});
   if(await serveLearning(req,res,url.pathname))return;
   if(req.method==='GET'&&url.pathname==='/')return send(res,200,await readFile(new URL('./admin.html',import.meta.url),'utf8'),'text/html');
   if(req.method==='GET'&&url.pathname==='/admin.js')return send(res,200,await readFile(new URL('./admin.js',import.meta.url),'utf8'),'text/javascript');
   if(req.method==='GET'&&url.pathname==='/style.css')return send(res,200,style,'text/css');
   if(req.method==='GET'&&url.pathname==='/api/domains')return send(res,200,{domains});
   if(req.method==='GET'&&url.pathname==='/preview'){if(!url.searchParams.has('domain'))return send(res,200,learningPage({title:(url.searchParams.get('title')||'Math notebook').slice(0,80)}),'text/html');const row=domains.find(item=>item.hostname===url.searchParams.get('domain'));return row?send(res,200,learningPage(row),'text/html'):send(res,404,{error:'Unknown domain.'});}
   if(req.method==='GET'&&url.pathname==='/api/caddy'){
    res.setHeader('Content-Disposition','attachment; filename="domain-pages.caddy"');
    return send(res,200,'# Import only after reviewing DNS and existing virtual hosts.\n'+domains.map(row=>`${row.hostname} {\n    reverse_proxy 127.0.0.1:${publicServer.address().port}\n}\n`).join('\n'),'text/plain');
   }
   if(req.method==='POST'&&url.pathname==='/api/domains'){
    if(!String(req.headers['content-type']).startsWith('application/json'))return send(res,415,{error:'JSON required.'});
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)return send(res,413,{error:'Request too large.'});chunks.push(chunk);}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(res,400,{error:'Invalid JSON.'});}
    const hostname=normalizeDomain(input?.hostname),title=String(input?.title||'Math notebook').trim();
    if(!title||title.length>80)throw new Error('Use a title between 1 and 80 characters.');
    await mutate(current=>{if(current.some(row=>row.hostname===hostname))throw new Error('That domain is already added.');if(current.length>=100)throw new Error('This registry holds up to 100 domains.');return [...current,{hostname,title,createdAt:new Date().toISOString()}];});
    return send(res,201,{hostname});
   }
   if(req.method==='DELETE'&&url.pathname.startsWith('/api/domains/')){const hostname=normalizeDomain(decodeURIComponent(url.pathname.slice('/api/domains/'.length)));await mutate(current=>current.filter(row=>row.hostname!==hostname));return send(res,200,{removed:hostname});}
   return send(res,404,{error:'Not found.'});
  }catch(error){send(res,error.code?500:400,{error:error.code?'Could not save the domain registry.':error.message});}
 });
 const publicServer=createServer(async(req,res)=>{
  const hostname=String(req.headers.host||'').toLowerCase().replace(/:\d+$/,'').replace(/\.$/,'');
  const row=domains.find(item=>item.hostname===hostname);
  if(!row)return send(res,404,'Unknown domain.','text/plain');
  if(!['GET','HEAD'].includes(req.method))return send(res,405,'Method not allowed.','text/plain');
  try{if(await serveLearning(req,res,new URL(req.url,'http://localhost').pathname))return;}catch{return send(res,500,'Could not load learning content.','text/plain');}
  if(req.url==='/robots.txt')return send(res,200,'User-agent: *\nAllow: /\n','text/plain');
  if(req.url!=='/'&&!req.url.startsWith('/?'))return send(res,404,'Page not found.','text/plain');
  send(res,200,req.method==='HEAD'?'':learningPage(row),'text/html');
 });
 const listen=(server,port)=>new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done);});
 await listen(publicServer,publicPort);
 try{await listen(admin,adminPort);}catch(error){publicServer.close();throw error;}
 return {admin,publicServer,close:()=>Promise.all([admin,publicServer].map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const service=await createDomainPages();
 console.log(`Domain pages admin: http://localhost:${service.admin.address().port}`);
 console.log(`Public pages listen on loopback port ${service.publicServer.address().port}; route selected domains through Caddy.`);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await service.close();process.exit(0);});
}
