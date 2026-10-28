import {parse} from 'parse5';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const terms=/\b(?:scramjet(?:\s+v?\d+)?|web\s+proxy|proxy|unblocked|bypass|free\s+games|play\s+now)\b/gi;
const neutral=text=>text.replace(terms,term=>/play\s+now/i.test(term)?'Open activity':/free\s+games/i.test(term)?'Study activities':/scramjet/i.test(term)?'Learning tools':/proxy/i.test(term)?'connection':/bypass/i.test(term)?'Access':'Available');
const protectedTags=new Set(['style','script','code','pre','textarea','input','noscript','svg']);
export function neutralPublicCopy(source,path){
 const changes=[],tree=parse(source,{sourceCodeLocationInfo:true});
 const title='Tutoring '+createHash('sha256').update(path).digest('hex').slice(0,6);
 const edit=(start,end,text)=>{if(source.slice(start,end)!==text)changes.push({start,end,text});};
 function visit(node,protectedText=false,inTitle=false){
  const legal=(node.attrs||[]).some(a=>['id','class'].includes(a.name)&&/license|copyright|attribution|credits/i.test(a.value));
  const blocked=protectedText||protectedTags.has(node.tagName)||legal;
  if(node.nodeName==='#text'&&!blocked&&node.sourceCodeLocation){
   const {startOffset:start,endOffset:end}=node.sourceCodeLocation;
   const text=source.slice(start,end);if(!/copyright|©|licen[cs]e/i.test(text))edit(start,end,inTitle&&terms.test(text)?title:neutral(text));terms.lastIndex=0;
  }
  if(!blocked)for(const attr of node.attrs||[]){
   const meta=node.tagName==='meta'&&attr.name==='content'&&(node.attrs||[]).some(a=>['name','property'].includes(a.name)&&/^(?:description|keywords|(?:og|twitter):(?:title|description))$/i.test(a.value));
   if(!(meta||attr.name==='title'))continue;
   const at=node.sourceCodeLocation?.attrs?.[attr.name];if(!at)continue;
   const original=source.slice(at.startOffset,at.endOffset);edit(at.startOffset,at.endOffset,neutral(original));
  }
  for(const child of node.childNodes||[])visit(child,blocked,inTitle||node.tagName==='title');
  if(node.content)visit(node.content,blocked,inTitle);
 }
 visit(tree);for(const change of changes.sort((a,b)=>b.start-a.start))source=source.slice(0,change.start)+change.text+source.slice(change.end);
 return source;
}
export async function buildPublicCopy(output){
 let changed=0;
 async function walk(dir=''){for(const item of await readdir(join(output,dir),{withFileTypes:true})){
  const path=dir?dir+'/'+item.name:item.name;
  if(item.isDirectory()){if(!/^(?:assets\/vendor|scramjet|controller|baremux|libcurl|epoxy)(?:\/|$)/.test(path))await walk(path);}
  else if(path.endsWith('.html')){const file=join(output,path),before=await readFile(file,'utf8'),after=neutralPublicCopy(before,path);if(after!==before){await writeFile(file,after);changed++;}}
 }}
 await walk();console.log(`Public copy: ${changed} documents updated; scripts, external URLs, inputs and required notices preserved.`);
}
