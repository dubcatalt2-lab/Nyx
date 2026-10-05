// Shared by the managed publisher and the browser's personal-token publisher.
export const staticBaseToken = '/__NYX_STATIC_BASE__/';
export const staticFolder = 'nyx-static';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const markerName = 'nyx-package.json';

export function validateStaticManifest(value) {
  if (value?.format !== 'nyx-static-package' || value.schema !== 1 || !/^[a-f0-9]{64}$/.test(value.revision)
    || !Array.isArray(value.files) || !value.files.length || value.files.length > 3000) throw Error('The static Nyx package is invalid. Rebuild Nyx before publishing.');
  const paths = new Set();
  let bytes = 0;
  for (const file of value.files) {
    if (typeof file.path !== 'string' || !/^[a-zA-Z0-9@!._ /()-]+$/.test(file.path)
      || file.path.split('/').some(part => !part || part === '.' || part === '..')
      || paths.has(file.path.toLowerCase()) || file.path === markerName
      || !['utf8', 'base64'].includes(file.encoding) || !/^[a-f0-9]{64}$/.test(file.sha256)
      || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 20_000_000) throw Error('The static package contains an unsupported file.');
    paths.add(file.path.toLowerCase());
    bytes += file.bytes;
  }
  if (bytes > 100_000_000 || !['index.html', 'nyx.svg', 'library-worker.js'].every(path => paths.has(path))) throw Error('The static package is incomplete or too large.');
  return value;
}

export function staticLauncher() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <title>Nyx</title><desc>Opens the packaged Nyx application from this repository.</desc>
  <foreignObject width="100%" height="100%"><body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;background:#080b09;color:#e3e9e5;font:16px system-ui;min-height:100vh;display:grid;place-content:center"><p>Opening Nyx...</p><a href="./${staticFolder}/Nyx.svg" style="color:inherit">Continue</a></body></foreignObject>
  <script><![CDATA[location.replace(new URL('./${staticFolder}/Nyx.svg', location.href).href);]]></script>
</svg>\n`;
}

function base64(bytes) {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}

async function digest(algorithm, bytes) {
  return [...new Uint8Array(await crypto.subtle.digest(algorithm, bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function blobSha(content) {
  const bytes = encoder.encode(content);
  const header = encoder.encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(header.length + bytes.length);
  all.set(header); all.set(bytes, header.length);
  return digest('SHA-1', all);
}

// Returns a subtree for the eventual atomic commit. It never updates a branch.
export async function prepareStaticPackage({ api, repository, branch, headTree, manifest, readBytes, onProgress, writeIntervalMs = 0 }) {
  validateStaticManifest(manifest);
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) || !branch || branch.length > 200) throw Error('Invalid static package repository.');
  const repoPath = repository.split('/').map(encodeURIComponent).join('/');
  const base = `/gh/${repoPath}@${encodeURIComponent(branch)}/${staticFolder}/`;
  const marker = JSON.stringify({ format: manifest.format, schema: 1, revision: manifest.revision, base });
  const apiRoot = `/repos/${repoPath}/git`;
  const root = await api(`${apiRoot}/trees/${encodeURIComponent(headTree)}`);
  if (root.truncated || !Array.isArray(root.tree)) throw Error('The repository tree could not be verified safely.');
  const existing = root.tree.find(entry => entry.path === staticFolder);
  if (existing) {
    if (existing.type !== 'tree') throw Error('The reserved nyx-static path already contains another file.');
    const subtree = await api(`${apiRoot}/trees/${encodeURIComponent(existing.sha)}`);
    if (subtree.truncated || !Array.isArray(subtree.tree)) throw Error('The existing static package could not be verified.');
    const saved = subtree.tree.find(entry => entry.path === markerName && entry.type === 'blob');
    if (!saved) throw Error('The nyx-static folder is not a Nyx package. Choose another repository.');
    if (saved.sha === await blobSha(marker)) return { path: staticFolder, mode: '040000', type: 'tree', sha: existing.sha };
    const blob = await api(`${apiRoot}/blobs/${encodeURIComponent(saved.sha)}`);
    let previous;
    try { previous = JSON.parse(atob(blob.content.replace(/\s/g, ''))); } catch {}
    if (previous?.format !== manifest.format || previous?.schema !== 1) throw Error('The nyx-static folder belongs to another project.');
  }
  let lastWrite = 0;
  const post = async (path, body) => {
    const wait = lastWrite + writeIntervalMs - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    lastWrite = Date.now();
    return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  };
  let treeSha;
  let entries = [];
  let payloadBytes = 0;
  const flush = async () => {
    if (!entries.length) return;
    const tree = await post(`${apiRoot}/trees`, { ...(treeSha ? { base_tree: treeSha } : {}), tree: entries });
    if (!tree.sha) throw Error('GitHub did not return the static package tree.');
    treeSha = tree.sha; entries = []; payloadBytes = 0;
  };
  const append = async entry => {
    const size = encoder.encode(JSON.stringify(entry)).length;
    if (entries.length && (payloadBytes + size > 4_500_000 || entries.length >= 500)) await flush();
    entries.push(entry); payloadBytes += size;
  };
  let completed = 0;
  for (const file of manifest.files) {
    let bytes = new Uint8Array(await readBytes(file.path));
    if (bytes.length !== file.bytes || await digest('SHA-256', bytes) !== file.sha256) throw Error(`The static package file failed verification: ${file.path}`);
    let content;
    if (file.encoding === 'utf8') {
      content = decoder.decode(bytes).replaceAll(staticBaseToken, base)
        .replaceAll(staticBaseToken.replaceAll('/', '\\/'), base.replaceAll('/', '\\/'));
      bytes = encoder.encode(content);
    }
    if (file.encoding === 'base64' || bytes.length > 1_000_000) {
      const blob = await post(`${apiRoot}/blobs`, { content: base64(bytes), encoding: 'base64' });
      if (!blob.sha) throw Error('GitHub did not return the static asset.');
      await append({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    } else await append({ path: file.path, mode: '100644', type: 'blob', content });
    onProgress?.(++completed, manifest.files.length);
  }
  await append({ path: markerName, mode: '100644', type: 'blob', content: marker });
  await flush();
  return { path: staticFolder, mode: '040000', type: 'tree', sha: treeSha };
}
