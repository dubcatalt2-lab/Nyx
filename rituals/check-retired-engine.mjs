import {readFileSync,readdirSync,statSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const self=fileURLToPath(import.meta.url);
const signatureFiles=new Set([self,fileURLToPath(new URL('./audit-release.mjs',import.meta.url))]);
const root=resolve(process.argv[2]||'.');
const reportPath=process.argv[3]?.startsWith('--')?null:process.argv[3];
const tracked=process.argv.includes('--tracked');
const signatures=/ultraviolet|UVServiceWorker|UVClient|__uv(?:\$|\b)|\buv\$(?:config|client|handler)|\buv\.(?:bundle|client|handler|config|sw)\.(?:js|mjs)|["'`]\/uv(?:\/|["'`])/gi;
const retiredPath=/(?:^|\/)(?:ultraviolet(?:\/|[.-])|uv(?:\/|\.(?:config|sw|bundle|client|handler)\.))/i;
const binaryExtensions=new Set(['.png','.jpg','.jpeg','.webp','.gif','.ico','.mp3','.mp4','.ogg','.wav','.ttf','.woff','.woff2','.zip','.exe','.dll','.pdf']);
const report={root,tracked,files:0,decodedFiles:0,binaryFiles:0,approved:[],failures:[]};
function walk(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{if(entry.name==='.git')return [];const path=resolve(directory,entry.name);return entry.isDirectory()?walk(path):entry.isFile()?[path]:[];});}
const files=tracked?execFileSync('git',['ls-files','-z'],{cwd:root,maxBuffer:16*1024*1024}).toString().split('\0').filter(Boolean).map(name=>resolve(root,name)):walk(root);
function scan(text,name,encoding){
 signatures.lastIndex=0;
 let match;
 while((match=signatures.exec(text))){
  report.failures.push({file:name,encoding,offset:match.index,match:match[0]});
 }
}
for(const file of files){
 if(!existsSync(file)||!statSync(file).isFile())continue;
 report.files++;
 const name=relative(root,file).replaceAll('\\','/');
 if(retiredPath.test(name))report.failures.push({file:name,encoding:'path',match:name});
 if(signatureFiles.has(file)){report.approved.push({file:name,reason:'Regression scanner signature definitions only; not published application code'});continue;}
 if(binaryExtensions.has(extname(name).toLowerCase())){report.binaryFiles++;continue;}
 const text=readFileSync(file,'utf8');
 scan(text,name,'raw');
 if(/\\(?:u\{?[0-9a-f]|x[0-9a-f])/i.test(text)){
  const decoded=text.replace(/\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi,(whole,a,b,c)=>{const code=parseInt(a||b||c,16);return code<=0x10ffff?String.fromCodePoint(code):whole;});
  if(decoded!==text){report.decodedFiles++;scan(decoded,name,'character escapes');}
 }
 const encoded=/\batob\(\s*['"]([A-Za-z0-9+/=]{16,})['"]\s*\)|data:(?:text\/(?:html|javascript)|application\/(?:javascript|wasm));base64,([A-Za-z0-9+/=]+)/g;
 for(const match of text.matchAll(encoded)){report.decodedFiles++;scan(Buffer.from(match[1]||match[2],'base64').toString('utf8'),name,'base64 payload');}
}
if(reportPath)writeFileSync(reportPath,JSON.stringify(report,null,2));
for(const item of report.approved)console.log('APPROVED '+item.file+': '+item.reason);
for(const item of report.failures.slice(0,100))console.error(JSON.stringify(item));
console.log(`${report.failures.length?'FAIL':'PASS'} retired-engine audit: ${report.files} files, ${report.decodedFiles} decoded payloads, ${report.binaryFiles} media/archive files classified separately, ${report.failures.length} prohibited matches`);
if(report.failures.length)process.exitCode=1;
