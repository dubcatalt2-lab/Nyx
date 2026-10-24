// Native-engine benchmark. Never changes player position, collisions or completion flags.
import {chromium} from 'playwright';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const arg=(name,fallback)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=').slice(1).join('=')||fallback;
const ids=arg('levels',Array.from({length:21},(_,i)=>i+1).join(',')).split(',').map(Number);
if(ids.some(n=>!Number.isInteger(n)||n<1||n>21))throw Error('Choose playable base levels 1–21; level 22 is marked coming soon by this runtime.');
const parallel=Math.max(1,Math.min(4,Number(arg('parallel','2'))));
const seconds=Number(arg('seconds','180')), attempts=Number(arg('attempts','3'));
if(!Number.isInteger(parallel)||!Number.isInteger(attempts)||attempts<1||!Number.isFinite(seconds)||seconds<1)throw Error('Invalid benchmark limits');
const base=arg('url','http://localhost:8080').replace(/\/$/,'');
const report=arg('report','.codex-artifacts/gd-base-levels.json');
const sourceHash=()=>readFile('assets/studies/study-practice.js').then(data=>createHash('sha256').update(data).digest('hex'));
const sourceAtStart=await sourceHash();
const browser=await chromium.launch({channel:'msedge',headless:true,args:[
  '--disable-web-security','--disable-features=LocalNetworkAccessChecks',
  '--disable-background-timer-throttling','--disable-renderer-backgrounding'
]});
const results=[],queue=[...ids];
await mkdir('.codex-artifacts',{recursive:true});

async function run(id){
  const context=await browser.newContext({viewport:{width:1280,height:720}});
  try{
    const page=await context.newPage();
    await page.goto(`${base}/assets/gn-math/play.html?game=785-upd3.html`);
    let frame;
    const loadUntil=Date.now()+90000;
    while(Date.now()<loadUntil){
      for(const candidate of page.frames().slice(1)){
        if(await candidate.evaluate(()=>typeof GameScene!=='undefined').catch(()=>false)){frame=candidate;break;}
      }
      if(frame)break;
      await page.waitForTimeout(250);
    }
    if(!frame)throw Error('Native engine did not load');
    await frame.waitForFunction(()=>[...document.querySelectorAll('aside')].some(e=>e.shadowRoot?.querySelector('input:not(:disabled)')));
    await frame.evaluate(()=>{
      const activate=PlayerObject.prototype._setObjectActivated;
      PlayerObject.prototype._setObjectActivated=function(object,active=true){
        const fresh=active&&!this._isObjectActivated(object);
        const out=activate.call(this,object,active);
        if(fresh&&object.type==='jump_ring'&&window.__benchmark){
          window.__benchmark.orbs.push({type:object.orbId,x:object.x,frame:this._scene?._physicsFrame});
        }
        return out;
      };
      const original=Phaser.Scenes.SceneManager.prototype.update;
      Phaser.Scenes.SceneManager.prototype.update=function(...args){
        const out=original.apply(this,args);
        const scene=this.scenes.find(s=>s._state);window.__benchmarkScene=scene;
        const r=window.__benchmark,s=scene?._state;
        if(r&&s&&!scene._menuActive&&!scene._slideIn){
          r.collisionBypass ||= Boolean(window.noClip||scene._practicedMode?.practiceMode);
          if(s.isDead&&!r.dead){r.deaths++;r.failures.push({x:scene._playerWorldX,y:s.y,mode:s.isFlying?'ship':s.isWave?'wave':s.isUfo?'ufo':s.isBall?'ball':s.isRobot?'robot':s.isSpider?'spider':'cube'});}
          r.dead=Boolean(s.isDead);r.maxX=Math.max(r.maxX,scene._playerWorldX||0);
          r.won=Boolean(scene._levelWon);r.coins=[...(scene._level._secretCoinRunCollected||[])];
        }
        return out;
      };
      window.updateLogShown=true;
    });
    await frame.waitForFunction(()=>window.__benchmarkScene);
    await frame.locator('summary').click();
    await frame.getByRole('checkbox',{name:'Autoplay (assisted)',exact:true}).check();
    await frame.getByRole('checkbox',{name:'Noclip',exact:true}).uncheck();
    await frame.getByRole('combobox',{name:'Speed',exact:true}).selectOption('1');
    await frame.evaluate(async id=>{
      const level=window.allLevels.find(l=>l[2]===`level_${id}`);
      if(!level)throw Error('Level unavailable');
      const response=await fetch(new URL(`assets/levels/${id}.txt`,document.baseURI));
      if(!response.ok)throw Error(`Level download: ${response.status}`);
      const scene=window.__benchmarkScene;
      scene.cache.text.add(level[2],await response.text());
      window.currentlevel=[...level];delete window.levelID;window.settingsMap=null;
      window.__benchmark={id,name:level[1],deaths:0,dead:false,maxX:0,won:false,collisionBypass:false,coins:[],orbs:[],failures:[]};
      scene.game.registry.set('autoStartGame',true);scene.scene.restart();
    },id);
    const start=Date.now();let result;
    do{
      await page.waitForTimeout(1000);
      result=await frame.evaluate(()=>window.__benchmark);
      if(result.won||result.deaths>=attempts||result.collisionBypass)break;
    }while(Date.now()-start<seconds*1000);
    result.elapsedSeconds=Math.round((Date.now()-start)/1000);
    result.outcome=result.collisionBypass?'invalid-collisions':result.won?'completed':result.deaths>=attempts?'failed':'timeout';
    return result;
  }catch(error){return {id,outcome:'error',error:error.message};}
  finally{await context.close();}
}

try{
  await Promise.all(Array.from({length:parallel},async()=>{
    while(queue.length){
      const id=queue.shift();console.log(`Starting base level ${id}`);
      const result=await run(id);results.push(result);console.log(JSON.stringify(result));
    }
  }));
}finally{
  await browser.close();
  results.sort((a,b)=>a.id-b.id);
  const sourceAtEnd=await sourceHash();
  await writeFile(report,JSON.stringify({url:base,generatedAt:new Date().toISOString(),parallel,attempts,seconds,sourceAtStart,sourceAtEnd,sourceChangedDuringRun:sourceAtStart!==sourceAtEnd,results},null,2));
  if(sourceAtStart!==sourceAtEnd){console.error('Source changed during the benchmark; rerun with a frozen build before making release claims.');process.exitCode=1;}
}
if(results.length!==ids.length||results.some(r=>r.outcome!=='completed'))process.exitCode=1;
