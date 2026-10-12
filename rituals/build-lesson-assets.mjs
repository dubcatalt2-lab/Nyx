import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {parse as parseHtml} from 'parse5';
import {parse} from 'acorn';
import {minify} from 'terser';
import {gameSourceText} from '../relics/games/game-cdn.js';

const revision='lesson-assets-3';
const javascriptType=/^(?:(?:text|application)\/(?:java|ecma)script|text\/javascript1\.[0-5]|module)?$/i;

export async function compactLessonScript(source,{module=false,seed='lesson'}={}){
  const alphabet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').sort((a,b)=>{
    const rank=value=>createHash('sha256').update(seed+value).digest('hex');
    return rank(a).localeCompare(rank(b));
  }).join('');
  const result=await minify(source,{
    module,
    compress:false,
    mangle:{toplevel:false,eval:false,properties:false,nth_identifier:{get(index){
      let name='';
      do{name+=alphabet[index%alphabet.length];index=Math.floor(index/alphabet.length);}while(index);
      return name;
    }}},
    keep_fnames:true,
    keep_classnames:true,
    sourceMap:false,
    format:{ascii_only:true,inline_script:true,comments:/@license|@preserve|copyright|^!/i}
  });
  const code=result.code||'';
  parse(code,{ecmaVersion:'latest',sourceType:module?'module':'script'});
  return code;
}

export async function compactLessonDocument(source,seed='lesson'){
  source=source.replace(/\r\n?/g,'\n');
  const scripts=[];
  const visit=node=>{
    if(node.tagName==='script'&&!node.attrs.some(a=>a.name==='src')){
      const type=node.attrs.find(a=>a.name==='type')?.value.trim()||'';
      const location=node.sourceCodeLocation;
      if(javascriptType.test(type)&&location?.endTag){
        scripts.push({start:location.startTag.endOffset,end:location.endTag.startOffset,module:type==='module'});
      }
    }
    node.childNodes?.forEach(visit);
    if(node.content)visit(node.content);
  };
  visit(parseHtml(source,{sourceCodeLocationInfo:true}));
  for(const script of scripts.sort((a,b)=>b.start-a.start)){
    const code=await compactLessonScript(source.slice(script.start,script.end),{module:script.module,seed:seed+':'+script.start});
    source=source.slice(0,script.start)+code+source.slice(script.end);
  }
  return {text:source,scripts:scripts.length};
}

export async function buildLessonAssets(output,{cacheDirectory,reportPath}={}){
  const report={files:0,scripts:0,beforeBytes:0,afterBytes:0,cached:0,failures:[],assets:[]};
  if(cacheDirectory)await mkdir(cacheDirectory,{recursive:true});
  async function visit(directory){
    let entries;
    try{entries=await readdir(directory,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
    for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
      const file=join(directory,entry.name);
      if(entry.isDirectory()){await visit(file);continue;}
      if(!/\.(?:html?|txt|docx|[mc]?js)$/i.test(file))continue;
      const bytes=await readFile(file);
      if(bytes.includes(0)||bytes.subarray(0,2).toString()==='PK')continue;
      const source=bytes.toString('utf8');
      const script=/\.[mc]?js$/i.test(file);
      if(!script&&!/<(?:!doctype|html|script)\b/i.test(source))continue;
      const path=relative(output,file).replaceAll('\\','/');
      const key=createHash('sha256').update(revision+'\0'+path+'\0').update(bytes).digest('hex');
      const cachedFile=cacheDirectory&&join(cacheDirectory,key+'.json');
      try{
        let result;
        if(cachedFile)try{result=JSON.parse(await readFile(cachedFile,'utf8'));report.cached++;}catch(error){if(error.code!=='ENOENT')throw error;}
        if(!result){
          result=script?{text:await compactLessonScript(source,{module:file.endsWith('.mjs'),seed:path}),scripts:1}:await compactLessonDocument(source,path);
          if(cachedFile)await writeFile(cachedFile,JSON.stringify(result));
        }
        result.text=gameSourceText(result.text);
        await writeFile(file,result.text);
        const after=Buffer.byteLength(result.text);
        report.files++;report.scripts+=result.scripts;report.beforeBytes+=bytes.length;report.afterBytes+=after;
        report.assets.push({path,scripts:result.scripts,beforeBytes:bytes.length,afterBytes:after});
      }catch(error){report.failures.push({path,error:error.message});}
      if(report.files&&report.files%200===0)console.log('Lesson delivery: '+report.files+' files processed.');
    }
  }
  for(const directory of ['assets/ugs','assets/vendor/balatro'])await visit(resolve(output,directory));
  console.log('Lesson delivery: '+JSON.stringify({...report,assets:undefined}));
  if(reportPath){await mkdir(resolve(reportPath,'..'),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2));}
  if(report.failures.length)throw new Error('Lesson delivery failed for '+report.failures.length+' files; see the build report.');
  return report;
}
