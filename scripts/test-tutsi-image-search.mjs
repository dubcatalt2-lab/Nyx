import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import {
  minimalGuardSource,
  compatibilityPlugin,
} from "../apps/tutsi/proxy-compat.mjs";
const script = await fs.readFile(
  new URL("../script.js", import.meta.url),
  "utf8",
);
const match = script.match(
  /const scramjetMinimalRuntimeGuardSource=(`[^]*?`);/,
);
assert.equal(vm.runInNewContext(match[1]), minimalGuardSource);
const callbacks = [];
globalThis.window = {
  $scramjet: { Tap: { tap: (hook, cb) => callbacks.push([hook, cb]) } },
};
const htmlHook = {},
  responseHook = {};
compatibilityPlugin().install({
  fetchHandler: {
    hooks: {
      rewriter: { html: { post: htmlHook } },
      fetch: { response: responseHook },
    },
  },
});
const head = {
  name: "head",
  children: [
    {
      name: "link",
      attribs: { integrity: "digest", "scramjet-attr-integrity": "digest" },
    },
  ],
};
callbacks.find(([h]) => h === htmlHook)[1]({ handler: { root: head } });
assert.equal(head.children[1].attribs.integrity, undefined);
assert(head.children[0].children[0].data.includes("location.hostname"));
delete globalThis.window;
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto("http://localhost:9091/tutsi");
  if(await p.locator("#customize-dialog").isVisible())await p.locator("#customize-dismiss").click();
  await p.addScriptTag({ url: "/js/duck-image-viewport.js" });
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
  console.log(
    "Shared image-gap repair, up/down scroll, All-tab restoration, SRI and Nyx Google-guard parity passed.",
  );
} finally {
  await b.close();
}
