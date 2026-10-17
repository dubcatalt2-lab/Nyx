import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'parse5';
export async function buildInterfaceText(output) {
 const files=[];
 async function walk(dir=''){for(const entry of await readdir(join(output,dir),{withFileTypes:true})){const path=dir?dir+'/'+entry.name:entry.name;if(entry.isDirectory()){if(!/^(?:assets\/(?:ugs|vendor)|scramjet|controller|baremux|libcurl|epoxy)/.test(path))await walk(path);}else if(path.endsWith('.html'))files.push(path);}}
 await walk();let count=0;
 // parse5 treats a leading BOM as body text, unlike browser HTML decoding.
 // Strip it before locating the real head or BOM-prefixed app pages get skipped.
 for(const file of files){let source=(await readFile(join(output,file),'utf8')).replace(/^\uFEFF/,'');const ast=parse(source,{sourceCodeLocationInfo:true});let head;
 const visit=node=>{if(node.tagName==='head')head=node;for(const child of node.childNodes||[])visit(child);};visit(ast);
 if(!head?.sourceCodeLocation?.endTag)continue;
 const at=head.sourceCodeLocation.endTag.startOffset;
 source=source.slice(0,at)+'<script defer src="/js/interface-text.js"></script>\n'+source.slice(at);
 await writeFile(join(output,file),source);count++;
 }
 console.log(`Interface presentation: ${count} first-party pages; Unicode chrome with plain accessible labels and unchanged input values.`);
}
