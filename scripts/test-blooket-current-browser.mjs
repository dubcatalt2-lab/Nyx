import assert from 'node:assert/strict';import express from 'express';import {chromium} from 'playwright';import {build} from 'esbuild';import {resolve} from 'node:path';import {access,readFile} from 'node:fs/promises';import {currentBrawlDefinitions} from './blooket-current-source.mjs';
const dir=resolve('.codex-artifacts/blooket-runtime-fixture');
try { await Promise.all(['react','react-dom','phaser'].map(name=>access(dir+'/node_modules/'+name+'/package.json'))); }
catch { throw Error('Install isolated test dependencies: npm install --prefix .codex-artifacts/blooket-runtime-fixture --no-save --no-audit --no-fund react@19.2.0 react-dom@19.2.0 phaser@3.90.0'); }
const bundle=await build({stdin:{contents:(await readFile('scripts/fixtures/blooket-current-brawl.jsx','utf8')).replace('// CURRENT_GAME_DEFINITIONS',await currentBrawlDefinitions()),resolveDir:resolve('scripts/fixtures'),loader:'jsx'},nodePaths:[dir+'/node_modules'],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const serverApp=express();serverApp.use(express.static(process.env.NYX_TEST_STATIC_ROOT||'.'));const server=serverApp.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=process.env.NYX_TEST_APP_ORIGIN||`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const ctx=await browser.newContext();ctx.setDefaultTimeout(20000);const errors=[];ctx.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept('77'));});
 await ctx.route('https://brawl.blooket.com/**',r=>r.fulfill({contentType:r.request().url().endsWith('fixture.js')?'text/javascript':'text/html',body:r.request().url().endsWith('fixture.js')?bundle.outputFiles[0].text:'<div id="root"></div><script src="/fixture.js"></script>'}));
 const setup=await ctx.newPage();await setup.goto(base+'/apps/blooket/');await setup.getByRole('status',{name:'27 tools',exact:true}).waitFor();const bookmark=await setup.getByRole('link',{name:'Connect to Nyx bookmarklet'}).getAttribute('href');
 const cases=[['Double Enemy Xp',()=>fixtureEnemy.val===fixtureBase.xp*2],['Half Enemy Speed',()=>fixtureEnemy.speed===fixtureBase.speed/2],['Instant Kill',()=>fixtureEnemy.hp===1],['Invincibility',()=>fixturePlayer.isInvulnerable()],['Kill Enemies',()=>(fixtureEnemy.dying||fixtureEnemy.active===false)&&fixtureScene.gameManager.getCurXp()===fixtureBase.xp],['Magnet',()=>fixturePlayer.getPlayerMagnetActive()],['Max Current Abilities',()=>fixtureScene.abilityService.abilityLevels.laser===1&&fixtureScene.abilityService.abilityStats.laser.dmg===35],['Next Level',()=>fixtureScene.gameManager.getCurXp()===10&&fixtureEvents.includes('prompt-question')],['Remove Obstacles',()=>fixtureScene.mapService.obstacles.getLength()===0],['Reset Health',()=>fixturePlayer.hp===100]];
 for(const [name,check,category='Monster Brawl'] of cases){
  const game=await ctx.newPage();await game.goto('https://brawl.blooket.com/fixture');await game.waitForFunction(()=>window.fixtureReady);
  if(process.env.NYX_TEST_MULTI_SCENE==='1'){await game.evaluate(()=>fixtureGame.scene.add('fixture-overlay',{create(){window.fixtureOverlay=this}},true));await game.waitForFunction(()=>fixtureOverlay?.physics?.world&&fixtureGame.scene.getScenes(false).length===2);}
  if(process.env.NYX_TEST_PAUSED_SCENE==='1')await game.evaluate(()=>fixtureScene.sys.pause());
  const opened=ctx.waitForEvent('page');const cdp=await ctx.newCDPSession(game);await cdp.send('Runtime.evaluate',{expression:'location.href='+JSON.stringify(bookmark),userGesture:true});await cdp.detach();const app=await opened;await app.getByRole('status',{name:'Connected to Blooket',exact:true}).waitFor();await app.getByRole('button',{name:'Open '+name+' ('+category+')',exact:true}).click();await app.getByRole('button',{name:'Run in game',exact:true}).click();
  await app.getByRole('status',{name:name+': finished running.'}).waitFor();await game.waitForFunction(check);if(process.env.NYX_TEST_PAUSED_SCENE==='1'){assert(await game.evaluate(()=>fixtureScene.sys.isPaused()),'Tool must not resume the scene');}await app.close();await game.waitForFunction(()=>!window[Symbol.for('nyx.blooket.connector.v1')]);if(['Double Enemy Xp','Half Enemy Speed','Instant Kill'].includes(name))assert(await game.evaluate(()=>!fixtureScene[Symbol.for('nyx.blooket.brawl.spawn')]),'Closing the workspace must remove the spawn modifier');await game.close();console.log('PASS supplied game classes + React 19 + Phaser: '+name);
 }

 const game=await ctx.newPage();await game.goto('https://brawl.blooket.com/fixture');await game.waitForFunction(()=>window.fixtureReady);
 const opened=ctx.waitForEvent('page'),cdp=await ctx.newCDPSession(game);await cdp.send('Runtime.evaluate',{expression:'location.href='+JSON.stringify(bookmark),userGesture:true});await cdp.detach();const app=await opened;await app.getByRole('status',{name:'Connected to Blooket',exact:true}).waitFor();
 const run=async name=>{await app.getByRole('button',{name:'Open '+name+' (Monster Brawl)',exact:true}).click();await app.getByRole('button',{name:'Run in game',exact:true}).click();await app.getByRole('status',{name:name+': finished running.'}).waitFor();await app.locator('dialog').evaluate(el=>el.close());};
 for(const name of ['Double Enemy Xp','Half Enemy Speed','Instant Kill','Invincibility','Magnet','Max Current Abilities','Remove Obstacles','Reset Health','Kill Enemies','Next Level'])await run(name);
 await game.waitForFunction(()=>fixtureScene.sys.isPaused());await run('Reset Health');
 assert(await game.evaluate(()=>fixtureScene.sys.isPaused()&&fixturePlayer.invulnerableTime===Infinity&&fixtureChoices().length>0));
 await game.evaluate(()=>fixtureScene.eventBus.emit('level-up','laser'));await game.waitForFunction(()=>fixtureScene.sys.isActive());
 await run('Max Current Abilities');await run('Next Level');assert(await game.evaluate(()=>fixtureChoices().length>0));
 await game.evaluate(()=>fixtureScene.eventBus.emit('level-up','card'));await game.waitForFunction(()=>fixtureScene.sys.isActive());
 await app.close();await game.waitForFunction(()=>!window[Symbol.for('nyx.blooket.connector.v1')]);
 assert(await game.evaluate(()=>fixturePlayer.invulnerableTime===0&&fixturePlayer.magnetTime===0&&!fixtureScene[Symbol.for('nyx.blooket.brawl.spawn')]));await game.close();
 console.log('PASS all ten tools together through actual bookmarklet: choice availability, healing during pause, repeated boost, native level-up resume and disconnect cleanup');
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
