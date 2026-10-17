import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
process.env.NYX_STATIC_ROOT=fileURLToPath(new URL(process.env.NYX_TEST_SOURCE==='1'?'../':'../dist/',import.meta.url));
const {app}=await import('../server.js');
const server=createServer(app);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome'});
try{
  for(const preset of ['photo-rain-soft','rose','lineWaves']){
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(preset=>{
      if(window!==top)return;
      for(const [key,value] of Object.entries({setupComplete:'true',tosAcceptedVersion:'2026-07-30',beamWallpaper:preset,beamTheme:'custom-wallpaper'}))localStorage.setItem('nyx.'+key,value);
    },preset);
    if(process.env.NYX_TEST_NO_WEBGL==='1')await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/i.test(kind)?null:original.call(this,kind,...args)}});
    await page.goto(base+'/nyx');
    await page.waitForFunction(preset=>document.documentElement.dataset.n7xBeamWallpaper===preset,preset);
    await page.waitForTimeout(3000);
    if(preset.startsWith('photo-')){
      const background=await page.evaluate(()=>getComputedStyle(document.body,'::before').backgroundImage);
      assert.match(background,/rain\.jpg/);
      const response=await page.request.get(base+'/assets/backgrounds/rain.jpg');
      assert.equal(response.status(),200);
      assert((await response.body()).length>10000);
    }else{
      const id=preset==='rose'?'n22e9fbee8c96':'n21c484be6235';
      const canvas=page.locator('#'+id);
      if(process.env.NYX_TEST_NO_WEBGL==='1'){assert.match(await page.evaluate(()=>getComputedStyle(document.body,'::before').backgroundImage),/gradient/);assert.equal(await canvas.getAttribute('data-renderer'),'fallback');assert.deepEqual(errors,[]);console.log('PASS static wallpaper without WebGL',preset);await page.close();continue;}
      await canvas.waitFor({state:'visible'});
      assert.deepEqual(await canvas.evaluate(c=>[c.clientWidth,c.clientHeight]),[1440,900]);
      assert.match(await canvas.getAttribute('data-renderer'),/^react-bits/);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS built wallpaper',preset);
    await page.close();
  }
}finally{
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
