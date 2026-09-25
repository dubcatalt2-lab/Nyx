import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {createServer,request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,symlink,unlink,rmdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {parse} from 'acorn';
import {chromium} from 'playwright';
import {proxyAssetNames,rewriteProxyReferences} from './build-proxy-assets.mjs';
import {rewriteFrontendReferences} from './build-frontend-assets.mjs';

// All upstream content and account APIs are fixtures. A fresh credential-free
// backend serves real proxy workers, rewriting and the current frontend build.
const temp=await mkdtemp(join(tmpdir(),'nyx-spa-'));
const staticRoot=join(temp,'site');
await symlink(resolve('dist'),staticRoot,process.platform==='win32'?'junction':'dir');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(key)));
const child=fork(new URL('../server.js',import.meta.url),[],{
  env:{...env,PORT:'0',WISP_URL:'wss://example.com/wisp/',NYX_STATIC_ROOT:staticRoot,NYX_YOUTUBE_NATIVE_ENABLED:'0'},silent:true
});
child.stdout.resume();child.stderr.resume();
let browser,fixtureServer;
try{
  const port=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Fixture backend startup timed out')),20000);
    child.once('error',reject);
    child.on('message',message=>{if(message.type==='nyx:listening'){clearTimeout(timeout);resolve(message.port);}});
  });
  const backend=`http://127.0.0.1:${port}`;
  const aliases=JSON.parse(await readFile('dist/frontend-assets.json','utf8')).aliases;
  const sourceMode=process.argv.includes('--source');
  const shell=sourceMode?rewriteFrontendReferences(rewriteProxyReferences(await readFile('script.js','utf8'),'/script.js'),'/script.js',aliases):'';
  const app=`document.body.dataset.instance=String(Math.random());
    document.getElementById('accept-cookies').addEventListener('click',event=>{
      document.cookie='consent=yes; Path=/; SameSite=Lax';
      localStorage.setItem('fixture-consent','yes');
      history.replaceState({consent:true},'',location.pathname+'?consent=yes#ready');
      event.currentTarget.textContent='Cookies accepted';
    });
    document.getElementById('links').addEventListener('click',event=>{
      const link=event.target.closest('a');if(!link)return;event.preventDefault();
      history.pushState({key:link.id,state:{channel:link.id}},null,link.getAttribute('href'));
      document.getElementById('channel').textContent=link.textContent;
      document.getElementById('message').textContent='A chat message says something went wrong';
    });`;
  const html='<!doctype html><html><head><title>Channel fixture</title><style>body{background:#202225;color:white;font:16px sans-serif}a{display:block;color:cyan;padding:12px}</style></head><body><button id="accept-cookies" type="button">Accept cookies</button><h1 id="channel">A</h1><p id="message">Loaded channel list</p><nav id="links"><a id="channel-b" href="/channels/100/200">B</a><a id="channel-c" href="/channels/100/300">C</a></nav><script src="/fixture-app.js"></script></body></html>';
  const transport=`export default class {ready=false;async init(){this.ready=true}async request(remote){
    const script=String(remote).includes('fixture-app.js');
    return {status:200,statusText:'OK',headers:[['content-type',script?'text/javascript':'text/html']],
      body:new Response(script?${JSON.stringify(app)}:${JSON.stringify(html)}).body};
    }connect(){return [()=>{},()=>{}]}}`;
  const curlSource=await readFile(createRequire(import.meta.url).resolve('@mercuryworkshop/libcurl-transport'),'utf8');
  let streamMethod='';
  function findStreamMethod(node){
    if(!node || typeof node!=='object')return;
    if(node.type==='MethodDefinition' && node.key.name==='stream_response')streamMethod=curlSource.slice(node.start,node.end);
    for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(findStreamMethod);else if(value&&typeof value==='object')findStreamMethod(value);}
  }
  findStreamMethod(parse(curlSource,{ecmaVersion:'latest',sourceType:'module'}));assert(streamMethod);
  // Inject a single late HTTP/2 stream failure using upstream's actual body
  // callbacks. The first-party libcurl adapters and proxy engines stay real.
  const curlFixture=`class Session { failed=false;${streamMethod}
    create_request(url,data,end){const script=String(url).includes('fixture-app.js');
      const fail=script&&!this.failed;if(fail)this.failed=true;
      queueMicrotask(()=>{data(new TextEncoder().encode(fail?'document.':script?${JSON.stringify(app)}:${JSON.stringify(html)}));end(fail?92:0)});return 1;}}
    export default class {ready=false;async meta(){}async init(){this.session=new Session();this.ready=true}
      request(url,method,body,headers,signal){return new Promise(resolve=>this.session.stream_response(url,
        stream=>resolve({status:200,statusText:'OK',headers:[['content-type',String(url).includes('fixture-app.js')?'text/javascript':'text/html']],body:stream}),()=>{},signal));}
      connect(){return [()=>{},()=>{}]}}`;
  // SharedWorker module requests bypass Playwright's page routing. Serve the
  // upstream stub at HTTP level so bare-mux exercises the same fixture too.
  fixtureServer=createServer((req,res)=>{
    const path=new URL(req.url,'http://fixture.test').pathname;
    if(['/libcurl/index.mjs',proxyAssetNames['/libcurl/index.mjs']].includes(path)){
      res.writeHead(200,{'content-type':'text/javascript'});res.end(curlFixture);return;
    }
    const upstream=httpRequest(backend+req.url,{method:req.method,headers:req.headers},response=>{
      res.writeHead(response.statusCode,response.headers);response.pipe(res);
    });
    upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
  });
  await new Promise(resolve=>fixtureServer.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${fixtureServer.address().port}`;
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [brand,mode,delay,transportName='epoxy'] of [
    ['nyx','auto',0],['nyx','auto',3000],['nyx','scramjet',0],['tutsi','scramjet',0],
    ['nyx','scramjet',0,'libcurlRaw'],['tutsi','scramjet',0,'libcurl'],
    ['nyx','scramjet-v1',0,'libcurlRaw'],['nyx','ultraviolet',0,'libcurlRaw']
  ]){
    if(process.argv.includes('--presentation') && !(brand==='nyx'&&delay===3000))continue;
    if(process.argv.includes('--legacy') && !['scramjet-v1','ultraviolet'].includes(mode))continue;
    const context=await browser.newContext();
    await context.routeWebSocket('wss://fixture.test/wisp/',ws=>setTimeout(()=>ws.send(Buffer.from([3,0,0,0,0,255,255,0,0])),20));
    await context.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:'{}'}));
    if(sourceMode) await context.route(url=>url.pathname===aliases['/script.js'],route=>route.fulfill({contentType:'text/javascript',body:shell}));
    const path='/assets/transports/epoxy-scramjet.mjs';
    await context.route(url=>[path,proxyAssetNames[path]].includes(url.pathname),route=>route.fulfill({contentType:'text/javascript',body:transport}));
    await context.addInitScript(({mode,transportName})=>{
      localStorage.setItem('nyx.releaseNotes.2026-09-14-nyx-1.0.3.seen','2026-09-14-nyx-1.0.3');
      localStorage.setItem('nyx.setupComplete','true');localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');
      localStorage.setItem('nyx.browserShellMode','true');localStorage.setItem('nyx.browserMode',mode);
      localStorage.setItem('nyx.transport',transportName);localStorage.setItem('nyx.wispUrl','wss://fixture.test/wisp/');
      localStorage.setItem('tutsi.customize.seen','1');
      localStorage.setItem('tutsi.settings.v1',JSON.stringify({transport:transportName,relay:'wss://fixture.test/wisp/',autoRelay:false,closePrevention:false}));
    },{mode,transportName});
    const page=await context.newPage();
    if(process.argv.includes('--debug')){
      page.on('framenavigated',frame=>console.log('NAV',frame.url().slice(-160)));
      page.on('pageerror',error=>console.log('PAGEERROR',error.message));
      page.on('console',message=>{if(message.type()==='error')console.log('ERROR',message.text().slice(0,400));});
    }
    await page.goto(base+'/'+brand);
    if(brand==='nyx'){
      await page.locator('[data-browser-shell-url]').waitFor();
      await page.locator('#nyxStudyHubStartup').waitFor({state:'detached'});
      await page.locator('[data-browser-shell-search]').evaluate(form=>{
        form.querySelector('[data-browser-shell-url]').value='https://discord.com/app';
        form.requestSubmit();
      });
    }else{
      await page.locator('#query').waitFor();
      await page.locator('#studyready-startup').waitFor({state:'detached'});
      await page.fill('#query','https://discord.com/app');await page.locator('#search button').click();
    }
    const frame=page.frameLocator(brand==='nyx'?'iframe.view.active':'#browser-stage iframe:not([hidden])');
    await frame.locator('#channel-b').waitFor();
    if(brand==='nyx') assert.match(await page.locator('iframe.view.active').getAttribute('src'), /\/~\/sj\//, 'Every saved proxy engine must use Scramjet v2');
    const instance=await frame.locator('body').getAttribute('data-instance');
    assert(instance,'Fixture script must initialize');
    await frame.locator('#accept-cookies').evaluate(button=>button.click());
    assert.equal(await frame.locator('#accept-cookies').innerText(),'Cookies accepted');
    assert.equal(await frame.locator('body').evaluate(()=>localStorage.getItem('fixture-consent')),'yes');
    assert.match(await frame.locator('body').evaluate(()=>document.cookie),/consent=yes/);
    assert.equal(await frame.locator('body').getAttribute('data-instance'),instance,'Accept cookies must preserve document');
    if(delay) await page.waitForTimeout(delay);
    if(process.argv.includes('--presentation')){
      await frame.locator('body').evaluate(body=>{const nodes=[...body.childNodes];body.replaceChildren();setTimeout(()=>body.append(...nodes),7000);});
      await page.waitForTimeout(8000);
      assert.equal(await frame.locator('body').getAttribute('data-instance'),instance,'A temporary blank app transition must not reload the frame');
    }
    // Early route changes can happen while the host's loading animation still
    // covers the frame. Later changes exercise an actual pointer click.
    if(delay) await frame.locator('#channel-b').click();
    else await frame.locator('#channel-b').evaluate(link=>link.click());
    assert.equal(await frame.locator('#channel').innerText(),'B');
    // Outlast every startup recovery timer, then change channels again.
    await page.waitForTimeout(12500);
    assert.equal(await frame.locator('body').getAttribute('data-instance'),instance,'Channel navigation must preserve the document');
    assert.equal(await frame.locator('#channel').innerText(),'B');
    await frame.locator('#channel-c').click();
    assert.equal(await frame.locator('#channel').innerText(),'C');
    assert.equal(await frame.locator('body').getAttribute('data-instance'),instance);
    console.log(`${sourceMode?'source':'built'} ${brand}/${mode}/${transportName}, click delay ${delay}ms: passed`);
    await context.close();
  }
}finally{
  await browser?.close();
  if(fixtureServer){fixtureServer.closeAllConnections();await new Promise(resolve=>fixtureServer.close(resolve));}
  if(child.exitCode===null && child.signalCode===null){
    const closed=once(child,'exit');child.disconnect();
    const timeout=setTimeout(()=>child.kill('SIGKILL'),12000);await closed;clearTimeout(timeout);
  }
  await unlink(staticRoot);await rmdir(temp);
}
