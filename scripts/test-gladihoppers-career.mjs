// Pinned Unity build regression; localhost:8080 supplies game assets. Native indices are build-specific.
import express from 'express';import {chromium} from 'playwright';import {readFile} from 'node:fs/promises';
const app=express();app.get('/assets/studies/gladihoppers-practice.js',async(req,res)=>res.type('js').send((await readFile('assets/studies/gladihoppers-practice.js','utf8')).replace('const timer=setInterval(tick,100);','window.__p={get classes(){return classes},get actors(){return actors},settings,tick,careerContext};const timer=setInterval(tick,100);')));app.use(express.static('.'));app.use(async(req,res)=>{const r=await fetch('http://localhost:8080'+req.originalUrl);res.status(r.status).set('Access-Control-Allow-Origin','*').set('Content-Type',r.headers.get('content-type')||'application/octet-stream').send(Buffer.from(await r.arrayBuffer()))});const server=app.listen(0);await new Promise(r=>server.once('listening',r));const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage();await p.goto('http://localhost:'+server.address().port+'/assets/studies/gladihoppers.html');await p.waitForFunction(()=>window.__p?.actors?.length,{timeout:45000});
try{
  await p.waitForTimeout(7000);
  const advance=async(count)=>{for(let i=0;i<count;i++){await p.mouse.click(640,640);await p.waitForTimeout(400)}};
  await advance(6);await p.keyboard.down('a');await p.waitForTimeout(5000);await p.keyboard.up('a');await advance(6);
  await p.keyboard.press('Space');await advance(8);
  await p.keyboard.down('a');await p.waitForTimeout(700);await p.keyboard.up('a');
  for(let i=0;i<6;i++){await p.keyboard.down('ArrowLeft');await p.waitForTimeout(120);await p.keyboard.up('ArrowLeft');await p.waitForTimeout(750)}
  await advance(8);await p.waitForTimeout(1000);await p.mouse.click(425,225);await p.waitForTimeout(1000);if(!await p.evaluate(()=>!!__p.careerContext())){await p.mouse.click(640,640);await p.waitForTimeout(700);await p.mouse.click(425,225);await p.waitForTimeout(1000)}await advance(12);await p.mouse.click(934,640);await p.waitForTimeout(600);await advance(9);await p.mouse.click(608,511);
  await p.locator('summary').filter({hasText:'Practice tools'}).click();
  await p.getByLabel('Unlimited gold',{exact:true}).check();
  await p.getByLabel('Unlimited skill points',{exact:true}).check();
  await p.getByRole('button',{name:'Upgrade Charisma',exact:true}).click();
  const values=()=>p.evaluate(()=>{const {m,g,master,skills}=__p.careerContext();return {gold:m.HEAP32[(master+g.offsets.gold)/4],points:m.HEAP32[(master+g.offsets.cSkillPoints)/4],skills:Array.from(m.HEAP32.slice((skills+16)/4,(skills+28)/4))}});
  let state=await values();if(state.skills[0]!==1||state.gold!==1000000||state.points!==9999)throw Error(JSON.stringify(state));
  await p.getByRole('button',{name:'Max career skills',exact:true}).click();state=await values();if(state.skills.some(v=>v!==10))throw Error(JSON.stringify(state));
  console.log('Career controls:',state);
  console.log(await p.evaluate(async()=>{
    const {m,g,master,skills}=__p.careerContext(),gold=(master+g.offsets.gold)/4,points=(master+g.offsets.cSkillPoints)/4,mode=(master+g.offsets.gameMode)/4;
    m.HEAP32[gold]-=100;m.HEAP32[points]--;await new Promise(r=>setTimeout(r,150));if(m.HEAP32[gold]!==1000000||m.HEAP32[points]!==9999)throw Error('Resources not replenished');
    __p.settings.gold=false;__p.settings.points=false;m.HEAP32[gold]=7;m.HEAP32[points]=0;m.HEAP32[(skills+16)/4]=0;
    for(const name of ['LoadGold','LoadCurrentCareer']){const f=g.methods[name];m.dynCall_vii(f.fn,master,f.info)}
    if(m.HEAP32[gold]!==1000000||m.HEAP32[points]!==9999||m.HEAP32[(skills+16)/4]!==10)throw Error('Native save did not restore');
    m.HEAP32[gold]=13;m.HEAP32[points]=2;__p.tick();if(m.HEAP32[gold]!==13||m.HEAP32[points]!==2)throw Error('Off toggle refilled');
    __p.settings.gold=true;__p.settings.points=true;const old=m.HEAP32[mode];m.HEAP32[mode]=3;__p.tick();if(m.HEAP32[gold]!==13||m.HEAP32[points]!==2)throw Error('Non-career modified');m.HEAP32[mode]=old;
    return {refill:true,saveRestore:true,disabled:true,nonCareerGuard:true};
  }));
}catch(error){await p.screenshot({path:'.codex-artifacts/gladi-career-failure.png'});throw error;}finally{await b.close();server.closeAllConnections();server.close();}
