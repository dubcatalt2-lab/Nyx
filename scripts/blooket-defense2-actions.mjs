const names=new Set(['maxTowers','removeEnemies','setCoins','setHealth','setRound']);
function runDefense2(action,scene,ask,number){
 const manager=scene.gameManager, enemies=scene.enemyService;
 if(action==='setCoins'||action==='setHealth'||action==='setRound'){
  if(action==='setRound'&&enemies.isWaveActive)throw Error('Finish the current wave before changing rounds.');
  const value=number(ask(action==='setCoins'?'Coins:':action==='setHealth'?'Health:':'Round (1-1000):'),'integer');
  if(value<0)throw Error('Enter zero or a positive whole number.');
  if(action==='setRound'){
   if(value<1||value>1000)throw Error('Enter a round from 1 to 1000.');
   enemies.waveNum=value;enemies.emitCurrentWave();
  }else if(action==='setCoins')manager.setCoins(value);else manager.setHealth(value);
 }else if(action==='removeEnemies'){
  // Extra subwaves otherwise repopulate the queue on the next spawn.
  enemies.enemyQueue.length=0;enemies.extraRounds.length=0;enemies.nextEnemy=0;
  for(const enemy of enemies.enemies.getChildren())if(enemy.active)enemy.hide();
  // The normal update ends the wave once, awards coins and retains question flow.
 }else if(action==='maxTowers'){
  const service=scene.towerService,towers=service.allTowersIterator();
  if(!towers.length)throw Error('Place a tower first.');
  // Use the game's four upgrade tiers, including tower-specific effects.
  // Inflated ranges, volley sizes and aura multipliers overload combat updates.
  if(towers.some(tower=>typeof tower.upgrade!=='function'||!Number.isInteger(tower.level)||tower.level<0||tower.level>4))throw Error('The tower upgrade data is unavailable.');
  for(const tower of towers)if(tower.level<4)tower.upgrade(4);
  service.recalculateBuffs();service.updateSelectedGameTower(service.selectedGameTower);
 }
}
export function adaptDefense2Action(path){const match=/^tower-defense-2\/([^/]+)\.js$/.exec(path);if(!match||!names.has(match[1]))return null;return {code:`(${runDefense2.toString()})(${JSON.stringify(match[1])},resolveBlooketScene("td2-services"),prompt,readBlooketNumber)`,adapted:0,expected:[],requirements:[{kind:'scene',value:'td2-services'}],implementation:'native-defense2'};}
