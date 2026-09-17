import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://localhost:9091/tutsi#settings");
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
    await p.goto("http://localhost:9091/tutsi#" + app);
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
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(150);
    const overflow = await f
      .locator("body")
      .evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow,false,app+" mobile overflow");
    await p.setViewportSize({ width: 1280, height: 900 });
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
  for(const app of ['games','code','ai','youtube','music','movies','chat','checker','links','publisher','api','profiles']){
    await p.goto('http://localhost:9091/tutsi#'+app);
    const home=p.getByRole('button',{name:'Return to Tutsi home'});
    await home.click();await p.waitForURL('**#home');
  }
  assert.deepEqual(errors, []);
  console.log(
    "All built-in app fonts/backgrounds and embedded/native play-button behavior passed.",
  );
} finally {
  await browser.close();
}
