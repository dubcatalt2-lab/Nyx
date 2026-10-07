import {sourceFile} from '../scripture/source-layout.mjs';
import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
import {join} from 'node:path';

export async function buildGameStorage(root, output) {
  await build({entryPoints:[join(root,'rituals/game-storage-entry.mjs')],bundle:true,platform:'b\u0072owser',format:'iife',target:'es2022',minify:true,legalComments:'inline',outfile:join(output,'assets/vendor/game-storage.js')});
  await copyFile(sourceFile(join(root,'node_modules/fake-indexeddb/LICENSE')),join(output,'assets/vendor/game-storage.LICENSE.txt'));
}
