import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { chromium } from 'playwright';

const source=readFileSync('script.js','utf8');
const wanted=new Set(['browserAdResourceSignature','browserAdElementSelector','browserAdBlockRuntimeSource']),declarations=[];
function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='VariableDeclarator'&&wanted.has(node.id?.name))declarations.push('const '+source.slice(node.start,node.end)+';');
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
}
visit(parse(source,{ecmaVersion:'latest'}));
const runtime=vm.runInNewContext(declarations.join('\n')+'browserAdBlockRuntimeSource;');
const browser=await chromium.launch();
const deadline=setTimeout(()=>void browser.close(),15000);
try{
  const page=await browser.newPage();
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));
  await page.goto('http://fixture.test/');
  await page.evaluate(code=>window.eval(code),runtime);
  const result=await page.evaluate(()=>new Promise(resolve=>{
    let scans=0,checked=0;
    const query=Element.prototype.querySelectorAll,matches=Element.prototype.matches;
    Element.prototype.querySelectorAll=function(...args){scans++;return query.apply(this,args);};
    Element.prototype.matches=function(...args){checked++;return matches.apply(this,args);};
    let node=document.body;
    for(let i=0;i<600;i++){if(i%20===0)node=document.body;const child=document.createElement('div');node.append(child);node=child;}
    const canvas=document.createElement('canvas');canvas.id='game';node.append(canvas);
    const ad=document.createElement('div');ad.id='ad-container-fixture';node.append(ad);
    setTimeout(()=>resolve({scans,checked}),0);
  }));
  assert.equal(result.scans,0,'Mutation cleanup must not repeatedly scan whole subtrees');
  assert(result.checked<600,'Large cleanup yields before scanning every element');
  await page.waitForFunction(()=>!document.getElementById('ad-container-fixture'));
  assert.equal(await page.locator('#game').count(),1,'Keep the actual game');
  assert.equal(await page.evaluate(async()=>(await fetch('https://doubleclick.net/ad')).status),204,'Network blocking remains');
  await page.evaluate(()=>{const ad=document.createElement('div');ad.id='ad-container-later';document.body.append(ad);});
  await page.waitForFunction(()=>!document.getElementById('ad-container-later'));
  console.log('PASS proxy cleanup yields during large DOM updates, avoids repeated subtree scans, removes late ads and preserves games/network blocking.');
}finally{clearTimeout(deadline);await browser.close();}
