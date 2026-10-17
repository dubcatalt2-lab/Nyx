import {parse} from 'acorn';
import {rewriteStorageNames,storageNames,migrateStorage} from './build-storage.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {join,posix} from 'node:path';
import {createHash} from 'node:crypto';
import {minify} from 'terser';
const alias=path=>posix.join(posix.dirname(path),'@r'+createHash('sha256').update('frontend-education-v1:'+path).digest('hex').slice(0,24)+'!'+posix.extname(path));
const q6b413=alias('/assets/games/index.html');
const q73d92=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Learning Library</title><style>html,body{margin:0;min-height:100%;background:#f6f4ee;color:#243e36;font-family:system-ui,sans-serif}body{min-height:100svh;display:grid;place-items:center}main{box-sizing:border-box;width:min(640px,100%);padding:40px 28px}svg{width:44px;height:44px;stroke:currentColor;fill:none;stroke-width:1.5}p{line-height:1.6;color:#596b62}small{letter-spacing:.15em;text-transform:uppercase}h1{font-size:clamp(30px,6vw,48px);font-weight:600;margin:18px 0}aside{border-top:1px solid #d8dfd4;margin-top:28px;padding-top:20px;font-size:14px}</style></head><body><main aria-label="Learning Library"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 7C12 4 6 4 3 5v21c5-2 9-1 13 2 4-3 8-4 13-2V5c-3-1-9-1-13 2Zm0 0v21"/></svg><p><small>Explore · Learn · Discover</small></p><h1>Learning Library</h1><p>A little curiosity opens a world of possibilities.</p><aside role="status">Preparing your activities…</aside></main></body></html>`;
function rewriteRelativeScriptUrls(source,path,aliases){
  const edits=[];
  const tree=parse(source,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true});
  const property=node=>node?.computed?node.property?.value:node?.property?.name;
  const urlArgument=(parent,node)=>{
    if(parent?.type==='ImportExpression')return parent.source===node;
    if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(parent?.type))return parent.source===node;
    if(parent?.type==='AssignmentExpression')return parent.right===node&&['src','href'].includes(property(parent.left));
    if(!['CallExpression','NewExpression'].includes(parent?.type))return false;
    const callee=parent.callee,name=callee?.type==='Identifier'?callee.name:property(callee);
    if(name==='setAttribute')return parent.arguments[1]===node&&['src','href'].includes(parent.arguments[0]?.value);
    return (name==='importScripts'||parent.arguments[0]===node)&&['fetch','importScripts','URL','Worker','SharedWorker','register'].includes(name);
  };
  function visit(node,parent){
    if(!node||typeof node!=='object')return;
    const value=node.type==='Literal'&&typeof node.value==='string'?node.value:node.type==='TemplateLiteral'&&!node.expressions.length?node.quasis[0].value.cooked:null;
    if(value&&!value.startsWith('/')&&!/^[a-z]+:/i.test(value)&&urlArgument(parent,node)){
      const [,pathname,suffix]=value.match(/^([^?#]*)(.*)$/);
      const original=posix.resolve(posix.dirname(path),pathname),renamed=aliases[original];
      if(renamed){let relative=posix.relative(posix.dirname(path),renamed);if(value.startsWith('./'))relative='./'+relative;edits.push({start:node.start,end:node.end,text:JSON.stringify(relative+suffix)});}
    }
    for(const [key,value] of Object.entries(node)){if(key==='parent')continue;if(Array.isArray(value))for(const child of value)visit(child,node);else if(value&&typeof value==='object')visit(value,node);}
  }
  visit(tree,null);for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);return source;
}
export function rewriteFrontendReferences(source,path,aliases) {
  source=rewriteStorageNames(source);
  const directory=posix.dirname(path);
  for(const [original,renamed] of Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length)) {
                                                                        
                                                                               
    const escaped=original.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    source=source.replace(new RegExp(escaped+'(?![\\w./%+-])','g'),()=>renamed);
    if(/\.(?:js|mjs)$/.test(path))continue;
    const relative=posix.relative(directory,original),replacement=posix.relative(directory,renamed);
    for(const prefix of relative.startsWith('.')?['']:['','./']) {
      const from=prefix+relative,to=prefix+replacement;
      for(const quote of ['"',"'",'`']) {
        source=source.split(quote+from+quote).join(quote+to+quote);
        source=source.split(quote+from+'?').join(quote+to+'?');
      }
    }
  }
  return /\.(?:js|mjs)$/.test(path)?rewriteRelativeScriptUrls(source,path,aliases):source;
}
export async function buildFrontendAssets(output,files,lessonHtml) {
  const existing=JSON.parse(await readFile(join(output,'proxy-assets.json'),'utf8')).aliases;
  const candidates=[...new Set(files)].filter(p=>/\.(js|mjs)$/.test(p)&&!p.startsWith('assets/ugs/')&&!p.startsWith('assets/vendor/')&&!existing['/'+p]&&p!=='runtime-config.js');
  const aliases=Object.fromEntries(candidates.map(p=>['/'+p,alias('/'+p)]));
  if(files.includes('assets/games/index.html'))aliases['/assets/games/index.html']=q6b413;
                                                                                     
  for(const path of [...new Set(files)].filter(p=>/\.(html|js|mjs)$/.test(p)&&!p.startsWith('assets/ugs/')&&!p.startsWith('assets/vendor/'))) {
    let source;try{source=await readFile(join(output,path),'utf8');}catch{continue;}
    source=rewriteFrontendReferences(source,'/'+path,aliases);
    await writeFile(join(output,path),source);
    if(aliases['/'+path])await writeFile(join(output,aliases['/'+path].slice(1)),source);
  }
  const pages=[...new Set(files)].filter(p=>p.endsWith('.html')&&!p.startsWith('assets/ugs/')&&!p.startsWith('assets/vendor/'));
  const publishedPages={};
  for(const path of pages) {
    const original=await readFile(join(output,path),'utf8');
    const loader=posix.join(posix.dirname('/'+path),'@r'+createHash('sha256').update('entry:'+path).digest('hex').slice(0,24)+'!.js');
                                                                                      
    const payload=Buffer.from(original).toString('base64').match(/.{1,112}/g)||[];
    const migrate=['index.html','apps/tutsi/index.html','apps/drop/index.html'].includes(path)
      ? `await (${migrateStorage.toString()})(JSON.parse(atob(${JSON.stringify(Buffer.from(JSON.stringify(storageNames)).toString('base64'))})));` : '';
    const q51ea=path==='assets/games/index.html';
    const boot=`(async()=>{${migrate}await new Promise(resolve=>{const settle=()=>setTimeout(resolve,0);if(document.readyState==='complete')settle();else window.addEventListener('load',settle,{once:true});});${q51ea?`await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,1000)));history.replaceState(history.state,'',${JSON.stringify(q6b413)}+location.search+location.hash);`:''}const html=new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(payload)}.join('')),c=>c.charCodeAt(0)));document.open();document.write(html);document.close()})().catch(()=>{const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='Saved browser data could not be updated. Close other site tabs and reload.';document.body.prepend(p)});`;
                                                                            
                                                                             
    await writeFile(join(output,loader.slice(1)),(await minify(boot,{mangle:{toplevel:true},compress:false,format:{beautify:false}})).code);
    const shell=q51ea?q73d92.replace('</body>',`<script src="${loader}"></script></body>`):!['apps/tutsi/index.html','apps/drop/index.html'].includes(path)
      ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N7X</title><link rel="icon" href="/assets/icons/nyx-cat-moon-small.svg?v=3"></head><body><script src="${loader}"></script></body></html>`
      : lessonHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replaceAll('/learning/','/apps/tutsi/studyready/').replace('</body>',`<script src="${loader}"></script></body>`);
    await writeFile(join(output,path),shell);
    if(q51ea)await writeFile(join(output,q6b413.slice(1)),shell);
    publishedPages[path]={loader,sha256:createHash('sha256').update(original).digest('hex'),bytes:Buffer.byteLength(original)};
  }
  await writeFile(join(output,'published-pages.json'),JSON.stringify({version:1,pages:publishedPages}));
  await writeFile(join(output,'frontend-assets.json'),JSON.stringify({version:1,aliases}));
  console.log(`Frontend build: ${candidates.length} stable script aliases; ${pages.length} encoded first-party documents.`);
}

export async function unpackPublishedDocument(output,entry) {
  const source=await readFile(join(output,entry.loader.slice(1)),'utf8');
  let document;
  function visit(node) {
    if(!node || typeof node!=='object')return;
    if(node.type==='ArrayExpression' && node.elements.length && node.elements.every(item=>item?.type==='Literal'&&typeof item.value==='string')) {
      const bytes=Buffer.from(node.elements.map(item=>item.value).join(''),'base64');
      if(bytes.length===entry.bytes && createHash('sha256').update(bytes).digest('hex')===entry.sha256)document=bytes.toString('utf8');
    }
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
  }
  visit(parse(source,{ecmaVersion:'latest'}));
  if(document===undefined)throw Error('Published document payload does not match its manifest.');
  return document;
}
