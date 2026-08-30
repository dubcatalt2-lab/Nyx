import assert from "node:assert/strict";
import { app } from "../server.js";

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});

const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browserHeaders = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Sec-Fetch-Dest": "document",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36"
};

try {
  for (const userAgent of ["Discordbot/2.0", "OAI-SearchBot/1.0; +https://openai.com/searchbot"]) {
    const preview = await fetch(`${origin}/`, {
      headers: { Accept: "text/html,*/*", "User-Agent": userAgent }
    });
    const previewHtml = await preview.text();
    assert.equal(preview.status, 200);
    assert.match(previewHtml, /Student Learning Portal/, `${userAgent} did not receive the decoy`);
    assert.doesNotMatch(previewHtml, /<script\b|script\.js|Nyx/i, `The decoy exposed a Nyx browser runtime to ${userAgent}`);
    assert.match(preview.headers.get("x-robots-tag") || "", /noindex/i);
    assert.match(preview.headers.get("cache-control") || "", /no-store/i);
  }

  const automated = await fetch(`${origin}/apps/nyxify/`, {
    headers: { Accept: "text/html", "User-Agent": "curl/8.15.0" }
  });
  assert.match(await automated.text(), /Student Learning Portal/);

  const normalHome = await fetch(`${origin}/`, { headers: browserHeaders });
  const normalHomeHtml = await normalHome.text();
  assert.equal(normalHome.status, 200);
  assert.match(normalHomeHtml, /script\.js/);
  assert.doesNotMatch(normalHomeHtml, /Student Learning Portal/);

  const normalMusic = await fetch(`${origin}/apps/nyxify/`, { headers: browserHeaders });
  const normalMusicHtml = await normalMusic.text();
  assert.equal(normalMusic.status, 200);
  assert.match(normalMusicHtml, /Nyxify\/built in music/);

  const health = await fetch(`${origin}/healthz`, { headers: { "User-Agent": "curl/8.15.0" } });
  assert.equal(health.headers.get("content-type")?.includes("application/json"), true);
  assert.equal((await health.json()).ok, true);

  const apps = await fetch(`${origin}/api/apps`, { headers: { "User-Agent": "Discordbot/2.0" } });
  assert.equal(apps.headers.get("content-type")?.includes("application/json"), true);
  assert.equal(Array.isArray((await apps.json()).apps), true);

  const robots = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": "Googlebot/2.1" } });
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /User-agent:/i);

  console.log("Nyx automated-request decoy regressions passed.");
} finally {
  await new Promise(resolve => server.close(resolve));
}
