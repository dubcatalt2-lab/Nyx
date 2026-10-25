import assert from 'node:assert/strict';import express from 'express';import {chromium} from 'playwright';import {build} from 'esbuild';import {resolve} from 'node:path';import {readFile} from 'node:fs/promises';import {currentDefinitions,currentCallback} from './blooket-current-source.mjs';
let fixture=await readFile('scripts/fixtures/blooket-current-panels.jsx','utf8');fixture=fixture.replace('// CYBER_DEFINITIONS',await currentDefinitions('crypto',['Ew','Cw','E1','jl','ia','sa','wd','Dg','iw','hd','vd','gd'])).replace('/* CYBER_CALLBACK */',await currentCallback('crypto','Tw','Ne')).replace('// FISHING_DEFINITIONS',await currentDefinitions('fishing',['Vd']));
const bundle=await build({stdin:{contents:fixture,resolveDir:resolve('scripts/fixtures'),loader:'jsx'},nodePaths:[resolve('.codex-artifacts/blooket-runtime-fixture/node_modules')],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const serverApp=express();serverApp.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));const server=serverApp.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=process.env.NYX_TEST_APP_ORIGIN||`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const ctx=await browser.newContext();ctx.setDefaultTimeout(25000);const errors=[];ctx.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept('123456'));});
 await ctx.route('https://hack.blooket.com/**',r=>r.fulfill({contentType:r.request().url().endsWith('fixture.js')?'text/javascript':'text/html',body:r.request().url().endsWith('fixture.js')?bundle.outputFiles[0].text:'<div id="root"></div><script src="/fixture.js"></script>'}));
 const setup=await ctx.newPage();await setup.goto(base+'/apps/blooket/');await setup.getByRole('status',{name:'27 tools',exact:true}).waitFor();const bookmark=await setup.getByRole('link',{name:'Connect to Nyx bookmarklet'}).getAttribute('href');
 const cases=[['Choice Esp','/preview','Cyber Hack / Crypto Hack'],['Set Password','/password','Cyber Hack / Crypto Hack'],['Remove Hack','/puzzle','Cyber Hack / Crypto Hack'],['Remove Distraction','/fishing','Fishing Frenzy'],['Remove Hack','/puzzle?deny=1','Cyber Hack / Crypto Hack']];
 for(const [name,path,mode] of cases){
  const game=await ctx.newPage();await game.goto('https://hack.blooket.com'+path);await game.waitForFunction(()=>window.fixtureReady);
  if(path.includes('?deny'))await game.evaluate(()=>window.denyCompletion=true);
  if(path==='/password')await game.getByRole('button',{name:'123456',exact:true}).waitFor();
  const opened=ctx.waitForEvent('page'),cdp=await ctx.newCDPSession(game);await cdp.send('Runtime.evaluate',{expression:'location.href='+JSON.stringify(bookmark),userGesture:true});await cdp.detach();const app=await opened;await app.getByRole('status',{name:'Connected to Blooket',exact:true}).waitFor();await app.getByRole('button',{name:`Open ${name} (${mode})`,exact:true}).click();await app.getByRole('button',{name:'Run in game',exact:true}).click();
  if(path.includes('?deny')){await app.getByRole('status',{name:'Blooket did not confirm puzzle completion.'}).waitFor();assert(await game.getByRole('button',{name:'Complete upload'}).isVisible());await app.close();await game.close();console.log('PASS puzzle rejection does not report success');continue;}
  await app.getByRole('status',{name:name+': finished running.'}).waitFor();
  if(path==='/preview')await game.getByRole('status').filter({hasText:'Upcoming prize: Triple Crypto'}).waitFor();
  if(path==='/password')assert.deepEqual(await game.evaluate(()=>sent.filter(e=>e.name==='selectPasswordIndex')),[{name:'selectPasswordIndex',data:{index:1}}]);
  if(path==='/puzzle'){assert.equal(await game.getByRole('button',{name:'Complete upload'}).count(),0);assert.deepEqual(await game.evaluate(()=>sent),[{name:'completeDefensiveHack',data:{}}]);}
  if(path==='/fishing'){assert.equal(await game.locator('._wrapper_10lfc_1').isVisible(),false);assert(await game.locator('#game-kept').isVisible());}
  if(path==='/preview'){await game.evaluate(()=>clearPrize());await game.waitForFunction(()=>!document.querySelector('[data-nyx-prize-preview]'));}
  await app.close();await game.waitForFunction(()=>!window[Symbol.for('nyx.blooket.connector.v1')]);
  if(path==='/preview')assert.equal(await game.locator('[data-nyx-prize-preview]').count(),0);
  if(path==='/fishing')assert(await game.locator('._wrapper_10lfc_1').isVisible());
  await game.close();console.log('PASS supplied React panel: '+name);
 }
 const game=await ctx.newPage();await game.goto('https://hack.blooket.com/guess');await game.waitForFunction(()=>window.fixtureReady);
 const opened=ctx.waitForEvent('page'),cdp=await ctx.newCDPSession(game);await cdp.send('Runtime.evaluate',{expression:'location.href='+JSON.stringify(bookmark),userGesture:true});await cdp.detach();const app=await opened;await app.getByRole('status',{name:'Connected to Blooket',exact:true}).waitFor();await app.getByRole('button',{name:'Open Auto Guess (Cyber Hack / Crypto Hack)',exact:true}).click();
 const run=async text=>{await app.getByRole('button',{name:'Run in game',exact:true}).click();await app.getByRole('status',{name:text}).waitFor();};
 const ready=()=>game.waitForFunction(()=>{const b=document.querySelector('[class*="buttonContainer"] [role="button"]');return b&&getComputedStyle(b).pointerEvents==='auto'&&!b.className.includes('buttonDeactivated');});
 await ready();await run('Incorrect. That choice will be skipped');assert.equal(await game.evaluate(()=>sent.filter(e=>e.name==='submitPasswordGuess').length),1);assert.equal(await game.evaluate(()=>listenerCount()),1);
 await run('Wait for the password choices to be ready.');assert.equal(await game.evaluate(()=>sent.filter(e=>e.name==='submitPasswordGuess').length),1);
 await game.evaluate(()=>nextGuess());await ready();await run('Correct. Remembered');
 await game.evaluate(()=>nextGuess());await ready();await run('Correct. Remembered');
 assert.deepEqual(await game.evaluate(()=>sent.filter(e=>e.name==='submitPasswordGuess').map(e=>e.data.passwordIndex)),[0,1,1]);
 await game.evaluate(()=>{nextGuess();setDuplicate();});await ready();await run('cannot be identified uniquely');assert.equal(await game.evaluate(()=>sent.filter(e=>e.name==='submitPasswordGuess').length),3);
 await game.evaluate(()=>{removeDuplicate();nextGuess();window.interruptGuess=true;});await ready();await run('The guess was interrupted. No result was saved.');assert.equal(await game.evaluate(()=>listenerCount()),1);
 await game.evaluate(()=>{nextGuess();window.interruptGuess=false;});await ready();await run('Correct. Remembered');assert.equal(await game.evaluate(()=>sent.filter(e=>e.name==='submitPasswordGuess').at(-1).data.passwordIndex),1);
 await app.close();await game.close();console.log('PASS actual Cyber guessing panel: one submission, rejected choice elimination, confirmed reuse, duplicate identity refusal, interrupted-result handling and listener cleanup');
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
