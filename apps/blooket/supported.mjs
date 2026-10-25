// Explicit review list: importing another action does not make it available.
const groups = {
  'native-brawl': ['doubleEnemyXp','halfEnemySpeed','instantKill','invincibility','killEnemies','magnet','maxCurrentAbilities','nextLevel','removeObstacles','resetHealth'].map(name => `brawl/${name}.js`),
  'native-cyber': ['autoGuess','choiceESP','removeHack','setPassword'].map(name => `crypto/${name}.js`),
  'native-fishing': ['fishing/removeDistraction.js'],
  'native-defense2': ['maxTowers','removeEnemies','setCoins','setHealth','setRound'].map(name => `tower-defense-2/${name}.js`),
  'native-question': ['autoAnswer','highlightAnswers','subtleHighlightAnswers','intervals/autoAnswer','intervals/highlightAnswers','intervals/subtleHighlightAnswers','intervals/percentAutoAnswer'].map(name => `global/${name}.js`),
};
const supported = new Map(Object.entries(groups).flatMap(([implementation, paths]) => paths.map(path => [path, implementation])));
export const supportedEntries = entries => entries.filter(entry => supported.has(entry.path) && supported.get(entry.path) === entry.implementation && typeof entry.code === 'string' && entry.code.trim());
