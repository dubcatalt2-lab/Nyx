import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import express from 'express';
import {parse} from 'acorn';
import {chromium} from 'playwright';
import {sourceFile} from '../scripture/source-layout.mjs';

const code=readFileSync('gospel.js','utf8');
let declaration;
function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration'&&node.id.name==='internalDocumentAddress')declaration=node;
  for(const value of Object.values(node)){
    if(Array.isArray(value))value.forEach(visit);
    else if(value&&typeof value==='object')visit(value);
  }
}
visit(parse(code,{ecmaVersion:'latest'}));
assert(declaration);
const implementation=code.slice(declaration.start,declaration.end);
const app=express(),root=process.cwd();
let fixed=false,requests=0;
let origin;
const entry=value=>runInNewContext('('+implementation+')(value)',{URL,value,location:{href:origin+'/history',origin}});
app.get('/shell',(_request,response)=>response.type('html').send('<!doctype html><iframe src="'+entry('/assets/games/?lesson=one#saved')+'"></iframe>'));
app.get('/assets/games/index.html',(_request,response)=>response.type('html').send('<!doctype html><h1>Activity fixture</h1>'));
app.use((request,_response,next)=>{
  requests++;
  const file=sourceFile(join(root,decodeURIComponent(request.path)));
  if(file!==join(root,decodeURIComponent(request.path)))request.url='/'+file.slice(root.length+1).replaceAll('\\','/')+(fixed&&request.path.endsWith('/')?'/':'');
  next();
});
app.use(express.static(root));
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const context=await browser.newContext();
  let page=await context.newPage();
  await assert.rejects(page.goto(origin+'/assets/games/'),/ERR_TOO_MANY_REDIRECTS/);
  assert(requests>=20);
  console.log('REPRODUCED old folder mapping: ERR_TOO_MANY_REDIRECTS');
  await page.close();page=await context.newPage();fixed=true;requests=0;
  await assert.rejects(page.goto(origin+'/assets/games/'),/ERR_TOO_MANY_REDIRECTS/);
  assert.equal(requests,0);
  console.log('REPRODUCED cached loop after server correction: 0 network requests');
  await page.close();page=await context.newPage();
  await page.goto(origin+'/shell');
  await page.frameLocator('iframe').getByRole('heading',{name:'Activity fixture'}).waitFor();
  assert.equal(page.frames()[1].url(),origin+'/assets/games/index.html?lesson=one#saved');
  await page.reload();
  await page.frameLocator('iframe').getByRole('heading',{name:'Activity fixture'}).waitFor();
  assert.equal(entry('https://external.example/apps/chat/'),'https://external.example/apps/chat/');
  assert.equal(entry('/apps/chat/?conversation=one#latest'),origin+'/apps/chat/index.html?conversation=one#latest');
  assert.equal(entry('/lessons/assets/games/'),origin+'/lessons/assets/games/index.html');
  assert.equal(entry('/apps/chat/client.js'),'/apps/chat/client.js');
  assert(code.includes('t.frame.src=internalDocumentAddress(url)'));
  console.log('PASS direct document navigation escapes cached redirects, survives reload and preserves query/hash/nested paths; external URLs untouched');
}finally{
  await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
