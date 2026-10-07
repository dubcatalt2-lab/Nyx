import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();
 await page.setContent(`<body><button data-nyx-dock-item="games" aria-label="Games"><span>Games</span></button><h1>Music</h1><h2 id="icon-title"><svg><path /></svg>Nyx API Keys</h2><div class="message"><h2>Games</h2></div><pre><h2>Music</h2></pre><textarea>Music</textarea><div contenteditable="true"><h2>Games</h2></div><span class="nyx-styled-display-name">Alice</span></body>`);
 await page.addScriptTag({content:await readFile('parables/display-names.js','utf8')});
 await page.waitForFunction(()=>document.querySelector('button span').textContent!=='Games');
 assert.equal((await page.locator('button span').textContent()).normalize('NFKC'),'G@M3Z');
 assert.equal((await page.locator('h1').textContent()).normalize('NFKC'),'MU$1C');
 assert.equal(await page.locator('textarea').inputValue(),'Music');
 assert.equal(await page.locator('[contenteditable] h2').textContent(),'Games');
 assert.equal(await page.locator('.nyx-styled-display-name').textContent(),'Alice');
 assert.equal(await page.getByRole('button',{name:'Games',exact:true}).count(),1);
 await page.evaluate(()=>document.querySelector('button span').textContent='Account');
 await page.waitForFunction(()=>document.querySelector('button span').textContent.normalize('NFKC')==='@CC0UN7');
 assert(await page.evaluate(()=>nyxDisplayName(nyxDisplayName('Games'))===nyxDisplayName('Games')));
 assert.equal((await page.locator('#icon-title').textContent()).normalize('NFKC'),'NYX @P1 K3Y$');
 assert.equal(await page.locator('#icon-title svg path').count(),1);
 assert.equal(await page.locator('.message h2').textContent(),'Games');
 assert.equal(await page.locator('pre h2').textContent(),'Music');
 assert.equal(await page.evaluate(()=>nyxDisplayName('AI')),'A1');
 assert.equal(await page.evaluate(()=>nyxDisplayName('A1')),'A1');
 assert.equal(await page.evaluate(()=>nyxDisplayName('Nyx AI').normalize('NFKC')),'NYX A1');
 console.log('PASS dynamic/icon labels, idempotence, accessible names, editable text, messages, code and profile preservation.');
} finally {await browser.close()}
