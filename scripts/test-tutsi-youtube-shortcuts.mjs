import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/nyxtube/**',route=>{const path=new URL(route.request().url()).pathname;const video={id:'testvideo01',title:'Shortcut fixture',description:'0:00 Start\n0:30 Chapter two\n1:00 Chapter three',durationSeconds:120,channelTitle:'Fixture',thumbnail:'/apps/tutsi/icon.png'};return route.fulfill({json:path.endsWith('/status')?{configured:true,nativeAvailable:false}:path.endsWith('/community')?{comments:{available:false},transcript:{available:false}}:{videos:[video,{...video,id:'testvideo02',title:'Next fixture'}]}})});
 await page.addInitScript(()=>{window.YT={PlayerState:{PLAYING:1,PAUSED:2},Player:class{
 constructor(id,o){this.o=o;this.state=2;this.rate=1;this.time=10;this.volume=50;this.muted=false;this.node=document.getElementById(id);this.node.innerHTML='<iframe title="Fixture video" src="about:blank" style="width:100%;height:100%"></iframe>';window.fixturePlayer=this;(window.fixturePlayers ||= []).push(this);setTimeout(()=>o.events.onReady({target:this}),0)}
 getPlayerState(){return this.state}getPlaybackRate(){return this.rate}setPlaybackRate(v){this.rate=v}getAvailablePlaybackRates(){return [.25,.5,.75,1,1.25,1.5,1.75,2]}getCurrentTime(){return this.time}getDuration(){return 120}seekTo(v){this.time=v}setVolume(v){this.volume=v}getVolume(){return this.volume}isMuted(){return this.muted}mute(){this.muted=true}unMute(){this.muted=false}playVideo(){this.state=1;this.o.events.onStateChange?.({data:1,target:this})}pauseVideo(){this.state=2;this.o.events.onStateChange?.({data:2,target:this})}getIframe(){return this.node.querySelector('iframe')}loadModule(){}unloadModule(){}destroy(){this.node.replaceChildren()}
 }};});
 await page.goto('http://localhost:9091/tutsi#youtube');const frame=page.frameLocator('#app-host iframe:not([hidden])');await frame.locator('.video-cover').first().click();await frame.locator('[data-watch-gesture]').waitFor();
 const value=key=>frame.locator('body').evaluate((_,key)=>window.fixturePlayer[key],key);
 // The mouse is over an actual iframe: the surrounding gesture surface must receive the hold.
 await frame.locator('body').evaluate(()=>window.fixturePlayer.pauseVideo());
 await frame.locator('[data-watch-gesture]').click();assert.equal(await value('state'),1);
 const box=await frame.locator('[data-watch-gesture]').boundingBox();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await page.mouse.down();await page.waitForTimeout(420);assert.equal(await value('rate'),2);await page.mouse.up();assert.equal(await value('rate'),1);assert.equal(await value('state'),1);
 // Outer-page focus should still forward keys to the registered YouTube frame.
 await page.evaluate(()=>{document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus()});
 await page.keyboard.down('Space');await page.waitForTimeout(420);assert.equal(await value('rate'),2);await page.keyboard.up('Space');assert.equal(await value('rate'),1);
 await page.keyboard.press('ArrowRight');assert.equal(await value('time'),15);await page.keyboard.press('j');assert.equal(await value('time'),5);
 await page.keyboard.press('5');assert.equal(await value('time'),60);await page.keyboard.press('Home');assert.equal(await value('time'),0);
 await page.keyboard.press('Control+ArrowRight');assert.equal(await value('time'),30);
 await page.keyboard.press('ArrowUp');assert.equal(await value('volume'),55);await page.keyboard.press('Shift+>');assert.equal(await value('rate'),1.25);
 await page.keyboard.press('k');assert.equal(await value('state'),2);await page.keyboard.press('.');assert(Math.abs(await value('time')-30-1/30)<.001);
 await page.keyboard.press('i');assert(await frame.locator('.mini-player').count());await page.keyboard.press('Escape');assert.equal(await frame.locator('.mini-player').count(),0);
 await page.keyboard.press('?');assert(await frame.locator('[data-shortcut-help]').isVisible());await frame.locator('[data-shortcut-help-close]').click();
 await page.keyboard.press('/');await frame.locator('[data-search-input]').fill('k');assert.equal(await value('state'),2);
 await frame.locator('[data-view-button="shorts"]').click();
 await frame.locator('[data-short-player] [aria-hidden="false"]').waitFor();
 const shortValue=key=>frame.locator('body').evaluate((_,key)=>window.fixturePlayers.find(p=>p.node.parentElement?.getAttribute('aria-hidden')==='false')[key],key);
 await page.evaluate(()=>{document.body.tabIndex=-1;document.body.focus()});
 await page.keyboard.down('Space');await page.waitForTimeout(420);assert.equal(await shortValue('rate'),2);await page.keyboard.up('Space');assert.equal(await shortValue('rate'),1);
 const shortBox=await frame.locator('[data-short-stage]').boundingBox();await page.mouse.move(shortBox.x+shortBox.width*.2,shortBox.y+shortBox.height*.3);await page.mouse.down();await page.waitForTimeout(420);assert.equal(await shortValue('rate'),2);await page.mouse.up();assert.equal(await shortValue('rate'),1);
 assert.deepEqual(errors,[]);console.log('Tutsi embedded YouTube: iframe pointer hold, outer focus Space hold, seek/chapter/speed/volume/frame-step/mini/help and typing isolation passed');
}finally{await browser.close()}
