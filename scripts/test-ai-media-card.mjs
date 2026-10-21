import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const server=express().use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.')).use(express.static('dist')).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch({channel:'msedge'});
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const id='11111111-1111-1111-1111-111111111111';
  let status='pending';
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/models'))return route.fulfill({json:{models:[{id:'vendor/image',label:'Image',text:false,imageGeneration:true,outputModalities:['image']}]}});
    if(path.endsWith('/providers'))return route.fulfill({json:{providers:[{id:'shared',label:'OpenRouter'}]}});
    if(path.endsWith('/media'))return route.fulfill({status:202,json:{jobId:id,kind:'image'}});
    if(path.endsWith('/'+id))return route.fulfill({json:{status,kind:'image'}});
    return route.fulfill({json:{}});
  });
  await page.goto((process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:'+server.address().port)+'/ai.html');
  await page.locator('#input').fill('Make a beach');
  await page.locator('#send').click();
  const card=page.locator('.ai-generated-video');
  await card.getByRole('button',{name:'Check progress',exact:true}).waitFor();
  const box=await card.boundingBox(),text=await page.locator('.ai-message-assistant .ai-message-content').last().boundingBox();
  assert(Math.abs(box.x-text.x)<2&&box.height<100,'Media status is compact and aligned with assistant text');
  assert.equal(await card.locator('button').evaluate(node=>getComputedStyle(node).borderTopWidth),'0px');
  await page.screenshot({path:'.codex-artifacts/a1-media-card.png'});
  status='failed';
  await card.getByRole('button',{name:'Check progress',exact:true}).click();
  await card.getByText('Generation failed. Try a different prompt or model.',{exact:true}).waitFor();
  assert.equal(await card.locator('button').isVisible(),false);
  await page.setViewportSize({width:390,height:740});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS media status alignment, compact styled controls, failure state and mobile fit');
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
