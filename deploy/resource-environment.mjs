import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function resourceEnvironmentDropIn(raw) {
  const rows=raw.trim().split(/\r?\n/).filter(Boolean);
  if(!rows.length)throw Error('Primary environment files are unavailable');
  const files=rows.map(row=>{
    const match=/^(\/etc\/nyx\/[A-Za-z0-9_.-]+\.env) \(ignore_errors=(yes|no)\)$/.exec(row);
    if(!match)throw Error('Unexpected primary environment file metadata');
    return (match[2]==='yes'?'-':'')+match[1];
  });
  return '[Service]\nEnvironmentFile=\n'+files.map(file=>'EnvironmentFile='+file+'\n').join('')+'EnvironmentFile=/etc/nyx/resources.env\n';
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.getuid?.()!==0)throw Error('Run as root');
  const text=resourceEnvironmentDropIn(execFileSync('systemctl',['show','nyx','-p','EnvironmentFiles','--value'],{encoding:'utf8'}));
  const dir='/etc/systemd/system/nyx-resources@.service.d';
  await mkdir(dir,{recursive:true});await writeFile(dir+'/10-primary-environment.conf',text,{mode:0o600});
  console.log('Resource units inherit the primary service environment files, followed by resource-root overrides.');
}
