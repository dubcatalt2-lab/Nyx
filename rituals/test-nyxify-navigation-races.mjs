import assert from 'node:assert/strict';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const root=process.env.NYX_TEST_STATIC_ROOT||'dist';
const app=express();app.use(express.static(root));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const track=title=>({id:title,title,artist:'Fixture artist',artistId:'42',catalog:'deezer',duration:120,cover:''});
try{
  const page=await browser.newPage(),errors=[],pending=new Map();let playbackRequests=0;
  page.on('pageerror',error=>errors.push(error.message));
  if(!process.argv.includes('--built')){
    const html=await readFile(`${root}/apps/nyxify/index.html`,'utf8');
    const entry=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].at(-1)[1];
    await page.route(new URL(entry,base).href,route=>route.fulfill({contentType:'text/javascript',path:'chapels/nyxify/app.js'}));
  }
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/nyxify/home')return route.fulfill({json:{tracks:[track('Home chart')],artists:[],albums:[]}});
    if(url.pathname==='/api/nyxify/search'){pending.set(url.searchParams.get('q'),route);return;}
    if(url.pathname==='/api/nyxify/artist/42'){pending.set('artist',route);return;}
    if(url.pathname.startsWith('/api/nyxify/playback/'))playbackRequests++;
    return route.fulfill({json:{enabled:false}});
  });
  const submit=async query=>{
    await page.locator('#searchInput').fill(query);await page.locator('#searchInput').press('Enter');
    for(let i=0;i<100&&!pending.has(query);i++)await new Promise(resolve=>setTimeout(resolve,20));
    assert(pending.has(query),`Search ${query} must start`);
  };
  const finish=async(key,json,status=200)=>{
    const route=pending.get(key);assert(route,`Pending ${key}`);pending.delete(key);
    await route.fulfill({status,json});await page.waitForTimeout(120);
  };
  await page.goto(base+'/apps/nyxify/');await page.getByText('Home chart',{exact:true}).first().waitFor();
  await submit('older');await submit('newer');
  await finish('newer',{data:[track('New result')]});
  await finish('older',{data:[track('Old result')]});
  assert.equal(await page.locator('#detailView .t-title').first().textContent(),'New result','A slower search must not overwrite a newer result');
  await submit('leave-search');await page.locator('[data-filter="home"]').click();
  await finish('leave-search',{error:'Delayed failure'},503);
  assert.equal(await page.getByText('Home chart',{exact:true}).first().isVisible(),true,'Stale search error must not replace Home');
  await page.locator('#detailView .alink').first().click();
  for(let i=0;i<100&&!pending.has('artist');i++)await new Promise(resolve=>setTimeout(resolve,20));
  await page.locator('[data-filter="home"]').click();
  await finish('artist',{name:'Fixture artist',tracks:[track('Artist result')],albums:[]});
  assert.equal(await page.getByText('Home chart',{exact:true}).first().isVisible(),true,'Stale artist response must not replace Home');
  await page.locator('#detailView .alink').first().click();
  for(let i=0;i<100&&!pending.has('artist');i++)await new Promise(resolve=>setTimeout(resolve,20));
  await submit('after-artist');await finish('after-artist',{data:[track('Search after artist')]});
  await finish('artist',{error:'Delayed artist failure'},503);
  assert.equal(await page.getByText('Search after artist',{exact:true}).first().isVisible(),true,'Stale detail error must not replace a search');
  const heart=page.locator('#detailView .like-btn').first();
  await heart.focus();await page.keyboard.press('Space');
  assert.equal(await heart.getAttribute('aria-pressed'),'true','Space on Like must activate Like, not its parent song row');
  await page.keyboard.press('Enter');assert.equal(await heart.getAttribute('aria-pressed'),'false');
  assert.equal(playbackRequests,0,'Keyboard Like must not start playback');
  assert.deepEqual(errors,[]);
  console.log('PASS delayed Music searches/details, out-of-order results, stale errors and navigation back Home.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
