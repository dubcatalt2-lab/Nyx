import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, symlink, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

// A fresh credential-free backend, serving the actual production build. The
// junction avoids Express's intentional rejection of dot-directory file paths.
const temp = await mkdtemp(join(tmpdir(), 'nyx-ai-picker-'));
const staticRoot = join(temp, 'site');
await symlink(resolve('dist'), staticRoot, process.platform === 'win32' ? 'junction' : 'dir');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(key)));
const child = fork(new URL('../shepherd.js', import.meta.url), [], {
  env: { ...env, PORT: '0', WISP_URL:'wss://example.com/wisp/', NYX_STATIC_ROOT: staticRoot, NYX_YOUTUBE_NATIVE_ENABLED: '0' }, silent: true
});
child.stdout.resume();
let stderr = '';
child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
let browser;
try {
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 20000);
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited (${code}): ${stderr}`)));
    child.on('message', message => { if (message.type === 'nyx:listening') { clearTimeout(timeout); resolve(message.port); } });
  });
  const base = `http://127.0.0.1:${port}`;
  const health = await (await fetch(base + '/healthz')).json();
  assert.equal(health.wispImplementation, 'external');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const fixtures=[
    {id:'openrouter/free',label:'Free router'},
    {id:'google/gemma-4-31b-it:free',label:'Gemma',vision:true},
    {id:'google/gemini-2.5-flash-image',label:'Gemini Image',text:true,vision:true,imageGeneration:true},
    {id:'inception/mercury-2.5',label:'Mercury',text:true},
    {id:'openai/gpt-5.6-luna',label:'GPT-5.6 Luna',vision:true},
    {id:'anthropic/claude-opus-5.5',label:'Claude Opus 5.5',vision:true,poolTokenLimit:5000},
    {id:'openai/gpt-6-luna-pro',label:'GPT-6 Luna Pro',vision:true,poolTokenLimit:5000},
    {id:'openai/gpt-6-luna',label:'GPT-6 Luna',vision:true,poolTokenLimit:5000},
    {id:'openai/gpt-6-sol',label:'GPT-6 Sol',vision:true}
  ];
  for(const variant of ['nyx','tutsi-desktop','tutsi-mobile']) {
    const tutsi=variant.startsWith('tutsi');
    const context=await browser.newContext({viewport:{width:variant.endsWith('mobile')?390:1280,height:850}});
    try {
      let reverse=false;
      await context.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:'{}'}));
      await context.route('**/api/nyx-ai/providers',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({providers:[{id:'shared',label:'OpenRouter'}]})}));
      await context.route('**/api/nyx-ai/models',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({models:reverse?[...fixtures].reverse():fixtures})}));
      await context.route('**/api/nyx-ai',route=>route.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({model:'anthropic/claude-opus-5.5',choices:[{delta:{content:'Reply icon regression fixture.'}}]})+'\n\ndata: [DONE]\n\n'}));
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/ai.html');
      if(tutsi){
        await page.evaluate(async()=>{const {decorateEmbedded}=await import('/chapels/tutsi/embedded.mjs');decorateEmbedded(document,'ai');});
        await page.waitForFunction(()=>[...document.styleSheets].some(sheet=>sheet.href?.includes('/apps/tutsi/embedded.css')));
      }
      await page.locator('#modelTrigger').click();
      if(tutsi){
        assert.equal(await page.locator('#modelCompanies .ai-company-filter-label').count(),5);
        assert.equal(await page.locator('#modelCompanies [data-loop-copy]').count(),0);
        assert.equal(await page.locator('#modelCompanies').evaluate(el=>getComputedStyle(el).flexDirection),variant.endsWith('mobile')?'row':'column');
        const bounds=await page.locator('#modelMenu').boundingBox();
        assert(bounds.x>=0&&bounds.x+bounds.width<=page.viewportSize().width,'Picker must fit viewport');
        await page.locator('#modelCompanies [data-model-company="anthropic"]').click();
        assert.equal(await page.locator('#modelOptions [data-model-id]').count(),1);
        await page.locator('#modelSearch').fill('Mercury');
        assert.equal(await page.locator('#modelOptions [data-model-id]').count(),1);
        assert.equal(await page.locator('#modelOptions [data-model-id]').getAttribute('data-model-id'),'inception/mercury-2.5');
        await page.locator('.ai-model-search [data-model-company=""]').click();
        await page.screenshot({path:join(tmpdir(),variant+'-model-picker.png')});
      }else assert.equal(await page.locator('#modelCompanies .ai-company-rail').count(),2);
      const ids=await page.locator('#modelOptions [data-model-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.modelId));
      assert.deepEqual(ids.slice(0,4),['openai/gpt-6-sol','openai/gpt-6-luna-pro','openai/gpt-6-luna','openai/gpt-5.6-luna']);
      assert(ids.slice(-2).every(id=>id.endsWith(':free')||id==='openrouter/free'));
      const option=id=>page.locator('#modelOptions [data-model-id="'+id+'"]');
      assert.match(await option('openai/gpt-6-luna').innerText(),/Text.*Vision/);
      assert(await option('openai/gpt-6-luna').locator('.ai-model-option-label').evaluate(node=>getComputedStyle(node).whiteSpace!=='nowrap'&&node.scrollWidth<=node.clientWidth+1),'Capability and quota labels must remain readable on mobile');
      assert(!/5,000|token cap|token limit/.test(await page.locator('#modelOptions').innerText()));
      assert(!/Image generation/.test(await option('openai/gpt-6-luna').innerText()));
      const imageCapabilities=await option('google/gemini-2.5-flash-image').innerText();
      for(const capability of ['Text','Vision','Image generation'])assert(imageCapabilities.includes(capability));
      assert.match(await option('inception/mercury-2.5').innerText(),/Text/);
      assert(!/Vision/.test(await option('inception/mercury-2.5').innerText()));
      await option('openai/gpt-6-luna').click();assert.equal(await page.locator('#model').inputValue(),'openai/gpt-6-luna');
      if(tutsi){
        await page.locator('#input').fill('Check the model avatar');
        await page.locator('#send').click();
        await page.waitForFunction(()=>document.querySelector('#conversation')?.textContent.includes('Reply icon regression fixture.'));
        const avatar=page.locator('.ai-message-assistant .ai-message-avatar').last();
        assert.equal(await avatar.evaluate(el=>getComputedStyle(el).backgroundImage),'none','Old Tutsi icon must not appear behind company logo');
        assert.equal(await avatar.locator('.ai-company-logo').count(),1);
        assert.match(await page.locator('.ai-message-assistant .ai-message-meta strong').last().innerText(),/Claude/);
      }
      reverse=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#model')?.value==='openai/gpt-6-luna');
      assert.deepEqual(errors,[]);
      console.log(variant+': model ordering, capabilities, saved selection, layout, filters and reply icons passed');
    } finally {await context.close();}
  }

  const embedded=await browser.newContext({viewport:{width:1280,height:850}});
  try{
    await embedded.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:'{}'}));
    await embedded.route('**/api/nyx-ai/providers',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({providers:[{id:'shared',label:'OpenRouter'}]})}));
    await embedded.route('**/api/nyx-ai/models',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({models:fixtures})}));
    await embedded.addInitScript(()=>localStorage.setItem('tutsi.customize.seen','1'));
    const page=await embedded.newPage();
    await page.goto(base+'/apps/tutsi/index.html#settings');
    await page.selectOption('#accent','green');
    await page.locator('#close-prevention').uncheck();
    await page.goto(base+'/apps/tutsi/index.html#ai');
    const frame=page.frameLocator('#app-host iframe:not([hidden])');
    await frame.locator('html[data-tutsi-app="ai"]').waitFor();
    await frame.locator('#modelTrigger').click();
    assert.equal(await frame.locator('#modelCompanies').getAttribute('data-layout'),'tutsi');
    assert.equal(await frame.locator('link[href*="obsidian.css"]').count(),0);
    assert.equal(await frame.locator('#modelCompanies').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(30, 47, 29)');
    const mark=frame.locator('#modelCompanies .ai-company-logo:not(.ai-company-logo-color)').first();
    assert.equal(await mark.evaluate(el=>getComputedStyle(el).backgroundColor),await mark.evaluate(el=>getComputedStyle(el).color));
    await page.screenshot({path:join(tmpdir(),'tutsi-embedded-model-picker.png')});
    await frame.locator('#modelSearch').press('Escape');
    assert.equal(await frame.locator('#modelMenu').evaluate(el=>el.open),false);
    console.log('Tutsi actual shell: named filters, native palette, isolated stylesheet and Escape passed');
  }finally{await embedded.close();}

} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'exit'); child.disconnect();
    const timeout = setTimeout(() => child.kill('SIGKILL'), 12000);
    await closed; clearTimeout(timeout);
  }
  await unlink(staticRoot); await rmdir(temp);
}
