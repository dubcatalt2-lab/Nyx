import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'acorn';
import {formatPublishedHtml} from './format-published-html.mjs';

const sensitive='<pre>  first\n second </pre><textarea>  draft\n keep </textarea><script>const text="a  b";</script>';
const formatted=formatPublishedHtml('<!doctype html><html><head><title>Test</title></head><body>'+sensitive+'</body></html>');
assert(formatted.includes(sensitive.split('<textarea>')[0]));
assert(formatted.includes('<textarea>  draft\n keep </textarea>'));
assert(formatted.includes('const text="a  b";'));
assert.match(formatted,/\n  <head>/);
for(const path of ['index.html','apps/tutsi/index.html','apps/drop/index.html']){
 const html=await readFile(sourceFile('dist/'+path),'utf8');assert(html.split('\n').length>20,path);
 const src=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].at(-1)?.[1];assert(src,path);
 const loader=await readFile(sourceFile('dist'+src),'utf8');const tree=parse(loader,{ecmaVersion:'latest'});
 let payload=[];
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='ArrayExpression'&&node.elements.length>payload.length&&node.elements.every(e=>e?.type==='Literal'&&typeof e.value==='string'))payload=node.elements.map(e=>e.value);
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }
 visit(tree);assert(payload.length>10);assert(payload.every(p=>p.length<=112));
 assert.match(Buffer.from(payload.join(''),'base64').toString('utf8'),/<html\b/i);
 assert(loader.split('\n').length>payload.length);
}
for(const path of ['script.js','styles.css','ai.html']){
 const code=await readFile(sourceFile('dist/'+path),'utf8');assert(code.split('\n').length>30,path);
}
console.log('PASS multiline HTML/JS/CSS, intact whitespace-sensitive content and chunked UTF-8 entry payloads for Nyx/Tutsi/Drop');
