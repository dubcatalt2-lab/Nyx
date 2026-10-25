import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {minify} from 'terser';
import {parse} from 'acorn';
import {encodeLiterals} from './build-string-literals.mjs';
import {supportedEntries} from '../apps/blooket/supported.mjs';

export async function buildBlooketCatalog(output) {
  const path=join(output,'apps/blooket/catalog.json');
  let catalog;
  try {catalog=JSON.parse(await readFile(path,'utf8'));} catch(error) {if(error.code==='ENOENT')return;throw error;}
  catalog.entries=await Promise.all(supportedEntries(catalog.entries).map(async entry => {
    // Preserve the expression's result: standalone-IIFE minification may negate it.
    const result=await minify(`function actionFactory(){return ${entry.code};}`,{
      compress:true,mangle:{toplevel:false},format:{comments:/@license|copyright/i},sourceMap:false,
    });
    const encoded=encodeLiterals(result.code),tree=parse(encoded,{ecmaVersion:'latest'});
    const argument=tree.body[0].body.body.find(node=>node.type==='ReturnStatement')?.argument;
    if(!argument)throw Error(`Action return lost: ${entry.path}`);
    return {...entry,code:(entry.code.match(/\/\*[\s\S]*?\*\//g)||[]).filter(text=>/@license|copyright/i.test(text)).join('\n')+'\n'+encoded.slice(argument.start,argument.end)};
  }));
  await writeFile(path,JSON.stringify(catalog));
  console.log(`Blooket catalog: ${catalog.entries.length} reviewed actions, local identifiers mangled and literals encoded; external properties preserved.`);
}
