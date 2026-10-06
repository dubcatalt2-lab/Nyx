import { chromium } from "playwright";

const baseUrl = String(process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const chromeOsMode = process.env.NYX_TEST_CHROMEOS === "1";
const browser = await chromium.launch({
  headless: true,
  args: chromeOsMode ? [] : ["--autoplay-policy=no-user-gesture-required"]
});

try {
  const page = await browser.newPage({
    viewport: chromeOsMode ? { width: 1365, height: 768 } : { width: 1280, height: 800 },
    userAgent: chromeOsMode
      ? "Mozilla/5.0 (X11; CrOS x86_64 15917.71.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
      : undefined
  });
  const forcedVideoId = String(process.env.NYX_TEST_VIDEO_ID || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(forcedVideoId)) {
    await page.route("**/api/nyxify/full-track/*", route => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "octave", videoId: forcedVideoId, durationSeconds: 213, title: "Full song playback test" })
    }));
  }
  const pageErrors = [];
  const failedNyxifyRequests = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    const text = message.text();
    if (message.type() === "error" && !/Permissions policy violation: compute-pressure/i.test(text)) pageErrors.push(`console: ${text}`);
  });
  page.on("requestfailed", request => {
    if (request.url().includes("/api/nyxify/")) {
      failedNyxifyRequests.push(`${request.url()} :: ${request.failure()?.errorText || "failed"}`);
    }
  });

  await page.goto(`${baseUrl}/apps/nyxify/`, { waitUntil: "domcontentloaded" });
  const testQuery = String(process.env.NYX_TEST_QUERY || "Daft Punk Get Lucky").trim();
  if (testQuery) {
    await page.locator("#searchInput").fill(testQuery);
    await page.locator("#searchInput").press("Enter");
  }
  const expectedTrack = String(process.env.NYX_TEST_EXPECTED_TRACK || "").trim();
  const row = expectedTrack
    ? page.locator(".row[data-id]", { hasText: expectedTrack }).first()
    : page.locator(".row[data-id]").first();
  try {
    await row.waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    const message = String(await page.locator("#emptySub").textContent().catch(() => "") || "").trim();
    throw new Error(`Nyxify did not render a playable track${message ? `: ${message}` : ""}`, { cause: error });
  }
  const title = String(await row.locator(".t-title").textContent() || "Unknown track").trim();
  await row.click();
  try {
    await page.waitForFunction(() => {
      const stage = document.querySelector("#fullTrackStage");
      const progress = Number(document.querySelector("#seekBar")?.value || 0);
      return stage?.dataset.playbackState === "ready" || (stage?.dataset.playbackState === "playing" && progress > 0);
    }, null, { timeout: 30_000 });
    if (await page.locator('#fullTrackStage').getAttribute('data-playback-state') === 'ready') {
      await page.locator('#playBtn').click();
      await page.waitForFunction(() => document.querySelector('#fullTrackStage')?.dataset.playbackState === 'playing' && Number(document.querySelector('#seekBar')?.value || 0) > 0, null, { timeout: 15_000 });
    }
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      stageHidden: document.querySelector("#fullTrackStage")?.hidden,
      playbackState: document.querySelector("#fullTrackStage")?.dataset.playbackState,
      lastError: document.querySelector("#fullTrackStage")?.dataset.lastError,
      status: document.querySelector("#fullTrackStatus")?.textContent,
      progress: document.querySelector("#seekBar")?.value,
      frameTag: document.querySelector("#fullTrackFrame")?.tagName,
      frameSrc: document.querySelector("#fullTrackFrame")?.getAttribute("src")
    }));
    throw new Error(`Octave player did not reach playing state: ${JSON.stringify(diagnostic)}; errors: ${pageErrors.join(" | ")}`, { cause: error });
  }

  await page.locator("#seekBar").evaluate(slider => {
    slider.value = "50";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const label = String(document.querySelector("#timeCur")?.textContent || "0:00");
    const parts = label.split(":").map(Number);
    const seconds = parts.reduce((total, value) => total * 60 + (Number(value) || 0), 0);
    return document.querySelector("#fullTrackStage")?.dataset.playbackState === "playing" && seconds > 30;
  }, null, { timeout: 15_000 });
  const firstProgress = Number(await page.locator("#seekBar").inputValue());
  const firstCurrentSeconds = await page.locator("#timeCur").evaluate(element => String(element.textContent || "0:00").split(":").map(Number).reduce((total, value) => total * 60 + (Number(value) || 0), 0));
  await page.waitForTimeout(2_500);

  const state = await page.evaluate(() => {
    const audio = document.querySelector("#audio");
    const player = document.querySelector("#player");
    const stage = document.querySelector("#fullTrackStage");
    const frame = document.querySelector("#fullTrackFrame");
    const rect = frame?.getBoundingClientRect();
    return {
      playbackState: stage?.dataset.playbackState || "",
      status: document.querySelector("#fullTrackStatus")?.textContent || "",
      videoTitle: document.querySelector("#fullTrackTitle")?.textContent || "",
      progress: Number(document.querySelector("#seekBar")?.value || 0),
      currentLabel: document.querySelector("#timeCur")?.textContent || "",
      currentSeconds: String(document.querySelector("#timeCur")?.textContent || "0:00").split(":").map(Number).reduce((total, value) => total * 60 + (Number(value) || 0), 0),
      frameWidth: rect?.width || 0,
      frameHeight: rect?.height || 0,
      frameRight: rect?.right || 0,
      stageHeight: stage?.getBoundingClientRect().height || 0,
      previewPaused: audio?.paused ?? true,
      playerVisible: Boolean(player && getComputedStyle(player).display !== "none")
    };
  });

  if (pageErrors.length) throw new Error(`Nyxify page errors: ${pageErrors.join(" | ")}`);
  if (failedNyxifyRequests.length) throw new Error(`Nyxify request failures: ${failedNyxifyRequests.join(" | ")}`);
  if (state.playbackState !== "playing" || (state.progress <= firstProgress && state.currentSeconds <= firstCurrentSeconds) || !state.videoTitle || /octave/i.test(`${state.videoTitle} ${state.status}`) || state.frameWidth < 200 || state.frameHeight < 200 || state.frameRight >= 0 || state.stageHeight >= 90 || !state.previewPaused || !state.playerVisible) {
    throw new Error(`Nyxify Octave playback did not advance: ${JSON.stringify(state)}`);
  }
  await page.locator("#fullTrackVideo").click();
  await page.waitForURL(/\/apps\/nyxtube\/?\?video=[A-Za-z0-9_-]{11}/, { timeout: 15_000 });
  await page.locator('[data-view="watch"]:not([hidden])').waitFor({ state: 'visible', timeout: 20_000 });
  const nyxTubeTitle = String(await page.locator('[data-watch-title]').textContent() || '').trim();
  if (!nyxTubeTitle) throw new Error('NyxTube did not render the matched video title.');
  console.log(`Nyxify live full-song playback passed: ${title} advanced to ${state.currentLabel}; the matched video opened in NyxTube as ${nyxTubeTitle}.`);
} finally {
  await browser.close();
}
