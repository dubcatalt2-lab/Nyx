import {sourceFile} from '../scripture/source-layout.mjs';
﻿import { chromium } from "playwright";
import assert from "node:assert/strict";
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const base=process.env.TUTSI_TEST_URL||'http://localhost:9091/tutsi';
const browser = await chromium.launch({channel:'msedge'});
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  if(process.env.TUTSI_TEST_DIST)await p.route(new URL(base).origin+'/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const path=pathname==='/tutsi'?'/apps/tutsi/index.html':pathname;
    try{const file=resolve('dist','.'+decodeURIComponent(path)+(path.endsWith('/')?'index.html':''));if(!file.startsWith(resolve('dist')+'\\'))throw Error('Invalid path');await route.fulfill({body:await readFile(sourceFile(file)),contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream'});}catch{await route.continue();}
  });
  if(process.env.TUTSI_TEST_SOURCE_CSS)await p.route('**/apps/tutsi/embedded.css?*',async r=>r.fulfill({body:await readFile(sourceFile('apps/tutsi/embedded.css')),contentType:'text/css'}));
  await p.addInitScript(()=>{try{localStorage.setItem('tutsi.customize.seen','1')}catch{}});
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base+"#settings");
  await p.selectOption("#accent", "green");
  await p.locator("#close-prevention").uncheck();
  for (const app of [
    "ai",
    "youtube",
    "music",
    "games",
    "movies",
    "chat",
    "code",
    "checker",
    "links",
    "publisher",
    "api",
  ]) {
    await p.goto(base+"#" + app);
    const f = p.frameLocator("#app-host iframe:not([hidden])");
    await f.locator('html[data-tutsi-app="' + app + '"]').waitFor();
    await f.locator("#tutsi-embedded-style").waitFor({ state: "attached" });
    await f.locator("body").evaluate(async () => {for(let i=0;i<100&&!getComputedStyle(document.body).fontFamily.includes("Indie Flower");i++)await new Promise(r=>setTimeout(r,50));await document.fonts.ready;});
    assert(
      (
        await f.locator("body").evaluate((e) => getComputedStyle(e).fontFamily)
      ).includes("Indie Flower"),
      app + " font",
    );
    assert.equal(
      await f
        .locator("body")
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(30, 47, 29)",
      app + " background",
    );
    assert.equal(await f.locator('html').getAttribute('data-app-shell'),'tutsi',app+' shell ownership');
    assert.equal(await f.locator('link[href*="obsidian.css"]').count(),0,app+' Nyx stylesheet excluded');
    await f.locator('body').evaluate(()=>{
      localStorage.setItem('nyx.theme','rose');
      dispatchEvent(new StorageEvent('storage',{key:'nyx.theme',newValue:'rose'}));
    });
    assert.equal(await f.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(30, 47, 29)',app+' isolated from Nyx theme');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(150);
    const overflow = await f
      .locator("body")
      .evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if(overflow)console.log(app,await f.locator('body').evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='fixed').slice(0,12).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))})));
    assert.equal(overflow,false,app+" mobile overflow");
    await p.setViewportSize({ width: 1280, height: 900 });
    if(['ai','youtube','checker'].includes(app))await p.screenshot({path:'.codex-artifacts/tutsi-'+app+'-isolated.png'});
    if (app === "youtube") {
      await f.locator("body").evaluate(() => {
        const button = document.querySelector("[data-watch-center-play]");
        button.hidden = false;
        const mount = document.querySelector("[data-watch-player]");
        mount.replaceChildren(document.createElement("iframe"));
      });
      assert.equal(
        await f
          .locator("[data-watch-center-play]")
          .evaluate((e) => getComputedStyle(e).display),
        "none",
      );
      await f
        .locator("body")
        .evaluate(() =>
          document
            .querySelector("[data-watch-player]")
            .replaceChildren(document.createElement("video")),
        );
      assert.notEqual(
        await f
          .locator("[data-watch-center-play]")
          .evaluate((e) => getComputedStyle(e).display),
        "none",
      );
    }
  }
  await p.goto(new URL('/ai.html',base).href);
  await p.locator('[data-ai-app]').waitFor();
  assert.equal(await p.locator('html').getAttribute('data-app-shell'),null,'standalone Nyx retains its shell');
  assert.equal(await p.locator('link[href*="obsidian.css"]').count(),1);
  assert(await p.locator('link[href*="obsidian.css"]').evaluate(link=>!link.disabled),'standalone Nyx retains its theme');
  assert.deepEqual(errors, []);
  console.log(
    "All built-in app fonts/backgrounds and embedded/native play-button behavior passed.",
  );
} finally {
  await browser.close();
}
