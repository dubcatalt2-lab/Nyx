import {mkdir,readFile,writeFile,rename,readdir,stat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {Cookies} from './cookies.mjs';

export function sessionStore(directory){
  const entries=new Map();
  let maintenance,checked=0,files=0;
  async function capacity(){
    if(Date.now()-checked<300000){if(files>=10000)throw new Error('Document session capacity');return;}
    if(!maintenance)maintenance=(async()=>{
      await mkdir(directory,{recursive:true,mode:0o700});files=0;
      for(const name of await readdir(directory)){
        if(!/^[a-f0-9]{64}\.json(?:\.[a-f0-9]{16})?$/.test(name))continue;
        const path=join(directory,name),info=await stat(path).catch(()=>null);
        if(!info)continue;
        if(Date.now()-info.mtimeMs>30*86400000){await unlink(path);entries.delete(name.slice(0,64));}else files++;
      }
      checked=Date.now();
    })().finally(()=>{maintenance=null;});
    await maintenance;if(files>=10000)throw new Error('Document session capacity');
  }
  function remember(id,value){entries.delete(id);entries.set(id,value);if(entries.size>512)entries.delete(entries.keys().next().value);return value;}
  async function load(id){
    if(!entries.has(id)){
      const promise=readFile(join(directory,id+'.json'),'utf8').then(text=>new Cookies(JSON.parse(text))).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      remember(id,promise);
    }
    return entries.get(id);
  }
  const writes=new Map();
  async function save(id,cookies){
    const value=JSON.stringify(cookies.export());
    if(Buffer.byteLength(value)>2*1024*1024)throw new Error('Document cookie storage limit');
    const previous=writes.get(id)||Promise.resolve();
    const next=previous.catch(()=>{}).then(async()=>{
      await mkdir(directory,{recursive:true,mode:0o700});
      const file=join(directory,id+'.json'),temporary=file+'.'+randomBytes(8).toString('hex');
      await writeFile(temporary,value,{mode:0o600,flag:'wx'});await rename(temporary,file);
    });
    writes.set(id,next);
    try{await next;}finally{if(writes.get(id)===next)writes.delete(id);}
  }
  return {async get(header='',create=true){
    const supplied=/(?:^|;\s*)__Secure_document=([a-f0-9]{64})(?:;|$)/.exec(header)?.[1];
    let id=supplied,cookies=id?await load(id):null;
    const fresh=!cookies;
    if(!cookies){
      if(!create)throw new Error('Document session missing');
      await capacity();files++;
      id=randomBytes(32).toString('hex');cookies=new Cookies();remember(id,Promise.resolve(cookies));await save(id,cookies);
    }
    return {id,cookies,fresh,save:()=>save(id,cookies)};
  }};
}
