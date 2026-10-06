import {resolve, relative, sep} from 'node:path';
import {lstatSync} from 'node:fs';

export function buildOutputPath(root, configured = process.env.NYX_BUILD_OUTPUT) {
  root = resolve(root);
  const output = resolve(root, configured || 'dist');
  const path = relative(root, output).split(sep).join('/');
  if (path !== 'dist' && !/^\.nyx-releases\/release-[a-zA-Z0-9_-]+\/site$/.test(path)) {
    throw new Error('Build output must be dist or a new .nyx-releases/release-*/site directory.');
  }
  let cursor = root;
  for (const part of path.split('/')) {
    cursor = resolve(cursor, part);
    try {
      if (lstatSync(cursor).isSymbolicLink()) throw new Error('Build output cannot use symbolic links.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return output;
}
