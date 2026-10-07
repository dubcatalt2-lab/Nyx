import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {parse} from 'acorn';
import {sourceLayout,sourceFileLayout,sourceFile,publicSourcePath,publicSourceText} from '../scripture/source-layout.mjs';
import {privateSourcePath} from '../scripture/public-assets.mjs';

for(const [from,to] of Object.entries({...sourceLayout,...sourceFileLayout})){
 await access(sourceFile(from));await access(to);
 assert.equal(resolve(sourceFile(from)),resolve(to),from);
}
assert.equal(publicSourcePath('chapels/movies/intercession.mjs'),'apps/movies/proxy.mjs');
assert.equal(publicSourcePath('study.html'),'index.html');
assert.equal(publicSourcePath('barebooks/index.mjs'),'baremux/index.mjs');
assert.equal(publicSourcePath('relics/transports/incense-pilgrim.mjs'),'assets/transports/epoxy-scramjet.mjs');
assert.equal(publicSourceText('import("/chapels/tutsi/intercession.mjs")'),'import("/apps/tutsi/proxy.mjs")');
for(const name of ['scripture','ministries','hermitage','deacon','lectionary','scrolls'])assert(privateSourcePath('/'+name+'/anything.js'));
assert(privateSourcePath('/fellowship-gateway.mjs'));
const router=await readFile('mission/refresh-turn-router.sh','utf8');
assert(router.includes('/etc/letsencrypt/renewal-hooks/deploy/nyx-turn-certificate'),'Certbot discovers hooks only in its standard deploy directory');
assert(!router.includes('/etc/letsencrypt/renewal-hooks/mission/'));
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
let imports=0;
for(const file of files.filter(file=>/\.(?:js|mjs)$/.test(file)&&!/^(?:relics|pilgrim|communion|incense|lectionary|ministries\/stratus\/upstream)\//.test(file))){
 let source;try{source=await readFile(file,'utf8')}catch{continue}
 let tree;try{tree=parse(source,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true})}catch{continue}
 for(const node of tree.body){
  const path=node.source?.value;
  if(!path?.startsWith('.'))continue;
  await access(resolve(dirname(file),path.split(/[?#]/)[0]));imports++;
 }
}
console.log(`PASS source layout mappings, private paths and ${imports} relative imports.`);
