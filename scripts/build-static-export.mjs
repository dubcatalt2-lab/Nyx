import {readFile,writeFile,mkdir,readdir,cp,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {minify} from 'terser';
import {rewriteProxyReferences,proxyAssetNames} from './build-proxy-assets.mjs';
import {rewriteRuntimeNames} from './build-runtime-names.mjs';
import {rewriteFrontendReferences} from './build-frontend-assets.mjs';

const root=process.cwd(),argument=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const base=argument('base')||'/',wisp=argument('wisp')||'wss://vps-a556737a.vps.ovh.us/resources/live/';
const mini=process.argv.includes('--mini'),lite=mini||process.argv.includes('--lite');
const publisher=process.argv.includes('--publisher');
if(!/^\/(?:[a-zA-Z0-9@!._~/-]+\/)?$/.test(base)||base.includes('..')||base.startsWith('//'))throw Error('Use a hosting path such as / or /gh/USER/REPO@main/.');
if(new URL(wisp).protocol!=='wss:')throw Error('The relay must use wss://.');
const id=createHash('sha256').update(base+wisp+(mini?'mini':lite?'lite':'')).digest('hex').slice(0,10);
const output=path.join(root,'.codex-artifacts','nyx-static-'+id);
if(path.dirname(path.resolve(output))!==path.resolve(root,'.codex-artifacts'))throw Error('Invalid artifact directory.');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
const dist=path.join(root,'dist'),aliases=JSON.parse(await readFile(path.join(dist,'frontend-assets.json'),'utf8')).aliases;
const roots=(await readdir(dist,{withFileTypes:true})).map(item=>item.name).filter(name=>!name.startsWith('.'));
const escaped=roots.map(value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).sort((a,b)=>b.length-a.length).join('|');
const rootUrl=new RegExp(`(["'\x60])/(?!/)(?=(?:${escaped}|api|~|service)(?:/|[?"'\x60)\\s<>]|$))`,'g');
const rebase=source=>base==='/'?source:source.replace(rootUrl,(_,lead)=>lead+base).replaceAll('${location.origin}/assets/','${location.origin}'+base+'assets/').replaceAll('^\\/~\\/','^'+base.replaceAll('/','\\/')+'~\\/');
const bootName='@r'+createHash('sha256').update('static-boot-v1').digest('hex').slice(0,24)+'!.js';
const boot=await minify(`globalThis.__NYX_STATIC_CONFIG__=${JSON.stringify({base,wisp,lite})};`+await readFile(path.join(root,'static-export/offline.js'),'utf8'),{mangle:{toplevel:true},compress:true});
await writeFile(path.join(output,bootName),rewriteRuntimeNames(boot.code));
const injected=`<script src="${base+bootName}"></script>`;
const currentAssets=new Set(Object.values(proxyAssetNames).map(value=>value.slice(1)));
// Nyx imports these shared transports even when the Tutsi app is omitted.
const sharedTransports=new Set(['/apps/tutsi/relay.mjs','/apps/tutsi/http-relay.mjs'].map(name=>proxyAssetNames[name].slice(1)));
const deferredBackgrounds=new Set();
if(mini)for(const file of await readdir(path.join(dist,'assets/backgrounds')))if((await stat(path.join(dist,'assets/backgrounds',file))).size>600000)deferredBackgrounds.add(file);
const remoteGames=new Set(['Dragonxclient.html','EaglercraftL_1.9_v0_7_0_Offline_Signed.html','EaglercraftX 1.8.8(u29).html','EaglercraftZ_1.11.2.html','eaglercraft.1.5.2.html'].map(name=>'assets/ugs/minecraft/'+name));
const skip=relative=>(/^(?:scramjet(?:-v1)?|studyjet(?:-v1)?|controller|epoxy|atlas|libcurl|textlib|baremux|uv)\//.test(relative)&&!currentAssets.has(relative))||/^(?:proxy-assets|frontend-assets)\.json$/.test(relative)||relative==='nyx-singlefile.html'||(relative.startsWith('apps/tutsi/')&&!sharedTransports.has(relative));
async function copy(dir=''){
  for(const item of await readdir(path.join(dist,dir),{withFileTypes:true})){
    const relative=path.posix.join(dir,item.name);if(skip(relative))continue;
    if(publisher && relative.startsWith('apps/jsdelivr-publisher'))continue;
    if(mini&&((relative.startsWith('assets/ugs/')&&!item.isDirectory()&&!relative.endsWith('.json'))||(relative.startsWith('assets/backgrounds/')&&deferredBackgrounds.has(item.name))))continue;
    if(lite&&(remoteGames.has(relative)||relative==='assets/jumpscares'||(relative.startsWith('assets/profile/')&&!item.isDirectory()&&!relative.endsWith('.json'))))continue;
    if(item.isDirectory()){await mkdir(path.join(output,relative),{recursive:true});await copy(relative);continue;}
    const target=path.join(output,relative);await mkdir(path.dirname(target),{recursive:true});
    if(/\.(?:js|mjs|css|html|json)$/.test(relative)&&(!relative.startsWith('assets/ugs/')||relative==='assets/ugs/play.html'||relative.endsWith('.json'))){
      let source=await readFile(path.join(dist,relative),'utf8');
      if(relative==='script.js'||'/'+relative===aliases['/script.js']){
        source=await readFile(path.join(root,'script.js'),'utf8');
        source=source.replace('async function sampleNyxLatency(force=false,publish=true){','async function sampleNyxLatency(force=false,publish=true){return null;').replace('async function sampleNyxDashboardLatency(force=false){','async function sampleNyxDashboardLatency(force=false){return null;');
        source=rewriteFrontendReferences(rewriteRuntimeNames(rewriteProxyReferences(source,'/script.js')),'/script.js',aliases);
      }
      if(relative==='assets/games/games.json'){
        const catalog=JSON.parse(source);catalog.catalogs=catalog.catalogs.filter(item=>item.id==='local');catalog.fallbackCover='';catalog.includeUnillustrated=true;
        if(mini){const local=catalog.catalogs.find(item=>item.id==='local');local.player='https://vps-a556737a.vps.ovh.us/assets/ugs/play.html?game={path}';local.coversUrl='';}
        source=JSON.stringify(catalog);
      }
      if(mini)for(const name of deferredBackgrounds)source=source.replaceAll('backgrounds/'+name,'backgrounds/nyx-blue-light-trails.jpg');
      if(mini&&relative==='assets/games/index.html')source=source.replace('id="gameFrame"','id="gameFrame" credentialless');
      if(relative==='index.html')source=rewriteFrontendReferences(rewriteRuntimeNames(rewriteProxyReferences(await readFile(path.join(root,'index.html'),'utf8'),'/index.html')),'/index.html',aliases);
      source=rebase(source);
      if(relative.endsWith('.css'))source=source.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g,(match,quote,url)=>{
        if(/^(?:[a-z]+:|\/|#)/i.test(url))return match;
        const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(relative),url));
        if(resolved.startsWith('../'))throw Error('CSS asset escapes the package: '+url);
        return `url("${base}${resolved}")`;
      });
      if(relative.endsWith('.html'))source=source.replace(/<head(?:\s[^>]*)?>/i,match=>match+injected);
      if(relative==='script.js'||'/'+relative===aliases['/script.js'])source=(await minify(source,{compress:true,mangle:true,format:{comments:/@license|@preserve/}})).code;
      await writeFile(target,source);
    }else await cp(path.join(dist,relative),target);
  }
}
await copy();
await cp(path.join(root,'static-export/Nyx.html'),path.join(output,'Nyx.html'));
for(const file of ['serve-mini.mjs','Start-Nyx-Mini.cmd'])await cp(path.join(root,'static-export',file),path.join(output,file));
if(lite)await cp(path.join(root,'static-export/Nyx.html'),path.join(output,'nyx-singlefile-mini.html'));
if(mini)await cp(path.join(root,'static-export/START-HERE-mini.txt'),path.join(output,'START-HERE.txt'));
if(base!=='/'){
  await cp(path.join(root,'static-export/configure-host.mjs'),path.join(output,'configure-host.mjs'));
  await writeFile(path.join(output,'hosting.json'),JSON.stringify({base,configured:false}));
}
await writeFile(path.join(output,'runtime-config.js'),`globalThis.__NYX_RUNTIME_CONFIG__=Object.freeze(${JSON.stringify({wispUrl:wisp,wispUrls:[wisp],presenceUrl:'',publicOrigin:''})});`);
const worker=`const base=${JSON.stringify(base)};self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(u.origin!==self.location.origin||!u.pathname.startsWith(base)||u.pathname.startsWith(base+'~/'))return;if(event.request.mode==='navigate'){event.respondWith((async()=>{if(u.pathname.endsWith('/'))u.pathname+='index.html';const response=await fetch(u.href);if(!response.ok)return response;const headers=new Headers(response.headers);headers.delete('content-disposition');headers.delete('content-length');headers.set('content-type',u.pathname.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');headers.set('cross-origin-opener-policy','same-origin');headers.set('cross-origin-embedder-policy','require-corp');return new Response(response.body,{status:response.status,headers});})());}});`;
const workerName='library-worker.js';await writeFile(path.join(output,workerName),(await minify(worker,{mangle:true,compress:true})).code);
const svgBoot=`(async()=>{if(!['http:','https:'].includes(location.protocol)||location.origin==='null')throw Error('Extract the mini ZIP and run Start-Nyx-Mini.cmd, then open localhost. A downloaded SVG cannot start the proxy.');if(!isSecureContext||!navigator.serviceWorker)throw Error('Open the complete package on HTTPS or localhost.');await navigator.serviceWorker.register(new URL('${workerName}',location.href),{scope:${JSON.stringify(base)}});await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('The worker did not take control. Reload to retry.')),15000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve()},{once:true})});location.replace(new URL('index.html',location.href).href)})().catch(e=>document.getElementById('status').textContent=e.message);`;
await writeFile(path.join(output,'Nyx.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><foreignObject width="100%" height="100%"><body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;background:#080b09;color:#e3e9e5;font:15px system-ui;min-height:100vh;display:grid;place-content:center;text-align:center"><h1 style="letter-spacing:8px;font-weight:500">NYX</h1><p id="status">Opening your workspace…</p></body></foreignObject><script><![CDATA[${svgBoot}]]></script></svg>`);
await mkdir(path.join(output,'licenses'),{recursive:true});
for(const [name,folder] of [['engine','@mercuryworkshop/scramjet'],['controller','@mercuryworkshop/scramjet-controller'],['transport','@mercuryworkshop/libcurl-transport']]){for(const file of ['LICENSE','LICENSE.md','LICENSE.txt'])try{await cp(path.join(root,'node_modules',folder,file),path.join(output,'licenses',name+'.txt'));break;}catch{}}
await writeFile(path.join(output,'README.txt'),`Nyx static package\n\nUpload ALL files, preserving folders. Open Nyx.svg over HTTPS.\nBuilt hosting path: ${base}\nRelay: ${wisp}\n\nThis is not an iframe of nyxlearning.org. The SVG installs a local static-file worker, then opens the packaged Nyx interface. HTML navigation is served with the correct media type, including on jsDelivr. Scramjet v2 runtime names and URLs use the production renaming build. Accounts, AI, server media, chat and backend publishing are hidden. Some catalog games and remote services still require their upstream servers.\n\nFor jsDelivr, build with --base=/gh/USER/REPO@REVISION/ (include any folder). Upload this entire directory to that exact repository/revision/path. Share https://cdn.jsdelivr.net plus that path plus Nyx.svg. The existing Link Generator's old iframe SVGs are unchanged.\n\nNyx's public Wisp relay accepts connections from any origin after release 2644d33. Other relay servers must allow your hosting origin. A network that blocks the relay itself can still prevent browsing. Renaming is not a guarantee against filtering.\n\nSource: https://github.com/dubcatalt2-lab/Nyx\nIncludes modified AGPL Scramjet and its production patches; retain licenses and publish corresponding source when distributing. Rebuild from the matching Nyx source using npm run build:netlify, then node scripts/build-static-export.mjs with your hosting path. No server credentials included.\n`);
console.log(JSON.stringify({output,base,entry:path.join(output,'Nyx.svg'),worker:workerName}));
