import {cp,mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
import {directS3Origin} from '../lib/static-host-access.mjs';
import {minify} from 'terser';
const argument=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const origin=directS3Origin(argument('origin')||''),backend=argument('backend')||'https://nyxlearning.org';
if(new URL(backend).origin!==backend||!backend.startsWith('https://'))throw Error('Use a backend HTTPS origin without a path.');
const entryUrl='https://s3.amazonaws.com/'+new URL(origin).hostname.split('.s3')[0]+'/studies.html';
const root=process.cwd(),dist=resolve('dist'),output=resolve('.codex-artifacts','nyx-direct-s3-'+Date.now());
await mkdir(output,{recursive:true});await cp(dist,join(output,'site'),{recursive:true,filter:p=>!p.endsWith('.map')&&!p.includes('static-package')});
const frontend=JSON.parse(await readFile(join(dist,'frontend-assets.json'),'utf8')).aliases;
const modules=JSON.parse(await readFile(join(dist,'public-modules.json'),'utf8')).aliases;
const aliases={...frontend,...modules},asset=name=>aliases[name]||name;
const runtime=asset('/js/direct-s3-runtime.js');
await cp(join(dist,asset('/js/direct-s3-worker.js').slice(1)),join(output,'site','direct-s3-worker.js'));
const pages=JSON.parse(await readFile(join(dist,'published-pages.json'),'utf8')).pages;
for(const name of Object.keys(pages)){const file=join(output,'site',name);let html=await readFile(file,'utf8');html=html.replace(/<head(?:\s[^>]*)?>/i,head=>head+`<meta name="nyx-static-backend" content="${backend}"><script src="${runtime}"></script>`);await writeFile(file,html);}
await writeFile(join(output,'site','direct-s3-config.json'),JSON.stringify({origin,backend,runtime,aliases}));
await writeFile(join(output,'site','index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nyx</title><style>body{margin:0;min-height:100vh;display:grid;place-content:center;background:#000;color:#eee;font:16px system-ui}main{width:min(320px,calc(100vw - 48px));text-align:center}img{display:block;width:96px;height:96px;margin:0 auto 32px}progress{appearance:none;display:block;width:100%;height:4px;border:0;border-radius:4px;background:#202027;overflow:hidden}progress::-webkit-progress-bar{background:#202027}progress::-webkit-progress-value{background:#aa95ff}progress::-moz-progress-bar{background:#aa95ff}p{line-height:1.5;font-size:14px;color:#ccc}</style></head><body><main><img src="/assets/icons/nyx-cat-moon.svg?v=3" alt="" width="96" height="96"><progress max="100" value="0" aria-label="Starting"></progress><p role="status" hidden></p></main><script src="${asset('/js/direct-s3-entry.js')}"></script></body></html>`);
// Shared path-style S3 links are entry links only. Never initialize account
// storage on the shared amazonaws.com origin; hydrate only on our bucket host.
for(const name of new Set(['index.html',...Object.keys(pages)])){
 const file=join(output,'site',name),html=await readFile(file,'utf8');
 const boot=`(()=>{if(location.origin!==${JSON.stringify(origin)}){location.replace(${JSON.stringify(origin+'/index.html?returnTo=')}+encodeURIComponent(${JSON.stringify('/'+name)}+location.search+location.hash));return;}const html=new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(Buffer.from(html).toString('base64'))}),c=>c.charCodeAt(0)));document.open();document.write(html);document.close();})();`;
 const compiled=await minify(boot,{mangle:{toplevel:true},compress:true,format:{comments:false}});
 await writeFile(file,'<!doctype html><html><head><meta charset="utf-8"><title>Nyx</title></head><body><script>'+compiled.code+'</script></body></html>');
}
const files=[];async function scan(dir=''){for(const item of await readdir(join(output,'site',dir),{withFileTypes:true})){const name=join(dir,item.name);if(item.isDirectory())await scan(name);else{const bytes=await readFile(join(output,'site',name));files.push({path:name.replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}await scan();
await writeFile(join(output,'manifest.json'),JSON.stringify({origin,backend,entryUrl,files},null,2));
await cp('static-export/upload-direct-s3.mjs',join(output,'upload.mjs'));
await writeFile(join(output,'START-HERE.txt'),`Direct S3 Nyx\nEntry: ${entryUrl}\nCanonical site: ${origin}/studies.html\nBackend: ${backend}\n\nThis package needs backend release support and NYX_STATIC_ORIGINS=${origin}. Add this exact hostname to Firebase Authentication authorized domains. These changes have NOT been activated automatically.\n\nUse a dedicated EMPTY bucket matching the origin. Authenticate AWS CLI, then run node upload.mjs. This publishes the website files and changes this bucket's public-read policy. It does not create CloudFront or change account-wide public-access settings. Account-level public-access policy must permit this bucket policy. AWS usage charges apply.\n\nThe backend must stay online. Test actual login, AI streaming, chat/voice, media and browsing on the real URL before sharing. Local controlled tests are not live certification. Do not upload credentials, private configuration or additional private files into this public bucket.\n`);
console.log(JSON.stringify({output,entry:entryUrl,files:files.length,bytes:files.reduce((sum,f)=>sum+f.bytes,0)}));
