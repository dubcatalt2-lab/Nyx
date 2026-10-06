import {sourceFile} from '../scripture/source-layout.mjs';
import {readdir, readFile, writeFile, rename, unlink} from 'node:fs/promises';
import {join, posix} from 'node:path';
import {createHash} from 'node:crypto';
import {privateSourcePath} from '../scripture/public-assets.mjs';

export async function publicFiles(root, directory = '') {
  const files = [];
  for (const entry of await readdir(join(root, directory), {withFileTypes: true})) {
    const name = posix.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await publicFiles(root, name));
    else files.push(name);
  }
  return files;
}

export function moduleNames(files) {
  const occupied = new Set(files.map(file => file.toLowerCase()));
  const aliases = {};
  for (const file of files.filter(file => file.endsWith('.mjs')).sort()) {
    let target = file.slice(0, -4) + '.js';
    if (occupied.has(target.toLowerCase())) target = file.slice(0, -4) + '.module-' + createHash('sha256').update(file).digest('hex').slice(0, 12) + '.js';
    if (occupied.has(target.toLowerCase())) throw Error('Public module filename collision: ' + target);
    occupied.add(target.toLowerCase());
    aliases['/' + file] = '/' + target;
  }
  return aliases;
}

const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function rewritePublicModules(source, file, aliases) {
  const replacements = new Map();
  for (const [from, to] of Object.entries(aliases)) {
    replacements.set(from, to);
    const relative = posix.relative(posix.dirname(file), from);
    const target = posix.relative(posix.dirname(file), to);
    replacements.set(relative, target);
    if (!relative.startsWith('.')) replacements.set('./' + relative, './' + target);
  }
  if (!replacements.size) return source;
  const pattern = new RegExp('(?<![\\w/@!.$%+-])(?:' + [...replacements.keys()].sort((a,b) => b.length-a.length).map(escape).join('|') + ')(?![\\w./%+-])', 'g');
  return source.replace(pattern, value => replacements.get(value));
}

export async function buildPublicModules(root) {
  const files = [];
  for (const file of await publicFiles(root)) {
    if (privateSourcePath('/' + file)) await unlink(join(root,file));
    else files.push(file);
  }
  const aliases = moduleNames(files);
  for (const file of files) {
    if (file !== '_headers' && !/\.(?:js|mjs|html|json|webmanifest)$/.test(file)) continue;
    const source = await readFile(sourceFile(join(root, file)), 'utf8');
    let updated;
    if (['proxy-assets.json', 'frontend-assets.json'].includes(file)) {
      const metadata = JSON.parse(source);
      metadata.aliases = Object.fromEntries(Object.entries(metadata.aliases).map(([from,to]) => [from, aliases[to] || to]));
      updated = JSON.stringify(metadata);
    } else updated = rewritePublicModules(source, '/' + file, aliases);
    if (source !== updated) await writeFile(join(root, file), updated);
  }
  for (const [from, to] of Object.entries(aliases)) await rename(join(root, from.slice(1)), join(root, to.slice(1)));
  await writeFile(join(root, 'public-modules.json'), JSON.stringify({version: 1, aliases}));
  console.log(`Published ${Object.keys(aliases).length} browser modules as JavaScript; legacy URLs mapped explicitly.`);
  return aliases;
}
