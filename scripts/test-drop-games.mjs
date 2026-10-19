import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('drop.setupComplete','1'));
 if(process.env.DROP_TEST_DIST)await page.route('http://localhost:6767/**',async route=>{const path=new URL(route.request().url()).pathname;try{const file=resolve('dist','.'+decodeURIComponent(path)+(path.endsWith('/')?'index.html':''));if(!file.startsWith(resolve('dist')+'\\'))throw Error('Invalid path');await route.fulfill({body:await readFile(file),contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream'});}catch{await route.continue();}});
                                                                                 
                                                          
 await page.route('**/assets/games/games.json',async r=>{const manifest=process.env.DROP_TEST_DIST?JSON.parse(await readFile('dist/assets/games/games.json','utf8')):await(await r.fetch()).json();manifest.catalogs=manifest.catalogs.filter(c=>c.id==='local');await r.fulfill({json:manifest});});
 await page.route('**/api/founder-profile/auth-config',r=>r.fulfill({json:{enabled:false}}));
 await page.goto('http://localhost:6767/apps/drop/');await page.locator('#gamesNav').click();const games=page.frameLocator('#gamesFrame');await games.locator('.q482f08e91ee0').first().waitFor({timeout:30000}).catch(async e=>{console.log(await games.locator('body').innerText(),errors);throw e;});
 assert.equal((await games.locator('h1').innerText()).normalize('NFKC'),'A little play time.');assert.equal(await games.locator('.q482f08e91ee0').first().evaluate(el=>getComputedStyle(el).display),'grid');assert.match((await games.locator('#q06a972261bc8').innerText()).normalize('NFKC'),/Archive/);
 await mkdir('.codex-artifacts',{recursive:true});await page.screenshot({path:'.codex-artifacts/drop-games.png'});
 await games.locator('#q768acae37c5a').fill('2048');await games.getByRole('button',{name:'Play 2048',exact:true}).waitFor();await games.getByRole('button',{name:'Play 2048',exact:true}).click();await games.locator('#qb12206a9731b').waitFor();await games.locator('#qcb196f617df1').waitFor();await page.waitForFunction(()=>document.querySelector('#gamesFrame').contentDocument.querySelector('#qcb196f617df1').getAttribute('src')?.includes('play.html'),{timeout:15000});
 await games.locator('#qd322f3d74d9d').click();await games.locator('#qb12206a9731b').waitFor({state:'hidden'});await games.locator('#q768acae37c5a').fill('not-an-actual-game-123456');await games.locator('#emptyState').waitFor();await games.locator('#q768acae37c5a').fill('');
 await page.setViewportSize({width:390,height:844});await page.locator('#collapse').click();await page.waitForTimeout(250);assert.equal(await games.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.codex-artifacts/drop-games-mobile.png'});assert.deepEqual(errors,[]);
 console.log('PASS Drop shared local catalog, distinct cards, search, game runner launch/close, mobile and no runtime errors');
}finally{await browser.close();}
