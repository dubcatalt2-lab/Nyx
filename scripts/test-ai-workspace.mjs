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
    localStorage.setItem("nyx.aiPersonalKey.device","retired-fixture-key");
    localStorage.setItem("nyx.aiPersonalBaseUrl.device","https://api.ofox.ai/v1");
    localStorage.setItem("nyx.aiSharedProvider","huggingface");
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
  assert(await page.locator('#apiKeySettings,#apiKeyDialog').count()===0,'Retired personal provider options remain');
  assert(await page.locator('#providerSelect option').allTextContents().then(items=>items.join(','))==='OpenRouter','Only OpenRouter should be offered');
  await page.locator("#shareScreen").click();
  await page.locator("#screenPreview").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#screenVideo")?.videoWidth > 1);
  await page.locator("#input").fill("Read the visible screen text.");
  await page.locator("#form").evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector("#conversation")?.textContent?.includes("Screen frame received."));
  assert(chatRequests.length === 1, "Screen prompt did not make exactly one AI request");
  assert(/^data:image\/jpeg;base64,/.test(chatRequests[0].body?.image?.dataUrl || ""), "Screen prompt did not attach a captured JPEG frame");
  assert(chatRequests[0].body?.image?.screenCapture === true, "Screen prompt did not identify the image as an active screen-share frame");
  assert(!chatRequests[0].headers["x-nyx-ai-base-url"]&&!chatRequests[0].headers["x-nyx-ai-api-key"], "Retired personal credentials must never be sent");
  assert(await page.locator(".ai-answer .katex-display").count() === 6, "Adjacent, escaped, or unclosed display math was not rendered through KaTeX");
  assert(await page.locator(".ai-answer .katex").count() >= 7, "Inline and display math were not both rendered through KaTeX");
  assert((await page.locator(".ai-answer .katex-display").first().innerText()).includes("125"), "The reported fractional-exponent example was not rendered as display math");
  assert(!(await page.locator(".ai-answer").innerText()).includes("\\["), "Raw display-math delimiters remained visible in the AI answer");
  assert(!(await page.locator(".ai-answer").innerText()).includes("\\]"), "Raw display-math closing delimiters remained visible in the AI answer");
  assert(await page.locator("#screenPreview").isVisible(), "Screen sharing stopped after one prompt instead of remaining user-controlled");
  await page.locator("#stopScreenShare").click();
  assert(await page.locator("#screenPreview").isHidden(), "Stop did not end and hide screen sharing");

  const imageFile = { name: "attachment-test.png", mimeType: "image/png", buffer: Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32; canvas.height = 32;
    canvas.getContext("2d").fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  }), "base64") };
  for (const keyboard of [false, true]) {
    const picker = page.waitForEvent("filechooser");
    if (keyboard) { await page.locator("#attachImage").focus(); await page.keyboard.press("Enter"); }
    else await page.locator("#attachImage").click();
    await (await picker).setFiles(imageFile);
    await page.locator("#attachmentPreview").waitFor({ state: "visible" });
    assert(await page.locator("#attachmentThumbnail").evaluate(img => img.complete && img.naturalWidth === 32), "Selected image preview failed");
    if (!keyboard) {
      await page.locator("#removeAttachment").click();
      assert(await page.locator("#attachmentPreview").isHidden(), "Remove image did not clear the attachment");
    }
  }
  await page.locator("#input").fill("Describe this image.");
  await page.locator("#send").click();
  await page.waitForFunction(() => !document.querySelector("#send").disabled);
  assert(chatRequests.length === 2 && chatRequests[1].body.image?.dataUrl.startsWith("data:image/png;base64,"), "Image bytes were not sent to AI");
  assert(chatRequests[1].body.image.width === 32 && chatRequests[1].body.image.screenCapture === false, "Image metadata was not preserved");
  assert(await page.locator("#attachmentPreview").isHidden(), "Sent attachment was not cleared");

  await page.evaluate(()=>window.postMessage({type:'nyx:ai-open-key-settings'},location.origin));
  await page.locator('#imageInput').setInputFiles(imageFile);
  await page.route('**/api/nyx-ai',route=>route.fulfill({status:503,json:{error:'Image test: provider unavailable'}}));
  await page.locator('#input').fill('Retry image test');
  await page.locator('#send').click();
  await page.getByText('Image test: provider unavailable',{exact:true}).waitFor();
  assert(await page.locator('#attachmentPreview').isVisible(),'Failed request discarded the image needed for retry');

  await page.setViewportSize({ width: 390, height: 700 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!overflow, "AI workspace has horizontal overflow at mobile width");
  assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join(" | ")}`);
  console.log("AI workspace test: OpenRouter-only selection, image picker/preview/removal/send, keyboard activation, screen capture, multiline KaTeX formatting, stop control, and mobile layout passed");
} finally {
  await browser.close();
}
