import {parse} from 'acorn';
import {parse as parseHtml} from 'parse5';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join,posix} from 'node:path';

export function opaqueIdentifiers(seed='workspace') {
  const prefix='_0x'+createHash('sha256').update(seed).digest('hex').slice(0,6)+'_';
  return {get:index=>prefix+index.toString(16)};
}

const marker='/__NYX_STATIC_BASE__/';
export const protectedIdentifierNames=/(?:proxy|browse|scramjet|inject|studyhub|baretransport|baremux|registersw)/i;
function escapedIdentifier(value) {
  return Array.from(value,character=>'\\u{'+character.codePointAt(0).toString(16)+'}').join('');
}
function escaped(value) {
  return value.split(marker).map(part=>Array.from({length:part.length},(_,index)=>{
    const code=part.charCodeAt(index);
    return code<256?'\\x'+code.toString(16).padStart(2,'0'):'\\u'+code.toString(16).padStart(4,'0');
  }).join('')).join(marker);
}
function signature(node) {
  return JSON.stringify(node,(key,value)=>['start','end','loc','range','raw'].includes(key)?undefined:typeof value==='bigint'?{bigint:String(value)}:value);
}
function parseJs(source) {
  try{return parse(source,{ecmaVersion:'latest',sourceType:'script',allowReturnOutsideFunction:true});}
  catch{return parse(source,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true});}
}
export function transformWorkspaceStrings(source,{decode=false}={}) {
  const tree=parseJs(source),edits=[];
  const walk=(node,parent)=>{
    if(!node||typeof node!=='object')return;
    if(node.type==='Literal'&&typeof node.value==='string'&&!parent?.directive) {
      const value=node.value;
      if(!decode&&(value.startsWith('data:')||/^[A-Za-z0-9+/]{96,}={0,2}$/.test(value)))return;
      edits.push({start:node.start,end:node.end,text:decode?JSON.stringify(value).replaceAll('<','\\u003c'):'"'+escaped(value)+'"'});
    }
    if((node.type==='Identifier'||node.type==='PrivateIdentifier')&&protectedIdentifierNames.test(node.name)) {
      const start=node.start+(node.type==='PrivateIdentifier'?1:0);
      edits.push({start,end:node.end,text:decode?node.name:escapedIdentifier(node.name)});
    }
    if(node.type==='TemplateLiteral'&&parent?.type!=='TaggedTemplateExpression'){
      for(const quasi of node.quasis)if(quasi.value.cooked!==null)edits.push({start:quasi.start,end:quasi.end,text:decode?quasi.value.cooked.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${').replaceAll('\r','\\r').replaceAll('<','\\x3c'):escaped(quasi.value.cooked)});
    }
    for(const [key,value] of Object.entries(node)){
      if(key==='regex'||(key==='value'&&['Literal','TemplateElement'].includes(node.type)))continue;
      if(Array.isArray(value))for(const child of value)walk(child,node);
      else if(value&&typeof value==='object')walk(value,node);
    }
  };
  walk(tree,null);
  let end=source.length;const chunks=[];
  const unique=[...new Map(edits.map(edit=>[edit.start+':'+edit.end,edit])).values()];
  for(const edit of unique.sort((a,b)=>b.start-a.start)){
    if(edit.end>end)throw Error('Overlapping workspace source transformations');
    chunks.push(source.slice(edit.end,end),edit.text);end=edit.start;
  }
  chunks.push(source.slice(0,end));const result=chunks.reverse().join('');
  if(signature(tree)!==signature(parseJs(result)))throw Error('Workspace string transformation changed executable structure');
  return result;
}

export function scrambleInlineScripts(source,{decode=false}={}) {
  const tree=parseHtml(source,{sourceCodeLocationInfo:true}),edits=[];
  const walk=node=>{
    if(node.tagName==='script'&&!node.attrs.some(attr=>attr.name==='src')){
      const type=node.attrs.find(attr=>attr.name==='type')?.value?.toLowerCase()||'';
      const location=node.sourceCodeLocation;
      if(['','module','text/javascript','application/javascript'].includes(type)&&location?.endTag){
        const start=location.startTag.endOffset,end=location.endTag.startOffset;
        edits.push({start,end,text:transformWorkspaceStrings(source.slice(start,end),{decode})});
      }
    }
    for(const child of node.childNodes||[])walk(child);
    if(node.content)walk(node.content);
  };
  walk(tree);
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  return source;
}

export async function scrambleWorkspaceOutput(root) {
  let scripts=0,pages=0;
  async function visit(directory=''){
    for(const entry of await readdir(join(root,directory),{withFileTypes:true})){
      const file=posix.join(directory,entry.name);
      if(/^(?:assets\/(?:ugs|vendor)\/|apps\/jsdelivr-publisher\/static-package\/)/.test(file))continue;
      if(entry.isDirectory()){await visit(file);continue;}
      if(!/\.(?:js|html)$/.test(file)||['serve-mini.js','configure-host.js'].includes(file))continue;
      const source=await readFile(join(root,file),'utf8');
      try{
        const result=file.endsWith('.js')?transformWorkspaceStrings(source):scrambleInlineScripts(source);
        await writeFile(join(root,file),result);
      }catch(error){throw Error(file+': '+error.message,{cause:error});}
      if(file.endsWith('.js'))scripts++;else pages++;
    }
  }
  await visit();
  console.log(`Workspace strings: ${scripts} scripts and ${pages} pages verified against their parsed executable structure.`);
}
