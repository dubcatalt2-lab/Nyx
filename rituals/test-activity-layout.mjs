import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';
const temp=await mkdtemp(join(tmpdir(),'nyx-activities-'));
await symlink(resolve('dist'),join(temp,'site'),process.platform==='win32'?'junction':'dir');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(key)));
const child=fork(new URL('../shepherd.js',import.meta.url),[],{env:{...env,PORT:'0',WISP_URL:'wss://example.com/wisp/',NYX_STATIC_ROOT:join(temp,'site'),NYX_YOUTUBE_NATIVE_ENABLED:'0'},silent:true});
child.stdout.resume();child.stderr.resume();
let browser;
try{
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),20000);child.on('message',m=>{if(m.type==='nyx:listening'){clearTimeout(timer);resolve(m.port);}});child.once('exit',()=>reject(Error('Server exited')));});
 const base=`http://127.0.0.1:${port}`;
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const json=body=>({contentType:'application/json',body:JSON.stringify(body)});
 await page.route('**/assets/games/games.json',r=>r.fulfill(json({catalogs:[{id:'gn',format:'gn',url:'/activity-fixture/catalog.json',player:'/activity-fixture/play.html?game={path}',priority:40}]})));
 const titles=['Slope','Retro Bowl','Geometry Dash',...Array.from({length:32},(_,i)=>`Exercise ${i+1}`)];
 await page.route('**/activity-fixture/catalog.json',r=>r.fulfill(json(titles.map((title,i)=>({title,path:`activity-${i}.html`,cover:'/activity-fixture/cover.svg'})))));
 await page.route('**/activity-fixture/cover.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#405848"/><path d="M0 400 300 60 600 400" fill="#b5b895"/></svg>'}));
 await page.route('**/activity-fixture/play.html*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Activity</title><p>Fixture loaded</p>'}));
 await page.goto(base+'/assets/games/',{waitUntil:'domcontentloaded'});
 try{await page.locator('.game-card').nth(29).waitFor();}catch(error){console.log(errors,await page.locator('body').innerText());throw error;}
 assert.equal(await page.locator('.activity-chapter').count(),3);
 assert.match(await page.locator('.activity-chapter').first().innerText(),/The Battle of Waterloo/);
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});
  const sizes=await page.locator('.game-card').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
  assert(sizes[0].width>sizes[1].width*1.5);
  if(width>700)assert(sizes[0].height>sizes[1].height*1.8);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width}`);
  assert(await page.locator('.activity-chapter').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().bottom<=n.nextElementSibling.getBoundingClientRect().top)),`Heading overlaps at ${width}`);
  await page.screenshot({path:join(temp,`library-${width}.png`),fullPage:true});
 }
 await page.locator('#gameSearch').fill('Motion Lab');
 await page.waitForFunction(()=>document.querySelectorAll('.game-card').length===1);
 assert.equal(await page.locator('.activity-chapter').count(),1);
 assert.equal(await page.locator('.game-card img').getAttribute('alt'),'Motion Lab cover');
 const key=await page.locator('.game-card').getAttribute('data-game-key');
 await page.locator('#gameSearch').fill('Slope');
 assert.equal(await page.locator('.game-card').getAttribute('data-game-key'),key);
 await page.locator('.game-card').click();
 await page.locator('#gamePlayer').waitFor({state:'visible'});
 assert.equal(await page.locator('#gameFrame').getAttribute('title'),'Motion Lab');
 await page.locator('#closePlayer').click();
 await page.locator('#gameSearch').fill('');
 await page.locator('#nextPage').click();
 await page.waitForFunction(()=>document.querySelectorAll('.game-card').length===5);
 assert.equal(await page.locator('.activity-chapter').count(),1);
 assert.match(await page.locator('.activity-chapter').innerText(),/The Renaissance/);
 assert.deepEqual(errors,[]);
 console.log('PASS varied desktop/mobile tiles, no overflow, renamed covers, original-name search, player startup and pagination. Screenshots: '+temp);
}finally{
 await browser?.close();
 if(child.exitCode===null){const stopped=once(child,'exit');child.disconnect();const timer=setTimeout(()=>child.kill(),10000);await stopped;clearTimeout(timer);}
}
