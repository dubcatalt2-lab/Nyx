import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(await readFile(path.join(root,'hosting.json'),'utf8'));
const target=process.argv[2];
if(!target||!/^\/(?:[a-zA-Z0-9@!._~/-]+\/)?$/.test(target)||target.includes('..')||target.startsWith('//'))throw Error('Use / for Surge, or /gh/USER/REPO@main/static/ for jsDelivr.');
if(config.configured)throw Error('Already configured. Extract a fresh copy to change hosts again.');
async function update(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())await update(file);
    else if(/\.(?:html|svg|js|mjs|css|json|txt)$/.test(entry.name)&&!['hosting.json','configure-host.mjs'].includes(entry.name)){
      const source=await readFile(file,'utf8');
      const changed=source.replaceAll(config.base,target).replaceAll(config.base.replaceAll('/','\\/'),target.replaceAll('/','\\/'));
      if(changed!==source)await writeFile(file,changed);
    }
  }
}
await update(root);
await writeFile(path.join(root,'hosting.json'),JSON.stringify({base:target,configured:true}));
console.log('Ready for '+target+'. Upload this entire folder. Open Nyx.svg on jsDelivr or Nyx.html on a normal HTTPS host.');
