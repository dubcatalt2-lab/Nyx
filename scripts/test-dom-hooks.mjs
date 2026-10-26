import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { chromium } from "playwright";
import { createDomHookTransform, domHookAlias } from "./build-dom-hooks.mjs";
import { encodeLiterals } from "./build-string-literals.mjs";

const html=`<!doctype html><style>.game-card{color:rgb(10,20,30)}#playButton{font-weight:bold}[data-library]{padding:8px}</style>
<button id="playButton" class="game-card" data-library="local" aria-label="Play game" title="Play game">Play game</button>
<span data-user-content>animation.gif</span><section id="dynamic"></section><script>
const config={library:'games',play:true,selector:'.game-card'};globalThis.fixtureConfig=config;
document.getElementById('playButton').addEventListener('click',event=>{
 document.body.dataset.gameMode=event.currentTarget.dataset.library;
 document.getElementById('dynamic').innerHTML='<div class="arcade-card" data-game-source="fixture">Game library</div>';
 document.querySelector('.arcade-card').dataset.gameSource='updated';
 document.querySelector('.game-card').classList.add('playing');
});
globalThis.optional=()=>document.querySelector('#missing')?.dataset?.gameMode;
</script><script src="/interface.js"></script>`;
const transform=createDomHookTransform();
transform.collect('<div class="search game-card"></div>', 'assets/studies/embedded.html');
const generatedScript='const guard = `<script>(() => { const parsed = new URL("https://game.test/?level=1"); window.result = parsed.search + parsed.hash; })()<\\/script>`;';
assert.equal(transform.rewrite(generatedScript,'assets/studies/guard.js'),generatedScript,'Embedded JavaScript properties must not be interpreted as CSS class selectors');
const embeddedStyle='const css = `.game-card { color:red; }`;';
assert(transform.rewrite(embeddedStyle,'assets/studies/style.js').includes(domHookAlias('class','game-card')),'Actual CSS templates retain linked selectors');
transform.collect('<span data-user-content>animation.gif</span>', 'assets/studies/fixture.html');
transform.collect(html,"fixture.html");
const output=transform.rewrite(html,"fixture.html");
assert(!output.includes('class="game-card"')&&!output.includes('data-library='));
const code=output.match(/<script>([\s\S]*?)<\/script>/)[1];
const final=output.replace(code,encodeLiterals(code));
const app=express().get('/',(_,res)=>res.type('html').send(final))
 .get('/interface.js',async(_,res)=>res.type('js').send(await readFile('js/interface-text.js','utf8')));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('button',{name:'Start game',exact:true}).waitFor();
 assert.equal(await page.locator('[data-user-content]').textContent(),'animation.gif','User content markers survive full hook collection and text presentation');
 const button=page.locator('#'+domHookAlias('id','playButton'));
 assert.equal(await button.evaluate(el=>getComputedStyle(el).color),'rgb(10, 20, 30)');
 await button.click();
 await page.waitForFunction(()=>document.querySelector('#dynamic').textContent.normalize('NFKC')==='Study coll3ction');
 assert.deepEqual(await page.evaluate(()=>globalThis.fixtureConfig),{library:'games',play:true,selector:'.game-card'});
 assert.equal(await page.evaluate(()=>globalThis.optional()),undefined);
 assert.equal(await page.locator('body').getAttribute('data-'+domHookAlias('attribute','data-game-mode')),'local');
 assert.equal(await page.locator('#dynamic > div').getAttribute('data-'+domHookAlias('attribute','data-game-source')),'updated');
 assert.deepEqual(await page.locator('[id],[class]').evaluateAll(elements=>elements.flatMap(el=>[el.id,el.className]).filter(value=>/game|librar(?:y|ies)|play|arcade/i.test(value))),[]);
 assert.deepEqual(errors,[]);
 console.log('PASS linked opaque DOM hooks, inline handlers, dynamic cards, CSS, data attributes, optional dataset access, neutral labels and unchanged API values');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
