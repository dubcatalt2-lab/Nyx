import {renameRuntimeText,rewriteRuntimeNames,renameRuntimeWasm} from './build-runtime-names.mjs';
import {createHash} from 'node:crypto';
import {rewriteStorageNames} from './build-storage.mjs';
import {readFile, writeFile, readdir, rm, mkdir} from 'node:fs/promises';
import {join, posix} from 'node:path';
import {randomBytes} from 'node:crypto';
import {minify} from 'terser';

// Generated once and committed: stable opaque URLs keep old tabs working.
export const legacyProxyAssetNames=JSON.parse(await readFile(new URL('./proxy-asset-names.json',import.meta.url),'utf8'));
const previousProxyAssetNames=Object.fromEntries(Object.entries(legacyProxyAssetNames).map(([original,alias])=>[original,alias.replace(/r([0-9a-f]{24})(\.(?:js|mjs|wasm))$/, '@r$1!$2')]));
export const proxyAssetNames=Object.fromEntries(Object.entries(legacyProxyAssetNames).map(([original,alias])=>[original,posix.join(renameRuntimeText(posix.dirname(alias)), '@r'+createHash('sha256').update('education-v1:'+original).digest('hex').slice(0,24)+'!'+posix.extname(alias))]));
const entries=Object.entries(proxyAssetNames);
const destinations=new Set();
for(const [original,alias] of entries){
  if(!original.startsWith('/')||original.includes('..')||renameRuntimeText(posix.dirname(original))!==posix.dirname(alias)||posix.extname(original)!==posix.extname(alias)||!/^@r[0-9a-f]{24}!\.(?:js|mjs|wasm)$/.test(posix.basename(alias))||destinations.has(alias))throw Error('Invalid proxy asset mapping');
  destinations.add(alias);
}
export function rewriteProxyReferences(source,path,mappings=entries){
  source=rewriteStorageNames(source);
  for(const [original,alias] of [...mappings].sort((a,b)=>b[0].length-a[0].length)) source=source.split(original).join(alias);
  // Resolve relative imports from the renamed module directory.
  const directory=posix.dirname(path);
  const destinationDirectory=posix.dirname(mappings.find(([original])=>original===path)?.[1] || path);
  for(const [original,alias] of mappings){
    let relative=posix.relative(directory,posix.normalize(original));
    const renamed=posix.relative(destinationDirectory,alias);
    for(const prefix of relative.startsWith('.')?['']:['','./']){
      for(const quote of ['"',"'",'`']) source=source.split(quote+prefix+relative+quote).join(quote+prefix+renamed+quote);
    }
  }
  return source;
}
export async function scrambleProxyCode(source,{module=false}={}){
  // Terser quotes Unicode private-method declarations; use ASCII for those runtimes.
  const prefix=/#[\p{ID_Start}$_]/u.test(source)?'_':'\u03bb';
  const names=new Map();
  const result=await minify(source,{
    module,compress:false,
    // Public properties, exports, function/class names, eval bindings and WASM
    // interfaces are contracts, not safe targets for arbitrary replacement.
    keep_fnames:true,keep_classnames:true,
    mangle:{toplevel:module,eval:false,properties:false,nth_identifier:{get(n){if(!names.has(n))names.set(n,prefix+randomBytes(6).toString('hex'));return names.get(n);}}},
    format:{comments:/@license|@preserve|^!/,ascii_only:false}
  });
  if(!result.code)throw Error('Proxy transformation produced empty code');
  return {code:result.code+'\n',renamed:names.size};
}
async function walk(root,prefix=''){
  const files=[];
  for(const entry of await readdir(join(root,prefix),{withFileTypes:true})){
    const path=posix.join(prefix,entry.name);
    if(entry.isDirectory())files.push(...await walk(root,path));else files.push(path);
  }
  return files;
}
export async function buildProxyAssets(output){
  const originals=new Map();
  for(const [original] of entries) originals.set(original,await readFile(join(output,original.slice(1))));
  let renamed=0;
  for(const [original,alias] of entries){
    const bytes=originals.get(original);
    await mkdir(join(output,posix.dirname(alias)),{recursive:true});
    const previousAlias=previousProxyAssetNames[original];
    if(original.endsWith('.wasm')){
      await writeFile(join(output,alias.slice(1)),renameRuntimeWasm(bytes));
      await writeFile(join(output,previousAlias.slice(1)),bytes);
      await writeFile(join(output,legacyProxyAssetNames[original].slice(1)),bytes);
      continue;
    }
    const previous=await scrambleProxyCode(rewriteProxyReferences(bytes.toString('utf8'),original,Object.entries(previousProxyAssetNames)),{module:original.endsWith('.mjs')});
    await writeFile(join(output,previousAlias.slice(1)),previous.code);
    const transformed=await scrambleProxyCode(rewriteRuntimeNames(rewriteProxyReferences(bytes.toString('utf8'),original)),{module:original.endsWith('.mjs')});
    renamed+=transformed.renamed;
    await writeFile(join(output,alias.slice(1)),transformed.code);
    // Compatibility filenames also receive mangled code, but keep their URLs.
    const legacy=await scrambleProxyCode(bytes.toString('utf8'),{module:original.endsWith('.mjs')});
    await writeFile(join(output,original.slice(1)),legacy.code);
    await writeFile(join(output,legacyProxyAssetNames[original].slice(1)),legacy.code);
  }
  for(const path of await walk(output)){
    if(/^(?:scramjet(?:-v1)?|controller|epoxy|libcurl|baremux|uv)\//.test(path)){
      if(path.endsWith('.map'))await rm(join(output,path));
      continue;
    }
    if(Object.values(previousProxyAssetNames).includes('/'+path)||Object.values(legacyProxyAssetNames).includes('/'+path)||proxyAssetNames['/'+path]||entries.some(([,alias])=>alias==='/'+path)||path.startsWith('assets/ugs/')||path.startsWith('assets/vendor/'))continue;
    if(!/\.(?:js|mjs|html)$/.test(path))continue;
    const source=await readFile(join(output,path),'utf8');
    const rewritten=rewriteRuntimeNames(rewriteProxyReferences(source,'/'+path));
    if(source!==rewritten)await writeFile(join(output,path),rewritten);
  }
  await writeFile(join(output,'proxy-assets.json'),JSON.stringify({version:3,aliases:proxyAssetNames}));
  await writeFile(join(output,'_headers'),entries.map(([,alias])=>`${alias}\n  Cache-Control: no-store, no-cache, must-revalidate\n`).join('\n'));
  console.log(`Proxy build: ${entries.length} opaque asset URLs; ${renamed} randomized identifier slots; educational runtime names linked across JS and WASM.`);
}
