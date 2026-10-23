import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge'});
try {
 for(const file of ['slope-practice.js','study-practice.js','gladihoppers-practice.js']){
  const page=await browser.newPage();
  await page.setContent('<body></body>');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addScriptTag({content:await readFile(new URL('../assets/studies/'+file,import.meta.url),'utf8')});
  const summary=page.locator('summary');await summary.click();
  const title=await summary.textContent();
  assert.equal(title.normalize('NFKC'),'Study t0ols');
  assert.notEqual(title,'Study tools');
  const snapshot=await page.evaluate(()=>{
    const root=document.querySelector('aside').shadowRoot;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),text=[];let n;
    while(n=walker.nextNode())if(!n.parentElement?.closest('style,script'))text.push(n.data);
    return {text:text.join(' '), values:[...root.querySelectorAll('option')].map(o=>o.value)};
  });
  assert(!/[A-Za-z]/.test(snapshot.text),file+' visible text is Unicode');
  assert(snapshot.values.every(v=>!/[\u{1d400}-\u{1d7ff}]/u.test(v)),'Option values must not be styled');
  await page.evaluate(()=>document.querySelector('aside').shadowRoot.querySelector('[role=status]').textContent='Game speed: Ready');
  await page.waitForTimeout(60);
  const status=await page.locator('[role=status]').first().textContent();
  assert.equal(status.normalize('NFKC'),'study sp3ed: R3ady');
  assert.equal(await summary.getAttribute('aria-label'),'Study tools');
  assert.deepEqual(errors,[]);
  await page.close();console.log('PASS Unicode static/dynamic menu and intact values: '+file);
 }
}finally{await browser.close();}
