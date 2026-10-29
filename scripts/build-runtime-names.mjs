import {readFileSync} from 'node:fs';
export const runtimeHookNames=JSON.parse(readFileSync(new URL('./runtime-hook-names.json',import.meta.url),'utf8'));
                                                                             
                                                                          
export const runtimeContentPrefix = '/p8d31e6/';
export const runtimeNames = {scramjet:'r94c6a12', Scramjet:'R94c6a12', SCRAMJET:'R94C6A12', libcurl:'r7d902a', Libcurl:'R7d902a', LibCurl:'R7D902a', LIBCURL:'R7D902A'};
export function renameRuntimeText(source) {
  for(const [before,after] of Object.entries(runtimeHookNames).sort((a,b)=>b[0].length-a[0].length)) source=source.split(before).join(after);
  return source.replace(/scramjet|studyjet|libcurl/gi, name => runtimeNames[name] || (name.toLowerCase() === 'studyjet' ? runtimeNames.scramjet : runtimeNames[name.toLowerCase()]));
}
export function renameRuntimeWasm(bytes) {
  if (!WebAssembly.validate(bytes)) throw Error('Invalid input runtime WASM');
  const result = Buffer.from(renameRuntimeText(Buffer.from(bytes).toString('latin1')), 'latin1');
  if (result.length !== bytes.length || !WebAssembly.validate(result)) throw Error('Invalid renamed runtime WASM');
  return result;
}
export function rewriteRuntimeNames(source) {
                                                                               
                                                                              
  source = source.replace(/AGFzbQE[A-Za-z0-9+/]*={0,2}/g, encoded => {
    const bytes = Buffer.from(encoded, 'base64');
    return bytes.length > 8 && WebAssembly.validate(bytes) ? renameRuntimeWasm(bytes).toString('base64') : encoded;
  });
                                                   
  // Persisted keys and state versions must survive a cosmetic runtime rename.
  const savedContracts=[];
  source=source.replace(/(["'`])(nyx[.-][^"'`\r\n]*(?:scramjet|libcurl)[^"'`\r\n]*)\1/g,(whole,quote,value)=>{
    const previous=value.replace(/scramjet|libcurl/gi,name=>name.toLowerCase()==='scramjet'?'st7dyj3t':'textlib');
    return '__SAVED_CONTRACT_'+(savedContracts.push(quote+previous+quote)-1)+'__';
  });
  const notices=[];
  source=source.replace(/\/\*[\s\S]*?\*\//g, text => /@license|@preserve|^\/\*!/.test(text) ? '__RUNTIME_NOTICE_'+(notices.push(text)-1)+'__' : text);
  source=renameRuntimeText(source).replaceAll('/~/sj-v1/','/~/study-v1/').replaceAll('/~/sj/',runtimeContentPrefix).replaceAll('/~sj/','/~study/');
                                                                             
                                                                       
  source=source.replaceAll('bare-mux-worker','ridgewood-stem-worker');
                                                                              
                                                                               
                                                                    
  source=source.replaceAll(String.raw`~\/sj\/`,String.raw`p8d31e6\/`)
    .replaceAll(String.raw`~\/sj-v1\/`,String.raw`~\/study-v1\/`)
    .replaceAll(String.raw`~sj\/`,String.raw`~study\/`)
    .replaceAll(String.raw`~\/(?:sj|tm)\/`,String.raw`(?:p8d31e6|~\/tm)\/`);
  source=source.replace(/__SAVED_CONTRACT_(\d+)__/g,(_,index)=>savedContracts[Number(index)]);
  return source.replace(/__RUNTIME_NOTICE_(\d+)__/g, (_,index)=>notices[Number(index)]);
}
