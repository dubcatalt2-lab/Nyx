import { chromium } from "playwright";

const baseUrl = process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10_000);
  const errors = [];
  const requests = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { try { localStorage.setItem("nyx.theme", "ruby"); } catch {} });
  await page.route("**/api/founder-profile/auth-config", route => route.fulfill({ contentType: "application/json", body: "{}" }));
  await page.route("**/api/nyx-ai/models", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ models: [{ id: "chatgpt-5.4-mini", label: "Nyx Mini" }] }) }));
  await page.route("**/api/nyx-ai", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ text: "Start by giving the button an accessible label and checking the click handler." }) });
  });

  await page.goto(`${baseUrl}/apps/code-studio/`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-code-input]").waitFor();
  assert(await page.locator("body").evaluate(body => body.classList.contains("theme-ruby")), "Code Sandbox did not inherit the selected Nyx theme");
  assert(await page.locator("[data-preview-empty]").isVisible(), "Preview did not show its polished empty state before the first run");
  assert(await page.locator("[data-resize-panel]").count() === 2, "Desktop workspace is missing a panel resizer");
  const desktopPanels = await page.locator(".assistant-panel, .editor-card, .result-card").evaluateAll(panels => panels.map(panel => panel.getBoundingClientRect().width));
  assert(desktopPanels.every(width => width > 260), `Desktop panels are not balanced: ${desktopPanels.join(", ")}`);
  assert((await page.locator("[data-highlight]").innerText()).includes("#172033"), "Editor did not preserve code text");
  assert(!(await page.locator("[data-highlight]").innerText()).includes('class="syntax-'), "Editor highlight leaked markup into the displayed code");
  assert(await page.locator("[data-highlight] .syntax-tag").count() > 0, "Editor did not render syntax highlighting");
  const selectionStyle = await page.locator("[data-code-input]").evaluate(editor => {
    editor.focus();
    editor.setSelectionRange(24, 72);
    const style = getComputedStyle(editor, "::selection");
    return { color: style.color, fill: style.webkitTextFillColor };
  });
  assert(selectionStyle.color === "rgba(0, 0, 0, 0)" && selectionStyle.fill === "rgba(0, 0, 0, 0)", `Editor selection exposed the transparent input layer (${selectionStyle.color}; ${selectionStyle.fill})`);
  if (process.env.NYX_TEST_STUDIO_SELECTION_SCREENSHOT) await page.screenshot({ path: process.env.NYX_TEST_STUDIO_SELECTION_SCREENSHOT, fullPage: false });
  await page.locator("[data-code-input]").evaluate(editor => editor.setSelectionRange(0, 0));
  const assistantWidthBefore = (await page.locator(".assistant-panel").boundingBox()).width;
  await page.locator('[data-resize-panel="assistant"]').focus();
  await page.keyboard.press("ArrowRight");
  const assistantWidthAfter = (await page.locator(".assistant-panel").boundingBox()).width;
  assert(assistantWidthAfter > assistantWidthBefore, "Assistant panel divider did not resize from the keyboard");
  await page.keyboard.press("ArrowLeft");
  const previewToggle = page.locator('[data-toggle-panel="preview"]');
  await previewToggle.click();
  assert(await page.locator("body").evaluate(body => body.classList.contains("preview-collapsed")), "Preview panel did not collapse");
  await previewToggle.click();
  assert(await page.locator(".result-card").isVisible(), "Preview panel did not reopen");
  const assistantToggle = page.locator('[data-toggle-panel="assistant"]');
  await assistantToggle.click();
  assert(await page.locator("body").evaluate(body => body.classList.contains("ai-collapsed")), "Nyx AI panel did not collapse");
  await assistantToggle.click();
  assert(await page.locator(".assistant-panel").isVisible(), "Nyx AI panel did not reopen");
  await page.locator("[data-run]").click();
  const preview = page.frameLocator("[data-preview]");
  await preview.getByText("Hello, Nyx").waitFor();
  assert((await page.locator("[data-preview]").boundingBox()).height > 120, "Preview frame is not visibly sized");
  assert(await page.locator("[data-output]").isHidden(), "Text output layer covered the live browser preview");
  assert(await page.locator("[data-preview]").getAttribute("sandbox") === "allow-scripts", "Web preview is not isolated in the expected sandbox");
  assert(await page.locator("[data-refresh-preview]").isEnabled(), "Preview refresh control did not enable after a run");
  await page.locator("[data-refresh-preview]").click();
  await preview.getByText("Hello, Nyx").waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-download-code]").click();
  const download = await downloadPromise;
  assert(download.suggestedFilename() === "index.html", "Download control did not export the active file name");
  await page.locator("[data-clear-code]").click();
  assert(await page.locator("[data-code-input]").inputValue() === "", "Clear control did not clear the editor");
  await page.locator("[data-load-starter]").click();
  assert((await page.locator("[data-code-input]").inputValue()).includes("<!doctype html>"), "Restore control did not restore the default starter");
  if (process.env.NYX_TEST_STUDIO_SCREENSHOT) await page.screenshot({ path: process.env.NYX_TEST_STUDIO_SCREENSHOT, fullPage: false });

  await page.locator("[data-language]").selectOption("javascript");
  await page.locator("[data-code-input]").fill('console.log("Nyx console ready");');
  await page.locator("[data-run]").click();
  await page.locator('[data-result-mode="terminal"]').click();
  await page.getByText("log: Nyx console ready").waitFor();
  await page.locator("[data-language]").selectOption("python");
  await page.locator("[data-run]").click();
  assert((await page.locator("[data-output]").innerText()).includes("intentionally limited"), "Non-web language did not stay in editor-only mode");
  await page.locator('[data-result-mode="terminal"]').click();
  assert((await page.locator("[data-output]").innerText()).includes("main.py"), "Terminal panel did not report the last run");
  await page.locator('[data-result-mode="problems"]').click();
  assert((await page.locator("[data-output]").innerText()).includes("No problems"), "Problems panel did not provide a result");
  await page.getByRole("button", { name: "Find issues" }).click();
  await page.getByText("Start by giving the button").waitFor();
  assert(await page.locator(".ai-message.is-user").count() === 1 && await page.locator(".ai-message.is-assistant").count() === 1, "Code helper did not render a conversation");
  assert(requests.length === 1, "Code helper did not send exactly one AI request");
  assert(requests[0].message.includes("main.py") && requests[0].message.includes("Current code") && requests[0].message.includes('def greet(name: str)'), "Code helper did not provide the language and current editor code");

  const shellPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  shellPage.setDefaultTimeout(12_000);
  const shellErrors = [];
  shellPage.on("pageerror", error => shellErrors.push(error.message));
  await shellPage.addInitScript(() => {
    localStorage.setItem("nyx.setupComplete", "true");
    localStorage.setItem("nyx.tosAcceptedVersion", "2026-07-30");
    localStorage.setItem("nyx.releaseNotes.2026-08-31-new-nyx.seen", "2026-08-31-new-nyx");
    localStorage.setItem("nyx.browserShellMode", "true");
    localStorage.setItem("nyx.homeDesign", "redesigned");
    localStorage.setItem("nyx.theme", "ruby");
    localStorage.setItem("nyx.popupProtection", "true");
  });
  await shellPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await shellPage.locator("#nyxStudyHubStartup").waitFor({ state: "hidden" });
  const discordLink = shellPage.locator(".nyx-discord-link");
  await discordLink.waitFor();
  assert((await discordLink.getAttribute("href")) === "https://discord.gg/cAdjYAJs3u", "Homepage Discord link has the wrong invite");
  assert((await discordLink.getAttribute("target")) === "_blank", "Homepage Discord link does not open separately");
  const discordVisibility = await discordLink.evaluate(link => ({ display: getComputedStyle(link).display, body: document.body.className }));
  assert(discordVisibility.display !== "none", `Homepage Discord link is not visible on the home page (${discordVisibility.display}; ${discordVisibility.body})`);
  assert((await discordLink.locator("svg").evaluate(icon => getComputedStyle(icon).fill)) === "none", "Homepage Discord symbol is not hollow");
  const dockBox = await shellPage.locator(".nyx-visual-dock").boundingBox();
  const discordBox = await discordLink.boundingBox();
  assert(!dockBox || !discordBox || discordBox.x + discordBox.width <= dockBox.x, "Homepage Discord link is covered by the right navigation rail");
  await shellPage.context().route("https://discord.gg/**", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Discord invite test</title>" }));
  const discordPopupPromise = shellPage.waitForEvent("popup");
  await discordLink.click();
  const discordPopup = await discordPopupPromise;
  assert(discordPopup.url().includes("discord.gg/cAdjYAJs3u"), "Trusted Discord link did not open the invite in a popup tab");
  await discordPopup.close();
  if (process.env.NYX_TEST_SCREENSHOT) {
    await shellPage.waitForTimeout(4000);
    await shellPage.screenshot({ path: process.env.NYX_TEST_SCREENSHOT, fullPage: false });
  }
  const codeSandbox = shellPage.locator('[data-nyx-visual-dock] [data-nyx-dock-item="code-sandbox"]');
  await codeSandbox.waitFor();
  assert(await codeSandbox.innerText() === "Code Sandbox", "Code Sandbox did not replace the Browse rail item");
  assert((await codeSandbox.locator("svg path").first().getAttribute("d"))?.startsWith("m9 7-5 5"), "Code Sandbox rail item is still using the generic Apps icon");
  assert(await shellPage.locator('[data-nyx-visual-dock] [data-nyx-dock-item="browse"]').count() === 0, "The retired Browse rail item is still present");
  await shellPage.locator('[data-nyx-visual-dock] [data-nyx-dock-item="apps"]').click();
  await shellPage.waitForFunction(() => {
    const frame = document.querySelector("iframe.view.active");
    try { return Boolean(frame?.contentDocument?.querySelector('[data-global-app-id="code-studio"]')); } catch { return false; }
  });
  const catalogCodeApps = await shellPage.locator("iframe.view.active").evaluate(frame => [...frame.contentDocument.querySelectorAll('[data-global-app-id^="code-"]')].map(tile => ({
    id: tile.dataset.globalAppId,
    name: tile.textContent.trim(),
    icon: tile.querySelector("img")?.getAttribute("src") || ""
  })));
  const sandboxCatalogEntry = catalogCodeApps.find(app => app.id === "code-studio");
  assert(sandboxCatalogEntry?.name === "Code Sandbox", "Apps catalog did not show Code Sandbox");
  assert(!catalogCodeApps.some(app => app.id === "code-tutorials"), "Nyx Code Tutorials is visible in the Apps catalog while it should be hidden");
  if (process.env.NYX_TEST_APPS_SCREENSHOT) await shellPage.screenshot({ path: process.env.NYX_TEST_APPS_SCREENSHOT, fullPage: false });
  await codeSandbox.evaluate(button => button.onclick?.({ preventDefault() {}, stopPropagation() {} }));
  await shellPage.locator('iframe.view[src*="/apps/code-studio/"]').waitFor();
  await shellPage.frameLocator('iframe.view[src*="/apps/code-studio/"]').locator('[data-code-studio]').waitFor();

  await page.setViewportSize({ width: 1024, height: 768 });
  let hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!hasOverflow, "Code Studio has horizontal overflow at 1024px");
  await page.setViewportSize({ width: 390, height: 780 });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  assert(await page.locator(".result-card").isVisible(), "Mobile Preview switch did not show the result panel");
  if (process.env.NYX_TEST_STUDIO_MOBILE_SCREENSHOT) await page.screenshot({ path: process.env.NYX_TEST_STUDIO_MOBILE_SCREENSHOT, fullPage: false });
  await page.getByRole("button", { name: "AI", exact: true }).click();
  assert(await page.locator(".assistant-panel").isVisible(), "Mobile AI switch did not show the assistant panel");
  await page.getByRole("button", { name: "Close Nyx AI" }).click();
  assert(await page.locator(".editor-card").isVisible(), "Closing mobile AI did not return to the editor");
  hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert(!hasOverflow, "Code Studio has horizontal overflow on mobile");
  assert(errors.length === 0, `Browser errors: ${errors.join(" | ")}`);
  console.log("Code Sandbox test: sandbox preview, AI suggestion request, editor mode, and mobile layout passed");
} finally {
  await browser.close();
}
