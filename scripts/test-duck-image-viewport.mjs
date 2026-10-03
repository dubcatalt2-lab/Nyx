import {chromium} from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.setDefaultTimeout(10000);
  await p.addInitScript(()=>localStorage.setItem('tutsi.customize.seen','1'));
  await p.goto("http://localhost:9091/tutsi");
  await p.locator('#query').waitFor();
  await p.locator('#studyready-startup').waitFor({state:'detached'});
  await p.addScriptTag({ content: await fs.readFile(process.env.IMAGE_REPAIR_SOURCE || new URL('../js/duck-image-viewport.js',import.meta.url),'utf8') });
  await p.evaluate(async () => {
    const frame = document.createElement("iframe");
    frame.id = "image-fixture";
    frame.style = "width:100%;height:650px";
    frame.srcdoc = `<style>body{margin:0}nav{height:700px}ul{height:40px;margin:0;display:flex;gap:20px}#main{min-height:450px}#images{display:grid;grid-template-columns:repeat(4,150px);gap:10px;margin-top:600px}img{width:150px;height:110px}</style><header>Search</header><nav><div><ul><li>AI images</li><li>All sizes</li><li>All colors</li><li>All layouts</li></ul></div></nav><div id='main' data-testid='mainline'>All results placeholder</div><section id='images'>${Array.from({ length: 32 }, () => "<img alt=\"image\" src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='110'%3E%3Crect width='150' height='110' fill='green'/%3E%3C/svg%3E\">").join("")}</section>`;
    document.body.append(frame);
    await new Promise((r) => (frame.onload = r));
    window.NyxDuckImageViewport(
      { frame, sourceUrl: "https://duckduckgo.com/?q=w&ia=images" },
      (s) => (s.startsWith("https://duckduckgo.com/") ? s : ""),
    );
  });
  const f = p.frameLocator("#image-fixture");
  assert((await f.locator("nav").boundingBox()).height < 100);
  assert(
    await f
      .locator("#main")
      .evaluate((e) => getComputedStyle(e).display === "none"),
  );
  assert(
    (await f
      .locator("#images")
      .evaluate((e) => e.getBoundingClientRect().top)) < 200,
  );
  await f.locator("body").evaluate(() => {
    scrollTo(0, 600);
    scrollTo(0, 0);
  });
  assert(
    (await f
      .locator("#images")
      .evaluate((e) => e.getBoundingClientRect().top)) < 200,
  );
  await f
    .locator("body")
    .evaluate(() =>
      document
        .querySelector("nav")
        .replaceChildren(document.createTextNode("All results")),
    );
  await p.waitForTimeout(100);
  assert.notEqual(
    await f.locator("#main").evaluate((e) => getComputedStyle(e).display),
    "none",
  );
  assert.equal(await f.locator("nav").evaluate((e) => e.style.height), "");
  let requests=0;
  await p.route('**/lazy-thumbnail-fixture/*',async route=>{
    requests++;
    await new Promise(resolve=>setTimeout(resolve,80));
    await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="green"/></svg>'});
  });
  await p.evaluate(async()=>{
    const frame=document.createElement('iframe');frame.id='lazy-fixture';frame.style='position:fixed;inset:0;width:900px;height:600px;z-index:999';
    frame.srcdoc='<!doctype html><style>body{margin:0}img{width:120px;height:90px}#far{position:absolute;top:6000px}</style><section id="near"></section><img id="far" loading="lazy" data-src="/lazy-thumbnail-fixture/far.svg"><div role="dialog"><img id="dialog" data-src="/lazy-thumbnail-fixture/dialog.svg"></div>';
    const ready=new Promise(resolve=>frame.onload=resolve);document.body.append(frame);await ready;
    window.lazyFixtureTab={frame,sourceUrl:'https://duckduckgo.com/?q=fixture&ia=images'};
    window.NyxDuckImageViewport(window.lazyFixtureTab,()=> '');
    // Late data-src arrival after the first layout pass, without a scroll event.
    setTimeout(()=>{frame.contentDocument.querySelector('#near').innerHTML=Array.from({length:6},(_,i)=>`<img loading="lazy" data-src="/lazy-thumbnail-fixture/${i}.svg">`).join('')+'<img id="native" loading="lazy" src="/lazy-thumbnail-fixture/native.svg" data-original="/lazy-thumbnail-fixture/wrong.svg" style="position:absolute;top:1200px">'},150);
  });
  const lazy=p.frameLocator('#lazy-fixture');
  await p.waitForFunction(()=>[...document.querySelector('#lazy-fixture').contentDocument.querySelectorAll('#near img')].filter(image=>image.complete&&image.naturalWidth>0).length===7);
  assert.equal(requests,7);
  assert.equal(await lazy.locator('#native').getAttribute('loading'),'eager');
  assert.equal(await lazy.locator('#native').getAttribute('src'),'/lazy-thumbnail-fixture/native.svg');
  assert.equal(await lazy.locator('body').evaluate(()=>scrollY),0);
  assert.equal(await lazy.locator('#far').getAttribute('src'),null);
  assert.equal(await lazy.locator('#dialog').getAttribute('src'),null);
  await lazy.locator('body').evaluate(()=>scrollTo(0,5900));
  await p.waitForFunction(()=>document.querySelector('#lazy-fixture').contentDocument.querySelector('#far').naturalWidth>0);
  await lazy.locator('body').evaluate(()=>scrollTo(0,0));
  assert.equal(await lazy.locator('#near img').evaluateAll(images=>images.filter(image=>image.complete&&image.naturalWidth>0).length),7);
  await p.evaluate(()=>{window.lazyFixtureTab.sourceUrl='https://duckduckgo.com/?q=fixture&ia=web';const image=document.createElement('img');image.id='web-image';image.setAttribute('data-src','/lazy-thumbnail-fixture/web.svg');window.lazyFixtureTab.frame.contentDocument.querySelector('#near').append(image)});
  await p.waitForTimeout(150);
  assert.equal(await lazy.locator('#web-image').getAttribute('src'),null);
  console.log(
    "Shared image-gap repair, stationary delayed thumbnails, bounded preloading, up/down scroll, All-tab restoration passed.",
  );
} finally {
  await b.close();
}
