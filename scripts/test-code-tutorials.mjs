import { chromium } from "playwright";

const baseUrl = process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080";
const assert = (value, message) => { if (!value) throw new Error(message); };
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(8_000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { try { localStorage.setItem("nyx.theme", "emerald"); } catch {} });
  await page.goto(`${baseUrl}/apps/code-tutorials/`, { waitUntil: "domcontentloaded" });
  await page.getByText("Start with values").waitFor();
  assert((await page.locator('link[rel="icon"]').getAttribute("href"))?.includes("code-tutorials.svg"), "Tutorials did not use its own app icon");
  assert(await page.locator("body").evaluate(body => body.classList.contains("theme-emerald")), "Tutorials did not inherit the Nyx theme");
  await page.getByRole("button", { name: "Python" }).click();
  await page.getByText("Python", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Mark complete" }).click();
  assert((await page.locator("[data-progress-label]").innerText()).includes("1 of 3"), "Completing a lesson did not update progress");
  await page.getByRole("button", { name: "JavaScript" }).click();
  await page.locator("[data-practice-code]").fill('console.log("Hello from Nyx")');
  await page.getByRole("button", { name: "Run example" }).click();
  await page.getByText("Hello from Nyx").waitFor();
  await page.setViewportSize({ width: 390, height: 780 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "Tutorials have horizontal overflow on mobile");
  assert(errors.length === 0, `Tutorial errors: ${errors.join(" | ")}`);
  console.log("Code Tutorials test: themed lessons, progress, practice, and mobile layout passed");
} finally {
  await browser.close();
}
