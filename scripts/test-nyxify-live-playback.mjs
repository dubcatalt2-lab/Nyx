import { chromium } from "playwright";

const baseUrl = String(process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"]
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  const failedNyxifyRequests = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => {
    if (request.url().includes("/api/nyxify/")) {
      failedNyxifyRequests.push(`${request.url()} :: ${request.failure()?.errorText || "failed"}`);
    }
  });

  await page.goto(`${baseUrl}/apps/nyxify/`, { waitUntil: "domcontentloaded" });
  const row = page.locator(".row[data-id]").first();
  try {
    await row.waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    const message = String(await page.locator("#emptySub").textContent().catch(() => "") || "").trim();
    throw new Error(`Nyxify did not render a playable track${message ? `: ${message}` : ""}`, { cause: error });
  }
  const title = String(await row.locator(".t-title").textContent() || "Unknown track").trim();
  await row.click();
  await page.waitForFunction(() => {
    const audio = document.querySelector("#audio");
    return Boolean(audio && !audio.paused && audio.currentTime > 0.35 && audio.readyState >= 2);
  }, null, { timeout: 30_000 });

  const state = await page.evaluate(() => {
    const audio = document.querySelector("#audio");
    const player = document.querySelector("#player");
    return {
      currentTime: audio?.currentTime || 0,
      duration: audio?.duration || 0,
      paused: audio?.paused ?? true,
      readyState: audio?.readyState || 0,
      sourcePath: audio ? new URL(audio.currentSrc || audio.src).pathname : "",
      playerVisible: Boolean(player && getComputedStyle(player).display !== "none")
    };
  });

  if (pageErrors.length) throw new Error(`Nyxify page errors: ${pageErrors.join(" | ")}`);
  if (failedNyxifyRequests.length) throw new Error(`Nyxify request failures: ${failedNyxifyRequests.join(" | ")}`);
  if (state.paused || state.currentTime <= 0.35 || state.readyState < 2 || !state.playerVisible) {
    throw new Error(`Nyxify audio did not advance: ${JSON.stringify(state)}`);
  }
  console.log(`Nyxify live playback passed: ${title} advanced to ${state.currentTime.toFixed(2)}s (${state.sourcePath}).`);
} finally {
  await browser.close();
}
