import {parse as javascript} from 'acorn';
import {parse as markup} from 'parse5';
import postcss from 'postcss';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
const require=createRequire(import.meta.url),postcssRoot=dirname(require.resolve('postcss'));
const tokenizeCss=require(join(postcssRoot,'tokenize.js')),CssInput=require(join(postcssRoot,'input.js'));
const blockIssues=[];
const root=resolve(process.argv[2]||process.cwd());
const preserve=text=>/@(?:license|preserve|__PURE__|__NO_SIDE_EFFECTS__|cc_on|ts-|jsx|babel|vite|rollup)|copyright|SPDX|licensed under|permission is hereby granted|GNU (?:General|Affero)|eslint|istanbul|c8 ignore|sourceMappingURL|sourceURL|\[if\b|<!\[endif/i.test(text);
function jsEdits(source,offset=0){
 const comments=[];let ast;
 try{ast=javascript(source,{ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true,onComment:comments});}
 catch{comments.length=0;ast=javascript(source,{ecmaVersion:'latest',sourceType:'script',allowReturnOutsideFunction:true,onComment:comments});}
 const edits=comments.filter(item=>!preserve(item.value)&&!source.slice(item.start,item.end).startsWith('#!')).map(item=>({start:offset+item.start,end:offset+item.end,text:source.slice(item.start,item.end).replace(/[^\r\n]/g,' ')}));
 const updated=apply(source,edits.map(edit=>({...edit,start:edit.start-offset,end:edit.end-offset})));
 const next=javascript(updated,{ecmaVersion:'latest',sourceType:ast.sourceType,allowReturnOutsideFunction:true});
 if(JSON.stringify(ast)!==JSON.stringify(next))throw Error('JavaScript syntax tree changed');
 return edits;
}
function cssEdits(source,offset=0){
 const edits=[],tokens=tokenizeCss(new CssInput(source));
 while(!tokens.endOfFile()){const token=tokens.nextToken();if(token[0]==='comment'&&!preserve(token[1]))edits.push({start:token[2]+offset,end:token[3]+1+offset,text:token[1].replace(/[^\r\n]/g,' ')});}
 return edits;
}
function apply(source,edits){for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);return source;}
function htmlEdits(source){
 const edits=[];
 const visit=node=>{
  const location=node.sourceCodeLocation;
  if(node.nodeName==='#comment'&&location&&!preserve(node.data))edits.push({start:location.startOffset,end:location.endOffset,text:''});
  if(location?.startTag&&location?.endTag&&['script','style'].includes(node.tagName)){
   const type=node.attrs?.find(item=>item.name==='type')?.value||'';
   let start=location.startTag.endOffset,end=location.endTag.startOffset,body=source.slice(start,end);
   try{if(node.tagName==='style')edits.push(...cssEdits(body,start));
   else if(!type||/^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(type)){
    const cdata=/^\s*<!\[CDATA\[/.exec(body);if(cdata){start+=cdata[0].length;end-=body.length-body.lastIndexOf(']]>');body=source.slice(start,end);}
    edits.push(...jsEdits(body,start));
   }}catch(error){blockIssues.push({offset:start,error:error.message.slice(0,140)});}
  }
  for(const child of node.childNodes||[])visit(child);
  if(node.content)visit(node.content);
 };
 visit(markup(source,{sourceCodeLocationInfo:true}));return edits;
}
const files=process.argv.includes('--retry')?JSON.parse(await readFile(join(root,'.codex-artifacts/comment-audit.json'),'utf8')).skipped.map(item=>item.file):execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8',maxBuffer:20_000_000}).split('\0').filter(Boolean);
const report={root,scanned:files.length,changed:[],preserved:[],skipped:[]};
for(const file of files){
 if(/^(?:dist|\.published|node_modules)\//.test(file))continue;
 const extension=extname(file).toLowerCase();if(!['.js','.mjs','.cjs','.css','.html','.svg'].includes(extension))continue;
 try{
  const source=await readFile(join(root,file),'utf8');blockIssues.length=0;
  const edits=['.js','.mjs','.cjs'].includes(extension)?jsEdits(source):extension==='.css'?cssEdits(source):htmlEdits(source);
  if(blockIssues.length)report.skipped.push({file,blocks:[...blockIssues]});
  if(!edits.length){report.preserved.push(file);continue;}
  await writeFile(join(root,file),apply(source,edits));report.changed.push({file,comments:edits.length});
 }catch(error){report.skipped.push({file,error:error.message});}
}
await mkdir(join(root,'.codex-artifacts'),{recursive:true});await writeFile(join(root,'.codex-artifacts',process.argv.includes('--retry')?'comment-retry-audit.json':'comment-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({scanned:report.scanned,changed:report.changed.length,comments:report.changed.reduce((sum,item)=>sum+item.comments,0),skipped:report.skipped}));
