import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root=process.env.NYX_TEST_STATIC_ROOT||'.';
const folder='assets/vendor/r93d51/';
const manifest=JSON.parse(await readFile(folder+'upstream.json','utf8'));
const aliases={};
for(const name of ['proxy-assets.json','frontend-assets.json','public-modules.json']){
  try{Object.assign(aliases,JSON.parse(await readFile(join(root,name),'utf8')).aliases)}catch(error){if(error.code!=='ENOENT')throw error}
}
for(const file of manifest.files){
  let path='/'+folder+file.path;
  const seen=new Set();
  while(aliases[path]&&!seen.has(path)){seen.add(path);path=aliases[path]}
  const bytes=await readFile(join(root,path.slice(1)));
  assert.equal(bytes.length,file.bytes,file.path+' byte length changed');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path+' no longer matches pinned upstream');
}
console.log('PASS '+manifest.files.length+' pinned runtime files match upstream byte-for-byte ('+root+')');
