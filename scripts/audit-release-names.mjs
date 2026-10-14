import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const terms=['nyx','studyhub','deltamath','scramjet','sjv2','ultraviolet','libcurl','baremux','bare-mux','epoxy','wispurr'];
const output='.codex-artifacts/name-audit';await mkdir(output,{recursive:true});
const source=[...new Set(execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8',maxBuffer:32*1024*1024}).split('\0').filter(Boolean))].filter(p=>!p.startsWith('dist/')&&!p.startsWith('node_modules/')&&!p.startsWith('.codex-artifacts/'));
async function walk(root,prefix=''){const all=[];for(const e of await readdir(join(root,prefix),{withFileTypes:true})){const p=prefix?prefix+'/'+e.name:e.name;if(e.isDirectory())all.push(...await walk(root,p));else if(e.isFile())all.push(p)}return all}
async function scan(root,files,label){const matches=[],missing=[];let bytes=0,binaryFiles=0;for(const file of files){
 const counts=Object.fromEntries(terms.map(t=>[t,0]));const hash=createHash('sha256');let tail='',size=0,binary=false;
 try{for await(const chunk of createReadStream(join(root,file))){hash.update(chunk);size+=chunk.length;if(size===chunk.length)binary=chunk.subarray(0,8192).includes(0);const data=tail+chunk.toString('latin1').toLowerCase();const keep=32;const end=Math.max(0,data.length-keep);for(const term of terms){let pos=data.indexOf(term);while(pos>=0&&pos<end){counts[term]++;pos=data.indexOf(term,pos+term.length)}}tail=data.slice(end)}
 for(const term of terms){let pos=tail.indexOf(term);while(pos>=0){counts[term]++;pos=tail.indexOf(term,pos+term.length)}}
 }catch(e){if(e.code==='ENOENT'){missing.push(file);continue}throw e}
 bytes+=size;if(binary)binaryFiles++;const pathTerms=terms.filter(t=>file.toLowerCase().includes(t));
 if(pathTerms.length||Object.values(counts).some(Boolean))matches.push({file,bytes:size,binary,sha256:hash.digest('hex'),pathTerms,counts});
 }
 const report={label,scope:root,fileCount:files.length-missing.length,bytes,binaryFiles,missing,totals:Object.fromEntries(terms.map(t=>[t,matches.reduce((n,m)=>n+m.counts[t],0)])),matchingFiles:matches.length,matches};
 await writeFile(`${output}/${label}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,matches:undefined}));return report;
}
await scan('.',source,'repository');await scan('dist',await walk('dist'),'generated-build');
