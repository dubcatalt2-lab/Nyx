import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

let seed;
function buildSeed(){
  if(seed)return seed;
  const result=spawnSync(process.platform==='win32'?'python':'python3',[
    fileURLToPath(new URL('./zaka-identifiers.py',import.meta.url))
  ],{encoding:'utf8',maxBuffer:65536});
  if(result.status!==0)throw Error('Zaka identifier generator failed: '+(result.error?.message||result.stderr));
  const values=JSON.parse(result.stdout);
  if(values.length!==256||values.some(value=>!/^__\d{5}$/.test(value)))throw Error('Invalid Zaka identifier seed');
  seed=values.join(':');
  return seed;
}

export function zakaIdentifiers(source=''){
  const entropy=buildSeed();
  const occupied=new Set(String(source).match(/__[a-zA-Z0-9_]+/g)||[]);
  const allocated=new Map();
  return {
    get(index){
      if(!Number.isSafeInteger(index)||index<0)throw new RangeError('Invalid identifier index');
      if(allocated.has(index))return allocated.get(index);
      let attempt=0,name;
      do{
        name='__'+createHash('sha256').update(`${entropy}:${index}:${attempt++}`).digest('hex');
      }while(occupied.has(name));
      occupied.add(name);
      allocated.set(index,name);
      return name;
    }
  };
}
export const zakaEnabled=process.env.NYX_ZAKA_OBFUSCATION!=='0';
