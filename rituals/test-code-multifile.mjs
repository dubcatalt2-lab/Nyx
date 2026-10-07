import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const workspace=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await workspace.newPage({viewport:{width:1440,height:900}});
 await page.route('**/api/**',r=>r.fulfill({json:{}}));
 await page.goto((process.env.NYX_TEST_BASE_URL||'http://localhost:6767')+'/apps/code-studio/');
 const editor=page.locator('[data-code-input]'),files=page.getByRole('combobox',{name:'Workspace files'});
 await editor.fill('<!doctype html><head><link rel="stylesheet" href="theme.css"><script defer src="interaction.js"></script></head><body><button id="test">Before</button></body>');
 async function create(name,code){await page.locator('[data-new-file]').click();await page.locator('input[name=filename]').fill(name);await page.getByRole('button',{name:'Create file',exact:true}).click();await editor.fill(code);}
 await create('theme.css','button { color: rgb(25, 150, 80); }');
 await create('interaction.js',"document.querySelector('#test').onclick=()=>document.querySelector('#test').textContent='After';");
 await create('extra.css','body { margin: 20px; }');
 await page.locator('[data-new-file]').click();await page.locator('input[name=filename]').fill('theme.css');await page.getByRole('button',{name:'Create file',exact:true}).click();assert(await page.locator('.studio-file-dialog[open]').count());await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await files.selectOption('index.html');await page.reload();assert.equal(await files.inputValue(),'index.html');assert.equal(await files.locator('option').count(),4);
 await page.locator('[data-run]').click();const frame=page.frames().find(f=>f!==page.mainFrame());await frame.waitForSelector('#test');assert.equal(await frame.locator('#test').evaluate(e=>getComputedStyle(e).color),'rgb(25, 150, 80)');await frame.locator('#test').click();assert.equal(await frame.locator('#test').innerText(),'After');
 const prompt=page.locator('[data-ai-prompt-input]');await prompt.focus();assert.equal(await prompt.evaluate(e=>getComputedStyle(e).outlineStyle),'none');assert.equal(await prompt.evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
 await page.screenshot({path:'.codex-artifacts/multifile-sandbox.png'});
 await page.goto((process.env.NYX_AGENTS_TEST_URL||'http://localhost:6769')+'/apps/agents/');await page.waitForSelector('#connect svg',{state:'attached'});assert.equal(await page.locator('#send svg').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.codex-artifacts/agents-redesign.png'});
 await page.locator('#account').click();assert(await page.locator('#login').evaluate(e=>e.open));await page.locator('#closeLogin').click();assert.equal(await page.locator('#login').evaluate(e=>e.open),false);
 console.log('PASS named files, duplicate guard, persistence, linked CSS/JS with deferred execution, rounded composer, Agents layout and sign-in controls');
}finally{await workspace.close();}
