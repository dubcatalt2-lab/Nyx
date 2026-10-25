import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parse} from 'acorn';
import {adaptBrawlAction} from './blooket-brawl-actions.mjs';
// The supplied public game bundle stays outside the release in ignored artifacts.
const source=await readFile(process.env.NYX_BRAWL_SOURCE||'.codex-artifacts/blooket-current/brawl.js','utf8');
const tree=parse(source,{ecmaVersion:'latest',sourceType:'module'}), definitions=new Map();
for(const node of tree.body){
 if((node.type==='ClassDeclaration'||node.type==='FunctionDeclaration')&&node.id)definitions.set(node.id.name,source.slice(node.start,node.end));
 if(node.type==='VariableDeclaration')for(const d of node.declarations)if(d.id.type==='Identifier')definitions.set(d.id.name,'var '+source.slice(d.start,d.end)+';');
}
const names=['Tf','tw','Kb','Ib','Qb','Ki','Dn','Mb','Nb','Fb','Pe','sh','Ef','Wb','Yb','Ab','Cb','_b','Pb'];
for(const name of names)assert(definitions.has(name),'Missing current source definition '+name);
class Image {constructor(scene){this.scene=scene;this.body={setSize(){},setOffset(){}};this.width=10;this.active=true;}setDepth(){}enableBody(){}setTexture(){}setActive(v){this.active=v;}setVisible(){}setPosition(){}setScale(){}disableBody(){this.body.enable=false;}}
function setup(){
 const events=[],cleanup=[],callbacks={};
 const ctx=vm.createContext({Phaser:{Physics:{Arcade:{Image}}},Yt:'test',he:{ENEMY:1},ie:()=>0,Mn:()=>1,wb:2591,Math,Infinity,setTimeout,clearTimeout});
 vm.runInContext(names.map(n=>definitions.get(n)).join('\n')+'\nvar K=sh;this.types={Tf,tw,Kb,Ib,Qb};this.enemyData=Fb;this.choices=Cb;',ctx);
 const {Tf,tw,Kb,Ib,Qb}=ctx.types;
 const map=Object.keys(ctx.enemyData)[0],difficulty=Object.keys(ctx.enemyData[map])[0],enemyType=Object.keys(ctx.enemyData[map][difficulty])[0];
 const player=Object.assign(Object.create(tw.prototype),{hp:40,invulnerableTime:0,magnetTime:0,getPlayerCenter:()=>({x:0,y:0})});
 const scene={gameData:{map,difficulty},cameras:{main:{worldView:{width:500,height:400}}},sfxService:{won(){},playHit(){},reduce(){}},textService:{spawnText(){}},tweens:{add(config){config.onComplete();}},eventBus:{emit(name,...args){events.push([name,...args]);callbacks[name]?.(...args);},on(name,cb){callbacks[name]=cb;}},inputService:{enableInputs(){},disableInputs(){}},scene:{pause(){},resume(){}},mapService:{obstacles:{clear(...args){scene.cleared=args;}}}};
 player.sc=scene;scene.playerService={getPlayer:()=>player};scene.gameManager=new Kb(scene);scene.gameManager.level=5;
 scene.abilityService=new Ib(scene);scene.projectileService={};scene.abilityService.unlockAbility('laser');scene.abilityService.unlockAbility('card');
 scene.enemyService={enemies:{classType:Tf,getChildren:()=>enemies},spawnNewWave(){}};
 new Qb(scene).initEventListeners();
 const enemy=new Tf(scene);enemy.spawn(enemyType);const enemies=[enemy];
 const execute=name=>vm.runInNewContext(adaptBrawlAction('brawl/'+name+'.js').code,{resolveBlooketScene:()=>scene,onBlooketCleanup:fn=>cleanup.push(fn),Infinity});
 return {ctx,scene,enemy,enemies,enemyType,player,events,execute,stop:()=>cleanup.reverse().forEach(fn=>fn())};
}
for(const [name,field,factor] of [['doubleEnemyXp','val',2],['halfEnemySpeed','speed',.5],['instantKill','hp',0]]){
 const f=setup(),before=f.enemy[field],original=f.ctx.types.Tf.prototype.spawn;
 f.execute(name);assert.equal(f.enemy[field],factor?before*factor:Math.min(before,1));
 const fresh=new f.ctx.types.Tf(f.scene);fresh.spawn(f.enemyType);assert.equal(fresh[field],factor?before*factor:Math.min(before,1));
 fresh.spawn(f.enemyType);assert.equal(fresh[field],factor?before*factor:Math.min(before,1),'pooled spawn must not compound');
 f.stop();assert.equal(f.ctx.types.Tf.prototype.spawn,original);assert.equal(f.enemy[field],before);assert.equal(fresh[field],before);
 console.log('PASS supplied enemy implementation: '+name+' current, future, pooled enemies and cleanup');
}
for(const [name,field] of [['invincibility','invulnerableTime'],['magnet','magnetTime']]){const f=setup();f.execute(name);f.player.update(0,16000);assert.equal(f.player[field],Infinity);f.stop();assert.equal(f.player[field],0);console.log('PASS supplied player implementation: '+name);}
{
 const f=setup();const xp=f.enemy.val;f.execute('killEnemies');assert.equal(f.enemy.active,false);assert.equal(f.scene.gameManager.getCurXp(),xp);f.execute('killEnemies');assert.equal(f.scene.gameManager.getCurXp(),xp);console.log('PASS supplied death and XP methods: killEnemies');
}
{
 const f=setup(),before=f.scene.abilityService.abilityStats.laser.dmg;f.execute('maxCurrentAbilities');assert.equal(f.scene.abilityService.abilityLevels.laser,1);assert.equal(f.scene.abilityService.abilityStats.laser.dmg,35);f.scene.abilityService.upgradeAbility('laser');assert.equal(f.scene.abilityService.abilityLevels.laser,2);assert.equal(f.scene.abilityService.abilityStats.laser.dmg,35);f.stop();assert.equal(f.scene.abilityService.abilityStats.laser.dmg,before+2);console.log('PASS combat boost preserves native upgrades and restores earned stats on cleanup');
}
{
 const f=setup();f.execute('nextLevel');assert.equal(f.scene.gameManager.getCurXp(),10);assert(f.events.some(e=>e[0]==='prompt-question'));assert.equal(f.scene.gameManager.level,5);console.log('PASS supplied XP threshold and question flow: nextLevel');
}
{const f=setup();f.execute('removeObstacles');assert.deepEqual(Array.from(f.scene.cleared),[true,true]);console.log('PASS obstacle group destroy contract');}
{const f=setup();f.execute('resetHealth');assert.equal(f.player.hp,100);assert.equal(f.player.invulnerableTime,0);assert.equal(f.scene.gameManager.getGameStatus(),'IN_PROGRESS');console.log('PASS supplied respawn handler: resetHealth');}
console.log('All 10 Brawl actions checked against extracted current game methods. This is isolated execution, not a live Blooket session.');


{const f=setup(),original=f.ctx.types.Tf.prototype.spawn;f.execute('doubleEnemyXp');f.execute('halfEnemySpeed');f.execute('instantKill');f.stop();assert.equal(f.ctx.types.Tf.prototype.spawn,original);assert.equal(f.scene[Symbol.for('nyx.blooket.brawl.spawn')],undefined);console.log('PASS combined spawn modifier cleanup');}

{
 const f=setup();
 for(let i=0;i<20;i++){const enemy=new f.ctx.types.Tf(f.scene);enemy.spawn(f.enemyType);f.enemies.push(enemy);}
 f.execute('killEnemies');
 assert.equal(f.events.filter(e=>e[0]==='prompt-question').length,1,'Mass kills open a single question');
 assert.throws(()=>f.execute('killEnemies'),/Finish the current question/);
 assert.throws(()=>f.execute('nextLevel'),/Finish the current question/);
 assert.equal(f.events.filter(e=>e[0]==='prompt-question').length,1);
 console.log('PASS mass kills award XP once and cannot reopen the paused question');
}

{
 const f=setup();
 assert.equal(f.ctx.choices({laser:10,card:11},6).length,0,'Reproduces the old empty upgrade screen');
 for(const action of ['doubleEnemyXp','halfEnemySpeed','instantKill','invincibility','magnet','maxCurrentAbilities','removeObstacles','resetHealth','killEnemies','nextLevel'])f.execute(action);
 f.execute('resetHealth');
 assert.equal(f.player.invulnerableTime,Infinity,'Healing must retain invincibility');
 assert.equal(f.scene.gameManager.getGameStatus(),'PAUSED_FOR_PLAYER_ACTION','Healing must retain question pause');
 assert(f.ctx.choices(f.scene.abilityService.abilityLevels,6).length>0,'Boosted abilities still offer a native level-up choice');
 f.scene.eventBus.emit('level-up','laser');
 assert.equal(f.scene.gameManager.getGameStatus(),'IN_PROGRESS');
 f.execute('nextLevel');
 assert(f.ctx.choices(f.scene.abilityService.abilityLevels,7).length>0);
 f.scene.eventBus.emit('level-up','card');
 assert.equal(f.scene.gameManager.getGameStatus(),'IN_PROGRESS');
 f.stop();assert.equal(f.player.invulnerableTime,0);assert.equal(f.player.magnetTime,0);
 console.log('PASS all ten Brawl tools together: native choices, level-up resume, heal/invincibility and cleanup');
}

{
 const boosted=setup(),normal=setup();boosted.execute('maxCurrentAbilities');
 for(const name of ['laser','card'])for(let i=0;i<9;i++){boosted.scene.abilityService.upgradeAbility(name);normal.scene.abilityService.upgradeAbility(name);}
 assert.equal(boosted.scene.abilityService.abilityLevels.card,11,'Native recursive combo evolution survives the boost');
 boosted.stop();assert.deepEqual(JSON.parse(JSON.stringify(boosted.scene.abilityService.abilityStats)),JSON.parse(JSON.stringify(normal.scene.abilityService.abilityStats)));
 console.log('PASS native recursive combo upgrades and earned-stat restoration under combat boost');
}
