import { chromium } from "playwright";

const baseUrl = process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080";
const livePlayer = process.env.NYX_TEST_LIVE_PLAYER === "1";
const videos = [
  { id: "dQw4w9WgXcQ", title: "A test documentary", creator: "Nyx Test", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", durationSeconds: 212, viewCount: 1203400, captions: true, isShort: false, sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "aqz-KE-bpKQ", title: "A second video", creator: "Test Studio", thumbnail: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg", durationSeconds: 73, viewCount: 8421, captions: false, isShort: true, sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
];
const shorts = [videos[1], { ...videos[1], id: "M7lc1UVf-VE", title: "Next test Short", creator: "Next Studio" }];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(8_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  if (!livePlayer) await page.addInitScript(() => {
    class MockPlayer {
      constructor(id, options) {
        this.node = document.getElementById(id);
        this.options = options;
        this.state = 1;
        this.current = 18;
        this.total = 212;
        this.muted = false;
        this.node.innerHTML = '<div data-mock-youtube-player style="width:100%;height:100%;background:linear-gradient(135deg,#121217,#23232a)"></div>';
        setTimeout(() => {
          options.events?.onReady?.({ target: this });
          options.events?.onStateChange?.({ target: this, data: 1 });
        }, 0);
      }
      playVideo() { this.state = 1; this.options.events?.onStateChange?.({ target: this, data: 1 }); }
      pauseVideo() { this.state = 2; this.options.events?.onStateChange?.({ target: this, data: 2 }); }
      getPlayerState() { return this.state; }
      getCurrentTime() { return this.current; }
      getDuration() { return this.total; }
      seekTo(value) { this.current = value; }
      mute() { this.muted = true; }
      unMute() { this.muted = false; }
      isMuted() { return this.muted; }
      loadModule() {}
      unloadModule() {}
      destroy() { this.node?.replaceChildren(); }
    }
    window.YT = { Player: MockPlayer, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
  });
  await page.route("**/api/nyxtube/status", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true, provider: "youtube" }) }));
  await page.route("**/api/nyxtube/feed?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "youtube", videos }) }));
  await page.route("**/api/nyxtube/search?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "youtube", videos: [videos[1]] }) }));
  await page.route("**/api/nyxtube/shorts?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "youtube", videos: shorts }) }));

  await page.goto(`${baseUrl}/apps/nyxtube/`, { waitUntil: "domcontentloaded" });
  console.log("NyxTube test: page loaded");
  assert(await page.locator(".site-nav").count() === 0, "Removed duplicate top navigation is still rendered");
  await page.locator(".video-card").first().waitFor();
  console.log("NyxTube test: feed rendered");
  assert(await page.locator(".video-card").count() === 2, "Home feed did not render both videos");
  if (process.env.NYX_TEST_SCREENSHOT_PATH) await page.screenshot({ path: process.env.NYX_TEST_SCREENSHOT_PATH, fullPage: true });

  await page.locator("[data-search-input]").fill("science");
  await page.locator("[data-search-form]").evaluate(form => form.requestSubmit());
  await page.getByText("Results for “science”").waitFor();
  console.log("NyxTube test: search rendered");
  assert(await page.locator(".video-card").count() === 1, "Search results did not replace the feed");

  await page.locator(".video-cover").first().click();
  await page.locator(livePlayer ? "[data-watch-player] iframe" : "[data-mock-youtube-player]").waitFor({ state: "attached" });
  console.log("NyxTube test: watch player ready");
  if (process.env.NYX_TEST_SCREENSHOT_PATH) await page.screenshot({ path: process.env.NYX_TEST_SCREENSHOT_PATH.replace(/\.png$/i, "-watch.png"), fullPage: true });
  assert(await page.locator("[data-watch-title]").textContent() === "A second video", "Watch metadata did not match the selected video");
  if (!livePlayer) {
    await page.locator("[data-watch-toggle]").click();
    assert(await page.locator("[data-watch-toggle]").getAttribute("aria-label") === "Play", "Pause control did not update player state");
    await page.locator("[data-watch-mute]").click();
    await page.locator("[data-watch-captions]").click();
    assert(await page.locator("[data-watch-captions]").getAttribute("aria-pressed") === "true", "Captions control did not update");
  }

  await page.locator('[data-view-button="shorts"]').click();
  await page.locator(livePlayer ? "[data-short-player] iframe" : "[data-mock-youtube-player]").waitFor({ state: "attached" });
  console.log("NyxTube test: Shorts player ready");
  if (process.env.NYX_TEST_SCREENSHOT_PATH) await page.screenshot({ path: process.env.NYX_TEST_SCREENSHOT_PATH.replace(/\.png$/i, "-shorts.png"), fullPage: true });
  assert(await page.locator("[data-short-title]").textContent() === "A second video", "Initial Short did not render");
  await page.locator("[data-short-next]").click();
  await page.getByText("Next test Short").waitFor();
  console.log("NyxTube test: Shorts navigation passed");
  assert(await page.locator("[data-short-title]").textContent() === "Next test Short", "Next Short navigation failed");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".video-card").first().waitFor();
  console.log("NyxTube test: mobile feed rendered");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!overflow, "NyxTube has horizontal overflow at 390px");
  assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join(" | ")}`);
  if (!livePlayer) {
    const fallbackPage = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      userAgent: "Mozilla/5.0 (X11; CrOS x86_64 15917.65.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    });
    fallbackPage.setDefaultTimeout(8_000);
    await fallbackPage.route("**/iframe_api", route => route.abort("blockedbyclient"));
    await fallbackPage.route("**/api/nyxtube/status", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true, provider: "youtube" }) }));
    await fallbackPage.route("**/api/nyxtube/feed?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "youtube", videos: [shorts[1]] }) }));
    await fallbackPage.goto(`${baseUrl}/apps/nyxtube/`, { waitUntil: "domcontentloaded" });
    await fallbackPage.locator(".video-cover").first().click();
    const directFrame = fallbackPage.locator('iframe[data-direct-youtube="true"]');
    await directFrame.waitFor({ state: "attached" });
    assert((await directFrame.getAttribute("src"))?.startsWith("https://www.youtube-nocookie.com/embed/"), "Blocked-script fallback did not use a privacy-enhanced direct embed");
    await fallbackPage.locator(".watch-player.direct-player").waitFor();
    assert(await fallbackPage.locator("[data-notice]:visible").count() === 0, "Blocked-script fallback displayed a player error");
    await fallbackPage.close();
    console.log("NyxTube test: Chromebook blocked-script fallback passed");
  }
  console.log(`NyxTube browser checks passed: feed, search, ${livePlayer ? "official iframe startup" : "watch controls"}, Shorts navigation, and mobile layout.`);
} finally {
  await browser.close();
}
