import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const root=resolve(process.argv[2]||'.');
const prohibited=/@mercuryworkshop\/|^(?:libcurl\.js|wispurr)$/i;
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
for(const name of Object.keys({...manifest.dependencies,...manifest.devDependencies}))assert(!prohibited.test(name),name);
const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
let entries=0;
for(const [path,value] of Object.entries(lock.packages)){
  const name=path.split('node_modules/').at(-1);
  assert(!prohibited.test(name),path);
  for(const name of Object.keys({...value.dependencies,...value.optionalDependencies}))assert(!prohibited.test(name),path+': '+name);
  entries++;
}
let installed=0;
async function packages(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.name.startsWith('.'))continue;
    const path=join(directory,entry.name);
    if(entry.name.startsWith('@')){await packages(path);continue;}
    if(!entry.isDirectory())continue;
    let value;
    try{value=JSON.parse(await readFile(join(path,'package.json'),'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
    assert(!prohibited.test(value.name),path);
    installed++;
    try{await packages(join(path,'node_modules'));}catch(error){if(error.code!=='ENOENT')throw error;}
  }
}
await packages(join(root,'node_modules'));
for(const path of ['barebooks','incense','relics/transports','pilgrim.sw.js','vespers.sw.js','fellowship-server.js','scripture/fellowship-relay.mjs','rituals/build-intercession-assets.mjs','CANON.md']){
  await assert.rejects(stat(join(root,path)),{code:'ENOENT'});
}
assert(!Object.hasOwn(manifest.scripts,'start:wisp'));
assert.equal(manifest.scripts['start:relay'],'node relay.js');
console.log(`PASS manifest: no prohibited dependency`);
console.log(`PASS regenerated lockfile: ${entries} entries, no prohibited package or dependency`);
console.log(`PASS installed tree: ${installed} packages, no prohibited package`);
console.log('PASS copied runtimes, workers, relay and asset-copy generator are absent');
console.log('PASS start:relay uses the original implementation');
