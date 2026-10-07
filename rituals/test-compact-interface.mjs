import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'acorn';
import {chromium} from 'playwright';
import {learningRoutes,appForLearningRoute,learningRouteForApp} from '../parables/learning-routes.js';
const origin='http://localhost:8080';
for(const [route,app] of Object.entries(learningRoutes)){
 assert.equal(appForLearningRoute(origin+route,origin),app);
 assert.equal(learningRouteForApp(app,origin),route);
}
assert.equal(appForLearningRoute('https://other.example/history',origin),'');
assert.equal(learningRouteForApp('https://other.example/assets/games/',origin),'');
assert.equal(appForLearningRoute('/history?game=balatro',origin),'/assets/games/?game=balatro');
assert.equal(learningRouteForApp('/assets/games/index.html?game=balatro',origin),'/history?game=balatro');
const source=await readFile('gospel.js','utf8');
const wanted=new Set(['compactBackgroundSource','setBackgroundProperty','bgSrc']);
const pieces=[];
function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&wanted.has(node.id?.name))pieces.push(source.slice(node.start,node.end));for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}}
walk(parse(source,{ecmaVersion:'latest',sourceType:'script'}));assert.equal(pieces.length,3);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();await page.goto('about:blank');await page.addScriptTag({content:pieces.join('\n')});
 await page.evaluate(async()=>{
  const bytes=Uint8Array.from({length:50000},(_,i)=>i%256),data='data:image/gif;base64,'+btoa(String.fromCharCode(...bytes));
  window.oldUrl=compactBackgroundSource(data,'image');
  if(!oldUrl.startsWith('blob:'))throw Error('Expected a compact reference');
  const copy=new Uint8Array(await(await fetch(oldUrl)).arrayBuffer());
  if(copy.length!==bytes.length||copy.some((b,i)=>b!==bytes[i]))throw Error('Image bytes changed');
  if(compactBackgroundSource(data,'image')!==oldUrl)throw Error('Reference was needlessly regenerated');
  setBackgroundProperty('--bg',`url("${data}")`);
  if(document.documentElement.style.cssText.length>200)throw Error('Inline wallpaper remains oversized');
  compactBackgroundSource('/assets/backgrounds/example.gif','image');
 });
 await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>fetch(oldUrl).then(()=>false,()=>true)),true);
 console.log('PASS educational route mapping/query/origin isolation; compact wallpaper URLs preserve exact bytes including animated formats, reuse references, and release replaced images.');
}finally{await browser.close();}
