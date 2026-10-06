import { gzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';

export function validateSurgeToken(value) {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{8,512}$/.test(value)) {
    throw Object.assign(new Error('Enter a valid Surge API token. Run surge token in the Surge CLI to get it.'), { status: 400 });
  }
  return value;
}

export function surgeSiteArchive(origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Surge requires a public HTTPS Nyx origin.');
  const escaped = url.origin.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const html = Buffer.from(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nyx</title><style>html,body{margin:0;height:100%;background:#000;color:#ddd;font:14px system-ui}iframe{display:block;border:0;width:100%;height:calc(100% - 30px)}footer{height:30px;display:flex;align-items:center;justify-content:center}a{color:inherit}</style></head><body><iframe src="${escaped}/" title="Nyx" allow="fullscreen; clipboard-read; clipboard-write; autoplay; microphone; camera" allowfullscreen></iframe><footer><a href="${escaped}/" target="_blank" rel="noopener">Open Nyx directly</a></footer></body></html>`);
  const header = Buffer.alloc(512);
  const field = (value, offset, length) => header.write(value, offset, length, 'ascii');
  field('site/index.html', 0, 100);
  field('0000644\0', 100, 8);
  field('0000000\0', 108, 8);
  field('0000000\0', 116, 8);
  field(html.length.toString(8).padStart(11, '0') + '\0', 124, 12);
  field(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12);
  header.fill(32, 148, 156);
  field('0', 156, 1);
  field('ustar\0', 257, 6);
  field('00', 263, 2);
  field(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return { body: gzipSync(Buffer.concat([header, html, Buffer.alloc((512 - html.length % 512) % 512 + 1024)])), size: html.length };
}

export async function publishSurgeLink({ origin, label, token }, request = fetch) {
  validateSurgeToken(token);
  const prefix = String(label || 'nyx').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'nyx';
  const domain = `${prefix}-${randomBytes(12).toString('hex')}.surge.sh`;
  const archive = surgeSiteArchive(origin);
  const fail = message => Object.assign(new Error(message), { status: 502 });
  let response;
  try {
    response = await request(`https://surge.surge.sh/${domain}`, {
      method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(120_000),
      headers: { Authorization: `Basic ${Buffer.from(`token:${token}`).toString('base64')}`, 'Content-Type': 'application/gzip', Accept: 'application/x-ndjson', version: '1.0.0', 'file-count': '1', 'project-size': String(archive.size), message: 'Publish Nyx link', ssl: 'true' },
      body: archive.body
    });
  } catch { throw fail('Could not reach Surge. Check your Surge projects before retrying; an interrupted publish may have completed.'); }
  if (!response.ok) {
    await response.body?.cancel();
    throw fail(response.status === 401 ? 'Surge rejected the token. Get a new token with surge token.' : response.status === 403 || response.status === 429 ? 'Surge denied this publish. Check your account verification, token permissions and publish limits.' : 'Surge could not publish this link. Try again later.');
  }
  let pending = '', received = 0, complete = false;
  const decoder = new TextDecoder();
  const parse = line => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'collect') throw fail('Surge requires a plan change. Review your account at surge.sh; Nyx has not purchased anything.');
    if (event.type === 'error') throw fail('Surge could not finish publishing. Check your Surge account before retrying.');
    if (event.type === 'info') complete = true;
  };
  try {
    for await (const chunk of response.body) {
      received += chunk.length;
      if (received > 1024 * 1024) throw fail('Surge returned an unexpectedly large response.');
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop();
      lines.forEach(parse);
    }
    parse(pending + decoder.decode());
  } catch (error) {
    if (error.status === 502) throw error;
    throw fail('Surge interrupted the publish. Check your Surge projects before retrying.');
  }
  if (!complete) throw fail('Surge did not confirm publication. Check your Surge projects before retrying.');
  return [{ name: domain, url: `https://${domain}/` }];
}
