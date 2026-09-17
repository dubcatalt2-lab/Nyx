import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const uid = "fixture-user-123";
  let profile = {
    displayName: "Test user",
    handle: "@testuser",
    bio: "Original bio",
    status: "online",
    avatarDecoration: "none",
    profileEffect: "none",
    avatarUrl: "",
    bannerUrl: "",
  };
  let writes = 0;
  let uploadChunks = 0;
  let rejectSave = false;
  await page.route("**/api/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    let data = {};
    if (path === "/api/founder-profile/auth-config")
      data = { enabled: true, projectId: "fixture", apiKey: "fixture" };
    if (path === "/api/founder-profile/owner")
      data = {
        founder: false,
        dashboard: false,
        role: "member",
        permissions: [],
      };
    if (path === "/api/account/sign-in") data = { customToken: "fixture" };
    if (path === "/api/account/me")
      data = { uid, email: "", role: "member", subscriptionStatus: "free" };
    if (
      path === "/api/profiles/me" &&
      r.request().method() === "PUT" &&
      rejectSave
    )
      return r.fulfill({
        status: 403,
        json: { error: "Profile changes are not allowed." },
      });
    if (path.startsWith("/api/profile-media/") && path.includes("/chunks/")) return r.fulfill({body:"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="});
    if (path.startsWith("/api/profile-media/")) {
      if (r.request().method() === "PUT") uploadChunks++;
      if (path.endsWith("/complete"))
        data = {
          url: "/api/profile-media/" + uid + "/avatar/fixtureavatar1234",
        };
      else if (r.request().method() === "GET")
        data = {
          mime: "image/png", totalChunks:1,
          dataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        };
    }
    if (path === "/api/profiles/me") {
      if (r.request().method() === "PUT") {
        writes++;
        profile = { ...profile, ...r.request().postDataJSON().profile };
      }
      data = { uid, profile, createdAt: "2026-07-01" };
    }
    if (path === "/api/profiles/" + uid)
      data = {
        uid,
        profile,
        self: true,
        role: "member",
        createdAt: "2026-07-01",
      };
    if (path === "/api/profiles")
      data = { profiles: [{ uid, profile, self: true, role: "member" }] };
    if (path.startsWith("/api/chat"))
      data = {
        me: {
          uid,
          displayName: profile.displayName,
          handle: profile.handle,
          role: "member",
        },
        channels: [],
        members: [],
        messages: [],
      };
    await r.fulfill({ json: data });
  });
  await page.route("**/firebase-app.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: "export const getApps=()=>[];export const initializeApp=()=>({});",
    }),
  );
  await page.route("**/firebase-auth.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: `const user={uid:'fixture-user-123',displayName:'Test user',email:'',getIdToken:async()=>'fixture-token'};const auth={currentUser:localStorage.fixtureSignedIn?user:null,authStateReady:async()=>{}};const listeners=[];export const browserLocalPersistence={};export const getAuth=()=>auth;export const setPersistence=async()=>{};export const onAuthStateChanged=(a,cb)=>{listeners.push(cb);queueMicrotask(()=>cb(a.currentUser))};export async function signInWithCustomToken(){localStorage.fixtureSignedIn='1';auth.currentUser=user;listeners.forEach(cb=>cb(user));return {user}}export async function signOut(){localStorage.removeItem('fixtureSignedIn');auth.currentUser=null;listeners.forEach(cb=>cb(null))}`,
    }),
  );
  await page.goto("http://localhost:9091/tutsi");
  if(await page.locator("#customize-dialog").isVisible())await page.locator("#customize-dismiss").click();
  assert.deepEqual(
    await page
      .locator("#dock-apps button")
      .evaluateAll((es) => es.map((e) => e.textContent)),
    ["AI", "Music", "Settings", "YouTube"],
  );
  assert.equal(
    await page.locator("#dock-apps button[data-route=ai] circle").count(),
    2,
  );
  if(await page.locator("#browser-home").isVisible()) await page.locator("#browser-home").click();
  await page.locator("#account-button").click();
  await page.fill("#identifier", "testuser");
  await page.fill("#password", "test-password");
  await page.locator("#auth-submit").click();
  await page.locator("#account-dialog").waitFor({ state: "hidden" });
  if(await page.locator("#browser-home").isVisible()) await page.locator("#browser-home").click();
  await page.locator("#account-button").click();
  await page.locator("#edit-profile").click();
  const f = page.frameLocator('iframe[title="Profiles"]');
  await f.locator("[name=displayName]").waitFor({ timeout: 15000 });
  await f.locator("#tutsi-theme").waitFor({ state: "attached" });
  await f.locator("body").evaluate(() => document.fonts.ready);
  await f.locator("[name=displayName]").fill("Tutsi friend");
  await f.locator("[name=bio]").fill("Shared profile fixture");
  const decorations = await f
    .locator("select[name=avatarDecoration] option")
    .evaluateAll((es) =>
      es.filter((e) => e.value !== "none" && !e.disabled).map((e) => e.value),
    );
  const effects = await f
    .locator("select[name=profileEffect] option")
    .evaluateAll((es) =>
      es
        .filter(
          (e) => e.value !== "none" && !e.disabled && e.value !== "custom",
        )
        .map((e) => e.value),
    );
  assert(decorations.length && effects.length);
  await f.locator("select[name=avatarDecoration]").selectOption(decorations[0]);
  await f.locator("select[name=profileEffect]").selectOption(effects[0]);
  await f
    .locator("input[name=avatarFile]")
    .setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page.screenshot({
    path: process.env.TEMP + "/tutsi-profile-editor.png",
  });
  await f.locator(".nyx-user-profile-form [type=submit]").click();
  await page.waitForFunction(() => location.hash !== "#profiles", {
    timeout: 10000,
  });
  assert.equal(profile.displayName, "Tutsi friend");
  assert.equal(writes, 1);
  assert(uploadChunks > 0);
  assert.equal(profile.avatarDecoration, decorations[0]);
  assert.equal(profile.profileEffect, effects[0]);
  assert.equal(
    profile.avatarUrl,
    "/api/profile-media/" + uid + "/avatar/fixtureavatar1234",
  );
  if(await page.locator("#browser-home").isVisible()) await page.locator("#browser-home").click();
  await page.locator("#account-button").click();
  await page.waitForFunction(()=>document.querySelector('#account-name').textContent==='Tutsi friend' && document.querySelector('#account-button img')?.naturalWidth > 0);
  assert.equal(await page.locator('#account-handle').textContent(), '@testuser');
  assert.equal(await page.locator('#account-dialog').evaluate(e=>e.classList.contains('account-dropdown')),true);
  assert(!/nyx/i.test(await page.locator('#account-dialog').innerText()));
  await page.locator('#account-close').click();
  for (const [route, requestType, responseType] of [['ai','nyx:ai-profile-request','nyx:ai-profile'],['youtube','nyx:nyxtube-profile-request','nyx:nyxtube-profile']]) {
    await page.evaluate(route=>location.hash=route,route);
    // Locate the registered frame by its source, without making a real AI request.
    await page.waitForFunction(route=>[...document.querySelectorAll('iframe')].some(f=>!f.hidden && f.src.includes(route==='ai'?'/ai':'/nyxtube')),route);
    const handle=await page.locator('iframe').first().evaluateHandle((_,route)=>[...document.querySelectorAll('iframe')].find(f=>!f.hidden && f.src.includes(route==='ai'?'/ai':'/nyxtube')),route);
    const target=await handle.asElement().contentFrame();
    await target.waitForLoadState('domcontentloaded');
    const payload=await target.evaluate(({requestType,responseType})=>new Promise(resolve=>{
      const listener=e=>{if(e.source===parent && e.data?.type===responseType){removeEventListener('message',listener);resolve(e.data.profile)}};
      addEventListener('message',listener);parent.postMessage({type:requestType,requestId:'profile-fixture'},location.origin);
    }),{requestType,responseType});
    assert.equal(payload.displayName,'Tutsi friend');assert.equal(payload.handle,'@testuser');assert(payload.avatarUrl.startsWith('blob:'));
  }
  await page.evaluate(()=>location.hash='home');
  await page.locator('#account-button').click();
  await page.locator("#view-profile").click();
  await f
    .locator(".nyx-user-profile-heading h2")
    .filter({ hasText: "Tutsi friend" })
    .waitFor();
  await page.locator("#browser-home").click();
  await page.locator('.header-actions a[href="#chat"]').click();
  const chat = page.frameLocator('iframe[title="Chat"]');
  await chat.locator("body").waitFor();
  await page.locator("#browser-home").click();
  await page.locator("#dock-apps [data-route=settings]").click();
  await chat
    .locator("body")
    .evaluate(() =>
      parent.postMessage(
        {
          type: "nyx:chat-notification",
          kind: "mention",
          notificationId: "test",
          sender: "Friend",
          preview: "Hello <script>not markup</script>",
        },
        location.origin,
      ),
    );
  await page.locator("#mention-toast").waitFor();
  assert(
    (await page.locator("#mention-toast p").textContent()).includes("<script>"),
  );
  assert.equal(await page.locator("#mention-toast script").count(), 0);
  await page.locator("#mention-open").click();
  assert.equal(new URL(page.url()).hash, "#chat");
  await chat
    .locator("body")
    .evaluate(() =>
      parent.postMessage(
        { type: "nyx:chat-open-profile", uid: "fixture-user-123" },
        location.origin,
      ),
    );
  await f.locator(".nyx-user-profile-heading h2").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  if(await page.locator("#browser-home").isVisible()) await page.locator("#browser-home").click();
  await page.locator("#account-button").click();
  await page.locator("#edit-profile").click();
  await f.locator("[name=bio]").waitFor();
  assert.equal(
    await f
      .locator("body")
      .evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await page.waitForTimeout(400);
  await page.screenshot({
    path: process.env.TEMP + "/tutsi-profile-mobile.png",
  });
  const bounds = await f.locator(".nyx-user-profile-dialog").boundingBox();
  assert(bounds.x >= 0 && bounds.width <= 390);
  rejectSave = true;
  await f.locator("[name=bio]").fill("Rejected change");
  await f.locator(".nyx-user-profile-form [type=submit]").click();
  await f
    .locator(".nyx-founder-editor-error")
    .filter({ hasText: "Profile changes are not allowed." })
    .waitFor();
  assert.equal(profile.bio, "Shared profile fixture");
  assert.deepEqual(errors, []);
  console.log(
    "Shared profile editing/viewing, chat profile bridge, safe mention toast, icons and mobile editor passed with fixtures.",
  );
} finally {
  await browser.close();
}
