import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {compilerBootstrap} from './build-lesson-runtime.mjs';

const types={'.html':'text/html','.txt':'text/html','.js':'text/javascript','.wasm':'application/wasm','.css':'text/css','.png':'image/png','.ogg':'audio/ogg'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/compiler-fixture'){
   res.setHeader('Content-Type','text/html');res.end('<!doctype html><head><base href="https://example.invalid/">'+compilerBootstrap+'</head><body><script>globalThis.compiledAnswer=LessonCompiler.compile([],"return 42")()</script>');return;
  }
  let name=decodeURIComponent(url.pathname);
  const base=url.searchParams.has('original')?'relics/ugs':'dist/assets/ugs';
  const root=resolve(name.startsWith('/assets/')?'dist':base);
  const file=resolve(root,'.'+name);
  if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/')){res.writeHead(403).end();return}
  const bytes=await readFile(file);
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404).end()}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:process.platform==='win32'?'chrome':undefined,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 const fixture=await browser.newPage();
 await fixture.goto(origin+'/compiler-fixture');
 assert.equal(await fixture.evaluate(()=>compiledAnswer),42);
 await fixture.evaluate(async html=>{const frame=document.createElement('iframe');frame.srcdoc=html;document.body.append(frame);await new Promise(resolve=>frame.onload=resolve)},'<!doctype html><head><base href="https://example.invalid/">'+compilerBootstrap+'</head><body><script>globalThis.compiledAnswer=LessonCompiler.compile([],"return 42")()</script>');
 assert.equal(await fixture.frames()[1].evaluate(()=>compiledAnswer),42);
 await fixture.evaluate(async html=>{
  const {prepareGameDocument}=await import(location.origin+'/assets/games/game-document.js');
  const frame=document.createElement('iframe');
  frame.srcdoc=prepareGameDocument(html,'fixture.html',location.origin+'/assets/ugs/fixture.html');
  document.body.append(frame);await new Promise(resolve=>frame.onload=resolve);
 },'<!doctype html><head><base href="https://example.invalid/">'+compilerBootstrap+'</head><body><script>globalThis.compiledAnswer=LessonCompiler.compile([],"return 42")()</script>');
 assert.equal(await fixture.frames()[2].evaluate(()=>compiledAnswer),42);
 console.log('PASS compiler bootstrap: external base URLs and embedded documents retain synchronous same-origin loading');
 await fixture.goto(origin+'/assets/ugs/E/clevilglitch.html');
 await fixture.addScriptTag({url:origin+'/assets/vendor/lesson-compiler.js'});
 const evidence=await fixture.evaluate(()=>{
  LessonCompiler.evaluateGlobal('var persistentLessonValue=21');
  return {
   global:LessonCompiler.evaluateGlobal('persistentLessonValue*2'),
   bound:LessonCompiler.run('Module.answer += 2; Module.answer',{Module:{answer:40}}),
   compiled:LessonCompiler.compile(['state'],'return state.value + 1')({value:41}),
   points:LessonCompiler.coordinates({x:2,y:4},['.x','.y'])
  };
 });
 assert.deepEqual(evidence,{global:42,bound:42,compiled:42,points:[2,4]});
 await fixture.addScriptTag({url:origin+'/assets/vendor/eruda.min.js'});
 assert.equal(await fixture.evaluate(()=>{eruda.init();return typeof eruda.get('console').log}),'function');
 console.log('PASS browser compiler: explicit bindings, persistent console globals, coordinate access and developer console initialization');
 await fixture.close();
 if(process.argv.includes('--games')){
  const files=['A/cladventneon.html','B/clbasketbros.html','C/clcatmariogood.html','G/clgeometrydashscratch.html','M/clmonkeymartenc.html','O/cloperius.html','P/clpaperio3d.html','W/clwaverun.html','C/clcookieclicker.txt'];
  const filter=process.argv.find(arg=>arg.startsWith('--filter='))?.slice(9);
  for(const file of files.filter(file=>!filter||new RegExp(filter).test(file))){
   const pair={file};
   for(const kind of ['original','built']){
    const context=await browser.newContext();const page=await context.newPage();const errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',r=>requests.push({url:r.url().split('?')[0],error:r.failure()?.errorText}));
    try{
     await page.goto(origin+'/'+file+(kind==='original'?'?original=1':''),{waitUntil:'domcontentloaded',timeout:20000}).catch(e=>errors.push(e.message.split('\n')[0]));
     await page.waitForTimeout(6000);
     const canvas=page.locator('canvas').first();
     if(await canvas.count())await canvas.click({position:{x:20,y:20},timeout:1500}).catch(()=>{});
     await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');
     await page.waitForTimeout(1000);
     pair[kind]={errors:[...new Set(errors)],requests:requests.slice(0,20),state:await page.evaluate(()=>({title:document.title,compiler:typeof globalThis.LessonCompiler,canvas:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height})),text:document.body.innerText.slice(0,220)}))};
     if(kind==='built'&&(await readFile('dist/assets/ugs/'+file,'utf8')).includes('LessonCompiler'))assert.equal(pair[kind].state.compiler,'object',file+' must load its compiler');
    }finally{await context.close()}
   }
   results.push(pair);
   console.log(JSON.stringify(pair));
  }
  await writeFile('.codex-artifacts/lesson-runtime-browser.json',JSON.stringify(results,null,2));
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
