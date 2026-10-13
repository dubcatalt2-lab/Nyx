import test from 'node:test';
import assert from 'node:assert/strict';
import {textCache} from './lectionary.mjs';
import {script,stylesheet,content} from './liturgy.mjs';

test('compiled text requires exact source and context, expires, and stays bounded',()=>{
  let time=0,calls=0;const cache=textCache({limit:10000,entries:2,lifetime:10,now:()=>time});
  const input=' '.repeat(1024),compute=()=>String(++calls);
  assert.equal(cache('a',input,compute),'1');assert.equal(cache('a',input,compute),'1');
  assert.equal(cache('a',input+'x',compute),'2');assert.equal(cache('b',input,compute),'3');
  assert.equal(cache('c',input,compute),'4');assert.equal(cache('a',input+'x',compute),'5');
  time=11;assert.equal(cache('a',input+'x',compute),'6');
  assert.throws(()=>cache('a',input,()=>{throw Error('parse failure')}),/parse failure/);
  assert.equal(cache('a',input,compute),'7');
  const small=textCache({limit:1});small('x',input,compute);small('x',input,compute);assert.equal(calls,9);
});

test('cached compilation retains scope, source changes, URL bases, and parse modes',async()=>{
  const padding=' '.repeat(1024),input=padding+'fetch("./data"); function local(location){return location.href} const ref=window.location;';
  const first=script(input,'https://a.example/one/','/content/page/');
  assert.equal(script(input,'https://a.example/one/','/content/page/'),first);
  assert.match(first,/a.example%2Fone%2Fdata/);assert.match(first,/return location.href/);
  assert.notEqual(script(input,'https://a.example/two/','/content/page/'),first);
  assert.notEqual(script(input+'fetch("./other");','https://a.example/one/','/content/page/'),first);
  assert.notEqual(script(input,'https://a.example/one/','/content/other/'),first);
  assert.throws(()=>script(padding+'return 1','https://a.example/','/content/page/',true));
  assert.doesNotThrow(()=>script(padding+'return 1','https://a.example/','/content/page/',false));
  assert.notEqual(stylesheet(padding+'a{background:url(x)}','https://a.example/','/content/page/'),stylesheet(padding+'a{background:url(x)}','https://b.example/','/content/page/'));
  const page='<html><head></head><body>private</body></html>';
  const a=await(await content(new Response(page,{headers:{'content-type':'text/html'}}),'https://a.example/','/content/page/','document','classic',{cookies:'one'})).text();
  const b=await(await content(new Response(page,{headers:{'content-type':'text/html'}}),'https://a.example/','/content/page/','document','classic',{cookies:'two'})).text();
  assert.notEqual(a,b);
});
