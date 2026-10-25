// Current Brawl service API, traced against the supplied db3a4b64 bundle.
// No React class-state lookup or collider callback string matching.
const tools = new Set(['doubleEnemyXp','halfEnemySpeed','instantKill','invincibility','killEnemies','magnet','maxCurrentAbilities','nextLevel','removeObstacles','resetHealth']);
const combatCaps={"egg":{"dmg":25,"maxTargets":4,"fireRate":800,"intervalRate":100},"nut":{"dmg":15,"maxTargets":4,"fireRate":125,"intervalRate":100},"slime":{"dmg":22,"maxTargets":1000,"fireRate":2500,"intervalRate":250},"jesterBall":{"dmg":40,"maxTargets":9,"fireRate":4000,"intervalRate":200},"horseshoe":{"dmg":30,"maxTargets":1000,"fireRate":4000},"shell":{"dmg":35,"maxTargets":20,"fireRate":3000,"intervalRate":250},"pizza":{"dmg":30,"maxTargets":1000,"fireRate":2000,"intervalRate":150},"banana":{"dmg":25,"maxTargets":10,"fireRate":1500,"intervalRate":100},"arrow":{"dmg":25,"maxTargets":11,"fireRate":1200},"peacock":{"dmg":30,"maxTargets":10,"fireRate":1200,"intervalRate":200},"bone":{"dmg":22,"maxTargets":20,"fireRate":500},"bee":{"dmg":28,"maxTargets":15,"fireRate":2500,"intervalRate":100},"bubble":{"dmg":23,"maxTargets":6,"fireRate":1000,"intervalRate":70},"card":{"dmg":17,"maxTargets":8,"fireRate":650,"intervalRate":300},"laser":{"dmg":35,"maxTargets":20,"fireRate":200},"darkEnergy":{"dmg":35,"maxTargets":1000,"fireRate":0},"syrup":{"dmg":40,"maxTargets":1000,"fireRate":2500,"intervalRate":200},"bird":{"dmg":18,"maxTargets":6,"fireRate":1000}};
function runBrawl(action, scene, cleanup, caps) {
 const enemies = scene.enemyService.enemies;
 const player = scene.playerService.getPlayer();
 const manager = scene.gameManager;
 if (['doubleEnemyXp','halfEnemySpeed','instantKill'].includes(action)) {
  const field = action==='doubleEnemyXp'?'val':action==='halfEnemySpeed'?'speed':'hp';
  const originals = new Map();
  const apply = enemy => {
   if(!Number.isFinite(enemy[field]))throw Error('The enemy '+field+' value is unavailable.');
   const before = enemy[field], after = action==='doubleEnemyXp'?before*2:action==='halfEnemySpeed'?before/2:Math.min(before,1);
   originals.set(enemy,{before,after});enemy[field]=after;
  };
  const key=Symbol.for('nyx.blooket.brawl.spawn');
  let shared=scene[key];
  if(!shared){
   const prototype=enemies.classType.prototype, original=prototype.spawn;
   if(typeof original!=='function')throw Error('The enemy spawn method is unavailable.');
   const descriptor=Object.getOwnPropertyDescriptor(prototype,'spawn');
   shared={modifiers:new Set(),prototype,original,descriptor};
   shared.wrapper=function(...args){const result=original.apply(this,args);if(this.sc===scene&&this.active&&!this.dying)for(const modify of shared.modifiers)modify(this);return result;};
   Object.defineProperty(prototype,'spawn',{value:shared.wrapper,writable:true,configurable:true});scene[key]=shared;
  }
  shared.modifiers.add(apply);
  cleanup(()=>{shared.modifiers.delete(apply);if(!shared.modifiers.size){if(shared.prototype.spawn===shared.wrapper){if(shared.descriptor)Object.defineProperty(shared.prototype,'spawn',shared.descriptor);else delete shared.prototype.spawn;}if(scene[key]===shared)delete scene[key];}});
  cleanup(()=>{for(const [enemy,value] of originals)if(enemy[field]===value.after)enemy[field]=value.before;originals.clear();});
  for(const enemy of enemies.getChildren())if(enemy.active&&!enemy.dying)apply(enemy);
 } else if(action==='invincibility'||action==='magnet') {
  const field=action==='invincibility'?'invulnerableTime':'magnetTime';
  const setter=action==='invincibility'?'setInvulnerableTime':'setMagnetTime';
  const old=player[field];player[setter](Infinity);
  cleanup(()=>{if(player[field]===Infinity)player[setter](old);});
 } else if(action==='killEnemies') {
  if(manager.getGameStatus()!=='IN_PROGRESS')throw Error('Finish the current question or ability choice first.');
  let xp=0;
  for(const enemy of enemies.getChildren())if(enemy.active&&!enemy.dying){xp+=enemy.val;enemy.die();}
  // A single award opens one question instead of reopening it for every enemy.
  if(xp>0)manager.addXp(xp);
 } else if(action==='maxCurrentAbilities') {
  const service=scene.abilityService,names=Object.keys(service.abilityLevels);
  if(!names.length)throw Error('Choose an ability first.');
  const original=service.upgradeAbility,descriptor=Object.getOwnPropertyDescriptor(service,'upgradeAbility');
  const snapshots=new Map();
  const restore=()=>{for(const [stats,fields] of snapshots)for(const [key,pair] of Object.entries(fields))if(stats[key]===pair.after)stats[key]=pair.before;snapshots.clear();};
  const apply=()=>{for(const name of names){const stats=service.abilityStats[name],cap=caps[name];if(!stats||!cap)continue;
   const fields={};for(const [key,value] of Object.entries(cap)){if(!Number.isFinite(stats[key]))continue;const before=stats[key],after=['fireRate','intervalRate'].includes(key)?Math.min(before,value):Math.max(before,value);fields[key]={before,after};stats[key]=after;}snapshots.set(stats,fields);
  }};
  let depth=0;
  const wrapper=function(...args){if(depth++===0)restore();try{return original.apply(this,args);}finally{if(--depth===0)apply();}};
  service.upgradeAbility=wrapper;
  cleanup(()=>{restore();if(service.upgradeAbility===wrapper){if(descriptor)Object.defineProperty(service,'upgradeAbility',descriptor);else delete service.upgradeAbility;}});
  apply();
 } else if(action==='nextLevel') {
  if(manager.getGameStatus()!=='IN_PROGRESS')throw Error('Finish the current question or ability choice first.');
  const level=manager.getLevel();
  if(!Number.isInteger(level)||level<1||level>59)throw Error('Choose the starting ability before advancing.');
  const threshold=level===1?1:level<5?5:level<10?10:level<20?20:level<30?30:level<40?40:level<45?50:level<50?75:100;
  manager.addXp(Math.max(0,threshold-manager.getCurXp()));
 } else if(action==='removeObstacles') {
  scene.mapService.obstacles.clear(true,true);
 } else if(action==='resetHealth') {
  const invulnerable=player.invulnerableTime;
  if(manager.getGameStatus()==='RESPAWNING'){scene.eventBus.emit('respawn');if(invulnerable===Infinity)player.setInvulnerableTime(Infinity);}
  else player.setHp(100);
 }
}
export function adaptBrawlAction(path) {
 const match=/^brawl\/([^/]+)\.js$/.exec(path);
 if(!match||!tools.has(match[1]))return null;
 return {code:`(${runBrawl.toString()})(${JSON.stringify(match[1])},resolveBlooketScene("brawl-services"),onBlooketCleanup,${JSON.stringify(combatCaps)})`,adapted:0,expected:[],requirements:[{kind:'scene',value:'brawl-services'}],implementation:'native-brawl'};
}
