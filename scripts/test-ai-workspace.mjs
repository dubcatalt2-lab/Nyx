import { chromium } from "playwright";

const baseUrl = process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10_000);
  const pageErrors = [];
  const modelHeaders = [];
  const chatRequests = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getDisplayMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 960;
          canvas.height = 540;
          const context = canvas.getContext("2d");
          context.fillStyle = "#10243b";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "#ffffff";
          context.font = "36px sans-serif";
          context.fillText("Nyx screen sharing test", 80, 140);
          const stream = canvas.captureStream(5);
          window.__nyxScreenTestStream = stream;
          return stream;
        }
      }
    });
  });
  await page.route("**/api/founder-profile/auth-config", route => route.fulfill({ contentType: "application/json", body: "{}" }));
  await page.route("**/api/nyx-ai/providers", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ providers: [{ id: "shared", label: "Nyx Shared" }] }) }));
  await page.route("**/api/nyx-ai/models", async route => {
    modelHeaders.push(await route.request().allHeaders());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ models: [{ id: "test-vision", label: "Test Vision", company: "Nyx", vision: true }] }) });
  });
  await page.route("**/api/nyx-ai", async route => {
    chatRequests.push({ headers: await route.request().allHeaders(), body: route.request().postDataJSON() });
    const formattedAnswer = String.raw`Screen frame received. Solve for \(x\).
So:
\[
(5)^{-3} = \frac{1}{5^3} = \frac{1}{125}
\]

\[
-6x = 42 - 6 \quad\Rightarrow\quad -6x = 36
\]

\[
x = \frac{36}{-6} = -6
\]

\[
\boxed{-6}
\]

Double-escaped provider form:
\\[
y = \frac{10}{2}
\\]

Unclosed provider fence:
\[
z = \frac{9}{3}`;
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: formattedAnswer } }] })}\n\ndata: [DONE]\n\n`
    });
  });

  await page.goto(`${baseUrl}/ai.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#modelTrigger").waitFor();
  await page.locator("#apiKeySettings").click();
  await page.locator("#apiBaseOfox").click();
  assert(await page.locator("#apiBaseUrl").inputValue() === "https://api.ofox.ai/v1", "Ofox preset did not fill its OpenAI-compatible base URL");
  await page.locator("#apiKeyInput").fill("sk-ofox-browser-test-key");
  await page.locator("#apiKeyForm").evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => sessionStorage.getItem("nyx.aiPersonalKey.session") === "sk-ofox-browser-test-key");
  await page.waitForFunction(() => sessionStorage.getItem("nyx.aiPersonalBaseUrl.session") === "https://api.ofox.ai/v1");
  await page.waitForFunction(() => document.querySelector("#apiKeyDialog")?.open === false);
  assert(modelHeaders.some(headers => headers["x-nyx-ai-base-url"] === "https://api.ofox.ai/v1"), "Ofox base URL was not sent with the personal-key model request");

  await page.locator("#apiKeySettings").click();
  await page.locator("#apiProfileNew").click();
  await page.locator("#apiProfileLabel").fill("TokenMix");
  await page.locator("#apiKeyInput").fill("sk-tokenmix-browser-test-key");
  await page.locator("#apiBaseUrl").fill("https://api.tokenmix.ai/v1");
  await page.locator("#apiKeyForm").evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector("#apiKeyDialog")?.open === false);
  const savedProviderCount = await page.evaluate(() => {
    const read = (storage, key) => { try { return JSON.parse(storage.getItem(key) || "[]").length; } catch { return 0; } };
    return read(sessionStorage, "nyx.aiPersonalProfiles.session") + read(localStorage, "nyx.aiPersonalProfiles.device");
  });
  assert(savedProviderCount === 2, "Adding TokenMix replaced Ofox instead of preserving both providers");
  await page.locator("#apiKeySettings").click();
  await page.locator(".ai-key-profile-select").filter({ hasText: "Ofox" }).click();
  await page.waitForFunction(() => sessionStorage.getItem("nyx.aiPersonalBaseUrl.session") === "https://api.ofox.ai/v1");
  await page.locator("#apiKeyClose").click();

  await page.locator("#shareScreen").click();
  await page.locator("#screenPreview").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#screenVideo")?.videoWidth > 1);
  await page.locator("#input").fill("Read the visible screen text.");
  await page.locator("#form").evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector("#conversation")?.textContent?.includes("Screen frame received."));
  assert(chatRequests.length === 1, "Screen prompt did not make exactly one AI request");
  assert(/^data:image\/jpeg;base64,/.test(chatRequests[0].body?.image?.dataUrl || ""), "Screen prompt did not attach a captured JPEG frame");
  assert(chatRequests[0].body?.image?.screenCapture === true, "Screen prompt did not identify the image as an active screen-share frame");
  assert(chatRequests[0].headers["x-nyx-ai-base-url"] === "https://api.ofox.ai/v1", "Custom base URL was not sent with the chat request");
  assert(await page.locator(".ai-answer .katex-display").count() === 6, "Adjacent, escaped, or unclosed display math was not rendered through KaTeX");
  assert(await page.locator(".ai-answer .katex").count() >= 7, "Inline and display math were not both rendered through KaTeX");
  assert((await page.locator(".ai-answer .katex-display").first().innerText()).includes("125"), "The reported fractional-exponent example was not rendered as display math");
  assert(!(await page.locator(".ai-answer").innerText()).includes("\\["), "Raw display-math delimiters remained visible in the AI answer");
  assert(!(await page.locator(".ai-answer").innerText()).includes("\\]"), "Raw display-math closing delimiters remained visible in the AI answer");
  assert(await page.locator("#screenPreview").isVisible(), "Screen sharing stopped after one prompt instead of remaining user-controlled");
  await page.locator("#stopScreenShare").click();
  assert(await page.locator("#screenPreview").isHidden(), "Stop did not end and hide screen sharing");

  await page.setViewportSize({ width: 390, height: 700 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!overflow, "AI workspace has horizontal overflow at mobile width");
  assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join(" | ")}`);
  console.log("AI workspace test: provider profiles, screen capture, multiline KaTeX formatting, stop control, and mobile layout passed");
} finally {
  await browser.close();
}
