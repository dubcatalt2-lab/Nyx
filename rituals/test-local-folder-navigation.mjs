import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,symlink,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const environment=Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(name)));
const built=process.argv.includes('--built');
const temporary=built?await mkdtemp(join(tmpdir(),'document-navigation-')):null;
if(temporary){environment.NYX_STATIC_ROOT=join(temporary,'site');await symlink(resolve('dist'),environment.NYX_STATIC_ROOT,process.platform==='win32'?'junction':'dir');}
const child=process.env.NYX_TEST_ORIGIN?null:fork(new URL('../shepherd.js',import.meta.url),[],{silent:true,env:{...environment,PORT:'0',NYX_YOUTUBE_NATIVE_ENABLED:'0',WISP_URL:'ws://127.0.0.1:9/'}});
let browser,serverOutput='';
try{
  let origin=process.env.NYX_TEST_ORIGIN;
  if(child){
    child.stdout.resume();child.stderr.on('data',bytes=>serverOutput=(serverOutput+bytes).slice(-4000));
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Source server startup timed out')),20000);
      const finish=(error,port)=>{clearTimeout(timer);error?reject(error):resolve(port);};
      child.once('error',error=>finish(error));
      child.once('exit',code=>finish(Error('Source server exited '+code)));
      child.on('message',message=>{if(message.type==='nyx:listening')finish(null,message.port);});
    });
    origin='http://127.0.0.1:'+port;
  }
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  for(const width of [1365,390]){
    const context=await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(()=>localStorage.setItem('nyx.tosAcceptedVersion','2026-07-30'));
    const page=await context.newPage(),failures=[],errors=[],redirects=[];
    page.on('dialog',dialog=>(dialog.type()==='beforeunload'?dialog.accept():dialog.dismiss()).catch(()=>{}));
    page.on('pageerror',error=>errors.push(error.message));
    page.on('requestfailed',request=>{
      if(request.isNavigationRequest()&&request.url().startsWith(origin))failures.push({url:request.url(),error:request.failure()});
    });
    page.on('response',response=>{
      if(response.request().isNavigationRequest()&&response.url().startsWith(origin)&&response.status()>=300&&response.status()<400)redirects.push(response.url());
    });
    for(const path of ['/assets/games','/assets/games/','/assets/games//','/assets/games/?view=collection']){
      const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),200);
      await page.locator('.game-card').first().waitFor();
    }
    assert.deepEqual(redirects,[origin+'/assets/games']);
    redirects.length=0;
    await page.goto(origin+'/history',{waitUntil:'domcontentloaded'});
    for(let visit=0;visit<2;visit++){
      const frame=page.frameLocator('.workspace-body iframe.view.active');
      await frame.locator('.game-card').first().waitFor({timeout:30000});
      assert(await frame.locator('.game-card').count()>0);
      assert.equal(new URL(await page.locator('.workspace-body iframe.view.active').getAttribute('src'),origin).pathname,'/assets/games/index.html');
      assert.equal(new URL(page.url()).pathname,'/history');
      if(visit===0)await page.reload({waitUntil:'domcontentloaded'});
    }
    assert.deepEqual(redirects,[]);
    assert.deepEqual(failures,[]);
    assert.deepEqual(errors,[]);
    for(const path of ['/apps/chat/','/apps/code-studio/']){
      const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),200);
    }
    assert.deepEqual(redirects,[]);
    console.log(`PASS ${built?'built':'source'} ${width}px: folder URLs, query string, direct Games document and cached reload; Chat and Code startup return 200; no redirect loop or Games console errors.`);
    await context.close();
  }
}catch(error){
  if(serverOutput)console.error(serverOutput);
  throw error;
}finally{
  await browser?.close();
  if(child&&child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill();await stopped;}
  if(temporary){await unlink(environment.NYX_STATIC_ROOT);await rmdir(temporary);}
}
