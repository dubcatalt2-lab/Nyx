import {cp,mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
import {directS3Origin} from '../lib/static-host-access.mjs';
import {minify} from 'terser';
import {parse} from 'acorn';
import {connectionCheckPage} from './s3-connection-check.mjs';
const argument=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const origin=directS3Origin(argument('origin')||''),backend=argument('backend')||'https://n7x.zakaon.top';
if(new URL(backend).origin!==backend||!backend.startsWith('https://'))throw Error('Use a backend HTTPS origin without a path.');
const bucketHost=new URL(origin).hostname,bucket=bucketHost.split('.s3')[0],region=/\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$/.exec(bucketHost)?.[1]||'us-east-1';
const entryUrl='https://s3.'+region+'.amazonaws.com/'+bucket+'/studies.html';
const features={chat:!process.argv.includes('--without-chat'),blooket:false};
const root=process.cwd(),dist=resolve('dist'),output=resolve('.codex-artifacts','nyx-direct-s3-'+Date.now());
await mkdir(output,{recursive:true});await cp(dist,join(output,'site'),{recursive:true,filter:p=>!p.endsWith('.map')&&!p.includes('static-package')&&!/\/apps\/blooket(?:\/|$)/.test(p.replaceAll('\\','/'))&&(features.chat||!/\/apps\/chat(?:\/|$)/.test(p.replaceAll('\\','/')))});
const frontend=JSON.parse(await readFile(join(dist,'frontend-assets.json'),'utf8')).aliases;
const modules=JSON.parse(await readFile(join(dist,'public-modules.json'),'utf8')).aliases;
const aliases={...frontend,...modules},asset=name=>aliases[name]||name;
const runtime=asset('/js/direct-s3-runtime.js');
await cp(join(dist,asset('/js/direct-s3-worker.js').slice(1)),join(output,'site','direct-s3-worker.js'));
const pages=JSON.parse(await readFile(join(dist,'published-pages.json'),'utf8')).pages;
if(!features.chat)for(const name of Object.keys(pages))if(name.startsWith('apps/chat/'))delete pages[name];
for(const name of Object.keys(pages))if(name.startsWith('apps/blooket/'))delete pages[name];
// Sponsor documents run in isolated data frames, not the account application frame.
for(const name of Object.keys(pages))if(name.startsWith('apps/sponsor/') || /^apps\/ad-haven\/(banner|native|multitag)\.html$/.test(name))delete pages[name];
for(const name of Object.keys(pages)){const file=join(output,'site',name);let html=await readFile(file,'utf8');html=html.replace(/<head(?:\s[^>]*)?>/i,head=>head+`<meta name="nyx-static-backend" content="${backend}"><meta name="nyx-blooket-enabled" content="0">${features.chat?'':'<meta name="nyx-chat-enabled" content="0">'}<script src="${runtime}"></script>`);await writeFile(file,html);}
await writeFile(join(output,'site','direct-s3-config.json'),JSON.stringify({origin,backend,runtime,aliases,features}));
let coverSource = await readFile(join(dist,'index.html'),'utf8');
if (pages['index.html']?.loader) {
 const loader = await readFile(join(dist,pages['index.html'].loader.slice(1)),'utf8');
 let encoded;
 const visit = node => {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee?.name === 'atob') {
   const argument = node.arguments[0];
   if (argument?.type === 'CallExpression' && argument.callee?.property?.name === 'join' && argument.callee.object?.type === 'ArrayExpression' && argument.callee.object.elements.every(part=>part?.type==='Literal'&&typeof part.value==='string')) encoded=argument.callee.object.elements.map(part=>part.value).join('');
  }
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
 };
 visit(parse(loader,{ecmaVersion:'latest'}));
 if (!encoded) throw Error('Production cover document could not be read.');
 const bytes = Buffer.from(encoded,'base64');
 if (createHash('sha256').update(bytes).digest('hex') !== pages['index.html'].sha256) throw Error('Production cover document integrity mismatch.');
 coverSource=bytes.toString('utf8');
}
const s3CoverScript = asset('/js/direct-s3-cover.js');
const redirects=[...coverSource.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(match=>match[1].includes('window.top.location.href')&&match[1].includes('1012'));
if (redirects.length !== 1) throw Error('Expected one production cover redirect.');
await writeFile(join(output,'site','index.html'),coverSource.replace(redirects[0][0],`<script src="${s3CoverScript}"></script>`));
// Changing the backend must activate a new worker even when runtime source is unchanged.
const workerPath=join(output,'site','direct-s3-worker.js');
await writeFile(workerPath,(await readFile(workerPath,'utf8'))+';void '+JSON.stringify(createHash('sha256').update(backend+runtime+JSON.stringify(aliases)+JSON.stringify(features)).digest('hex').slice(0,16))+';');
// Shared path-style S3 links frame the isolated bucket host. Never initialize account
// storage on the shared amazonaws.com origin; hydrate only on our bucket host.
for(const name of new Set(['index.html',...Object.keys(pages)])){
 const file=join(output,'site',name),html=await readFile(file,'utf8');
 const boot=`(()=>{if(location.origin!==${JSON.stringify(origin)}){document.documentElement.style.cssText='margin:0;background:#000;color-scheme:dark';document.body.style.margin='0';const frame=document.createElement('iframe');frame.title='Workspace';frame.src=${JSON.stringify(origin+'/'+name)}+location.search+location.hash;frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0';frame.allow='autoplay; fullscreen; microphone; camera; display-capture; clipboard-read; clipboard-write; gamepad';frame.allowFullscreen=true;document.body.append(frame);addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==${JSON.stringify(origin)})return;if(event.data?.type==='nyx:host-context-required'){location.replace(${JSON.stringify(origin+'/'+name)}+location.search+location.hash);return;}if(event.data?.type!=='nyx:tab-cloak-sync')return;if(typeof event.data.title==='string')document.title=event.data.title.slice(0,200);try{const icon=new URL(event.data.favicon,${JSON.stringify(origin)});if(!/^https?:$/.test(icon.protocol)&&!icon.href.toLowerCase().startsWith('data:image/'))return;let link=document.querySelector('link[rel=icon]');if(!link){link=document.createElement('link');link.rel='icon';document.head.append(link);}link.href=icon.href;}catch{}});return;}const html=new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(Buffer.from(html).toString('base64'))}),c=>c.charCodeAt(0)));document.open();document.write(html);document.close();})();`;
 const compiled=await minify(boot,{mangle:{toplevel:true},compress:true,format:{comments:false}});
 const title=name==='index.html'?(coverSource.match(/<title>([^<]*)<\/title>/i)?.[1]||'Nyx'):'Nyx';
 await writeFile(file,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title></head><body><script>'+compiled.code+'</script></body></html>');
}
await writeFile(join(output,'site','connection-check.html'),await connectionCheckPage(origin,backend));
const files=[];async function scan(dir=''){for(const item of await readdir(join(output,'site',dir),{withFileTypes:true})){const name=join(dir,item.name);if(item.isDirectory())await scan(name);else{const bytes=await readFile(join(output,'site',name));files.push({path:name.replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}await scan();
await writeFile(join(output,'manifest.json'),JSON.stringify({origin,backend,entryUrl,files},null,2));
await cp('static-export/upload-direct-s3.mjs',join(output,'upload.mjs'));
await writeFile(join(output,'START-HERE.txt'),`Direct S3 Nyx\nEntry: ${entryUrl}\nCanonical site: ${origin}/studies.html\nBackend: ${backend}\n\nThis package needs backend release support and NYX_STATIC_ORIGINS=${origin}. Add this exact hostname to Firebase Authentication authorized domains. These changes have NOT been activated automatically.\n\nUse a dedicated EMPTY bucket matching the origin. Authenticate AWS CLI, then run node upload.mjs. This publishes the website files and changes this bucket's public-read policy. It does not create CloudFront or change account-wide public-access settings. Account-level public-access policy must permit this bucket policy. AWS usage charges apply.\n\nThe backend must stay online. Test actual login, AI streaming, chat/voice, media and browsing on the real URL before sharing. Local controlled tests are not live certification. Do not upload credentials, private configuration or additional private files into this public bucket.\n`);
console.log(JSON.stringify({output,entry:entryUrl,files:files.length,bytes:files.reduce((sum,f)=>sum+f.bytes,0)}));
