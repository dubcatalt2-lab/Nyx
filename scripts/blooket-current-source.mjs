import {readFile} from 'node:fs/promises';
import {parse} from 'acorn';
export async function currentBrawlDefinitions(){
 const source=await readFile(process.env.NYX_BRAWL_SOURCE||'.codex-artifacts/blooket-current/brawl.js','utf8');
 const tree=parse(source,{ecmaVersion:'latest',sourceType:'module'}),definitions=new Map();
 for(const node of tree.body){
  if((node.type==='ClassDeclaration'||node.type==='FunctionDeclaration')&&node.id)definitions.set(node.id.name,source.slice(node.start,node.end));
  if(node.type==='VariableDeclaration')for(const d of node.declarations)if(d.id.type==='Identifier')definitions.set(d.id.name,'var '+source.slice(d.start,d.end)+';');
 }
 const names=['Tf','tw','Kb','Ib','Qb','Ki','Dn','Mb','Nb','Fb','Pe','sh','Ef','Wb','Yb','Ab','Cb','_b','Pb'];
 for(const name of names)if(!definitions.has(name))throw Error('Missing supplied game definition '+name);
 return names.map(n=>definitions.get(n)).join('\n')+'\nvar K=sh;';
}

export async function currentDefinitions(file,names){
 const source=await readFile('.codex-artifacts/blooket-current/'+file+'.js','utf8');
 const tree=parse(source,{ecmaVersion:'latest',sourceType:'module'}),defs=new Map();
 for(const node of tree.body){
  if((node.type==='ClassDeclaration'||node.type==='FunctionDeclaration')&&node.id)defs.set(node.id.name,source.slice(node.start,node.end));
  if(node.type==='VariableDeclaration')for(const d of node.declarations)if(d.id.type==='Identifier')defs.set(d.id.name,'var '+source.slice(d.start,d.end)+';');
 }
 return names.map(name=>{if(!defs.has(name))throw Error('Missing supplied definition '+name);return defs.get(name);}).join('\n');
}

export async function currentCallback(file,functionName,variable){
 const source=await readFile('.codex-artifacts/blooket-current/'+file+'.js','utf8'),tree=parse(source,{ecmaVersion:'latest',sourceType:'module'});
 const fn=tree.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===functionName);let found;
 const visit=n=>{if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id.name===variable)found=n.init.arguments[0];for(const value of Object.values(n))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);};visit(fn);
 if(!found)throw Error('Missing current callback '+variable);return source.slice(found.start,found.end);
}
