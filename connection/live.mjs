import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
import {application} from './app.mjs';
const server=application({observe:(name,value)=>{if(name==='failure')console.error('UPSTREAM',value);}});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
let page;
try{
  page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button',{name:'Open',exact:true}).click();
  await page.frameLocator('iframe').getByText(/This domain is for use in documentation examples/).first().waitFor({timeout:20000});
  assert.deepEqual(errors,[]);
  console.log('PASS public HTTPS: https://example.com rendered through the original transport and transformation; public DNS validation enabled; 0 console errors');
}catch(error){
  console.error(await Promise.all(page.frames().map(async frame=>({url:frame.url(),text:await frame.locator('body').innerText().catch(()=>'<unavailable>')}))));
  throw error;
}finally{await browser.close();server.closeAllConnections();server.close();}

