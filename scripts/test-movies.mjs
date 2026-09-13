import {createMovieCatalog,installMovieApi} from '../lib/movies.mjs';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const item={id:157336,title:'Interstellar <script>',overview:'A movie description.',release_date:'2014-11-05',runtime:169,genres:[{name:'Science Fiction'}]};
let calls=0;const catalog=createMovieCatalog({token:()=> 'private-test-token',fetchImpl:async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer private-test-token');assert.equal(url.origin,'https://api.themoviedb.org');return Response.json(url.pathname.endsWith('/157336')?item:{results:[item,{...item,id:2,adult:true}],total_pages:2});}});
const [a,b]=await Promise.all([catalog.search('Interstellar'),catalog.search('Interstellar')]);assert.equal(calls,1);assert.equal(a.results.length,1);assert.deepEqual(a,b);assert(!JSON.stringify(a).includes('private-test-token'));await catalog.search('Interstellar');assert.equal(calls,1);
assert.equal((await catalog.details('157336')).playbackUrl,'https://vidsrcme.ru/embed/movie/157336');
await assert.rejects(()=>catalog.details('../secret'),e=>e.status===400);await assert.rejects(()=>catalog.search('x',101),e=>e.status===400);
await assert.rejects(()=>createMovieCatalog({token:()=>''}).search('x'),e=>e.status===503);
for(const status of [401,404,429,500])await assert.rejects(()=>createMovieCatalog({token:()=> 'secret',fetchImpl:async()=>new Response('secret',{status})}).search('x'),e=>!e.message.includes('secret')&&e.status===(status===404?404:status===429?429:503));
let failures=0;const broken=createMovieCatalog({token:()=> 'x',fetchImpl:()=>{failures++;throw Error('secret');}});await assert.rejects(()=>broken.search('x'));await assert.rejects(()=>broken.search('x'));assert.equal(failures,2);
const app=express();installMovieApi(app,{catalog});app.use(express.static(process.env.NYX_TEST_ASSET_ROOT||'.'));const server=app.listen(0);await new Promise(r=>server.once('listening',r));const origin='http://localhost:'+server.address().port;
const browser=await chromium.launch({channel:"msedge"});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();if(r.request().url().startsWith('https://vidsrcme.ru/embed/'))return r.fulfill({contentType:'text/html',body:'<button>Test player</button>'});return r.abort();});
 await page.goto(origin+'/apps/movies/');await page.locator('.movie-card').waitFor();assert.equal(await page.locator('.movie-card').count(),1);assert.equal(await page.locator('.movie-card strong').textContent(),item.title);
 assert.equal(await page.locator('#grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),4);
 await page.waitForFunction(()=>document.querySelector('footer img').naturalWidth>0);await page.screenshot({path:'.codex-artifacts/movies-desktop.png'});
 await page.locator('#query').fill('Interstellar');await page.locator('#search button').click();await page.locator('.movie-card').waitFor();await page.locator('.movie-card').click();await page.locator('#watch').waitFor();assert.equal(await page.locator('#player iframe').count(),0);
 await page.route('**/api/movies/157336/playback?**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'No video source is available.'})}));
 await page.locator('#watch').click();await page.locator('#player iframe').waitFor();assert((await page.locator('#player iframe').getAttribute('src')).startsWith('https://nhdapi.com/movie/'));assert.equal(await page.locator('#source-list li[data-state=Unavailable]').count(),1);await page.locator('#close-player').click();assert.equal(await page.locator('#player video').count(),0);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.codex-artifacts/movies-details-mobile.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#back').click();await page.locator('.movie-card').waitFor();await page.setViewportSize({width:320,height:700});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 let transientCalls=0;
 await page.route('**/api/movies/search?**',r=>{transientCalls++;return transientCalls===1?r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Movie browsing is unavailable.'})}):r.continue();});
 await page.evaluate(()=>{window.catalogNotices=[];new MutationObserver(()=>window.catalogNotices.push(document.getElementById('notice').textContent)).observe(document.getElementById('notice'),{childList:true,subtree:true,characterData:true});});
 await page.locator('#search button').click();await page.locator('.movie-card').waitFor();assert.equal(transientCalls,2);assert(!(await page.evaluate(()=>window.catalogNotices)).some(text=>text.includes('unavailable')),'Transient failure must not flash an error');
 let failedCalls=0;await page.route('**/api/movies/search?**',r=>{failedCalls++;return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Movie browsing is unavailable.'})});});await page.locator('#search button').click();await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('unavailable'));assert.equal(failedCalls,3,'Persistent failures stop after bounded retries');assert.equal(errors.length,0,errors.join('\n'));
 // Metadata abuse protection remains bounded and does not reveal credentials.
 let response;for(let i=0;i<121;i++)response=await fetch(origin+'/api/movies/search?q=cache');assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
 console.log('PASS: metadata validation, credential isolation, coalescing, failures, rate limit, search/details/player controls, safe text, desktop/mobile layout.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
