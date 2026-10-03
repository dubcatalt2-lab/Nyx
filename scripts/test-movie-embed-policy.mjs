import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static(process.env.NYX_TEST_ASSET_ROOT||'.'));
const server=app.listen(0);await new Promise(r=>server.once('listening',r));const origin='http://localhost:'+server.address().port;
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage(),blockedRequests=[];
 const movie={id:1,title:'Movie',genres:[],cast:[],sources:[{id:'vidcore',name:'VidCore',url:'https://vidcore.org/embed/movie/1?theme=eeeeee'},{id:'screenscape',name:'ScreenScape',url:'https://screenscape.me/embed?tmdb=1&type=movie&lan=eng'},{id:'nhd',name:'NHD',url:'https://nhdapi.com/movie/1'}]};
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(['vidcore.org','screenscape.me'].includes(url.hostname)){blockedRequests.push(url.hostname);return route.abort();}if(url.hostname==='nhdapi.com')return route.fulfill({contentType:'text/html',body:'<button>Play fixture</button>'});if(url.origin!==origin)return route.abort();if(url.pathname==='/api/movies/episodes')return route.fulfill({json:{results:[]}});if(url.pathname==='/api/movies/1')return route.fulfill({json:movie});if(url.pathname==='/api/movies/search')return route.fulfill({json:{results:[movie],page:1,totalPages:1}});return route.continue();});
 await page.goto(origin+'/apps/movies/#movie=1');await page.locator('#watch').click();
 await page.frameLocator('#player iframe').getByText('Play fixture').waitFor();
 assert.equal(await page.locator('#player iframe').getAttribute('sandbox'),'allow-scripts allow-same-origin allow-forms allow-presentation');
 assert.deepEqual(await page.locator('[data-provider]').evaluateAll(nodes=>nodes.map(n=>n.dataset.provider)),['nhd']);
 await page.evaluate(()=>{window.blockedFrames=[];addEventListener('securitypolicyviolation',e=>window.blockedFrames.push(e.effectiveDirective));for(const host of ['vidcore.org','screenscape.me']){const frame=document.createElement('iframe');frame.src='https://'+host+'/embed/movie/1';document.body.append(frame);}});
 await page.waitForFunction(()=>window.blockedFrames.filter(d=>d==='frame-src').length>=2);
 assert.deepEqual(blockedRequests,[],'Removed provider frames never reach the network');
 console.log('PASS embed policy: allowed player remains sandboxed; removed providers rejected in metadata and blocked by browser CSP.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
