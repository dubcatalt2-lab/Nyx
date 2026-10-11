import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {application} from '../connection/app.mjs';
import {documentOrigin} from '../parables/document-window.mjs';

for(const hostname of ['localhost','127.0.0.1'])assert.equal(documentOrigin({},new URL('http://'+hostname+':8080')),'http://'+hostname+':8082');
assert.throws(()=>documentOrigin({documentOrigin:'http://localhost:8080'},new URL('http://localhost:8080')));
const upstream=createServer((_request,response)=>{
 response.writeHead(200,{'content-type':'text/html'});
 response.end('<!doctype html><title>Lesson</title><h1>Lesson ready</h1>');
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const service=application({resolveDestination:async()=>({url:new URL('http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
service.listen(0,'127.0.0.1');await once(service,'listening');
const shell=createServer(async(request,response)=>{
 if(request.url==='/document-window.mjs'){
  response.writeHead(200,{'content-type':'application/javascript'});
  response.end(await readFile(new URL('../parables/document-window.mjs',import.meta.url)));return;
 }
 const hostname=request.url==='/different'?'127.0.0.1':'localhost';
 const origin='http://'+hostname+':'+service.address().port;
 response.writeHead(200,{'content-type':'text/html'});
 response.end(`<!doctype html><link rel="icon" href="data:,"><button>Open lesson</button><iframe></iframe><script type="module">import {openDocument} from './document-window.mjs';localStorage.setItem('account-fixture','private');document.querySelector('button').onclick=()=>openDocument(document.querySelector('iframe'),'https://lesson.test/',{config:{documentOrigin:${JSON.stringify(origin)}},onError:error=>document.body.dataset.error=error});</script>`);
});
shell.listen(0,'127.0.0.1');await once(shell,'listening');
const profile=await mkdtemp(join(tmpdir(),'nyx-storage-test-'));
await mkdir(join(profile,'Default'));
await writeFile(join(profile,'Default','Preferences'),JSON.stringify({profile:{block_third_party_cookies:true,cookie_controls_mode:1}}));
let context;
try{
 context=await chromium.launchPersistentContext(profile,{headless:true,...(process.platform==='win32'?{channel:'chrome'}:{})});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const origin='http://localhost:'+shell.address().port;
 await page.goto(origin+'/different');
 await page.getByRole('button',{name:'Open lesson'}).click();
 await page.waitForFunction(()=>document.body.dataset.error?.includes('Site storage is blocked'));
 assert.equal(await page.frameLocator('iframe').frameLocator('iframe').locator('h1').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS Chrome with third-party cookies blocked: cross-site storage failure is reported to Nyx without an uncaught startup error');
 await page.goto(origin+'/same');
 await page.getByRole('button',{name:'Open lesson'}).click();
 const document=page.frameLocator('iframe').frameLocator('iframe');
 await document.getByRole('heading',{name:'Lesson ready'}).waitFor({timeout:15000});
 const isolation=await document.locator('body').evaluate(()=>{
  let blocked=false;try{void top.localStorage.getItem('account-fixture');}catch{blocked=true;}
  return {blocked,own:localStorage.getItem('account-fixture')};
 });
 assert.deepEqual(isolation,{blocked:true,own:null});
 await page.reload();await page.getByRole('button',{name:'Open lesson'}).click();
 await document.getByRole('heading',{name:'Lesson ready'}).waitFor({timeout:15000});
 assert.deepEqual(errors,[]);
 console.log('PASS Chrome with third-party cookies blocked: same host, separate port loads and reloads; account origin storage remains inaccessible; zero page errors');
}finally{
 await context?.close();
 for(const server of [shell,service,upstream]){server.closeAllConnections();server.close();}
 if(resolve(profile).startsWith(resolve(tmpdir())+ '\\nyx-storage-test-')||resolve(profile).startsWith(resolve(tmpdir())+'/nyx-storage-test-'))await rm(profile,{recursive:true,force:true,maxRetries:3});
}
