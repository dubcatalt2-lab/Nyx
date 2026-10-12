import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {runInNewContext} from 'node:vm';
import sharp from 'sharp';
import {chromium} from 'playwright';
import {compactLessonScript,compactLessonDocument,buildLessonAssets} from './build-lesson-assets.mjs';

const script=`/*! Copyright fixture author */
function exportedHook(inputValue){const meaningfulLocalVariable=inputValue+3;return meaningfulLocalVariable*2}
function expressionHook(inputValue){const retainedValue=inputValue+7;return eval('retainedValue')}
globalThis.result=[exportedHook(4),expressionHook(2),exportedHook.name];
//# sourceMappingURL=private-source.map
`;
const compact=await compactLessonScript(script);
assert(!compact.includes('meaningfulLocalVariable'));
assert(compact.includes('Copyright fixture author'));
assert(!compact.includes('sourceMappingURL'));
const originalContext={},compactContext={};
runInNewContext(script,originalContext);runInNewContext(compact,compactContext);
assert.equal(JSON.stringify(originalContext.result),JSON.stringify(compactContext.result));
assert.equal(await compactLessonScript(script),compact);
const module=await compactLessonScript('export function start(initialValue){const currentValue=initialValue+1;return currentValue}',{module:true});
assert.equal((await import('data:text/javascript,'+encodeURIComponent(module))).start(8),9);
await assert.rejects(()=>compactLessonScript('function {'),/Unexpected/);
const temporary=await mkdtemp(join(tmpdir(),'nyx-lesson-assets-'));
try{
  const output=join(temporary,'site'),directory=join(output,'assets/ugs'),cacheDirectory=join(temporary,'cache');
  await mkdir(directory,{recursive:true});
  const path=join(directory,'sample.html'),html='<script>'+script+';globalThis.asset="https://cdn.jsdelivr.net/gh/example/source@abc/file.js";</script>';
  await writeFile(path,html);
  const first=await buildLessonAssets(output,{cacheDirectory});
  assert.equal(first.files,1);assert.equal(first.cached,0);
  const expected=await readFile(path,'utf8');
  assert(!expected.includes('cdn.jsdelivr.net'));assert(expected.includes('https://raw.githack.com/example/source/abc/file.js'));
  await writeFile(path,html);
  const second=await buildLessonAssets(output,{cacheDirectory});
  assert.equal(second.cached,1);assert.equal(await readFile(path,'utf8'),expected);
  await writeFile(path,html.replace('inputValue+3','inputValue+9'));
  const third=await buildLessonAssets(output,{cacheDirectory});
  assert.equal(third.cached,0);assert.notEqual(await readFile(path,'utf8'),expected);
  await writeFile(join(directory,'broken.html'),'<script>function {</script>');
  await assert.rejects(()=>buildLessonAssets(output,{cacheDirectory}),/Lesson delivery failed/);
  console.log('PASS lesson build cache: identical input reused, changed input rebuilt, invalid source blocks the build');
}finally{
  const parent=resolve(tmpdir()),name=relative(parent,resolve(temporary));
  assert(/^nyx-lesson-assets-[^\\/]+$/.test(name));
  await rm(temporary,{recursive:true,force:true});
}

const source=`<!doctype html><html><head><meta charset="utf-8"><title>Interaction fixture</title>
<script type="application/json" id="data">{"message":"keep whitespace"}</script>
<script>var score=Number(localStorage.getItem('score')||0);function increment(){const nextScore=score+1;score=nextScore;document.getElementById('score').textContent=score;localStorage.setItem('score',String(score))}</script>
</head><body><button id="play" onclick="increment()">Play</button><output id="score"></output><canvas width="8" height="8"></canvas>
<script>document.getElementById('score').textContent=score;document.addEventListener('keydown',event=>{if(event.key==='ArrowUp')increment()});const context=document.querySelector('canvas').getContext('2d');context.fillStyle='#ff0000';context.fillRect(0,0,8,8);requestAnimationFrame(()=>document.body.dataset.ready='yes');</script>
<template><script>function dormantHook(longParameter){return longParameter+1}</script></template>
</body></html>`;
const built=await compactLessonDocument(source);
assert.equal((await compactLessonDocument(source.replaceAll('\n','\r\n'))).text,built.text);
assert.equal(built.scripts,3);
assert(built.text.includes('{"message":"keep whitespace"}'));
assert(!built.text.includes('nextScore'));
const actual=process.argv.includes('--built')
  ?{text:await readFile(new URL('../dist/assets/ugs/E/clevilglitch.html',import.meta.url),'utf8')}
  :await compactLessonDocument(await readFile(new URL('../relics/ugs/E/clevilglitch.html',import.meta.url),'utf8'),'evilglitch');
const server=createServer((request,response)=>{response.setHeader('Content-Type','text/html');response.end(request.url==='/actual'?actual.text:built.text)});
server.listen(0,'127.0.0.1');await once(server,'listening');
try{
  for(const channel of (process.platform==='win32'?['chrome','msedge']:['chromium'])){
    const browser=await chromium.launch({channel:channel==='chromium'?undefined:channel,headless:true});
    try{
      const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port);
      await page.waitForFunction(()=>document.body.dataset.ready==='yes');
      await page.locator('#play').click();await page.keyboard.press('ArrowUp');
      assert.equal(await page.locator('#score').textContent(),'2');
      await page.reload();assert.equal(await page.locator('#score').textContent(),'2');
      assert.deepEqual(await page.evaluate(()=>Array.from(document.querySelector('canvas').getContext('2d').getImageData(0,0,1,1).data)),[255,0,0,255]);
      assert.deepEqual(errors,[]);
      console.log('PASS '+channel+': inline callbacks, cross-script globals, keyboard, canvas, animation and saved state after reload');
      await page.goto('http://127.0.0.1:'+server.address().port+'/actual');
      const canvas=page.locator('#c');await canvas.waitFor({state:'visible'});
      await page.waitForFunction(()=>document.querySelector('#c').width>100);
      await canvas.click({position:{x:100,y:100}});
      await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(700);
      const stats=await sharp(await canvas.screenshot()).stats();
      assert(stats.channels.slice(0,3).some(channel=>channel.stdev>2),'Bundled game should render varied canvas pixels');
      assert.deepEqual(errors,[]);
      console.log('PASS '+channel+': bundled Evil Glitch renders after click and keyboard interaction without page errors');
    }finally{await browser.close()}
  }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
console.log('PASS lesson assets: deterministic identifier obfuscation, minification, modules, eval bindings, names, license retention, source-map removal and syntax failure');
