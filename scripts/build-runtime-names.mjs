import {readFileSync} from 'node:fs';
export const runtimeHookNames=JSON.parse(readFileSync(new URL('./runtime-hook-names.json',import.meta.url),'utf8'));
                                                                             
                                                                          
export const runtimeNames = {scramjet:'studyjet', Scramjet:'StudyJet', SCRAMJET:'STUDYJET', libcurl:'textlib', Libcurl:'Textlib', LibCurl:'TextLib', LIBCURL:'TEXTLIB', epoxy:'atlas', Epoxy:'Atlas', EPOXY:'ATLAS'};
export function renameRuntimeText(source) {
  for(const [before,after] of Object.entries(runtimeHookNames).sort((a,b)=>b[0].length-a[0].length)) source=source.split(before).join(after);
  return source.replace(/scramjet|libcurl|epoxy/gi, name => runtimeNames[name] || runtimeNames[name.toLowerCase()]);
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
                                                   
  const notices=[];
  source=source.replace(/\/\*[\s\S]*?\*\//g, text => /@license|@preserve|^\/\*!/.test(text) ? '__RUNTIME_NOTICE_'+(notices.push(text)-1)+'__' : text);
  source=renameRuntimeText(source).replaceAll('/~/sj-v1/','/~/study-v1/').replaceAll('/~/sj/','/4otig/').replaceAll('/~sj/','/~study/');
                                                                             
                                                                       
  source=source.replaceAll('bare-mux-worker','ridgewood-stem-worker');
                                                                              
                                                                               
                                                                    
  source=source.replaceAll(String.raw`~\/sj\/`,String.raw`4otig\/`)
    .replaceAll(String.raw`~\/sj-v1\/`,String.raw`~\/study-v1\/`)
    .replaceAll(String.raw`~sj\/`,String.raw`~study\/`)
    .replaceAll(String.raw`~\/(?:sj|tm)\/`,String.raw`(?:4otig|~\/tm)\/`);
  return source.replace(/__RUNTIME_NOTICE_(\d+)__/g, (_,index)=>notices[Number(index)]);
}
