import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const server=express().use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.')).use(express.static('dist')).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'no-preference'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let release;
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/models'))return route.fulfill({json:{models:[{id:'anthropic/claude-fixture',label:'Claude',text:true}]}});
  if(path.endsWith('/providers'))return route.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}});
  if(path==='/api/nyx-ai'&&route.request().method()==='POST'){
   await new Promise(resolve=>{release=resolve;});
   return route.fulfill({contentType:'text/event-stream',body:'data: {"choices":[{"delta":{"content":"Finished fixture response."}}]}\n\ndata: [DONE]\n\n'});
  }
  return route.fulfill({json:{}});
 });
 await page.goto((process.env.NYX_TEST_BASE_URL||`http://127.0.0.1:${server.address().port}`)+'/ai.html');
 await page.locator('#input').waitFor();
 const seen=new Set();
 for(let n=0;n<6;n++){
  await page.locator('#input').fill('Thinking example '+n);
  await page.locator('#send').click();
  const art=page.locator('[data-thinking-variant]');await art.waitFor();
  const variant=Number(await art.getAttribute('data-thinking-variant'));
  assert([1,3,5,6,9,10].includes(variant));assert(!seen.has(variant),'Each randomized batch uses all six');seen.add(variant);
  const bounds=await art.evaluate(el=>{
   const box=el.getBoundingClientRect(),scene=el.firstElementChild.getBoundingClientRect(),label=el.nextElementSibling.getBoundingClientRect();
   return {width:box.width,height:box.height,inside:scene.left>=box.left&&scene.right<=box.right&&scene.top>=box.top&&scene.bottom<=box.bottom,aligned:Math.abs((label.top+label.bottom)/2-(box.top+box.bottom)/2)<2,labelAfter:label.left>=box.right};
  });
  assert(bounds.width<=52&&bounds.height<=36&&bounds.inside&&bounds.aligned&&bounds.labelAfter,`Variant ${variant} fits and aligns beside label: ${JSON.stringify(bounds)}`);
  await page.evaluate(()=>document.documentElement.dataset.n7xTheme='ruby');
  assert.equal(await art.evaluate(el=>getComputedStyle(el).color),'rgb(173, 119, 123)');
  await page.evaluate(()=>document.documentElement.dataset.n7xTheme='emerald');
  assert.equal(await art.evaluate(el=>getComputedStyle(el).color),'rgb(87, 156, 133)');
  await page.evaluate(()=>{document.documentElement.dataset.n7xTheme='custom';document.documentElement.style.setProperty('--n7x-custom-base','#4499ee');});
  assert.equal(await art.evaluate(el=>getComputedStyle(el).color),'rgb(68, 153, 238)');
  const motion=()=>art.evaluate(el=>[...el.querySelectorAll('i,b,circle,path')].map(node=>{
    const style=getComputedStyle(node);
    return {animation:style.animationName,transform:style.transform,opacity:style.opacity,height:style.height,dash:style.strokeDashoffset,running:node.getAnimations().some(animation=>animation.playState==='running')};
  }));
  const initialMotion=await motion();
  assert(initialMotion.length>0&&initialMotion.every(node=>node.running),`Variant ${variant} has running animation on every visual element: ${JSON.stringify(initialMotion)}`);
  const before=await art.screenshot();await page.waitForTimeout(350);
  const laterMotion=await motion();
  assert(initialMotion.every((node,index)=>JSON.stringify(node)!==JSON.stringify(laterMotion[index])),`Variant ${variant} changes every visual element, independently of wallpaper`);
  assert(!before.equals(await art.screenshot()),`Variant ${variant} visibly animates`);
  await page.locator('.ai-message-assistant').last().screenshot({path:`.codex-artifacts/thinking-fit-${variant}.png`});
  if(n===0){
   const label=await page.locator('.ai-thinking-label').textContent();
   await page.waitForFunction(previous=>document.querySelector('.ai-thinking-label')?.textContent!==previous,label);
   assert.equal(await art.getAttribute('data-thinking-variant'),String(variant),'Words change without replacing animation');
   assert.equal(await page.getByRole('status',{name:'A1 is waiting for a response'}).count(),1);
  }
  if(n===5){
   await page.emulateMedia({reducedMotion:'reduce'});
   assert(await art.evaluate(el=>[...el.querySelectorAll('*')].every(node=>getComputedStyle(node).animationName==='none')));
  }
  while(!release)await page.waitForTimeout(10);
  release();release=null;
  await page.waitForFunction(()=>!document.querySelector('.ai-thinking'));
  await page.waitForFunction(()=>!document.querySelector('#send').disabled);
 }
 assert.deepEqual([...seen].sort((a,b)=>a-b),[1,3,5,6,9,10]);
 assert.deepEqual(errors,[]);
 console.log('PASS six selected animations visibly move, randomized without repeats per batch, rotating labels, response cleanup and reduced motion.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
