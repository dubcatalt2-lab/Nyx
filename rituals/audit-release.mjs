import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse as parseHtml} from 'parse5';
import {inspectCode} from './audit-code.mjs';
import {gunzipSync} from 'node:zlib';

const signatures=/ultraviolet|__uv|uv-iframe|uv\.(?:config|bundle|sw|handler)|bare-mux|baremux|bareclient|bare-client|libcurl|epoxy|wisp|scramjet|scram|rammerhead|fern|daydream|phproxy|glype|rewriteHTML|rewriteCSS|rewriteJS|rewriteUrl|proxyUrl|unproxyUrl|encodeUrl|decodeUrl|setTransport/gi;
const prohibitedPaths=/uv|ultraviolet|bare|libcurl|epoxy|wisp|scram|rammerhead|rh|fern|daydream|phproxy|glype/i;
export const prohibitedDependency=/@mercuryworkshop\/|^(?:bare-mux|baremux|bare-client|libcurl(?:\.js|-transport)?|epoxy(?:-tls|-transport)?|wisp(?:urr)?|scramjet(?:-controller)?|ultraviolet|rammerhead|fern|daydream)$/i;
const engineReference=/(?:@mercuryworkshop\/|\bBareMuxConnection\b|\bBareClient\b|\bScramjetController\b|\$scramjet|__uv\$|\bUVServiceWorker\b|\bUVClient\b|^(?:scramjet|bare-mux|baremux|epoxy|libcurl|wispurr|wisp|ultraviolet|rammerhead)$)/i;
const digest=value=>createHash('sha256').update(value).digest('hex');
const evidenceFile=fileURLToPath(new URL('../scrolls/release-evidence.json',import.meta.url));
const binaryTypes=new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.wasm','.woff','.woff2','.ttf','.mp3','.ogg','.wav','.zip','.pdf']);
export async function auditRelease(root,{evidencePath=evidenceFile}={}){
  root=resolve(root);
  let evidence=[];
  try{evidence=JSON.parse(await readFile(evidencePath,'utf8')).reviews||[]}catch(error){if(error.code!=='ENOENT')throw error}
  const report={root,files:0,counts:{atob:0,eval:0,Function:0},calls:[],nonGlobalFunctionMethods:[],matches:[],findings:[],paths:[],parseErrors:[],unreadable:[],sourceMaps:[],embeddedPrograms:[],classified:[],limits:{atob:6,eval:2,Function:2}};
  async function walk(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      if(entry.name==='.git')continue;
      const file=resolve(directory,entry.name);
      if(entry.isDirectory()){await walk(file);continue}
      if(!entry.isFile())continue;
      const name=relative(root,file).replaceAll('\\','/');report.files++;
      if(prohibitedPaths.test(name))report.paths.push(name);
      if(name.endsWith('.map'))report.sourceMaps.push(name);
      let bytes;try{bytes=await readFile(file)}catch(error){report.unreadable.push({file:name,code:error.code});continue}
      const sha256=digest(bytes),binary=binaryTypes.has(extname(name).toLowerCase())||bytes.subarray(0,2).toString()==='PK';
      const text=bytes.toString(binary?'latin1':'utf8');
      const records=[],identifiers=[];
      function scan(value,section,base=0){
        for(const match of value.matchAll(signatures)){
          const context=value.slice(Math.max(0,match.index-64),match.index+match[0].length+64);
          const record={file:name,sha256,section,offset:base+match.index,value:match[0],context,contextHash:digest(context)};
          records.push(record);report.matches.push(record);
        }
      }
      scan(text,binary?'binary strings':'raw');
      function inspect(code,section,offset=0,mode){
        try{
          const result=inspectCode(code,{mode,offset});for(const identifier of result.identifiers)identifiers.push(identifier);
          for(const map of result.sourceMaps)report.sourceMaps.push({file:name,section,offset:map.start});
          for(const identifier of result.identifiers)if(engineReference.test(identifier.value))report.findings.push({file:name,section:'executable identifier',value:identifier.value,offset:identifier.start});
          for(const call of result.calls){report.counts[call.name]++;report.calls.push({file:name,section,...call})}
          report.nonGlobalFunctionMethods.push(...result.methods.map(method=>({file:name,section,...method})));
          for(const literal of result.strings){
            if(engineReference.test(literal.value))report.findings.push({file:name,section:'engine reference',offset:literal.start,value:literal.value.slice(0,200)});
            scan(literal.value,'decoded string',literal.start);
            if(literal.value.length<8*1024*1024){
              const payload=/^data:(?:text\/(?:html|javascript)|application\/(?:javascript|wasm));base64,([\s\S]+)$/.exec(literal.value);
              if(payload)scan(Buffer.from(payload[1],'base64').toString('latin1'),'decoded payload',literal.start);
            }
          }
        }catch(error){report.parseErrors.push({file:name,section,message:error.message})}
      }
      if(/\.[mc]?js$/i.test(name))inspect(text,'script',0,name.endsWith('.mjs')?'module':undefined);
      if(!binary&&(/\.html?$/i.test(name)||/\.(?:txt|docx)$/i.test(name)&&/<(?:html|script)\b/i.test(text))){
        const visit=node=>{
          if(node.tagName==='style'){
            const content=node.childNodes.map(c=>c.value||'').join('').trim();
            if(content.startsWith('data:application/octet-stream;base64,H4sI')){
              try{
                const expanded=gunzipSync(Buffer.from(content.slice(content.indexOf(',')+1),'base64'),{maxOutputLength:64*1024*1024});
                report.embeddedPrograms.push({file:name,sha256:digest(expanded),bytes:expanded.length,encoding:'gzip'});
                inspect(expanded.toString('utf8'),'gzip program');
              }catch(error){report.parseErrors.push({file:name,section:'gzip program',message:error.message})}
            }
          }
          if(node.tagName==='script'&&!node.attrs.some(a=>a.name==='src')){
            const type=node.attrs.find(a=>a.name==='type')?.value||'';
            if(/^(?:module|(?:text|application)\/(?:java|ecma)script)?$/i.test(type))inspect(node.childNodes.map(c=>c.value||'').join(''),'inline '+node.sourceCodeLocation?.startLine,node.sourceCodeLocation?.startTag.endOffset||0,type==='module'?'module':'script');
          }
          node.childNodes?.forEach(visit);if(node.content)visit(node.content);
        };visit(parseHtml(text,{sourceCodeLocationInfo:true}));
      }
      for(const record of records){
        const identifier=record.section==='raw'&&identifiers.find(n=>n.start<=record.offset&&n.end>=record.offset+record.value.length);
        if(identifier&&/^(?:bufferNyxConsoleEntry|deferNyxVisualDockRecovery|prefernowplayingvideo|bufferNext|bufferNextSN|bufferNextTick|bufferNotFound)$/i.test(identifier.value)){
          report.classified.push({...record,reason:'Identifier word boundary: '+identifier.value});continue;
        }
        const review=!engineReference.test(record.context)&&evidence.find(item=>item.sha256===sha256&&item.matches?.some(match=>match.section===record.section&&match.contextHash===record.contextHash)&&typeof item.evidence==='string'&&item.evidence.length>30);
        if(review){report.classified.push({...record,reason:review.evidence});continue}
        report.findings.push(record);
      }
    }
  }
  await walk(root);
  report.passed=!report.findings.length&&!report.paths.length&&!report.parseErrors.length&&!report.unreadable.length&&!report.sourceMaps.length&&Object.entries(report.limits).every(([name,limit])=>report.counts[name]<=limit);
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(process.argv[2]||'dist'),path=process.argv[3]||resolve('.codex-artifacts/release-audit.json');
  const report=await auditRelease(root);
  await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,files:report.files,counts:report.counts,nonGlobalFunctionMethods:report.nonGlobalFunctionMethods.length,rawMatches:report.matches.length,classified:report.classified.length,blockingFindings:report.findings.length,pathMatches:report.paths.length,parseErrors:report.parseErrors.length,unreadable:report.unreadable.length,sourceMaps:report.sourceMaps.length,embeddedPrograms:report.embeddedPrograms.length,report:path},null,2));
  if(!report.passed)process.exitCode=1;
}
