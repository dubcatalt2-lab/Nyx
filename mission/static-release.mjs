import {readFile, writeFile, rename, stat, chown, chmod, access, realpath, readdir, lstat, rm} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {buildOutputPath} from '../scripture/build-output.mjs';

export async function currentStaticRoot(project, environment) {
  const text = await readFile(environment, 'utf8');
  const value = [...text.matchAll(/^[ \t]*NYX_STATIC_ROOT=(.*)$/gm)].at(-1)?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
  return buildOutputPath(project, value || 'dist');
}

export async function activateStaticRelease(project, environment, output, {rollback = false} = {}) {
  output = buildOutputPath(project, output);
  if (!rollback) {
    if (output === resolve(project, 'dist')) throw new Error('Deploy a staged release, not dist.');
    const ready = JSON.parse(await readFile(join(dirname(output), 'ready.json'), 'utf8'));
    if (ready.format !== 'nyx-static-release' || ready.version !== 1) throw new Error('Release is incomplete.');
    const aliases = JSON.parse(await readFile(join(output, 'public-modules.json'), 'utf8')).aliases;
    if (!aliases || Object.keys(aliases).length < 1) throw new Error('Release has no module mappings.');
    for (const target of Object.values(aliases)) {
      if (!/^\/(?!\/)[^\\\0]+\.js$/.test(target) || target.split('/').includes('..')) throw new Error('Invalid module mapping.');
      await access(join(output, target.slice(1)));
    }
  }
  await access(join(output, 'index.html'));
  const previous = await readFile(environment, 'utf8');
  const line = 'NYX_STATIC_ROOT=' + output;
  const updated = /^[ \t]*NYX_STATIC_ROOT=.*$/m.test(previous)
    ? previous.replace(/^[ \t]*NYX_STATIC_ROOT=.*$/gm, line)
    : previous.replace(/\s*$/, '') + '\n' + line + '\n';
  const info = await stat(environment);
  const temporary = environment + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, updated, {mode: info.mode & 0o777, flag: 'wx'});
    if (process.platform !== 'win32') await chown(temporary, info.uid, info.gid);
    await chmod(temporary, info.mode & 0o777);
    await rename(temporary, environment);
  } finally { await rm(temporary, {force: true}); }
}

export async function pruneStaticReleases(project, active, previous) {
  const root = await realpath(join(project, '.nyx-releases'));
  if (root !== resolve(project, '.nyx-releases')) throw new Error('Release directory cannot be a symbolic link.');
  const keep = new Set([resolve(active), resolve(previous)]);
  const releases = [];
  for (const name of await readdir(root)) {
    if (!/^release-[a-zA-Z0-9_-]+$/.test(name)) continue;
    const path = join(root, name);
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) continue;
    try {
      const ready = JSON.parse(await readFile(join(path, 'ready.json'), 'utf8'));
      if (ready.format === 'nyx-static-release' && ready.version === 1) releases.push({path, time: info.mtimeMs});
    } catch {}
  }
  releases.sort((a, b) => b.time - a.time);
  for (const release of releases.slice(0, 3)) keep.add(join(release.path, 'site'));
  for (const release of releases) {
    if (keep.has(join(release.path, 'site'))) continue;
    const checked = await realpath(release.path);
    if (dirname(checked) !== root || checked !== release.path) throw new Error('Release cleanup escaped its directory.');
    await rm(checked, {recursive: true});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, project, environment, output, previous] = process.argv.slice(2);
  if (action === 'current') console.log(await currentStaticRoot(project, environment));
  else if (action === 'activate' || action === 'rollback') await activateStaticRelease(project, environment, output, {rollback: action === 'rollback'});
  else if (action === 'prune') await pruneStaticReleases(project, output, previous);
  else throw new Error('Unknown static release operation.');
}
