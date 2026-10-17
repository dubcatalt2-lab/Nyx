import {mkdir,cp,readdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {awsTemplate} from '../static-export/aws-template.mjs';
const root=process.cwd(),dist=resolve(root,'dist');
const output=resolve(root,'.codex-artifacts','nyx-aws-'+Date.now());await mkdir(join(output,'site'),{recursive:true});
await cp(dist,join(output,'site'),{recursive:true,filter:source=>!source.includes(join('apps','jsdelivr-publisher','static-package'))&&!/\.(?:map|log)$/.test(source)});
await writeFile(join(output,'hosting.json'),JSON.stringify(awsTemplate(),null,2));
await cp(join(root,'static-export/upload-aws.mjs'),join(output,'upload.mjs'));
await cp(join(root,'THIRD_PARTY_NOTICES.md'),join(output,'THIRD_PARTY_NOTICES.md'));
await cp(join(root,'static-export/README-aws.txt'),join(output,'START-HERE.txt'));
const files=[];
async function scan(dir=''){for(const entry of await readdir(join(output,dir),{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())await scan(file);else{const bytes=await readFile(join(output,file));files.push({path:file.replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}
await scan();await writeFile(join(output,'manifest.json'),JSON.stringify({format:'nyx-connected-aws',files},null,2));
console.log(JSON.stringify({output,files:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0)}));
