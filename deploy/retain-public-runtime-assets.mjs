import {readdir,lstat,copyFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const alias = /(?:^|\/)@r[0-9a-f]+!\.(?:js|mjs|wasm|html|json|css|svg|webp)$/;
export async function retainPublicRuntimeAssets(sources,destination) {
  const output=await realpath(destination);let count=0,bytes=0;
  for(const input of sources) {
    const root=await realpath(input);if(root===output)throw Error('Source and destination must differ');
    async function walk(folder='') {
      for(const entry of await readdir(join(root,folder),{withFileTypes:true})) {
        const name=folder?folder+'/'+entry.name:entry.name;
        if(entry.isSymbolicLink())continue;
        if(entry.isDirectory()){await walk(name);continue;}
        if(!entry.isFile()||!alias.test(name))continue;
        const source=join(root,name),target=resolve(output,name);
        if(relative(output,target).startsWith('..'))throw Error('Invalid public asset path');
        const stat=await lstat(source);if(stat.size>64*1024*1024)throw Error('Unexpected runtime asset size');
        try {await lstat(target);continue;}catch(error){if(error.code!=='ENOENT')throw error;}
        bytes+=stat.size;if(bytes>1024*1024*1024)throw Error('Runtime retention exceeds safety bound');
        await mkdir(dirname(target),{recursive:true});await copyFile(source,target,1);count++;
      }
    }
    await walk();
  }
  return {count,bytes};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [destination,...sources]=process.argv.slice(2);if(!destination||!sources.length)throw Error('Pass destination dist and previous dist roots');
  console.log('Retained opaque public runtime assets:',JSON.stringify(await retainPublicRuntimeAssets(sources,destination)));
}
