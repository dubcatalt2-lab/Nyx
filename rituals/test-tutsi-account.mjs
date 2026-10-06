import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.TUTSI_TEST_URL || "http://localhost:9091/tutsi";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route("**/api/founder-profile/auth-config", (r) =>
    r.fulfill({
      json: { enabled: true, apiKey: "fixture", projectId: "fixture" },
    }),
  );
  await page.route("**/firebase-app.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: "export const getApps=()=>[];export const initializeApp=()=>({});",
    }),
  );
  await page.route("**/firebase-auth.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: `const auth={currentUser:null,authStateReady:async()=>{}};const listeners=[];export const browserLocalPersistence={};export const getAuth=()=>auth;export const setPersistence=async()=>{};export const onAuthStateChanged=(a,cb)=>{listeners.push(cb);queueMicrotask(()=>cb(a.currentUser))};export async function signInWithCustomToken(){auth.currentUser={uid:'fixture',displayName:'Test user',getIdToken:async()=>'fixture-id-token'};listeners.forEach(cb=>cb(auth.currentUser))}export async function signOut(){auth.currentUser=null;listeners.forEach(cb=>cb(null))}`,
    }),
  );
  await page.route("**/api/account/sign-in", (r) =>
    r.fulfill({ json: { customToken: "fixture-custom-token" } }),
  );
  await page.route("**/api/nyx-ai/providers", (r) =>
    r.fulfill({
      json: { providers: [{ id: "openrouter", label: "OpenRouter" }] },
    }),
  );
  await page.route("**/api/nyx-ai/models", (r) =>
    r.fulfill({
      json: {
        models: [{ id: "test-model", label: "Test model", company: "Test" }],
      },
    }),
  );
  let request;
  await page.route("**/api/nyx-ai", async (r) => {
    request = await r.request().allHeaders();
    await r.fulfill({
      contentType: "text/event-stream",
      body:
        "data: " +
        JSON.stringify({
          choices: [{ delta: { content: "Tutsi response fixture" } }],
        }) +
        "\n\ndata: [DONE]\n\n",
    });
  });
  await page.goto(base);
  if(await page.locator("#customize-dialog").isVisible())await page.locator("#customize-dismiss").click();
  if(await page.locator("#browser-home").isVisible()) await page.locator("#browser-home").click();
  await page.locator("#account-button").click();
  await page.fill("#identifier", "test-user");
  await page.fill("#password", "fixture-password");
  await page.locator("#sign-in button").click();
  await page.locator("#account-dialog").waitFor({ state: "hidden" });
  await page.locator("#dock-apps button[data-route=ai]").click();
  const ai = page.frameLocator('#app-host iframe[title="Tutsi AI"]');
  await ai
    .locator("#modelTrigger")
    .getByText("Test model", { exact: true })
    .waitFor();
  await ai.locator("#input").fill("Reply with a short answer.");
  await ai.locator("#form").evaluate((form) => form.requestSubmit());
  await ai
    .getByText("Tutsi response fixture", { exact: true })
    .waitFor({ timeout: 10000 })
    .catch(async (e) => {
      console.log((await ai.locator("body").innerText()).slice(-1800));
      throw e;
    });
  assert.equal(request.authorization, "Bearer fixture-id-token");
  assert.equal(
    await ai
      .locator(".ai-message-assistant .ai-message-meta strong")
      .textContent(),
    "Tutsi AI",
  );
  const rogueReply = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frame = document.createElement("iframe");
        frame.src = "about:blank";
        document.body.append(frame);
        const handler = (e) => {
          if (
            e.data?.requestId === "rogue" &&
            e.data?.type === "nyx:account-token-response"
          )
            resolve(e.data.token);
        };
        frame.contentWindow.addEventListener("message", handler);
        frame.contentWindow.eval(
          "parent.postMessage({type:'nyx:account-token-request',requestId:'rogue'},parent.location.origin)",
        );
        setTimeout(() => {
          frame.remove();
          resolve(null);
        }, 350);
      }),
  );
  assert.equal(rogueReply, null);
  console.log(
    "Mocked account sign-in, authenticated AI streaming, Tutsi response label and unregistered-frame token rejection passed. No paid generation.",
  );
  if(await page.locator("#browser-home").isVisible()) await page.locator("#browser-home").click();
  await page.locator("#account-button").click();
  await page.locator("#sign-out").click();
  await page.locator("#auth-mode").click();
  let signup;
  await page.route("**/api/account/register", (r) => {
    signup = r.request().postDataJSON();
    return r.fulfill({ json: { customToken: "fixture-custom-token" } });
  });
  await page.fill("#identifier", "new-tutsi-user");
  await page.fill("#password", "fixture-password");
  await page.locator("#auth-submit").click();
  await page.locator("#account-dialog").waitFor({ state: "hidden" });
  assert.deepEqual(signup, {
    username: "new-tutsi-user",
    email: "",
    password: "fixture-password",
  });
  console.log(
    "Tutsi registration uses the shared Nyx endpoint with optional email and signs in. No real account created.",
  );
  const clockPage = await browser.newPage();
  await clockPage.clock.install({ time: new Date("2026-09-16T19:59:58") });
  await clockPage.goto(base);
  await clockPage.clock.runFor(1000);
  assert.equal(await clockPage.locator(".clock-digit.flipping").count(), 1);
  await new Promise((resolve) => setTimeout(resolve, 650));
  assert.equal(await clockPage.locator(".clock-digit.flipping").count(), 0);
  await clockPage.clock.runFor(1000);
  assert.equal(
    await clockPage
      .locator(".clock-digit")
      .evaluateAll((ns) => ns.map((n) => n.dataset.value).join("")),
    "080000",
  );
  await clockPage.evaluate(
    () => (document.documentElement.dataset.motion = "reduce"),
  );
  await clockPage.clock.runFor(1000);
  assert.equal(await clockPage.locator(".clock-digit.flipping").count(), 0);
  console.log(
    "Clock digit changes, hour rollover, animation completion and reduced motion passed.",
  );
} finally {
  await browser.close();
}
