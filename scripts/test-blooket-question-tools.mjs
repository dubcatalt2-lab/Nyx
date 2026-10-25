import assert from 'node:assert/strict';import express from 'express';import {chromium} from 'playwright';import {build} from 'esbuild';import {resolve} from 'node:path';
const bundle=await build({entryPoints:[resolve('scripts/fixtures/blooket-question.jsx')],nodePaths:[resolve('.codex-artifacts/blooket-runtime-fixture/node_modules')],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const serverApp=express();serverApp.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));const server=serverApp.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const ctx=await browser.newContext();ctx.setDefaultTimeout(20000);const errors=[];let percentage='100';ctx.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>percentage===null?d.dismiss():d.accept(percentage));});
 await ctx.route('https://play.blooket.com/**',r=>r.fulfill({contentType:r.request().url().endsWith('fixture.js')?'text/javascript':'text/html',body:r.request().url().endsWith('fixture.js')?bundle.outputFiles[0].text:'<div id="root"></div><script src="/fixture.js"></script>'}));
 const setup=await ctx.newPage();await setup.goto(base+'/apps/blooket/');await setup.getByRole('status',{name:'27 tools',exact:true}).waitFor();const bookmark=await setup.getByRole('link',{name:'Connect to Nyx bookmarklet'}).getAttribute('href');
 const cases=[['Auto Answer','answer',false],['Auto Answer (Intervals)','answer',true],['Highlight Answers','highlight',false],['Highlight Answers (Intervals)','highlight',true],['Subtle Highlight Answers','subtle',false],['Subtle Highlight Answers (Intervals)','subtle',true],['Percent Auto Answer (Intervals)','answer',true],['Percent Auto Answer (Intervals)','answer',true,'0'],['Percent Auto Answer (Intervals)','cancel',false,null]];
 for(const [name,kind,repeat,percent='100'] of cases){
  percentage=percent;
  const game=await ctx.newPage();await game.goto('https://play.blooket.com/fixture');await game.getByRole('button',{name:'A',exact:true}).waitFor();
  const opened=ctx.waitForEvent('page'),cdp=await ctx.newCDPSession(game);await cdp.send('Runtime.evaluate',{expression:'location.href='+JSON.stringify(bookmark),userGesture:true});await cdp.detach();const app=await opened;
  await app.getByRole('status',{name:'Connected to Blooket',exact:true}).waitFor();await app.getByRole('button',{name:'Open '+name+' (Global)',exact:true}).click();await app.getByRole('button',{name:'Run in game',exact:true}).click();
  await app.getByRole('status',{name:name+(kind==='cancel'?': cancelled.':repeat?': running.':': finished running.')}).waitFor();
  if(kind==='answer'){
   await game.waitForFunction(expected=>document.querySelector('output').textContent===expected,percent==='0'?'B':'A');
   if(repeat){await game.waitForTimeout(600);await game.evaluate(()=>fixtureNext());await game.waitForFunction(expected=>document.querySelector('output').textContent===expected,percent==='0'?'C':'D');}
  }else if(kind==='cancel'){assert.equal(await game.locator('output').textContent(),'');}else{
   await game.waitForFunction(kind=>kind==='highlight'?document.querySelector('button').style.backgroundColor==='rgb(0, 207, 119)':document.querySelector('button').style.outline.includes('2px'),kind);
  }
  await app.getByRole('button',{name:'Close tool details'}).click();await app.getByRole('button',{name:'Stop scheduled tools'}).click();await app.getByRole('listitem',{name:/Scheduled tools stopped/}).waitFor();
  if(kind!=='answer'&&kind!=='cancel')assert.equal(await game.locator('button').first().getAttribute('style'),'');
  await app.close();await game.close();console.log('PASS functional React question: '+name);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
