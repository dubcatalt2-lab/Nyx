import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {parse as parseJs} from 'acorn';
import {parse as parseHtml} from 'parse5';

// Only owned presentation copy is eligible. Protocols, selectors, storage and vendor code keep their names.
const root=resolve(process.argv.find(arg=>arg.startsWith('--root='))?.slice(7)||'.');
const apply=process.argv.includes('--write');
const files=[...new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean))];
const excluded=/^(?:scripts\/|assets\/(?:ugs|vendor|archives?)\/|(?:scramjet|controller|baremux|epoxy|libcurl)\/|apps\/blooket\/actions\/|static-export\/|index\.(?:accidental|backup)|package(?:-lock)?\.json$)|(?:^|\/)(?:LICENSE|COPYING|NOTICE|AGENTS)(?:\.|$)/i;
const copy=text=>text.split(/(https?:\/\/[^\s<>"']+|`[^`]*`|[\w.+-]+@[\w.-]+\.[a-z]{2,})/gi).map((part,index)=>index%2?part:part.replace(/(?<![\w./:@$#-])browser(?![\w/:@]|\.[\w])/gi,'br00ser')).join('');
const edits=(source,changes)=>{for(const [start,end,value] of changes.sort((a,b)=>b[0]-a[0]))source=source.slice(0,start)+value+source.slice(end);return source;};
function html(source){
 const changes=[];
 function walk(node,excludedText=false){
  const skip=excludedText||['style','code','pre','kbd','samp','textarea','input'].includes(node.tagName)||(node.attrs||[]).some(a=>a.name==='data-user-content');
  if(node.tagName==='script'){
   const start=node.sourceCodeLocation?.startTag?.endOffset,end=node.sourceCodeLocation?.endTag?.startOffset;
   if(start!=null&&end!=null){const before=source.slice(start,end);let after=before;
    if(node.attrs?.some(a=>a.name==='type'&&a.value==='application/ld+json')){
     try{const data=JSON.parse(before);function values(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(typeof item==='string'&&['name','description','headline'].includes(key))value[key]=copy(item);else values(item);}}values(data);if(JSON.stringify(data)!==JSON.stringify(JSON.parse(before)))after=JSON.stringify(data,null,2);}catch{}
    }else after=javascript(before);
    if(after!==before)changes.push([start,end,after]);
   }return;
  }
  if(node.nodeName==='#text'&&!skip&&node.sourceCodeLocation){const {startOffset,endOffset}=node.sourceCodeLocation;const before=source.slice(startOffset,endOffset),after=copy(before);if(after!==before)changes.push([startOffset,endOffset,after]);}
  for(const attr of node.attrs||[]){if(!['title','placeholder','label','content'].includes(attr.name)||skip)continue;if(attr.name==='content'&&!node.attrs.some(a=>['name','property'].includes(a.name)&&/description|title/.test(a.value)))continue;const loc=node.sourceCodeLocation?.attrs?.[attr.name];if(loc){const before=source.slice(loc.startOffset,loc.endOffset),after=copy(before);if(after!==before)changes.push([loc.startOffset,loc.endOffset,after]);}}
  for(const child of node.childNodes||[])walk(child,skip);
  if(node.content)walk(node.content,skip);
 }
 walk(parseHtml(source,{sourceCodeLocationInfo:true}));return edits(source,changes);
}
function javascript(source){
 let tree;try{tree=parseJs(source,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});}catch{return source;}
 const changes=[];
 function walk(node,parent){
  if(!node||typeof node!=='object')return;
  if(node.type==='CallExpression'&&node.callee.property?.name==='setAttribute'&&['aria-label','alt'].includes(node.arguments[0]?.value))return;
  if((node.type==='Literal'&&typeof node.value==='string')||node.type==='TemplateElement'){
   const start=node.start+(node.type==='Literal'?1:0),end=node.end-(node.type==='Literal'?1:0),before=source.slice(start,end);
   if(/\bbrowser\b/i.test(before)){
    const property=parent?.type==='Property'?(parent.key.name||parent.key.value):'';
    const technicalKey=(parent?.type==='Property'&&parent.key===node)||(parent?.type==='CallExpression'&&parent.callee.property?.name==='setAttribute'&&['aria-label','alt'].includes(parent.arguments[0]?.value));
    const prose=/\s/.test(before)&&!/[{};]|=>|\b(?:function|const|let|var)\b/.test(before);
    let after=before;
    if(!technicalKey&&!['value','id','key','type','selector','className','aria-label','alt'].includes(property)){
      if(/<[a-z!][\s\S]*>/i.test(before))after=html(before);
      else if(prose||['label','title','description','text','message','name','placeholder'].includes(property)||parent?.type==='AssignmentExpression'&&['textContent','innerText','placeholder','title'].includes(parent.left.property?.name))after=copy(before);
    }
    if(after!==before)changes.push([start,end,after]);
   }
   return;
  }
  for(const [key,value] of Object.entries(node)){if(key==='start'||key==='end')continue;if(Array.isArray(value))value.forEach(child=>walk(child,node));else if(value&&typeof value==='object')walk(value,node);}
 }
 walk(tree);return edits(source,changes);
}
let scanned=0;const changed=[];
for(const file of files){
 if(excluded.test(file)||!['.js','.mjs','.cjs','.html','.md','.txt','.webmanifest'].includes(extname(file)))continue;
 const path=resolve(root,file),before=readFileSync(path,'utf8');scanned++;
 if(!/\bbrowser\b/i.test(before))continue;
 let after=before;
 if(/\.(?:js|mjs|cjs)$/.test(file))after=javascript(before);
 else if(file.endsWith('.html'))after=html(before);
 else if(file.endsWith('.webmanifest')){const data=JSON.parse(before);for(const field of ['name','short_name','description'])if(typeof data[field]==='string')data[field]=copy(data[field]);if(JSON.stringify(data)!==JSON.stringify(JSON.parse(before)))after=JSON.stringify(data,null,2)+'\n';}
 else after=before.split(/(```[\s\S]*?```)/).map((part,index)=>index%2?part:copy(part)).join('');
 if(after!==before){if(/\.(?:js|mjs|cjs)$/.test(file))parseJs(after,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true});if(apply)writeFileSync(path,after);changed.push(file);}
}
console.log(JSON.stringify({scanned,changed:changed.length,files:changed,written:apply},null,2));
