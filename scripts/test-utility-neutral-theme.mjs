import { chromium } from "playwright";

const baseUrl = process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isGray(color) {
  const values = String(color).match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
  return values.length === 3 && Math.max(...values) - Math.min(...values) <= 1;
}

const cases = [
  {
    name: "API Keys",
    path: "/apps/api-keys/",
    surface: ".keys-card",
    inner: ".developer-nav",
    hover: '.developer-nav button[data-tab="usage"]'
  },
  {
    name: "Link Generator",
    path: "/apps/link-generator/",
    surface: ".generator-card",
    inner: ".form-panel",
    hover: '.access-tabs button[data-access-mode="administrator"]'
  },
  {
    name: "JSDelivr Publisher",
    path: "/apps/jsdelivr-publisher/",
    surface: ".publisher-card",
    inner: ".form-grid label",
    hover: ".file-display"
  }
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 760 }]) {
    for (const testCase of cases) {
      const page = await browser.newPage({ viewport });
      const pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      await page.route("**/api/**", route => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}"
      }));
      await page.goto(`${baseUrl}${testCase.path}`, { waitUntil: "domcontentloaded" });
      await page.locator(testCase.surface).waitFor();

      if (testCase.name === "Link Generator") {
        const jsdelivrLink = page.locator('.utility-nav-item[aria-label="Jsdelivr Links"]');
        assert(await jsdelivrLink.getAttribute("href") === "../jsdelivr-publisher/", "Link Generator does not expose the Jsdelivr Links publisher");
        assert((await jsdelivrLink.textContent())?.trim() === "Jsdelivr Links", "The publisher navigation label is not Jsdelivr Links");
        assert(await jsdelivrLink.locator("svg").isVisible(), `Jsdelivr Links navigation icon is hidden at ${viewport.width}px`);
      }

      const colors = await page.evaluate(({ surface, inner }) => {
        const style = selector => getComputedStyle(document.querySelector(selector));
        return {
          htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          bodyImage: getComputedStyle(document.body).backgroundImage,
          surfaceBackground: style(surface).backgroundColor,
          surfaceBorder: style(surface).borderTopColor,
          innerBackground: style(inner).backgroundColor,
          innerBorder: style(inner).borderTopColor,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        };
      }, { surface: testCase.surface, inner: testCase.inner });

      assert(colors.htmlBackground === "rgb(0, 0, 0)", `${testCase.name} HTML canvas is not jet black`);
      assert(colors.bodyBackground === "rgb(0, 0, 0)", `${testCase.name} body is not jet black`);
      assert(colors.bodyImage === "none", `${testCase.name} still renders the tinted dot background`);
      assert(colors.surfaceBackground === "rgb(8, 8, 8)", `${testCase.name} primary surface is not neutral black`);
      assert(isGray(colors.surfaceBorder), `${testCase.name} primary border is not neutral gray`);
      assert(isGray(colors.innerBackground), `${testCase.name} inner surface is color-tinted`);
      assert(isGray(colors.innerBorder), `${testCase.name} inner border is not neutral gray`);
      assert(!colors.overflow, `${testCase.name} overflows at ${viewport.width}px`);

      await page.locator(testCase.hover).hover();
      await page.waitForTimeout(220);
      const hoverBackground = await page.locator(testCase.hover).evaluate(node => getComputedStyle(node).backgroundColor);
      assert(isGray(hoverBackground), `${testCase.name} hover state is not neutral gray`);
      assert(pageErrors.length === 0, `${testCase.name} browser errors: ${pageErrors.join(" | ")}`);
      await page.close();
    }
  }
  console.log("Utility theme test: API Keys, Link Generator, and JSDelivr Publisher use jet-black canvases with gray surfaces, borders, hover states, and responsive layouts.");
} finally {
  await browser.close();
}
