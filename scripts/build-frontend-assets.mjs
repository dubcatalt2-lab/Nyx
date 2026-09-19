import {rewriteStorageNames,storageNames,migrateStorage} from './build-storage.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {join,posix} from 'node:path';
import {createHash} from 'node:crypto';
import {minify} from 'terser';
const alias=path=>posix.join(posix.dirname(path),'@r'+createHash('sha256').update('frontend-v1:'+path).digest('hex').slice(0,24)+'!'+posix.extname(path));
export function rewriteFrontendReferences(source,path,aliases) {
  source=rewriteStorageNames(source);
  const directory=posix.dirname(path);
  for(const [original,renamed] of Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length)) {
    source=source.split(original).join(renamed);
    const relative=posix.relative(directory,original),replacement=posix.relative(directory,renamed);
    for(const prefix of relative.startsWith('.')?['']:['','./']) {
      const from=prefix+relative,to=prefix+replacement;
      for(const quote of ['"',"'",'`']) {
        source=source.split(quote+from+quote).join(quote+to+quote);
        source=source.split(quote+from+'?').join(quote+to+'?');
      }
    }
  }
  return source;
}
export async function buildFrontendAssets(output,files,lessonHtml) {
  const existing=JSON.parse(await readFile(join(output,'proxy-assets.json'),'utf8')).aliases;
  const candidates=[...new Set(files)].filter(p=>/\.(js|mjs)$/.test(p)&&!p.startsWith('assets/ugs/')&&!p.startsWith('assets/vendor/')&&!existing['/'+p]&&p!=='runtime-config.js');
  const aliases=Object.fromEntries(candidates.map(p=>['/'+p,alias('/'+p)]));
  // Keep old URLs for open tabs; new documents and module graphs use stable aliases.
  for(const path of [...new Set(files)].filter(p=>/\.(html|js|mjs)$/.test(p)&&!p.startsWith('assets/ugs/')&&!p.startsWith('assets/vendor/'))) {
    let source;try{source=await readFile(join(output,path),'utf8');}catch{continue;}
    source=rewriteFrontendReferences(source,'/'+path,aliases);
    await writeFile(join(output,path),source);
    if(aliases['/'+path])await writeFile(join(output,aliases['/'+path].slice(1)),source);
  }
  for(const path of ['index.html','apps/tutsi/index.html']) {
    const original=await readFile(join(output,path),'utf8');
    const loader=posix.join(posix.dirname('/'+path),'@r'+createHash('sha256').update('entry:'+path).digest('hex').slice(0,24)+'!.js');
    // Decode as UTF-8, preserve the original document URL, script order and handlers.
    const boot=`(async()=>{await (${migrateStorage.toString()})(JSON.parse(atob(${JSON.stringify(Buffer.from(JSON.stringify(storageNames)).toString("base64"))})));const html=new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(Buffer.from(original).toString('base64'))}),c=>c.charCodeAt(0)));document.open();document.write(html);document.close()})().catch(()=>{const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='Saved browser data could not be updated. Close other site tabs and reload.';document.body.prepend(p)});`;
    await writeFile(join(output,loader.slice(1)),(await minify(boot,{mangle:{toplevel:true},compress:true})).code);
    const shell=lessonHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replaceAll('/learning/','/apps/tutsi/studyready/').replace('</body>',`<script src="${loader}"></script></body>`);
    await writeFile(join(output,path),shell);
  }
  await writeFile(join(output,'frontend-assets.json'),JSON.stringify({version:1,aliases}));
  console.log(`Frontend build: ${candidates.length} stable script aliases; lesson entry documents for both sites.`);
}
