import {readFile} from 'node:fs/promises';

const modules = ['learning', 'curriculum', 'secondary'];
const names = new Map([
  ...modules.map(name => [name + '.js', name + '.mjs']),
  ['learning.css', 'learning.css'], ['textbook.css', 'textbook.css']
]);
export function legacyLearningAsset(name) {
  return modules.some(module => name === module + '.mjs') ? name.slice(0, -4) + '.js' : null;
}
export async function learningAsset(name) {
  if (!names.has(name)) return null;
  let source = await readFile(new URL('./' + names.get(name), import.meta.url), 'utf8');
  for (const module of modules) source = source.replaceAll('./' + module + '.mjs', './' + module + '.js');
  return source;
}
