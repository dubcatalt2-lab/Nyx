import assert from 'node:assert/strict';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createAiAllowance,aiAllowanceConfig} from '../lib/ai-allowance.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';

let time=Date.now();const db=memoryFirestore(),a=createAiAllowance({db,now:()=>time,config:aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'10'})});
const actor={uid:'long-answer-fixture',app:'nyx',requestedModel:'openai/gpt-6.1-terra'};
for(const output of [8192,16384]){
  const s=await a.begin(actor),payload={model:actor.requestedModel,messages:[{role:'user',content:'Write complete source code.'}],max_tokens:output};
  const reservation=await a.reserve(s,'shared',payload);assert.equal(payload.max_tokens,output,'Nyx must not silently clamp to 700/2200');
  time+=240000;await assert.rejects(a.begin(actor),e=>e.reason==='capacity','Long streams retain their concurrency lease');
  await a.settle(reservation,{input:100,output:output-10});await a.finish(s,true);
}
const root=process.env.NYX_TEST_STATIC_ROOT||'.',aliases=root==='.'?{}:JSON.parse(await readFile(root+'/frontend-assets.json','utf8')).aliases;
const app=express();app.get('/fixture',(_q,r)=>r.type('html').send(`<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/css/ai-workspace.css"><main style="width:100%;height:100%;overflow:auto"></main><script src="${aliases['/js/ai-markdown.js']||'/js/ai-markdown.js'}"></script>`));app.use(express.static(root));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const browser=await chromium.launch();
try{
  const page=await browser.newPage({viewport:{width:390,height:700}});await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
  const code='\nconst text = "</textarea><script>window.injected=true</script>";\n'+Array.from({length:350},(_,i)=>`console.log("line ${i}");`).join('\n');
  await page.evaluate(code=>document.querySelector('main').innerHTML=window.NyxMarkdown.render('```javascript\n'+code+'\n```'),code);
  const area=page.getByRole('textbox',{name:'javascript code'});assert.equal(await area.inputValue(),code);assert(await area.evaluate(e=>e.readOnly));
  assert.equal(await page.evaluate(()=>window.injected),undefined);assert.equal(await page.getByRole('button',{name:'Copy code'}).count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert(await area.evaluate(e=>e.scrollHeight>e.clientHeight));
  console.log('PASS 8k/16k response reservations, >4-minute concurrency lease, complete 350-line code textarea, literal HTML safety, copy control and mobile fit');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
