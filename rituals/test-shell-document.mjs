import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {fork} from 'node:child_process';
import {chromium} from 'playwright';
import {application} from '../connection/app.mjs';

const upstream=createServer((request,response)=>{
 const url=new URL(request.url,'https://fixture.test');
 response.setHeader('content-type','text/html');
 response.end('<!doctype html><html><head><title>Lesson results</title></head><body><h1>'+(url.pathname==='/next'?'Next lesson':'Lesson results')+'</h1><a href="/next" target="_blank">Next lesson</a></body></html>');
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
let requests=0;
const service=application({resolveDestination:async value=>{
 requests++;
 return {url:new URL(new URL(value).pathname+new URL(value).search,'http://127.0.0.1:'+upstream.address().port),address:{address:'127.0.0.1',family:4}};
}});
service.listen(0,'127.0.0.1');await once(service,'listening');
const documentOrigin='http://127.0.0.1:'+service.address().port;
const environment=Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(name)));
const child=fork(new URL('../shepherd.js',import.meta.url),[],{silent:true,env:{...environment,PORT:'0',NYX_YOUTUBE_NATIVE_ENABLED:'0'}});
child.stdout.resume();child.stderr.resume();
let browser;
try{
 const port=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Source startup timed out')),20000);
  child.on('message',message=>{if(message.type==='nyx:listening'){clearTimeout(timer);resolve(message.port);}});
  child.once('error',reject);
 });
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 for(const width of [1365,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(origin=>{localStorage.setItem('nyx.documentOrigin',origin);localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30');},documentOrigin);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.dismiss());
  await page.goto('http://127.0.0.1:'+port+'/study.html');
  const before=requests;
  await page.waitForTimeout(5500);assert.equal(requests,before);
  const gotIt=page.getByRole('button',{name:'Got it',exact:true});if(await gotIt.isVisible())await gotIt.click();
  const input=page.locator('input[placeholder="find your lessons"]:visible');
  await input.fill('waterloo');const sent=Date.now();await input.press('Enter');
  const outer=page.frameLocator('.workspace-body iframe.view.active');
  const content=outer.frameLocator('iframe');
  await content.getByRole('heading',{name:'Lesson results',exact:true}).waitFor({timeout:20000});
  console.log('Initial search rendered in '+(Date.now()-sent)+'ms');
  assert(Date.now()-sent<1900,'Initial search must not wait for an artificial timer');
  assert.equal(await outer.locator('form').count(),0);
  assert.equal(await outer.locator('output').count(),0);
  assert.equal(await input.inputValue(),'https://duckduckgo.com/?q=waterloo');
  await content.getByRole('link',{name:'Next lesson',exact:true}).click();
  await content.getByRole('heading',{name:'Next lesson',exact:true}).waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(input=>input.offsetParent&&input.value==='https://duckduckgo.com/next'));
  assert.equal(context.pages().length,1);
  await page.locator('[data-workspace-shell-back]:visible').click();
  await content.getByRole('heading',{name:'Lesson results',exact:true}).waitFor();
  assert.equal(await input.inputValue(),'https://duckduckgo.com/?q=waterloo');
  await page.locator('[data-workspace-shell-forward]:visible').click();
  await content.getByRole('heading',{name:'Next lesson',exact:true}).waitFor();
  assert.equal(await input.inputValue(),'https://duckduckgo.com/next');
  const beforeReload=requests;
  await page.locator('[data-workspace-shell-reload]:visible').click();
  await content.getByRole('heading',{name:'Next lesson',exact:true}).waitFor();
  await page.waitForTimeout(500);
  assert(requests>beforeReload,'Reload must request the current document again');

  await input.fill('https://lesson.test/');const repeated=Date.now();await input.press('Enter');
  await content.getByRole('heading',{name:'Lesson results',exact:true}).waitFor({timeout:20000});
  const warm=Date.now()-repeated;assert(warm<1900,'Repeat navigation added a startup delay: '+warm+'ms');
  console.log('Repeat navigation rendered in '+warm+'ms');
  console.log('PASS back, forward and reload');
  const originalTab=await page.locator('[data-workspace-shell-tab].active:visible').getAttribute('data-workspace-shell-tab');
  await page.locator('[data-nyx-visual-new-tab]:visible').first().click({timeout:5000});
  await page.locator('[data-workspace-blank-input]:visible').waitFor({timeout:10000});
  await page.locator('[data-workspace-shell-tab="'+originalTab+'"]:visible').click();
  await content.getByRole('heading',{name:'Lesson results',exact:true}).waitFor();
  assert.equal(await input.inputValue(),'https://lesson.test/');
  await page.locator('[data-workspace-shell-tab="'+originalTab+'"]:visible [data-workspace-shell-close-tab]').click();
  await page.locator('[data-workspace-blank-input]:visible').waitFor({timeout:10000});
  const tabsBefore=await page.locator('.nyx-visual-dock-tab[data-workspace-shell-tab]').count();
  await page.locator('[data-workspace-blank-input]:visible').click({button:'right'});
  await page.getByRole('menuitem',{name:/^New /}).click();
  assert.equal(await page.locator('.nyx-visual-dock-tab[data-workspace-shell-tab]').count(),tabsBefore+1);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: no initial request; one Enter loads results without an artificial delay; no second form; link updates address; cached worker; back/forward/reload; new/switch/close tabs; context-menu new page; zero page errors`);
  await context.close();
 }
}finally{
 await browser?.close();child.kill();
 for(const server of [service,upstream]){server.closeAllConnections();server.close();}
}
