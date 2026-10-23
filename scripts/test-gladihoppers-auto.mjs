// Pinned Unity build regression; localhost:8080 supplies game assets. Native indices are build-specific.
import express from 'express';import {chromium} from 'playwright';import {readFile} from 'node:fs/promises';
const app=express();app.get('/assets/studies/gladihoppers-practice.js',async(req,res)=>res.type('js').send((await readFile('assets/studies/gladihoppers-practice.js','utf8')).replace('const timer=setInterval(tick,100);','window.__p={get classes(){return classes},get actors(){return actors},settings,tick};const timer=setInterval(tick,100);')));app.use(express.static('.'));app.use(async(req,res)=>{const r=await fetch('http://localhost:8080'+req.originalUrl);res.status(r.status).set('Access-Control-Allow-Origin','*').set('Content-Type',r.headers.get('content-type')||'application/octet-stream').send(Buffer.from(await r.arrayBuffer()))});const server=app.listen(0);await new Promise(r=>server.once('listening',r));const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage();await p.goto('http://localhost:'+server.address().port+'/assets/studies/gladihoppers.html');await p.waitForFunction(()=>window.__p?.actors?.length,{timeout:45000});
try{
  await p.waitForTimeout(7000);
  const advance=async(count)=>{for(let i=0;i<count;i++){await p.mouse.click(640,640);await p.waitForTimeout(400)}};
  await advance(6);await p.keyboard.down('a');await p.waitForTimeout(5000);await p.keyboard.up('a');await advance(6);
  await p.keyboard.press('Space');await advance(8);
  await p.keyboard.down('a');await p.waitForTimeout(700);await p.keyboard.up('a');
  for(let i=0;i<6;i++){await p.keyboard.down('ArrowLeft');await p.waitForTimeout(120);await p.keyboard.up('ArrowLeft');await p.waitForTimeout(750)}
  await advance(8);await p.mouse.click(915,395);await p.waitForTimeout(700);await p.mouse.click(934,640);await p.waitForTimeout(4000);
  await p.locator('summary').filter({hasText:'Practice tools'}).click();
  await p.getByLabel('Infinite health',{exact:true}).check();
  await p.getByLabel('Timed sword attacks',{exact:true}).check();
  // Keep focus on the checkbox: no forced actInput, weaponRange, or combat flags.
  const result=await p.evaluate(async()=>{
    const m=unityGame.Module,c=__p.classes,a=__p.actors.find(x=>m.HEAPU32[(x.master+8)/4]);
    if(!a)throw Error('No current fighter');
    const enemy=m.HEAPU32[(a.master+c.CharacterMaster.offsets.enemy)/4],stats=m.HEAPU32[(enemy+c.CharacterMaster.offsets.cStats)/4];
    const hp=()=>m.HEAP32[(stats+c.CharacterStats.offsets.health)/4];const before=hp();
    let swings=0;const call=m.dynCall_vii;m.dynCall_vii=function(...args){if(args[0]===4671&&args[1]===a.master)swings++;return call.apply(this,args)};
    for(let i=0;i<200&&hp()>=before;i++)await new Promise(r=>setTimeout(r,100));
    m.dynCall_vii=call;if(!swings||hp()>=before)throw Error(JSON.stringify({swings,before,after:hp(),status:Array.from(document.querySelectorAll('aside')).map(x=>x.shadowRoot?.querySelector('p')?.textContent)}));
    return {swings,enemyHealthBefore:before,enemyHealthAfter:hp(),menuFocus:document.activeElement.tagName};
  });console.log('Actual quick fight:',result);
  await p.getByLabel('Timed sword attacks',{exact:true}).uncheck();
  await p.getByLabel('Movement speed',{exact:true}).selectOption('25');
  await p.getByLabel('Weapon reach',{exact:true}).selectOption('3');
  console.log(await p.evaluate(async()=>{
    const m=unityGame.Module,c=__p.classes,a=__p.actors.find(x=>m.HEAPU32[(x.master+8)/4]),o=c.CharacterMotor.offsets;
    await new Promise(r=>setTimeout(r,150));const boosted=m.HEAPF32[(a.motor+o.maxVel)/4];
    __p.settings.speed=1;__p.tick();const base=m.HEAPF32[(a.motor+o.maxVel)/4];if(Math.abs(boosted/base-25)>.01)throw Error('25x speed');
    const tip=m.HEAPU32[(a.motor+o.weaponTip)/4],tr=m.dynCall_iii(8051,tip,21728848),stack=m.stackSave(),vec=m.stackAlloc(12);
    m.dynCall_viii(5254,tr,vec,21729992);const reachScale=m.HEAPF32[vec/4+1],reach=m.HEAPF32[(a.motor+o.weaponRange)/4];
    __p.settings.reach=1;__p.tick();m.dynCall_viii(5254,tr,vec,21729992);const baseScale=m.HEAPF32[vec/4+1],baseReach=m.HEAPF32[(a.motor+o.weaponRange)/4];m.stackRestore(stack);
    if(Math.abs(reachScale/baseScale-3)>.01||Math.abs(reach/baseReach-3)>.01)throw Error('Physical weapon reach did not scale/restore');
    // Controlled recovery/regen checks supplement the unmodified fight above.
    __p.settings.health=false;__p.tick();const h=(a.stats+c.CharacterStats.offsets.health)/4,cap=m.HEAP32[(a.stats+c.CharacterStats.offsets.maxHealth)/4];
    m.HEAP32[h]=Math.floor(cap/2);__p.settings.regen=100;const start=m.HEAP32[h];await new Promise(r=>setTimeout(r,250));const healed=m.HEAP32[h];if(healed<=start||healed>cap)throw Error('Regeneration bounds');__p.settings.regen=0;
    m.HEAPU8[a.motor+o.attacking]=0;m.HEAPU8[a.motor+o.prepping]=0;m.HEAPU8[a.motor+o.throwing]=0;m.HEAPU8[a.motor+o.coolingDown]=1;m.HEAPF32[(a.motor+o.coolDownTimer)/4]=1;
    __p.settings.cooldown=true;__p.tick();if(m.HEAPU8[a.motor+o.coolingDown]||m.HEAPF32[(a.motor+o.coolDownTimer)/4])throw Error('Cooldown not removed');
    __p.settings.cooldown=false;m.HEAPU8[a.motor+o.coolingDown]=1;m.HEAPF32[(a.motor+o.coolDownTimer)/4]=1;__p.tick();if(!m.HEAPU8[a.motor+o.coolingDown])throw Error('Cooldown still bypassed when disabled');
    return {speed:boosted/base,reach:reach/baseReach,regen:{start,healed,cap},cooldownToggle:true};
  }));
}catch(error){await p.screenshot({path:'.codex-artifacts/gladi-auto-failure.png'});throw error;}finally{await b.close();server.closeAllConnections();server.close();}
