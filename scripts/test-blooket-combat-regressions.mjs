import assert from 'node:assert/strict';
import vm from 'node:vm';
import {currentDefinitions} from './blooket-current-source.mjs';
import {adaptDefense2Action} from './blooket-defense2-actions.mjs';
class Image {setTexture(){return this;}setScale(){return this;}}
const context=vm.createContext({Phaser:{Physics:{Arcade:{Image}},Math:{Angle:{Between:()=>0}}},structuredClone,Math});
vm.runInContext(await currentDefinitions('defense2',['wt','Cd','ee','le','sn'])+';this.types={wt,ee,Cd};',context);
const {wt,ee,Cd}=context.types;
let shots=0,refreshes=0;
const scene={gameManager:{getSpeed:()=>1},enemyService:{isWaveActive:true,getEnemy:()=>({x:1,y:1,getTargetPos:()=>({x:1,y:1})})},towerAbilityService:{addProjectile(){shots++;}}};
const towers=Object.keys(ee).map(type=>Object.assign(Object.create(wt.prototype),{sc:scene,type,level:0,stats:Cd(type,0),buffs:{},towerPlatform:{setLevel(){}},setRotation(){},timeTilNextVolley:0,timeTilNextAttack:0,attacksLeftInVolley:0}));
scene.towerService={allTowersIterator:()=>towers,recalculateBuffs(){},updateSelectedGameTower(){refreshes++;}};
const run=()=>vm.runInNewContext(adaptDefense2Action('tower-defense-2/maxTowers.js').code,{resolveBlooketScene:()=>scene,prompt(){},readBlooketNumber(){}},{timeout:1000});
run();
for(const tower of towers){assert.equal(tower.level,4);assert.deepEqual(tower.stats,Cd(tower.type,4));}
run();assert.equal(refreshes,2);
for(let frame=0;frame<3600;frame++)for(const tower of towers)tower.update(frame*16,16);
assert(shots>0&&shots<100000,'Normal attack cadence remains bounded during 60 seconds of simulated combat');
console.log(`PASS ${towers.length} tower types use exact maximum-tier stats; repeated activation and 3600 combat updates finish (${shots} shots). Specialized projectile behavior is not simulated.`);
