import { chromium } from "playwright";

const baseUrl = process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080";
const livePlayer = process.env.NYX_TEST_LIVE_PLAYER === "1";
const videos = [
  { id: "dQw4w9WgXcQ", title: "A test documentary", creator: "Nyx Test", channelId: "UC1234567890123456789012", channelAvatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%2386a9e8'/%3E%3C/svg%3E", description: "A full documentary description for the NyxTube watch page.", publishedAt: "2026-08-20T12:00:00.000Z", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", durationSeconds: 212, viewCount: 1203400, likeCount: 532, commentCount: 47, captions: true, isShort: false, sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "aqz-KE-bpKQ", title: "A second video", creator: "Test Studio", channelId: "UCabcdefghijklmnopqrstuv", channelAvatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Ccircle cx='24' cy='24' r='24' fill='%23d990b3'/%3E%3C/svg%3E", description: "This description must be visible below the selected video.", publishedAt: "2026-08-21T12:00:00.000Z", thumbnail: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg", durationSeconds: 73, viewCount: 8421, likeCount: 42, commentCount: 3, captions: true, isShort: true, sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
];
const shorts = [videos[1], { ...videos[1], id: "M7lc1UVf-VE", title: "Next test Short", creator: "Next Studio" }];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (X11; CrOS x86_64 15917.65.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });
  page.setDefaultTimeout(8_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  if (!livePlayer) await page.addInitScript(() => {
    window.__nyxTubeOpenedProfiles = [];
    window.__nyxTubeOpenedChannels = [];
    window.open = url => { window.__nyxTubeOpenedChannels.push(String(url)); return null; };
    addEventListener("message", event => {
      if (event.data?.type === "nyx:nyxtube-profile-request") {
        postMessage({ type: "nyx:nyxtube-profile", requestId: event.data.requestId, profile: { uid: "nyxtube-test-user", signedIn: true, displayName: "Nyx Tester", handle: "@tester", avatarUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%2386a9e8'/%3E%3C/svg%3E" } }, location.origin);
      }
      if (event.data?.type === "nyx:nyxtube-open-profile") window.__nyxTubeOpenedProfiles.push(event.data.uid);
    });
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
          if (Array.isArray(window.__nyxTubeMockBlockedIds) && window.__nyxTubeMockBlockedIds.includes(options.videoId)) {
            options.events?.onError?.({ target: this, data: 150 });
            return;
          }
          options.events?.onReady?.({ target: this });
          options.events?.onStateChange?.({ target: this, data: 1 });
        }, 0);
      }
      playVideo() { this.state = 1; window.__nyxTubePlayerState = this.state; this.options.events?.onStateChange?.({ target: this, data: 1 }); }
      pauseVideo() { this.state = 2; window.__nyxTubePlayerState = this.state; this.options.events?.onStateChange?.({ target: this, data: 2 }); }
      getPlayerState() { return this.state; }
      getCurrentTime() { return this.current; }
      getDuration() { return this.total; }
      getAvailablePlaybackRates() { return [0.5, 1, 1.5, 2]; }
      getPlaybackRate() { return this.rate || 1; }
      setPlaybackRate(value) { this.rate = Number(value) || 1; window.__nyxTubeLastPlaybackRate = this.rate; }
      seekTo(value) { this.current = value; window.__nyxTubeLastSeek = value; }
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
  await page.route("**/api/nyxtube/community?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({
    provider: "youtube",
    comments: { available: true, comments: [{ id: "comment-1", author: "Viewer One", avatarUrl: "", text: "This comment came from YouTube.", likeCount: 8, replyCount: 2, publishedAt: "2026-08-22T12:00:00.000Z" }] },
    transcript: { available: true, language: "English", segments: [{ startSeconds: 4, durationSeconds: 2.5, text: "Welcome to the test transcript." }, { startSeconds: 7, durationSeconds: 3, text: "This is the next caption line." }] }
  }) }));

  await page.goto(`${baseUrl}/apps/nyxtube/`, { waitUntil: "domcontentloaded" });
  console.log("NyxTube test: page loaded");
  assert(await page.locator(".site-nav").count() === 0, "Removed duplicate top navigation is still rendered");
  await page.locator(".video-card").first().waitFor();
  console.log("NyxTube test: feed rendered");
  if (!livePlayer) {
    await page.locator("[data-profile-avatar] img").waitFor();
    assert(await page.locator("[data-profile-button]").getAttribute("aria-label") === "Open Nyx Tester's profile", "NyxTube did not render the signed-in profile identity");
    await page.locator("[data-profile-button]").click();
    await page.waitForFunction(() => window.__nyxTubeOpenedProfiles.includes("nyxtube-test-user"));
    console.log("NyxTube test: signed-in profile avatar and public-profile action passed");
  }
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
  await page.locator("[data-watch-channel-mark] img").waitFor();
  assert(await page.locator("[data-watch-creator]").textContent() === "Test Studio", "Watch page did not render the creator name as a channel action");
  if (!livePlayer) {
    await page.locator("[data-watch-channel-mark]").click();
    await page.waitForFunction(() => window.__nyxTubeOpenedChannels.includes("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"));
    await page.locator("[data-watch-creator]").click();
    await page.waitForFunction(() => window.__nyxTubeOpenedChannels.filter(url => url === "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv").length === 2);
  }
  assert((await page.locator("[data-watch-description]").textContent())?.includes("visible below"), "Watch description was not rendered");
  assert(await page.locator("[data-watch-views]").textContent() === "8,421", "Watch page did not show the exact view count");
  assert(await page.locator("[data-watch-likes]").textContent() === "42", "Watch page did not show the exact like count");
  assert(await page.locator("[data-watch-comments-count]").textContent() === "3", "Watch page did not show the exact comment count");
  assert(await page.locator("[data-watch-related] .related-card").count() >= 1, "Related content rail did not render");
  if (!livePlayer) {
    await page.locator("[data-watch-settings]").click();
    await page.locator("[data-watch-settings-menu]").waitFor({ state: "visible" });
    if (process.env.NYX_TEST_SCREENSHOT_PATH) await page.screenshot({ path: process.env.NYX_TEST_SCREENSHOT_PATH.replace(/\.png$/i, "-settings.png"), fullPage: true });
    assert(await page.locator("[data-watch-speed] option").count() === 4, "Video settings did not expose the available playback speeds");
    await page.locator("[data-watch-speed]").selectOption("1.5");
    assert(await page.evaluate(() => window.__nyxTubeLastPlaybackRate) === 1.5, "Video settings did not apply the selected playback speed");
    assert(!await page.locator("[data-watch-settings-captions]").isDisabled(), "Video settings disabled captions for a captioned video");
    await page.locator("[data-watch-settings]").click();
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press("ArrowRight");
    assert(await page.evaluate(() => window.__nyxTubeLastSeek) === 23, "Right Arrow did not seek forward five seconds");
    await page.keyboard.press("KeyJ");
    assert(await page.evaluate(() => window.__nyxTubeLastSeek) === 13, "J did not seek back ten seconds");
    await page.keyboard.press("KeyL");
    assert(await page.evaluate(() => window.__nyxTubeLastSeek) === 23, "L did not seek forward ten seconds");
    await page.keyboard.down("Space");
    await page.waitForTimeout(60);
    await page.keyboard.up("Space");
    assert(await page.evaluate(() => window.__nyxTubePlayerState) === 2, "A quick Space tap did not pause the video");
    await page.keyboard.press("KeyK");
    assert(await page.evaluate(() => window.__nyxTubePlayerState) === 1, "K did not resume the video");
    await page.keyboard.down("Space");
    await page.waitForTimeout(425);
    assert(await page.evaluate(() => window.__nyxTubeLastPlaybackRate) === 2, "Holding Space did not temporarily select 2x speed");
    assert(await page.locator("[data-watch-speed-indicator]").isVisible(), "Holding Space did not show the 2x indicator");
    assert(await page.evaluate(() => window.__nyxTubePlayerState) === 1, "Holding Space unexpectedly paused the video");
    await page.keyboard.up("Space");
    assert(await page.evaluate(() => window.__nyxTubeLastPlaybackRate) === 1.5, "Releasing Space did not restore the selected playback speed");
    assert(await page.locator("[data-watch-speed-indicator]").isHidden(), "Releasing Space left the 2x indicator visible");
    await page.locator("[data-watch-settings]").focus();
    await page.keyboard.press("Space");
    assert(await page.evaluate(() => window.__nyxTubePlayerState) === 1, "Space hijacked a focused player control");
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press("KeyC");
    assert(await page.locator("[data-watch-captions]").getAttribute("aria-pressed") === "true", "C did not enable captions");
    await page.keyboard.press("KeyC");
    assert(await page.locator("[data-watch-captions]").getAttribute("aria-pressed") === "false", "C did not disable captions");
    console.log("NyxTube test: tap/hold Space and YouTube-style keyboard shortcuts passed");
    await page.setViewportSize({ width: 390, height: 700 });
    await page.locator("[data-watch-forward]").waitFor({ state: "visible" });
    if (process.env.NYX_TEST_SCREENSHOT_PATH) await page.screenshot({ path: process.env.NYX_TEST_SCREENSHOT_PATH.replace(/\.png$/i, "-seek-mobile.png"), fullPage: true });
    await page.locator("[data-watch-forward]").click();
    assert(await page.evaluate(() => window.__nyxTubeLastSeek) === 28, "Mobile forward control did not seek five seconds");
    await page.locator("[data-watch-rewind]").click();
    assert(await page.evaluate(() => window.__nyxTubeLastSeek) === 23, "Mobile rewind control did not seek back five seconds");
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), "Watch statistics or information tabs overflow at 390px");
    await page.setViewportSize({ width: 1280, height: 900 });
    console.log("NyxTube test: keyboard and mobile five-second seeking passed");
    await page.locator('[data-watch-info-tab="comments"]').click();
    await page.getByText("This comment came from YouTube.").waitFor();
    assert(await page.locator(".watch-comment").count() === 1, "YouTube comments did not render in the watch page");
    await page.locator('[data-watch-info-tab="transcript"]').click();
    await page.getByText("Welcome to the test transcript.").waitFor();
    await page.locator(".transcript-line").first().click();
    assert(await page.evaluate(() => window.__nyxTubeLastSeek) === 4, "Clicking a transcript line did not seek to its timestamp");
    await page.locator('[data-watch-info-tab="description"]').click();
    assert(await page.locator('[data-watch-info-panel="description"]').isVisible(), "Description tab did not restore the video description");
    console.log("NyxTube test: exact statistics, comments, and timestamped transcript passed");
    await page.locator("[data-watch-toggle]").click();
    assert(await page.locator("[data-watch-toggle]").getAttribute("aria-label") === "Play", "Pause control did not update player state");
    await page.locator("[data-watch-mute]").click();
    await page.locator("[data-watch-captions]").click();
    assert(await page.locator("[data-watch-captions]").getAttribute("aria-pressed") === "true", "Captions control did not update");
    console.log("NyxTube test: usable YouTube player settings passed");
    await page.evaluate(() => { window.__nyxTubeMockBlockedIds = ["dQw4w9WgXcQ"]; });
    await page.locator("[data-watch-related] .related-card").filter({ hasText: "A test documentary" }).click();
    await page.waitForFunction(() => document.querySelector("[data-watch-title]")?.textContent === "A second video");
    assert((await page.locator("[data-notice]").textContent())?.includes("restricted on this Chromebook"), "Restricted-video recovery did not explain the automatic fallback");
    assert(await page.locator("[data-mock-youtube-player]").count() === 1, "Restricted-video recovery did not start the next playable video");
    await page.evaluate(() => { window.__nyxTubeMockBlockedIds = []; });
    console.log("NyxTube test: restricted Chromebook video advanced to a playable recommendation");
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
    });
    const addressBounds = await discoveryPage.locator('form.browser-mode-address > input.browser-mode-url').boundingBox();
    assert(addressBounds?.width > 100, `Browser address field did not have usable geometry: ${JSON.stringify(addressBounds)}`);
    const addressBorder = discoveryPage.locator('form.browser-mode-address > .browser-mode-url-pointer-border');
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await discoveryPage.evaluate(() => {
        const field = document.querySelector('form.browser-mode-address > input.browser-mode-url');
        const bounds = field?.getBoundingClientRect();
        field?.focus();
        if (field && bounds) field.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: bounds.left + Math.min(120, bounds.width / 2), clientY: bounds.top + bounds.height / 2 }));
      });
      await discoveryPage.mouse.move(addressBounds.x + Math.min(120, addressBounds.width / 2), addressBounds.y + addressBounds.height / 2);
      await discoveryPage.waitForTimeout(100);
      const width = await discoveryPage.evaluate(() => document.querySelector('form.browser-mode-address > .browser-mode-url-pointer-border')?.getBoundingClientRect().width || 0);
      if (width > 100) break;
    }
    await addressBorder.waitFor({ state: "attached" });
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
