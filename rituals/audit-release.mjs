import {readFile, readdir, writeFile} from 'node:fs/promises';
import {resolve, relative, extname} from 'node:path';
import {parse} from 'acorn';
import {parse as parseHtml} from 'parse5';

const root=resolve(process.argv[2] || 'dist');
const reportPath=process.argv[3];
const signatures=/ultraviolet|__uv|uv-iframe|uv\.(?:config|bundle|sw|handler)|bare-mux|baremux|bareclient|bare-client|libcurl|epoxy|wisp|scramjet|scram|rammerhead|fern|daydream|phproxy|glype|rewriteHTML|rewriteCSS|rewriteJS|rewriteUrl|proxyUrl|unproxyUrl|encodeUrl|decodeUrl|setTransport/gi;
const paths=/uv|ultraviolet|bare|libcurl|epoxy|wisp|scram|rammerhead|rh|fern|daydream|phproxy|glype/i;
const textTypes=new Set(['.js','.mjs','.cjs','.html','.css','.json','.md','.txt','.xml','.svg','.map','.webmanifest']);
const report={root,files:0,counts:{atob:0,eval:0,Function:0},calls:[],matches:[],paths:[],parseErrors:[],unreadable:[],sourceMaps:[],classifiedBinary:[],limits:{atob:6,eval:2,Function:2}};
async function walk(directory){
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.name==='.git'||entry.name==='node_modules')continue;
    const file=resolve(directory,entry.name);
    if(entry.isDirectory())result.push(...await walk(file));
    else if(entry.isFile())result.push(file);
  }
  return result;
}
function inspect(code,file,section){
  let ast;
  try{ast=parse(code,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true,locations:true});}
  catch(error){report.parseErrors.push({file,section,message:error.message});return;}
  function visit(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='CallExpression'||node.type==='NewExpression'){
      let target=node.callee;
      if(target.type==='SequenceExpression')target=target.expressions.at(-1);
      let name=target.type==='Identifier'?target.name:target.type==='MemberExpression'?(target.computed?target.property.value:target.property.name):'';
      if(Object.hasOwn(report.counts,name)){report.counts[name]++;report.calls.push({file,section,line:node.loc.start.line,column:node.loc.start.column,name});}
    }
    if(node.type==='Literal'&&typeof node.value==='string')scan(node.value,file,'decoded string',node.start);
    for(const [key,value] of Object.entries(node)){
      if(key==='loc')continue;
      if(Array.isArray(value))value.forEach(visit);
      else if(value&&typeof value==='object')visit(value);
    }
  }
  visit(ast);
}
function scan(text,file,section,base=0){
  signatures.lastIndex=0;
  for(const match of text.matchAll(signatures))report.matches.push({file,section,offset:base+match.index,value:match[0]});
}
for(const file of await walk(root)){
  const name=relative(root,file).replaceAll('\\','/');
  report.files++;
  if(paths.test(name))report.paths.push(name);
  if(name.endsWith('.map'))report.sourceMaps.push(name);
  const extension=extname(name).toLowerCase();
  if(!textTypes.has(extension)&&extension!=='.wasm'){report.classifiedBinary.push(name);continue;}
  let bytes;
  try{bytes=await readFile(file);}catch(error){report.unreadable.push({file:name,code:error.code});continue;}
  const text=bytes.toString(extension==='.wasm'?'latin1':'utf8');
  scan(text,name,extension==='.wasm'?'binary strings':'raw');
  if(/\.[mc]?js$/.test(name))inspect(text,name,'script');
  if(extension==='.html'){
    const document=parseHtml(text,{sourceCodeLocationInfo:true});
    const visit=node=>{
      if(node.tagName==='script'&&!node.attrs.some(attribute=>attribute.name==='src')){
        const type=node.attrs.find(attribute=>attribute.name==='type')?.value || '';
        if(!type||/^(?:module|(?:text|application)\/javascript)$/i.test(type))inspect(node.childNodes.map(child=>child.value||'').join(''),name,'inline '+(node.sourceCodeLocation?.startLine||0));
      }
      node.childNodes?.forEach(visit);
    };
    visit(document);
  }
}
report.passed=!report.matches.length&&!report.paths.length&&!report.parseErrors.length&&!report.unreadable.length&&!report.sourceMaps.length&&Object.entries(report.limits).every(([name,limit])=>report.counts[name]<=limit);
if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,files:report.files,counts:report.counts,signatureMatches:report.matches.length,pathMatches:report.paths.length,parseErrors:report.parseErrors.length,unreadable:report.unreadable.length,sourceMaps:report.sourceMaps.length,report:reportPath||null},null,2));
if(!report.passed)process.exitCode=1;
