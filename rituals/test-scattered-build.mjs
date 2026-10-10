import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve,dirname,posix} from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
const root=resolve(process.argv[2]||'dist');
const {aliases}=JSON.parse(await readFile(resolve(root,'frontend-assets.json'),'utf8'));
let imports=0;
for(const [original,target] of Object.entries(aliases)){
 assert.match(target,/\/@[a-f0-9]{8}\/[a-f0-9]{8}\/@r[a-f0-9]{24}!\.js$/);
 const legacy=posix.join(posix.dirname(original),'@r'+createHash('sha256').update('frontend-education-v1:'+original).digest('hex').slice(0,24)+'!.js');
 await access(resolve(root,'.'+legacy));
 const file=resolve(root,'.'+target);
 const source=await readFile(file,'utf8');
 const tree=parse(source,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true});
 async function visit(node){
  if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)&&typeof node.source?.value==='string'){
   const value=node.source.value.split(/[?#]/)[0];
   if(value.startsWith('.')||value.startsWith('/')){
    await access(value.startsWith('/')?resolve(root,'.'+value):resolve(dirname(file),value));
    imports++;
   }
  }
  for(const value of Object.values(node))if(Array.isArray(value)){for(const child of value)await visit(child);}else if(value&&typeof value==='object')await visit(value);
 }
 await visit(tree);
}
for(const name of ['/script.js','/assets/games/games.js','/js/ai-workspace.js'])assert(aliases[name],name+' must be scattered');
console.log('PASS '+Object.keys(aliases).length+' scattered scripts parse; '+imports+' local imports resolve; shell, games and AI included');
