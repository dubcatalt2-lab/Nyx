import {sourceFile} from '../scripture/source-layout.mjs';
import {parse as parseJs} from 'acorn';
import {parse as parseHtml} from 'parse5';
import CleanCSS from 'clean-css';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const apply = process.argv.includes('--write');
const keep = value => /@(?:license|preserve|copyright|cc_on|ts-|jsx|flow)|copyright|SPDX|eslint|prettier|source(?:Mapping)?URL|[#@]__|webpack|vite-ignore|istanbul|c8 ignore|^!|^\s*\[if|^\s*#|^\s*\/?ko\b/i.test(value);
const report = {checked: 0, removed: 0, changed: [], retained: []};
function commentRange(source,start,end) {
  const lineStart=source.lastIndexOf('\n',start-1)+1;
  const nextLine=source.indexOf('\n',end);
  const lineEnd=nextLine<0?source.length:nextLine;
  const aloneBefore=/^[ \t]*$/.test(source.slice(lineStart,start));
  const aloneAfter=/^[ \t\r]*$/.test(source.slice(end,lineEnd));
  if(aloneBefore)start=lineStart;
  else if(aloneAfter)while(start>lineStart&&/[ \t]/.test(source[start-1]))start--;
  if(aloneAfter)while(end<lineEnd&&/[ \t]/.test(source[end]))end++;
  const breaks=source.slice(start,end).match(/\r?\n/g)?.join('')||'';
  return {start,end,text:breaks||(!aloneBefore&&!aloneAfter?' ':'')};
}
const structure = tree => JSON.stringify(tree, (key, value) => ['start','end','loc','range','raw'].includes(key) ? undefined : typeof value === 'bigint' ? value.toString() : value);
function remove(source, ranges) {
  for (const {start, end, text} of ranges.sort((a,b) => b.start-a.start)) source = source.slice(0,start) + text + source.slice(end);
  return source;
}
function retain(value, file) {
  if (!keep(value)) return false;
  report.retained.push({file, directive: value.trim().slice(0,120)});
  return true;
}
function javascript(source, file) {
  const comments = [];
  const options = {ecmaVersion:'latest',sourceType:'module',allowReturnOutsideFunction:true,allowHashBang:true};
  const before = parseJs(source, {...options,onComment:comments});
  const ranges = comments.filter(comment => !(comment.start === 0 && source.startsWith('#!')) && !retain(comment.value,file))
    .map(comment => commentRange(source,comment.start,comment.end));
  const result = remove(source,ranges);
  assert.equal(structure(parseJs(result,options)),structure(before),'Executable JavaScript changed: '+file);
  report.removed += ranges.length;
  return result;
}
function css(source,file) {
  const ranges = [];
  let quote = '';
  for (let i=0;i<source.length;i++) {
    if (source[i] === '\\') { i++; continue; }
    if (quote) { if(source[i] === quote) quote=''; continue; }
    if ('"\''.includes(source[i])) { quote=source[i]; continue; }
    if (source.slice(i,i+2) !== '/*') continue;
    const end=source.indexOf('*/',i+2)+2;
    if(end===1) throw Error('Unclosed CSS comment: '+file);
    if(!retain(source.slice(i+2,end-2),file)) ranges.push(commentRange(source,i,end));
    i=end-1;
  }
  const result=remove(source,ranges);
  const normalized=value=>new CleanCSS({level:{1:{all:false,specialComments:0}},rebase:false,inline:['none'],format:false}).minify(value).styles;
  assert.equal(normalized(result),normalized(source),'CSS semantics changed: '+file);
  report.removed += ranges.length;
  return result;
}
function html(source,file) {
  const tree=parseHtml(source,{sourceCodeLocationInfo:true}),ranges=[];
  function walk(node) {
    const location=node.sourceCodeLocation;
    if(node.nodeName==='#comment'&&location&&!retain(node.data,file)) {
      ranges.push({start:location.startOffset,end:location.endOffset,text:''});report.removed++;
    }
    if(['script','style'].includes(node.tagName)&&location?.startTag&&location.endTag) {
      const type=node.attrs.find(attr=>attr.name==='type')?.value||'';
      if(node.tagName==='style'||!type||/^(?:module|text\/javascript|application\/javascript)$/.test(type)) {
        const start=location.startTag.endOffset,end=location.endTag.startOffset;
        const value=source.slice(start,end);
        ranges.push({start,end,text:node.tagName==='style'?css(value,file+':style'):javascript(value,file+':script')});
      }
    }
    for(const child of node.childNodes||[])walk(child);
    if(node.content)walk(node.content);
  }
  walk(tree);
  return remove(source,ranges);
}
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
for(const file of files) {
  if(!/\.(?:js|cjs|css|html)$/.test(file)||/^(?:assets\/(?:ugs\/(?!play\.html$)|vendor\/)|services\/stratus\/upstream\/|scramjet\/|baremux\/)/.test(file)||/^index\.(?:backup|accidental)/.test(file))continue;
  const source=await readFile(sourceFile(file),'utf8');
  const result=file.endsWith('.html')?html(source,file):file.endsWith('.css')?css(source,file):javascript(source,file);
  report.checked++;
  if(result!==source){report.changed.push(file);if(apply)await writeFile(file,result);}
}
await mkdir('.codex-artifacts',{recursive:true});
await writeFile('.codex-artifacts/comment-cleanup.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({checked:report.checked,changed:report.changed.length,removed:report.removed,retained:report.retained.length,apply}));
