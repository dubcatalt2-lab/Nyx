import {chromium} from 'playwright';import assert from 'node:assert/strict';
const workspace=await chromium.launch();try{
 for(const path of ['/apps/cloud-gaming/','/tutsi#cloud']){
  const page=await workspace.newPage();let launches=0;
  await page.route('https://luna.loan/**',r=>r.fulfill({contentType:'text/html',body:'Luna fixture'}));
  await page.addInitScript(()=>{window.RTCPeerConnection=undefined;});
  await page.route('**/api/**',r=>{const url=new URL(r.request().url());if(url.pathname==='/api/cloud-gaming/sessions')launches++;return r.fulfill({json:url.pathname.endsWith('/cloud-gaming/status')?{configured:false,maintenance:true,setupMessage:'Cloud gaming is currently down.'}:{enabled:false}})});
  await page.goto('http://localhost:9091'+path);
  const content=path.startsWith('/tutsi')?page.frameLocator('#app-host iframe:not([hidden])'):page;
  await content.locator('[data-luna-close]').click();
  await content.getByText('Stratus is currently unavailable. Luna is available above.',{exact:true}).waitFor();
  assert(await content.locator('[data-search]').isDisabled());assert(await content.locator('[data-network-mode]').isDisabled());assert.equal(launches,0);
  await page.close();
 }
 console.log('Nyx and Tutsi outage notices, disabled controls and no launches passed, including workspaces without WebRTC.');
}finally{await workspace.close()}
