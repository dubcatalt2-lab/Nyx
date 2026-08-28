import { chromium } from "playwright";

const baseUrl = process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080";
const livePlayer = process.env.NYX_TEST_LIVE_PLAYER === "1";
const videos = [
  { id: "dQw4w9WgXcQ", title: "A test documentary", creator: "Nyx Test", description: "A full documentary description for the NyxTube watch page.", publishedAt: "2026-08-20T12:00:00.000Z", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", durationSeconds: 212, viewCount: 1203400, captions: true, isShort: false, sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "aqz-KE-bpKQ", title: "A second video", creator: "Test Studio", description: "This description must be visible below the selected video.", publishedAt: "2026-08-21T12:00:00.000Z", thumbnail: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg", durationSeconds: 73, viewCount: 8421, captions: false, isShort: true, sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
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
  assert((await page.locator("[data-watch-description]").textContent())?.includes("visible below"), "Watch description was not rendered");
  assert(await page.locator("[data-watch-related] .related-card").count() >= 1, "Related content rail did not render");
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

  await page.setViewportSize({ width: 1366, height: 650 });
  const compactShorts = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    const overlaps = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const card = rect(".short-card"), copy = rect(".short-copy"), actions = rect(".short-actions"), nav = rect(".short-nav");
    return { cardBottom: card?.bottom, viewportHeight: innerHeight, copyActionsOverlap: overlaps(copy, actions), cardNavOverlap: overlaps(card, nav) };
  });
  assert(compactShorts.cardBottom <= compactShorts.viewportHeight + 1, "Short player exceeds a compact Chromebook viewport");
  assert(!compactShorts.copyActionsOverlap && !compactShorts.cardNavOverlap, "Short controls overlap at Chromebook size");
  if (process.env.NYX_TEST_SCREENSHOT_PATH) await page.screenshot({ path: process.env.NYX_TEST_SCREENSHOT_PATH.replace(/\.png$/i, "-shorts-compact.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 700 });
  const mobileShorts = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    const overlaps = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const card = rect(".short-card"), copy = rect(".short-copy"), actions = rect(".short-actions"), nav = rect(".short-nav");
    return { cardBottom: card?.bottom, navTop: nav?.top, viewportHeight: innerHeight, copyActionsOverlap: overlaps(copy, actions) };
  });
  assert(mobileShorts.cardBottom <= mobileShorts.viewportHeight + 1, "Short player exceeds a compact mobile viewport");
  assert(mobileShorts.navTop >= mobileShorts.cardBottom - 1, "Mobile Short navigation overlaps the player");
  assert(!mobileShorts.copyActionsOverlap, "Mobile Short metadata overlaps its controls");
  if (process.env.NYX_TEST_SCREENSHOT_PATH) await page.screenshot({ path: process.env.NYX_TEST_SCREENSHOT_PATH.replace(/\.png$/i, "-shorts-mobile.png"), fullPage: true });

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

    const discoveryPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await discoveryPage.addInitScript(() => {
      localStorage.setItem("nyx.setupComplete", "true");
      localStorage.setItem("nyx.homeDesign", "redesigned");
    });
    await discoveryPage.route("**/api/apps", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ apps: [{ id: "youtube", icon: "youtube.com", name: "NyxTube", url: "/apps/nyxtube/" }] }) }));
    await discoveryPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const redesignedNyxTubeShortcut = discoveryPage.locator('.nyx-minimal-shortcuts [data-app-url="/apps/nyxtube/"]');
    await redesignedNyxTubeShortcut.waitFor({ state: "attached" });
    await discoveryPage.evaluate(() => {
      document.body.classList.add("browser-content-active");
      document.querySelectorAll("#nyxStudyHubStartup,#setupLaunchScreen,#setupScreen,.nyx-tos-gate").forEach(element => { element.style.pointerEvents = "none"; });
      const field = document.querySelector('form.browser-mode-address > input.browser-mode-url');
      const bounds = field?.getBoundingClientRect();
      field?.focus();
      if (field && bounds) field.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: bounds.left + Math.min(120, bounds.width / 2), clientY: bounds.top + bounds.height / 2 }));
    });
    const addressBounds = await discoveryPage.locator('form.browser-mode-address > input.browser-mode-url').boundingBox();
    assert(addressBounds?.width > 100, `Browser address field did not have usable geometry: ${JSON.stringify(addressBounds)}`);
    await discoveryPage.mouse.move(addressBounds.x + Math.min(120, addressBounds.width / 2), addressBounds.y + addressBounds.height / 2);
    const addressBorder = discoveryPage.locator('form.browser-mode-address > .browser-mode-url-pointer-border');
    await addressBorder.waitFor({ state: "attached" });
    await discoveryPage.waitForTimeout(180);
    const addressInteraction = await discoveryPage.evaluate(() => {
      const field = document.querySelector('form.browser-mode-address > input.browser-mode-url');
      const border = document.querySelector('form.browser-mode-address > .browser-mode-url-pointer-border');
      return {
        fieldShadow: field ? getComputedStyle(field).boxShadow : "missing",
        borderOpacity: border ? Number.parseFloat(getComputedStyle(border).opacity) : -1,
        borderWidth: border?.getBoundingClientRect().width || 0,
      };
    });
    assert(addressInteraction.fieldShadow === "none", `Browser address field still glows on hover: ${addressInteraction.fieldShadow}`);
    assert(addressInteraction.borderOpacity > 0 && addressInteraction.borderWidth > 100, `Browser address pointer border did not activate: ${JSON.stringify(addressInteraction)}`);
    const catalog = await discoveryPage.evaluate(() => fetch("/api/apps", { cache: "no-store" }).then(response => response.json()));
    assert(catalog.apps?.some(app => app.id === "youtube" && app.name === "NyxTube" && app.url === "/apps/nyxtube/"), "Apps API did not expose the NyxTube entry");
    await discoveryPage.close();

    const migrationPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await migrationPage.addInitScript(() => {
      if (window.top !== window) return;
      localStorage.setItem("nyx.setupComplete", "true");
      localStorage.setItem("nyx.homeDesign", "original");
      localStorage.setItem("nyx.homeShortcuts", JSON.stringify([{ domain: "duck.ai", title: "Research Assistant", url: "https://duck.ai/", favorite: false }]));
      localStorage.removeItem("nyx.homeShortcuts.nyxTubeShortcutV1");
    });
    await migrationPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await migrationPage.locator('[data-home-shortcuts] button[data-app-url="/apps/nyxtube/"]').waitFor({ state: "attached" });
    const migrated = await migrationPage.evaluate(() => JSON.parse(localStorage.getItem("nyx.homeShortcuts") || "[]"));
    assert(migrated.some(item => item.url === "/apps/nyxtube/" && item.title === "NyxTube"), `Returning profile did not receive the NyxTube shortcut migration: ${JSON.stringify(migrated)}`);
    await migrationPage.close();
    console.log("NyxTube test: Apps and returning-profile shortcut discovery passed");
  }
  console.log(`NyxTube browser checks passed: feed, search, ${livePlayer ? "official iframe startup" : "watch controls"}, Shorts navigation, and mobile layout.`);
} finally {
  await browser.close();
}
