const names = new Map([
  ['slope', 'Motion Lab'],
  ['retro bowl', 'Team Strategy Workshop'],
  ['geometry dash', 'Geometry & Rhythm'],
  ['2048', 'Number Patterns'],
  ['chess', 'Strategy Studies'],
  ['tetris', 'Spatial Patterns'],
  ['wordle', 'Word Workshop'],
  ['minesweeper', 'Logic Grid'],
  ['cookie clicker', 'Growth & Numbers'],
  ['subway surfers', 'Route & Reaction'],
  ['temple run', 'Pathfinding Practice'],
  ['run 3', 'Space & Motion'],
  ['basket random', 'Movement Workshop'],
  ['bitlife', 'Life Choices'],
  ['drive mad', 'Balance & Motion']
]);

export function activityName(value) {
  const title = String(value || '').trim();
  return names.get(title.toLowerCase()) || `${title || 'Discovery'} Workshop`;
}
