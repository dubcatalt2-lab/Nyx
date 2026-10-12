import test from 'node:test';
import assert from 'node:assert/strict';
import {content,document,stylesheet} from './transform.mjs';
import {route} from './address.mjs';

const base='https://fixture.test/folder/page';
const prefix='https://d-test.nyx.test/content/page/';

test('upstream script errors retain their status and body',async()=>{
  const text='<h1>Not found</h1>';
  const response=await content(new Response(text,{status:404,headers:{'content-type':'text/plain'}}),base,prefix,'script');
  assert.equal(response.status,404);
  assert.equal(await response.text(),text);
});

test('redirects preserve bodies without compiling them as scripts',async()=>{
  const text='<p>Continue</p>';
  const response=await content(new Response(text,{status:302,headers:{location:'/next','content-type':'text/javascript'}}),base,prefix,'script');
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),route('/next',base,prefix));
  assert.equal(await response.text(),text);
});

test('data HTML is returned without document runtime injection',async()=>{
  const text='<article><a href="/next">Next</a></article>';
  const response=await content(new Response(text,{headers:{'content-type':'text/html'}}),base,prefix,'');
  assert.equal(await response.text(),text);
});

test('malformed resource addresses do not destroy the surrounding document',()=>{
  const result=document('<h1>Still here</h1><img src="http://["><img src="/valid.png">',base,prefix);
  assert.ok(result.includes('<h1>Still here</h1>'));
  assert.ok(result.includes('src="http://["'));
  assert.ok(result.includes(route('/valid.png',base,prefix)));
  assert.doesNotThrow(()=>stylesheet('a{background:url("http://[")}b{background:url("/valid.png")}',base,prefix));
});

test('a syntax error in one inline script does not prevent document delivery',()=>{
  const result=document('<h1>Still here</h1><script>const = ;</script><script>fetch("/next")</script>',base,prefix);
  assert.ok(result.includes('<h1>Still here</h1>'));
  assert.ok(result.includes('const = ;'));
  assert.ok(result.includes(route('/next',base,prefix)));
});

test('opaque CORS origins are retained exactly',async()=>{
  const response=await content(new Response('data',{headers:{'access-control-allow-origin':'null'}}),base,prefix,'','classic',{isolated:true});
  assert.equal(response.headers.get('access-control-allow-origin'),'null');
});

test('declared legacy text encoding is decoded and normalized after transformation',async()=>{
  const bytes=Uint8Array.from(Buffer.from('<h1>caf\xe9</h1>','latin1'));
  const response=await content(new Response(bytes,{headers:{'content-type':'text/html; charset=windows-1252'}}),base,prefix,'document');
  assert.ok((await response.text()).includes('café'));
  assert.match(response.headers.get('content-type'),/charset=utf-8/i);
});
