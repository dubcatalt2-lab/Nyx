import {readFile, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {brotliCompress, gzip, constants} from 'node:zlib';
import {promisify} from 'node:util';

const compressBrotli=promisify(brotliCompress),compressGzip=promisify(gzip);
const names=new Map([['/','index.html'],['/boot/start.js','worker.js'],['/boot/client.js','client.js'],['/boot/runtime.js','runtime.js']]);

function encoding(header=''){
  const weights=new Map();
  for(const entry of header.toLowerCase().split(',')){
    const [name,...parameters]=entry.trim().split(';');
    const quality=parameters.find(value=>value.trim().startsWith('q='));
    const value=quality===undefined?1:Number(quality.trim().slice(2));
    weights.set(name,Number.isFinite(value)&&value>=0&&value<=1?value:0);
  }
  const weight=name=>weights.get(name)??weights.get('*')??0;
  const choices=[['br',weight('br')],['gzip',weight('gzip')],['identity',weights.get('identity')??(weights.get('*')===0?0:0.001)]];
  return choices.sort((a,b)=>b[1]-a[1]).find(([,value])=>value>0)?.[0];
}

export function assets(directory=new URL('./dist/',import.meta.url)){
  const cache=new Map();
  async function load(name){
    const path=new URL(name,directory),info=await stat(path,{bigint:true});
    const key=[info.size,info.mtimeNs,info.ctimeNs,info.ino].join(':');
    let entry=cache.get(name);
    if(!entry||entry.key!==key){
      entry={key,promise:readFile(path).then(bytes=>({bytes,hash:createHash('sha256').update(bytes).digest('hex'),encoded:new Map()}))};
      cache.set(name,entry);
      entry.promise.catch(()=>{if(cache.get(name)===entry)cache.delete(name);});
    }
    return entry.promise;
  }
  return async(request,response,path)=>{
    const name=names.get(path);
    if(!name){response.writeHead(404);response.end('Not found');return;}
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{allow:'GET, HEAD'});response.end();return;}
    const kind=encoding(request.headers['accept-encoding']);
    if(!kind){response.writeHead(406,{vary:'Accept-Encoding'});response.end();return;}
    const value=await load(name);
    const etag='"'+value.hash+'-'+kind+'"';
    const headers={'content-type':name.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8','cache-control':'no-cache','etag':etag,'vary':'Accept-Encoding','service-worker-allowed':'/content/','x-content-type-options':'nosniff'};
    if(kind!=='identity')headers['content-encoding']=kind;
    const matches=String(request.headers['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag);
    if(matches){response.writeHead(304,headers);response.end();return;}
    let bytes=value.bytes;
    if(kind!=='identity'){
      if(!value.encoded.has(kind)){
        const result=kind==='br'?compressBrotli(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}):compressGzip(bytes,{level:6});
        value.encoded.set(kind,result);
        result.catch(()=>value.encoded.delete(kind));
      }
      bytes=await value.encoded.get(kind);
    }
    response.writeHead(200,{...headers,'content-length':bytes.length});
    response.end(request.method==='HEAD'?undefined:bytes);
  };
}
