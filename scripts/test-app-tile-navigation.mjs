import assert from 'node:assert/strict';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {domHookAlias} from './build-dom-hooks.mjs';

const root=process.env.NYX_TEST_STATIC_ROOT||'.';
const aliases=root==='.'?{}:JSON.parse(await readFile(root+'/frontend-assets.json','utf8')).aliases;
const attr=root==='.'?'data-app-url':'data-'+domHookAlias('attribute','data-app-url');
const runtime=aliases['/js/shell-app-launch.js']||'/js/shell-app-launch.js';
const app=express();
app.get('/fixture',(_req,res)=>res.type('html').send(`<iframe src="/tiles"></iframe><script>window.messages=[];addEventListener('message',e=>messages.push(e.data))</script>`));
app.get('/tiles',(_req,res)=>res.type('html').send(`<button ${attr}="/apps/link-checker/"><span>Link Checker</span></button><button ${attr}="/apps/nyxify/">Music</button><button ${attr}="nyx://ai">AI</button><button>Other</button><script src="${runtime}"></script>`));
app.use(express.static(root));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
 const frame=page.frameLocator('iframe');
 await frame.locator('span').click();
 await frame.getByRole('button',{name:'Music'}).focus();await page.keyboard.press('Enter');
 await frame.getByRole('button',{name:'AI',exact:true}).click();await frame.getByRole('button',{name:'Other'}).click();
 await page.waitForFunction(()=>messages.length===3);
 assert.deepEqual(await page.evaluate(()=>messages),['/apps/link-checker/','/apps/nyxify/','nyx://ai'].map(url=>({type:'nyx:navigate',url})));
 console.log('PASS app tiles: nested icon/text click, keyboard activation, internal address, no unrelated navigation.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
