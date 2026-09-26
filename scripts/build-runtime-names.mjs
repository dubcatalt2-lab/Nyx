// Keep substitutions byte-for-byte the same length: the compiler's WASM data
// segments contain runtime hook names as well as its import/export names.
export const runtimeNames = {scramjet:'studyjet', Scramjet:'StudyJet', SCRAMJET:'STUDYJET', libcurl:'textlib', Libcurl:'Textlib', LibCurl:'TextLib', LIBCURL:'TEXTLIB', epoxy:'atlas', Epoxy:'Atlas', EPOXY:'ATLAS'};
export function renameRuntimeText(source) {
  return source.replace(/scramjet|libcurl|epoxy/gi, name => runtimeNames[name] || runtimeNames[name.toLowerCase()]);
}
export function renameRuntimeWasm(bytes) {
  if (!WebAssembly.validate(bytes)) throw Error('Invalid input runtime WASM');
  const result = Buffer.from(renameRuntimeText(Buffer.from(bytes).toString('latin1')), 'latin1');
  if (result.length !== bytes.length || !WebAssembly.validate(result)) throw Error('Invalid renamed runtime WASM');
  return result;
}
export function rewriteRuntimeNames(source) {
  // Transports bundle WASM in both raw base64 and data-URL literals. Patch the
  // binary too, otherwise the renamed JS import/export contracts cannot link.
  source = source.replace(/AGFzbQE[A-Za-z0-9+/]*={0,2}/g, encoded => {
    const bytes = Buffer.from(encoded, 'base64');
    return bytes.length > 8 && WebAssembly.validate(bytes) ? renameRuntimeWasm(bytes).toString('base64') : encoded;
  });
  // Preserve third-party license notices verbatim.
  const notices=[];
  source=source.replace(/\/\*[\s\S]*?\*\//g, text => /@license|@preserve|^\/\*!/.test(text) ? '__RUNTIME_NOTICE_'+(notices.push(text)-1)+'__' : text);
  source=renameRuntimeText(source).replaceAll('/~/sj-v1/','/~/study-v1/').replaceAll('/~/sj/','/~/study/').replaceAll('/~sj/','/~study/');
  return source.replace(/__RUNTIME_NOTICE_(\d+)__/g, (_,index)=>notices[Number(index)]);
}
