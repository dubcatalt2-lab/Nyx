import {readdir,readFile} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
const root=resolve(process.argv[2]||'dist');let files=0;const findings=[];
async function visit(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(entry.isDirectory()){await visit(path);continue;}
  if(!/\.(?:[mc]?js|json|html?|css|txt|docx)$/i.test(path))continue;
  const text=await readFile(path,'utf8');files++;
  if(/(?:https?:)?\/\/[\w.-]*jsdelivr\.net(?:[/:]|$)/i.test(text))findings.push(relative(root,path));
 }
}
for(const dir of ['assets/ugs','assets/games','assets/gn-math','assets/gms-games'])await visit(join(root,dir));
console.log(JSON.stringify({check:'game source delivery',files,cdnTargets:findings.length,findings},null,2));
if(findings.length)process.exitCode=1;
