import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.TUTSI_TEST_URL || "http://localhost:9091/tutsi";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  if(await page.locator("#customize-dialog").isVisible())await page.locator("#customize-dismiss").click();
  assert.equal(await page.locator("#all-apps button").count(), 16);
  assert.equal(await page.locator("#dock-apps button").count(), 4);
  assert.equal(await page.locator("#dock-apps img").count(), 0);
  assert.equal(await page.title(), "Tutsi Math");
  await page.screenshot({ path: process.env.TEMP + "/tutsi-redesign.png" });
  await page.locator('#dock-apps button[data-route="settings"]').click();
  await page.locator("input[value=frappe]").check();
  await page.selectOption("#accent", "pink");
  await page.selectOption("#tab-preset", "drive");
  assert(await page.locator("#close-prevention").isChecked());
  await page.locator("#close-prevention").uncheck();
  await page.reload();
  assert(!(await page.locator("#close-prevention").isChecked()));
  assert.equal(await page.title(), "My Drive - Google Drive");
  assert(await page.locator("input[value=frappe]").isChecked());
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim(),
    ),
    "#f4b8e4",
  );
  await page.locator("#close-prevention").check();
  const dialogEvent = page.waitForEvent("dialog");
  const reload = page.reload({ timeout: 3000 }).catch(() => {});
  const dialog = await dialogEvent;
  assert.equal(dialog.type(), "beforeunload");
  await dialog.dismiss();
  await reload;
  assert(await page.locator("#close-prevention").isChecked());
  await page.locator("#close-prevention").uncheck();
  await page.selectOption("#tab-preset", "tutsi");
  await page.locator("input[value=mocha]").check();
  await page.selectOption("#accent", "mauve");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const hash of ["home", "apps", "settings"]) {
    await page.goto(base + "#" + hash);
    await page.waitForTimeout(200);
    assert(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
      `Horizontal overflow: ${hash}`,
    );
  }
  await page.goto(base + "#home");
  await page.screenshot({ path: process.env.TEMP + "/tutsi-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const transport of ["epoxy", "libcurl", "wisp"]) {
    await page.goto(base + "#settings");
    await page.selectOption("#transport", transport);
    await page.goto(base + "#home");
    await page.fill("#query", "https://example.com");
    await page.locator("#search button").click();
    await page
      .frameLocator("#browser-stage iframe")
      .getByRole("heading", { name: "Example Domain" })
      .waitFor({ timeout: 30000 });
    await page.locator("#close-browser").click();
    console.log(transport + " real proxy navigation passed");
  }
  await page.goto(base + "#games");
  await page
    .frameLocator('#app-host iframe[title="Games"]')
    .locator("#gameSearch")
    .waitFor();
  await page
    .frameLocator('#app-host iframe[title="Games"]')
    .locator(".game-card")
    .first()
    .waitFor();
  assert(
    (await page
      .frameLocator('#app-host iframe[title="Games"]')
      .locator(".game-card")
      .count()) > 0,
  );
  console.log("Games catalog loaded");
  for (const app of ["movies", "music", "ai"]) {
    await page.goto(base + "#" + app);
    const frame = page.locator("#app-host iframe:not([hidden])");
    await frame.waitFor();
    await page.waitForFunction(()=>document.querySelector('#app-host iframe:not([hidden])')?.contentDocument?.body?.innerText?.length>30,null,{timeout:15000});
    assert(
      (await frame.contentFrame().locator("body").innerText()).length > 30,
      `${app} empty`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Tutsi UI: 16 apps, mobile, themes, tab presets, native close dialog, three proxy transports and shared app shells passed.",
  );
} finally {
  await browser.close();
}
