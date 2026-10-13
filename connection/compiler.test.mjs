import test from 'node:test';
import assert from 'node:assert/strict';
import {compiler} from './compiler.mjs';
import {content,script,stylesheet} from './liturgy.mjs';

test('large script/CSS compilation preserves output and leaves request thread responsive',async()=>{
  const pool=compiler({workers:2});
  const text='function sample(){let x=1;return x+2;}\n'.repeat(12000)+'fetch("/data");location.href="/next";',base='https://example.com/assets/a.js',prefix='https://mapped.test/content/page/';
  let ticks=0;const timer=setInterval(()=>ticks++,5);
  try{
    const actual=await pool.compile('js',text,base,prefix,'classic');
    assert(ticks>2,'timers must run during compilation');
    assert.equal(actual,script(text,base,prefix,false));
    assert.equal(await pool.compile('js',text,base,prefix,'classic'),actual);
    const changed=text+'fetch("/other")';
    assert.equal(await pool.compile('js',changed,base,prefix,'classic'),script(changed,base,prefix,false));
    const css='.a{background:url(../image.png)}'.repeat(2000);
    assert.equal(await pool.compile('css',css,base,prefix,'classic'),stylesheet(css,base,prefix));
    const response=await content(new Response(text,{headers:{'content-type':'text/javascript'}}),base,prefix,'script','classic',{compile:pool.compile});
    assert.equal(await response.text(),actual);
    await assert.rejects(pool.compile('js','function {',base,prefix,'classic'),{name:'SyntaxError'});
    assert.equal(await pool.compile('js','fetch("/ok")',base,prefix,'classic'),script('fetch("/ok")',base,prefix,true));
  }finally{clearInterval(timer);await pool.close();}
});

test('compiler bounds queued work and closes running jobs',async()=>{
  const pool=compiler({workers:1,capacity:1,limit:1024*1024});
  const pending=pool.compile('js','var x=1;'.repeat(10000),'https://a.test/','/content/page/','classic');
  const settled=assert.rejects(pending,/closed/);
  await assert.rejects(pool.compile('js','let a=1;','https://a.test/','/content/page/','classic'),/busy/);
  await pool.close();await settled;
  await assert.rejects(pool.compile('js','1','https://a.test/','/content/page/','classic'),/closed/);
});
