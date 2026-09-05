import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const token = 'hf_local_mock_only';
const tokens = [token, 'hf_local_mock_second', 'hf_local_mock_third'];
process.env.NYX_HUGGINGFACE_API_KEY = token;
process.env.NYX_HUGGINGFACE_API_KEY_2 = tokens[1];
process.env.NYX_HUGGINGFACE_API_KEY_3 = tokens[2];
const realFetch = globalThis.fetch;
const requests = [];
const accounts = [];
let fail = false;
const mockFetch = async (url, options = {}) => {
  if (String(url).startsWith('https://router.huggingface.co/v1/')) {
    const account = tokens.indexOf(options.headers.authorization?.replace('Bearer ', ''));
    assert(account >= 0);
    if (String(url).endsWith('/models')) return Response.json({ data: [{ id: 'test/general' }, { id: 'test/Coder' }, ...(account === 1 ? [{ id: 'test/second-only' }] : [])] });
    assert.equal(String(url), 'https://router.huggingface.co/v1/chat/completions');
    const body = JSON.parse(options.body);
    requests.push(body);
    accounts.push(account);
    if (fail) return Response.json({ error: { message: `Denied ${tokens[account]}` } }, { status: 429, headers: { 'retry-after': '3600' } });
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
  assert(models.models.some(m => m.id === 'test/second-only'));
  for (const stream of [false, true, false]) {
    const reply = await realFetch(`${origin}/api/nyx-ai`, { method: 'POST', headers, body: JSON.stringify({ model: 'test/Coder', message: 'Review const answer = 42;', stream }) });
    assert.equal(reply.status, 200);
    const text = await reply.text();
    assert(text.includes('Code suggestion'));
    assert(!text.includes(token));
  }
  assert.deepEqual(accounts, [0, 1, 2], 'Requests should rotate across all three accounts');
  const exclusive = await realFetch(`${origin}/api/nyx-ai`, { method: 'POST', headers, body: JSON.stringify({ model: 'test/second-only', message: 'Hello', stream: false }) });
  assert.equal(exclusive.status, 200);
  assert.equal(accounts.at(-1), 1, 'A model must use an account whose catalog contains it');
  fail = true;
  const denied = await realFetch(`${origin}/api/nyx-ai`, { method: 'POST', headers, body: JSON.stringify({ model: 'test/Coder', message: 'Review code', stream: false }) });
  assert(!denied.ok);
  const deniedText = await denied.text();
  assert(tokens.every(value => !deniedText.includes(value)));
  const pausedAccount = accounts.at(-1);
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
  assert.notEqual(accounts.at(-1), pausedAccount, 'A rate-limited account must be skipped');
  await page.goto(`${origin}/ai.html`);
  await page.waitForFunction(() => document.querySelector('#providerSelect')?.value === 'huggingface');
  await page.waitForFunction(() => document.body.textContent.includes('test/Coder'));
  delete process.env.NYX_HUGGINGFACE_API_KEY;
  const secondaryOnly = await realFetch(`${origin}/api/nyx-ai/models`, { headers });
  assert.equal(secondaryOnly.status, 200, 'Secondary keys should work without a primary');
  delete process.env.NYX_HUGGINGFACE_API_KEY_2;
  delete process.env.NYX_HUGGINGFACE_API_KEY_3;
  const missing = await realFetch(`${origin}/api/nyx-ai/models`, { headers });
  assert.equal(missing.status, 503);
  process.env.NYX_HUGGINGFACE_API_KEY = tokens[2];
  const single = await realFetch(`${origin}/api/nyx-ai/models`, { headers });
  assert.equal(single.status, 200, 'The single-key configuration should remain compatible');
  assert((await single.json()).models.some(m => m.id === 'test/Coder'));
  console.log('Hugging Face: three-account rotation, model access, cooldown, single-key compatibility, streaming, secrets, AI picker, and sandbox context passed.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  globalThis.fetch = realFetch;
}
