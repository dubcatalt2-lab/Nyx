import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const token = 'hf_local_mock_only';
process.env.NYX_HUGGINGFACE_API_KEY = token;
const realFetch = globalThis.fetch;
const requests = [];
let fail = false;
const mockFetch = async (url, options = {}) => {
  if (String(url).startsWith('https://router.huggingface.co/v1/')) {
    assert.equal(options.headers.authorization, `Bearer ${token}`);
    if (String(url).endsWith('/models')) return Response.json({ data: [{ id: 'test/general' }, { id: 'test/Coder' }] });
    assert.equal(String(url), 'https://router.huggingface.co/v1/chat/completions');
    const body = JSON.parse(options.body);
    requests.push(body);
    if (fail) return Response.json({ error: { message: `Denied ${token}` } }, { status: 401 });
    if (body.stream) return new Response('data: {"choices":[{"delta":{"content":"Code suggestion"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
    return Response.json({ choices: [{ message: { content: 'Code suggestion' } }] });
  }
  return realFetch(url, options);
};
const { app } = await import('../server.js');
globalThis.fetch = mockFetch;
const server = createServer(app);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const headers = { 'content-type': 'application/json', 'x-nyx-ai-provider': 'huggingface', origin };
let browser;
try {
  const providers = await (await realFetch(`${origin}/api/nyx-ai/providers`)).json();
  assert(providers.providers.some(p => p.id === 'huggingface'));
  assert(!JSON.stringify(providers).includes(token));
  const models = await (await realFetch(`${origin}/api/nyx-ai/models`, { headers })).json();
  assert(models.models?.some(m => m.id === 'test/Coder'), JSON.stringify(models).replaceAll(token, '[redacted]'));
  for (const stream of [false, true]) {
    const reply = await realFetch(`${origin}/api/nyx-ai`, { method: 'POST', headers, body: JSON.stringify({ model: 'test/Coder', message: 'Review const answer = 42;', stream }) });
    assert.equal(reply.status, 200);
    const text = await reply.text();
    assert(text.includes('Code suggestion'));
    assert(!text.includes(token));
  }
  fail = true;
  const denied = await realFetch(`${origin}/api/nyx-ai`, { method: 'POST', headers, body: JSON.stringify({ model: 'test/Coder', message: 'Review code', stream: false }) });
  assert(!denied.ok);
  assert(!(await denied.text()).includes(token));
  fail = false;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route('**/api/founder-profile/auth-config', r => r.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.goto(`${origin}/apps/code-studio/`);
  await page.locator('[data-code-input]').fill('const sandboxEvidence = 123;');
  await page.getByRole('button', { name: 'Find issues' }).click();
  await page.getByText('Code suggestion', { exact: true }).waitFor();
  assert.equal(requests.at(-1).model, 'test/Coder');
  assert(JSON.stringify(requests.at(-1).messages).includes('sandboxEvidence'));
  await page.goto(`${origin}/ai.html`);
  await page.waitForFunction(() => document.querySelector('#providerSelect')?.value === 'huggingface');
  await page.waitForFunction(() => document.body.textContent.includes('test/Coder'));
  delete process.env.NYX_HUGGINGFACE_API_KEY;
  const missing = await realFetch(`${origin}/api/nyx-ai/models`, { headers });
  assert.equal(missing.status, 503);
  console.log('Hugging Face: catalog, chat, streaming, secret redaction, AI picker, and sandbox code context passed.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  globalThis.fetch = realFetch;
}
