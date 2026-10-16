import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let names;
export function zakaIdentifiers(){
 if(!names){
  const result=spawnSync(process.platform==='win32'?'python':'python3',[fileURLToPath(new URL('./zaka-identifiers.py',import.meta.url))],{encoding:'utf8',maxBuffer:2000000,timeout:30000});
  if(result.status!==0)throw Error('Zaka identifier generator failed: '+(result.error?.message||result.stderr));
  names=JSON.parse(result.stdout);
  if(names.length!==65000||new Set(names).size!==names.length||names.some(name=>!/^__\d{5}$/.test(name)))throw Error('Invalid Zaka identifiers');
 }
 return {get(index){if(!names[index])throw Error('Zaka identifier capacity exceeded');return names[index];}};
}
export const zakaEnabled=process.env.NYX_ZAKA_OBFUSCATION!=='0';
