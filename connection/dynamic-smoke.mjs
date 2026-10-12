import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
import {application} from './app.mjs';
import {mkdtemp, copyFile, readFile, writeFile, unlink, rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const hits=[];
const upstream=createServer((request,response)=>{
  const url=new URL(request.url,'https://fixture.test');hits.push(url.pathname);
  const send=(type,body)=>{response.writeHead(200,{'content-type':type});response.end(body);};
  if(url.pathname==='/search')return send('text/html',`<!doctype html><title>Dynamic results</title><h1>Dynamic results</h1><button id="images">Images</button><button id="videos">Videos</button><div id="results"></div><div id="mounts"></div><script src="/app.js"></script>`);
  if(url.pathname==='/app.js')return send('text/javascript',`
    for(const kind of ['images','videos'])document.getElementById(kind).onclick=async()=>{
      const values=new URLSearchParams(document.defaultView.location.search);values.set('type',kind);
      history.pushState({},'', '/search?'+values);
      const data=await fetch('/results?'+values).then(r=>r.json());
      document.getElementById('results').innerHTML=data.html;
    };
  `);
  if(url.pathname==='/results')return send('application/x-javascript; charset=UTF-8',JSON.stringify({html:`<h2>${url.searchParams.get('type')}: ${url.searchParams.get('q')}</h2><img id="result-image" src="/image.svg?result"><div id="result-background" style="width:20px;height:20px;background-image:url('/image.svg?background')"></div><a href="/details?q=${url.searchParams.get('q')}">Details</a>`}));
  if(url.pathname==='/details')return send('text/html','<!doctype html><h1>Details</h1>');
  if(url.pathname==='/image.svg')return send('image/svg+xml','<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="green"/></svg>');
  if(url.pathname==='/styles.css')return send('text/css','.external{background-image:url("/image.svg?external")}');
  response.writeHead(404);response.end('Unknown fixture');
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const directory=await mkdtemp(join(tmpdir(),'document-assets-'));
const files=['index.html','worker.js','client.js','runtime.js'];
for(const name of files)await copyFile(new URL('./dist/'+name,import.meta.url),join(directory,name));
const workerSource=await readFile(join(directory,'worker.js'),'utf8');
const app=application({assetDirectory:pathToFileURL(directory+'/'),resolveDestination:async value=>({url:new URL(new URL(value).pathname+new URL(value).search,'http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}})});
let revision=0;
app.listen(0,'127.0.0.1');await once(app,'listening');
try{
  for(const channel of process.platform==='win32'?['chrome','msedge']:[undefined]){
    const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
    try{
      const page=await browser.newPage(),errors=[],failed=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      page.on('response',response=>{if(response.status()>=400)failed.push(response.status()+' '+response.url());});
      await page.goto('http://127.0.0.1:'+app.address().port);
      await page.locator('input').fill('https://fixture.test/search?q=waterloo');
      await page.getByRole('button',{name:'Open',exact:true}).click();
      const frame=page.frameLocator('iframe');
      await frame.getByRole('heading',{name:'Dynamic results'}).waitFor();
      for(const name of ['Images','Videos','Images']){
        await frame.getByRole('button',{name,exact:true}).click();
        await frame.getByRole('heading',{name:name.toLowerCase()+': waterloo'}).waitFor();
        await frame.locator('#result-image').evaluate(image=>image.decode());
        assert.match(await page.locator('input').inputValue(),/q=waterloo/);
      }
      console.log('PASS '+(channel||'chromium')+': clicked Images -> Videos -> Images; query, JSON served with JavaScript MIME type and inserted image preserved');
      const inspector=await page.context().newCDPSession(page),versions=new Map();
      inspector.on('ServiceWorker.workerVersionUpdated',({versions:updates})=>{for(const version of updates)versions.set(version.versionId,version);});
      await inspector.send('ServiceWorker.enable');
      for(let attempt=0;attempt<50&&!versions.size;attempt++)await page.waitForTimeout(20);
      const current=[...versions.values()].find(version=>version.status==='activated'&&version.runningStatus==='running');
      assert.ok(current,'Active document worker is inspectable');
      await inspector.send('ServiceWorker.stopWorker',{versionId:current.versionId});
      await frame.getByRole('button',{name:'Videos',exact:true}).click();
      await frame.getByRole('heading',{name:'videos: waterloo'}).waitFor();
      revision++;
      await writeFile(join(directory,'worker.js'),workerSource+'\n;void '+revision+';');
      await page.evaluate(async()=>{
        const registration=await navigator.serviceWorker.getRegistration('/content/');await registration.update();
        const worker=registration.installing||registration.waiting||registration.active;
        if(worker.state!=='activated')await new Promise(resolve=>worker.addEventListener('statechange',()=>{if(worker.state==='activated')resolve();}));
      });
      await frame.getByRole('button',{name:'Images',exact:true}).click();
      await frame.getByRole('heading',{name:'images: waterloo'}).waitFor();
      await frame.locator('#result-image').evaluate(image=>image.decode());
      await inspector.detach();
      console.log('PASS '+(channel||'chromium')+': stopped worker and installed replacement worker; existing page automatically reconnects and loads results');
      const results=await frame.locator('#mounts').evaluate(async mount=>{
        const image='<img src="/image.svg?fragment">';
        const make=()=>{const element=document.createElement('div');mount.append(element);return element;};
        make().innerHTML=image;
        make().outerHTML=image;
        make().insertAdjacentHTML('beforeend',image);
        const range=document.createRange();range.selectNodeContents(mount);mount.append(range.createContextualFragment(image));
        const table=document.createElement('table');mount.append(table);table.innerHTML='<tbody><tr><td>'+image+'</td></tr></tbody>';
        const template=document.createElement('template');template.innerHTML=image;mount.append(template.content.cloneNode(true));
        const shadow=make().attachShadow({mode:'open'});shadow.innerHTML=image;
        const responsive=new Image();responsive.srcset='/image.svg?candidate 1x, /image.svg?large 2x';mount.append(responsive);
        const attribute=new Image();attribute.setAttribute('srcset','/image.svg?attribute 1x');mount.append(attribute);
        const data=new Image();data.srcset='data:image/svg+xml,%3Csvg%20xmlns="http://www.w3.org/2000/svg"/%3E 1x';
        const styles=[];
        const first=make();first.style.backgroundImage='url("/image.svg?property")';styles.push(first);
        const second=make();second.style.setProperty('background-image','url("/image.svg?set")','important');styles.push(second);
        const third=make();third.style.cssText='background-image:url("/image.svg?text");width:12px;height:12px';styles.push(third);
        const fourth=make();fourth.setAttribute('style','background-image:url("/image.svg?attribute");width:12px;height:12px');styles.push(fourth);
        const style=document.createElement('style');style.textContent='.style-text{background-image:url("/image.svg?style")}';document.head.append(style);
        const fifth=make();fifth.className='style-text';styles.push(fifth);
        const sixth=make();sixth.className='rule';style.sheet.insertRule('.rule{background-image:url("/image.svg?rule")}');styles.push(sixth);
        const sheet=new CSSStyleSheet();sheet.replaceSync('.constructed{background-image:url("/image.svg?constructed")}');document.adoptedStyleSheets=[sheet];
        const seventh=make();seventh.className='constructed';styles.push(seventh);
        const link=document.createElement('link');link.rel='stylesheet';link.href='/styles.css';await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject;document.head.append(link);});
        const eighth=make();eighth.className='external';styles.push(eighth);
        for(const element of styles){element.style.width='12px';element.style.height='12px';}
        const all=[...mount.querySelectorAll('img'),...shadow.querySelectorAll('img')];await Promise.all(all.map(image=>image.decode()));
        const copy=make();copy.innerHTML=mount.querySelector('img').outerHTML;await copy.querySelector('img').decode();
        const inert=make();inert.innerHTML='<script>invalid javascript syntax</script><span>Still inserted</span>';
        if(inert.querySelector('span')?.textContent!=='Still inserted')throw new Error('Inert markup changed');
        return {images:all.map(image=>({width:image.naturalWidth,src:image.currentSrc})),backgrounds:styles.map(element=>getComputedStyle(element).backgroundImage),table:table.rows.length,priority:second.style.getPropertyPriority('background-image'),copy:copy.querySelector('img').currentSrc,originalCopy:copy.querySelector('img').src,data:data.srcset};
      });
      assert.equal(results.table,1);assert.equal(results.priority,'important');
      assert.ok(results.images.length>=9);
      for(const image of results.images){assert.equal(image.width,12);assert.ok(image.src.includes('/content/'));}
      for(const background of results.backgrounds)assert.ok(background.includes('/content/'),background);
      assert.equal(results.copy.split('/content/').length,2);
      assert.equal(results.originalCopy.includes('/content/'),false);
      assert.ok(results.data.startsWith('data:'));
      await frame.getByRole('link',{name:'Details',exact:true}).click();await frame.getByRole('heading',{name:'Details',exact:true}).waitFor();
      assert.match(await page.locator('input').inputValue(),/details\?q=waterloo/);
      assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
      console.log('PASS '+(channel||'chromium')+': HTML insertion, table/template/shadow contexts, srcset, CSS setters/rules, copied markup and result navigation; zero console errors or failed resources');
    }finally{await browser.close();}
  }
}finally{app.closeAllConnections();app.close();upstream.closeAllConnections();upstream.close();for(const name of files)await unlink(join(directory,name));await rmdir(directory);}
