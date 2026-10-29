import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import mime from 'mime-types';import {chromium} from 'playwright';
const exported=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Pass a generated S3 export directory');const site=join(exported,'site');const canonical='https://history-classroom.s3.us-east-1.amazonaws.com';
const browser=await chromium.launch();try{
 for(const entry of [canonical+'/index.html','https://s3.amazonaws.com/history-classroom/index.html','https://d329oui0a76my.cloudfront.net/index.html']){
  const context=await browser.newContext();let arrived=0;
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(![new URL(canonical).hostname,'s3.amazonaws.com','d329oui0a76my.cloudfront.net'].includes(u.hostname))return route.abort();let path=decodeURIComponent(u.pathname);if(u.hostname==='s3.amazonaws.com')path=path.replace(/^\/history-classroom/,'');if(path==='/studies.html'){arrived++;return route.fulfill({contentType:'text/html',body:'<title>Workspace reached</title><h1>Workspace reached</h1>'});}const file=resolve(site,'.'+path);if(!file.startsWith(site))return route.abort();try{return route.fulfill({contentType:mime.lookup(file)||'application/octet-stream',body:await readFile(file)});}catch{return route.fulfill({status:404,body:'Missing fixture asset'});}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+500));await page.goto(entry);
  const frame=entry.startsWith(canonical)?page.mainFrame():page.frames().find(f=>f.url().startsWith(canonical+'/index.html'));
  assert(frame,'Canonical cover context must exist');await frame.waitForFunction(()=>document.title.includes('Antelope Valley'));
  assert.equal(arrived,0,'Cover must appear before workspace navigation');
  await page.clock.runFor(1012);await frame.getByRole('heading',{name:'Workspace reached',exact:true}).waitFor();assert.equal(arrived,1);assert.equal(page.url(),entry.startsWith(canonical)?canonical+'/studies.html':entry,'Shared entry remains in its wrapper');
  assert.deepEqual(errors,[]);await context.close();console.log('PASS exported cover then workspace:',new URL(entry).hostname);
 }
}finally{await browser.close();}
