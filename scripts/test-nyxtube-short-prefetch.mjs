import { chromium } from "playwright";

const baseUrl = process.env.NYX_TEST_BASE_URL || "http://127.0.0.1:8080";
const livePlayer = process.env.NYX_TEST_LIVE_PLAYER === "1";
const videos = [
  { id: "dQw4w9WgXcQ", title: "A test documentary", creator: "Nyx Test", channelId: "UC1234567890123456789012", channelAvatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%2386a9e8'/%3E%3C/svg%3E", description: "A full documentary description for the NyxTube watch page.", publishedAt: "2026-08-20T12:00:00.000Z", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", durationSeconds: 212, viewCount: 1203400, likeCount: 532, commentCount: 47, captions: true, isShort: false, sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "aqz-KE-bpKQ", title: "A second video", creator: "Test Studio", channelId: "UCabcdefghijklmnopqrstuv", channelAvatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Ccircle cx='24' cy='24' r='24' fill='%23d990b3'/%3E%3C/svg%3E", description: "This description must be visible below the selected video.", publishedAt: "2026-08-21T12:00:00.000Z", thumbnail: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg", durationSeconds: 73, viewCount: 8421, likeCount: 42, commentCount: 3, captions: true, isShort: true, sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" },
];
const shorts=Array.from({length:5},(_,i)=>({...videos[1],id:['aqz-KE-bpKQ','M7lc1UVf-VE','dQw4w9WgXcQ','jNQXAC9IVRw','9bZkp7q19f0'][i],title:i===0?'A second video':i===1?'Next test Short':'Short '+i}));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    hasTouch: true,
    userAgent: "Mozilla/5.0 (X11; CrOS x86_64 15917.65.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });
  page.setDefaultTimeout(8_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  if (!livePlayer) await page.addInitScript(() => {
    window.__nyxTubeOpenedProfiles = [];
    window.__nyxTubeOpenedChannels = [];
    window.open = url => { window.__nyxTubeOpenedChannels.push(String(url)); return null; };
    addEventListener("message", event => {
      if (event.data?.type === "nyx:nyxtube-profile-request") {
        postMessage({ type: "nyx:nyxtube-profile", requestId: event.data.requestId, profile: { uid: "nyxtube-test-user", signedIn: true, displayName: "Nyx Tester", handle: "@tester", avatarUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%2386a9e8'/%3E%3C/svg%3E" } }, location.origin);
      }
      if (event.data?.type === "nyx:nyxtube-open-profile") window.__nyxTubeOpenedProfiles.push(event.data.uid);
    });
    class MockPlayer {
      constructor(id, options) {
        this.node = document.getElementById(id);
        this.options = options;
        this.state = 5;
        this.current = 18;
        this.total = 212;
        this.muted = false;
        this.mute=undefined; // YouTube adds API methods only when ready.
        this.node.innerHTML = '<div data-mock-youtube-player style="width:100%;height:100%;background:linear-gradient(135deg,#121217,#23232a)"></div>';
        setTimeout(() => {
          if (Array.isArray(window.__nyxTubeMockBlockedIds) && window.__nyxTubeMockBlockedIds.includes(options.videoId)) {
            options.events?.onError?.({ target: this, data: 150 });
            return;
          }
          delete this.mute;
          options.events?.onReady?.({ target: this });
          options.events?.onStateChange?.({ target: this, data: this.state });
        }, 150);
      }
      loadVideoById(id){this.options.videoId=id;window.__shortReuse=(window.__shortReuse||0)+1;this.current=0;this.playVideo();}
      playVideo() { if(window.__blockShort===this.options.videoId){window.__blockShort='';this.options.events?.onAutoplayBlocked?.({target:this});return;}if(window.__stallShorts?.includes(this.options.videoId))return;this.state = 1; window.__nyxTubePlayerState = this.state; this.options.events?.onStateChange?.({ target: this, data: this.state }); }
      pauseVideo() { this.state = 2; window.__nyxTubePlayerState = this.state; this.options.events?.onStateChange?.({ target: this, data: 2 }); }
      getPlayerState() { return this.state; }
      getCurrentTime() { return this.current; }
      getDuration() { return this.total; }
      getAvailablePlaybackRates() { return [0.5, 1, 1.5, 2]; }
      getPlaybackRate() { return this.rate || 1; }
      setPlaybackRate(value) { this.rate = Number(value) || 1; window.__nyxTubeLastPlaybackRate = this.rate; }
      seekTo(value) { this.current = value; window.__nyxTubeLastSeek = value; }
      mute() { this.muted = true; }
      unMute() { this.muted = false; }
      isMuted() { return this.muted; }
      loadModule() {}
      unloadModule() {}
      destroy() { this.node?.replaceChildren(); }
    }
    window.YT = { Player: MockPlayer, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
  });
  await page.route("**/api/nyxtube/status", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true, provider: "youtube" }) }));
  await page.route("**/api/nyxtube/feed?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "youtube", videos }) }));
  await page.route("**/api/nyxtube/search?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "youtube", videos: [videos[1]] }) }));
  await page.route("**/api/nyxtube/shorts?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ provider: "youtube", videos: shorts }) }));
  await page.route("**/api/nyxtube/channel?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ channel: { title: "Test Studio", description: "Test channel" }, videos: [videos[1]] }) }));
  await page.route("**/api/nyxtube/community?**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({
    provider: "youtube",
    comments: { available: true, comments: [{ id: "comment-1", author: "Viewer One", avatarUrl: "", text: "This comment came from YouTube.", likeCount: 8, replyCount: 2, publishedAt: "2026-08-22T12:00:00.000Z" }] },
    transcript: { available: true, language: "English", segments: [{ startSeconds: 4, durationSeconds: 2.5, text: "Welcome to the test transcript." }, { startSeconds: 7, durationSeconds: 3, text: "This is the next caption line." }] }
  }) }));

  await page.goto(`${baseUrl}/apps/nyxtube/`, { waitUntil: "domcontentloaded" });
  console.log("NyxTube test: page loaded");
  assert(await page.locator(".site-nav").count() === 0, "Removed duplicate top navigation is still rendered");
  await page.locator(".video-card").first().waitFor();
  console.log("NyxTube test: feed rendered");  await page.locator('[data-view-button="shorts"]').click();
  await page.locator(livePlayer ? "[data-short-player] iframe" : "[data-mock-youtube-player]").first().waitFor({ state: "attached" });
  console.log("NyxTube test: Shorts player ready");
  if (process.env.NYX_TEST_SCREENSHOT_PATH) await page.screenshot({ path: process.env.NYX_TEST_SCREENSHOT_PATH.replace(/\.png$/i, "-shorts.png"), fullPage: true });
  assert(await page.locator("[data-short-title]").textContent() === "A second video", "Initial Short did not render");
  await page.waitForFunction(()=>document.querySelector('[data-short-player]').children.length===4);
  const prepared=await page.locator('[data-short-player]').evaluate(el=>Array.from(el.children).map(n=>n.id));
  assert(!(await page.locator('body').innerText()).includes('mute is not a function'),'Short activation must wait for player methods');
  await page.locator('[data-short-stage]').hover();await page.mouse.wheel(0,120);

  await page.getByText("Next test Short").waitFor();
  if(!livePlayer)assert(await page.locator('[data-short-player] > [id^=nyxtube-prepared-short-]').count()<=4,'Shorts warm pool must stay bounded');
  await page.waitForFunction(()=>document.querySelector('[data-short-player]').children.length===4);
  const nextPrepared=await page.locator('[data-short-player]').evaluate(el=>Array.from(el.children).map(n=>n.id));
  assert(nextPrepared.filter(id=>prepared.includes(id)).length===3,'Navigation must retain three prepared players');
  console.log("NyxTube test: Shorts navigation passed");
  assert(await page.locator("[data-short-title]").textContent() === "Next test Short", "Wheel navigation failed");
  await page.waitForTimeout(500);await page.mouse.wheel(0,-120);
  await page.waitForFunction(()=>document.querySelector('[data-short-title]').textContent==='A second video');
  await page.locator('[data-short-next]').click();
  await page.waitForFunction(()=>document.querySelector('[data-short-title]').textContent==='Next test Short');
  await page.locator('[data-short-previous]').click();
  await page.waitForFunction(()=>document.querySelector('[data-short-title]').textContent==='A second video');
  await page.waitForTimeout(500);
  const touch=await page.context().newCDPSession(page),box=await page.locator('[data-short-stage]').boundingBox();
  const swipe=async(up)=>{
    const x=box.x+box.width/2,start=box.y+(up?220:80),end=box.y+(up?80:220);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:end}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await swipe(true);
  await page.waitForFunction(()=>document.querySelector('[data-short-title]').textContent==='Next test Short');


  await page.waitForTimeout(500);await swipe(false);
  await page.waitForFunction(()=>document.querySelector('[data-short-title]').textContent==='A second video');
  await page.locator('body').click({position:{x:5,y:5}});await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>document.querySelector('[data-short-title]').textContent==='Next test Short');
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(()=>document.querySelector('[data-short-title]').textContent==='A second video');
  if(!livePlayer){
    await page.clock.install();
    await page.evaluate(()=>{window.__stallShorts=['M7lc1UVf-VE'];});
    await page.locator('[data-short-next]').click();
    await page.waitForFunction(()=>document.querySelector('[data-short-title]').textContent==='Next test Short');
    await page.clock.runFor(12100);
    assert((await page.locator('body').innerText()).includes('Retrying...'),'Stalled activation should retry once');
    await page.clock.runFor(12500);
    await page.waitForFunction(()=>document.querySelector('[data-short-title]').textContent==='A second video');
    await page.waitForFunction(()=>document.querySelector('[data-short-loading]').hidden);
    await page.clock.resume();
    await page.evaluate(()=>{window.__stallShorts=[];window.__blockShort='M7lc1UVf-VE';});
    await page.locator('[data-short-next]').click();
    await page.locator('[data-short-center-play]').waitFor({state:'visible'});
    await page.locator('[data-short-center-play]').click();
    await page.locator('[data-short-center-play]').waitFor({state:'hidden'});
  }
  await page.locator('[data-view-button=home]').click();
  assert(await page.locator('[data-short-player]').evaluate(el=>el.children.length)===0,'Short players must clean up on exit');
  assert(!pageErrors.length,'Shorts errors: '+pageErrors.join('; '));
  console.log('PASS Shorts warm player lifecycle and delayed readiness');
} finally { await browser.close(); }
