const githubApi = 'https://api.github.com';
const githubApiVersion = '2022-11-28';
const maxSvgBytes = 2 * 1024 * 1024;
const maxLinksPerRun = 10_000;
const maxSvgsPerRepo = 1_000;
const maxTreeEntries = 1_000;
const maxTreePayloadBytes = 5_500_000;
const retryCount = 3;

const providers = Object.freeze({
  jsdelivr: (repo, branch, file) => `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${file}`,
  gcore: (repo, branch, file) => `https://gcore.jsdelivr.net/gh/${repo}@${branch}/${file}`,
  fastly: (repo, branch, file) => `https://fastly.jsdelivr.net/gh/${repo}@${branch}/${file}`
});

const form = document.getElementById('publisherForm');
const tokenInput = document.getElementById('token');
const modeInput = document.getElementById('mode');
const repoField = document.getElementById('repoField');
const repoInput = document.getElementById('repo');
const fileInput = document.getElementById('svgFile');
const fileField = document.getElementById('fileField');
const fileDisplay = document.getElementById('fileDisplay');
const fileHint = document.getElementById('fileHint');
const mainWordsInput = document.getElementById('mainWords');
const sideWordsInput = document.getElementById('sideWords');
const countInput = document.getElementById('count');
const publishButton = document.getElementById('publishButton');
const message = document.getElementById('publisherMessage');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const results = document.getElementById('results');
const resultsSummary = document.getElementById('resultsSummary');
const providerTabs = document.getElementById('providerTabs');
const linksOutput = document.getElementById('linksOutput');
const repositoryResults = document.getElementById('repositoryResults');
const copyLinksButton = document.getElementById('copyLinks');
const downloadLinksButton = document.getElementById('downloadLinks');
const openRandomButton = document.getElementById('openRandom');

let selectedProvider = 'jsdelivr';
let publishedResult = null;
let publishing = false;
let presetSvg = '';
const presetParameters = new URLSearchParams(location.search);
const presetCdn = { 'cdn.jsdelivr.net': 'jsdelivr', 'gcore.jsdelivr.net': 'gcore', 'fastly.jsdelivr.net': 'fastly' }[presetParameters.get('cdn')];
if (presetCdn) selectedProvider = presetCdn;
const presetName = presetParameters.get('preset') === 'nyx' ? 'nyx' : '';
const presetFilter = /^[a-z0-9_-]{1,80}$/i.test(presetParameters.get('filter') || '') ? presetParameters.get('filter') : '';
const presetMethod = presetParameters.get('method') === 'p2p' ? 'p2p' : '';
let presetPromise = Promise.resolve();

class GithubRequestError extends Error {
  constructor(status, detail) {
    super(`GitHub API ${status}: ${detail || 'Request failed'}`);
    this.name = 'GithubRequestError';
    this.status = status;
  }
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function splitWords(value) {
  return [...new Set(String(value || '').split(/[\n,]+/).map(word => slug(word)).filter(Boolean))];
}

function slug(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
}

function randomIndex(length) {
  if (length <= 1) return 0;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % length;
}

function pick(values) {
  return values[randomIndex(values.length)];
}

function repositoryApiPath(fullName) {
  return String(fullName).split('/').map(part => encodeURIComponent(part)).join('/');
}

function setMessage(text = '', type = '') {
  message.textContent = text;
  message.className = `publisher-message${type ? ` ${type}` : ''}`;
}

function setProgress(done, total, label = '') {
  const percent = total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
  progress.hidden = false;
  progressBar.style.width = `${percent}%`;
  if (label) setMessage(label);
}

function setPublishing(active) {
  publishing = active;
  publishButton.disabled = active;
  tokenInput.disabled = active;
  modeInput.disabled = active;
  repoInput.disabled = active;
  fileInput.disabled = active;
  mainWordsInput.disabled = active;
  sideWordsInput.disabled = active;
  countInput.disabled = active;
  publishButton.querySelector('span').textContent = active ? 'Publishing…' : 'Publish SVGs';
}

function initializePreset() {
  if (presetName !== 'nyx') return;
  const label = slug(presetParameters.get('label'));
  const requestedCount = Math.max(1, Math.min(maxLinksPerRun, Number.parseInt(presetParameters.get('count'), 10) || 1));
  mainWordsInput.value = [label, 'nyx', 'learning'].filter(Boolean).join(', ');
  sideWordsInput.value = 'study, school, portal, class, hub';
  countInput.value = String(requestedCount);
  fileInput.required = false;
  fileField.dataset.preset = 'nyx';
  fileDisplay.textContent = 'Nyx site SVG included';
  fileHint.textContent = 'The official Nyx site package is ready. Choose a file only if you want to replace it.';
  document.getElementById('publisher-title').textContent = 'Publish Nyx links';
  if (presetMethod === 'p2p') {
    modeInput.value = 'auto';
    document.getElementById('page-title').textContent = 'P2P Publisher';
    document.getElementById('publisher-title').textContent = 'Publish P2P Nyx links';
  }
  const source = presetParameters.get('source') === 'jsdelivr'
    ? 'https://cdn.jsdelivr.net/gh/dubcatalt2-lab/nyx-jsdelivr-links@main/1-learning-005847b5039fb2c8f4515165e0d79a17.svg'
    : './nyx-source.svg';
  if (presetParameters.get('source') === 'jsdelivr') {
    fileDisplay.textContent = 'Selected jsDelivr SVG';
    fileHint.textContent = 'Copies of the selected jsDelivr SVG will be published as new files in your repository.';
  }
  presetPromise = fetch(source, { cache: 'no-store', credentials: 'omit' })
    .then(response => {
      if (!response.ok) throw new Error(`Nyx SVG returned ${response.status}.`);
      return response.text();
    })
    .then(svg => { presetSvg = svg; })
    .catch(error => {
      presetSvg = '';
      setMessage(`The included Nyx SVG could not be loaded: ${error.message}`, 'error');
    });
}

async function githubFetch(path, token, options = {}) {
  const target = path.startsWith('https://') ? path : `${githubApi}${path}`;
  let lastError = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetch(target, {
        ...options,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': githubApiVersion,
          ...(options.headers || {})
        }
      });
      if (response.ok) return response;
      let detail = '';
      try {
        const payload = await response.json();
        detail = String(payload?.message || payload?.error || '').slice(0, 500);
        if (payload?.documentation_url) detail += ` (${payload.documentation_url})`;
      } catch {
        detail = String(await response.text().catch(() => '')).slice(0, 500);
      }
      const requestError = new GithubRequestError(response.status, detail);
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === retryCount) throw requestError;
      lastError = requestError;
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) ? Math.min(15_000, retryAfter * 1_000) : 500 * (2 ** attempt));
    } catch (error) {
      if (error instanceof GithubRequestError) {
        if (![429, 500, 502, 503, 504].includes(error.status) || attempt === retryCount) throw error;
      } else if (attempt === retryCount) {
        throw new Error(`Could not reach GitHub: ${error instanceof Error ? error.message : String(error)}`);
      }
      lastError = error;
      await sleep(500 * (2 ** attempt));
    }
  }
  throw lastError || new Error('GitHub request failed.');
}

async function githubJson(path, token, options = {}) {
  return (await githubFetch(path, token, options)).json();
}

async function getRepositoryFiles(fullName, branch, token) {
  const path = repositoryApiPath(fullName);
  try {
    const reference = await githubJson(`/repos/${path}/git/ref/heads/${encodeURIComponent(branch)}`, token);
    const commit = await githubJson(`/repos/${path}/git/commits/${reference.object.sha}`, token);
    const tree = await githubJson(`/repos/${path}/git/trees/${commit.tree.sha}?recursive=1`, token);
    if (!tree.truncated && Array.isArray(tree.tree)) return tree.tree.filter(item => item.type === 'blob').map(item => item.path);
  } catch (error) {
    if (!(error instanceof GithubRequestError) || ![404, 409].includes(error.status)) throw error;
  }
  const items = await githubJson(`/repos/${path}/contents?per_page=100`, token);
  return Array.isArray(items) ? items.filter(item => item.type === 'file').map(item => item.name) : [];
}

async function loadRepository(fullName, token) {
  const normalized = String(fullName || '').trim();
  let info;
  try {
    info = await githubJson(`/repos/${repositoryApiPath(normalized)}`, token);
  } catch (error) {
    if (error instanceof GithubRequestError && error.status === 404) return null;
    throw error;
  }
  if (info.private) throw new Error(`${normalized} is private. JSDelivr requires a public GitHub repository.`);
  const branch = String(info.default_branch || 'main');
  const files = await getRepositoryFiles(normalized, branch, token);
  const svgs = new Set();
  let maxNumber = 0;
  files.forEach(file => {
    if (!/\.svg$/i.test(file)) return;
    svgs.add(file.toLowerCase());
    const match = file.match(/-(\d+)\.svg$/i);
    if (match) maxNumber = Math.max(maxNumber, Number.parseInt(match[1], 10) || 0);
  });
  return { fullName: normalized, branch, svgs, maxNumber, free: Math.max(0, maxSvgsPerRepo - svgs.size) };
}

async function createRepository(name, token) {
  await githubJson('/user/repos', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: 'Nyx JSDelivr SVG publisher output', private: false, auto_init: true })
  });
}

async function getGitHead(repository, token) {
  const path = repositoryApiPath(repository.fullName);
  const reference = await githubJson(`/repos/${path}/git/ref/heads/${encodeURIComponent(repository.branch)}`, token);
  const commit = await githubJson(`/repos/${path}/git/commits/${reference.object.sha}`, token);
  return { commitSha: reference.object.sha, treeSha: commit.tree.sha };
}

function splitTreeBatches(fileNames, svg) {
  const batches = [];
  let batch = [];
  let bytes = 0;
  fileNames.forEach(file => {
    const entry = { path: file, mode: '100644', type: 'blob', content: svg };
    const entryBytes = new TextEncoder().encode(JSON.stringify(entry)).length;
    if (entryBytes > maxTreePayloadBytes) throw new Error('The SVG is too large for GitHub tree publishing.');
    if (batch.length && (batch.length >= maxTreeEntries || bytes + entryBytes > maxTreePayloadBytes)) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(entry);
    bytes += entryBytes;
  });
  if (batch.length) batches.push(batch);
  return batches;
}

async function publishTree(repository, fileNames, svg, token, onProgress) {
  const path = repositoryApiPath(repository.fullName);
  const head = await getGitHead(repository, token);
  let treeSha = head.treeSha;
  let completed = 0;
  for (const treeEntries of splitTreeBatches(fileNames, svg)) {
    const tree = await githubJson(`/repos/${path}/git/trees`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: treeSha, tree: treeEntries })
    });
    treeSha = tree.sha;
    completed += treeEntries.length;
    onProgress?.(completed);
  }
  const commit = await githubJson(`/repos/${path}/git/commits`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Add ${fileNames.length} JSDelivr SVG link${fileNames.length === 1 ? '' : 's'}`, tree: treeSha, parents: [head.commitSha] })
  });
  await githubJson(`/repos/${path}/git/refs/heads/${encodeURIComponent(repository.branch)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force: false })
  });
}

function generateFileNames(repository, amount, mainWords, sideWords) {
  const generated = [];
  let number = repository.maxNumber + 1;
  while (generated.length < amount) {
    const parts = [pick(mainWords), pick(sideWords), pick(sideWords)].filter(Boolean);
    const file = `${parts.join('-')}-${number}.svg`;
    number += 1;
    if (repository.svgs.has(file.toLowerCase())) continue;
    repository.svgs.add(file.toLowerCase());
    generated.push(file);
  }
  repository.maxNumber = number - 1;
  repository.free = Math.max(0, repository.free - generated.length);
  return generated;
}

async function findAutomaticRepository(owner, prefix, start, token) {
  let index = start;
  while (index <= 100) {
    const fullName = `${owner}/${prefix}-auto-${index}`;
    let repository = await loadRepository(fullName, token);
    if (!repository) {
      await createRepository(`${prefix}-auto-${index}`, token);
      for (let attempt = 0; attempt < 6 && !repository; attempt += 1) {
        if (attempt) await sleep(250 * attempt);
        repository = await loadRepository(fullName, token);
      }
      if (!repository) throw new Error(`GitHub created ${fullName}, but its default branch is not ready yet. Wait a moment and retry.`);
    }
    if (repository.free > 0) return { repository, nextIndex: index + 1 };
    index += 1;
  }
  throw new Error('No automatic repository slot is available.');
}

async function publishSvgs({ token, mode, repo, svg, mainWords, sideWords, count }) {
  const user = await githubJson('/user', token);
  const owner = String(user.login || '').trim();
  if (!owner) throw new Error('GitHub did not return an account for this token.');
  const repoResults = [];
  const links = [];
  let completed = 0;

  if (mode === 'existing') {
    const repository = await loadRepository(repo, token);
    if (!repository) throw new Error(`Repository not found or not accessible: ${repo}`);
    if (repository.free < count) throw new Error(`${repository.fullName} has room for ${repository.free} more SVG files. Use automatic repositories or choose a smaller count.`);
    const files = generateFileNames(repository, count, mainWords, sideWords);
    await publishTree(repository, files, svg, token, done => setProgress(completed + done, count, `Publishing ${completed + done} of ${count}…`));
    completed += files.length;
    repoResults.push({ repo: repository.fullName, branch: repository.branch, files });
    files.forEach(file => links.push({ repo: repository.fullName, branch: repository.branch, file }));
  } else {
    const prefix = mainWords[0] || 'nyx';
    let automaticIndex = 1;
    while (completed < count) {
      const automatic = await findAutomaticRepository(owner, prefix, automaticIndex, token);
      automaticIndex = automatic.nextIndex;
      const amount = Math.min(count - completed, automatic.repository.free);
      const files = generateFileNames(automatic.repository, amount, mainWords, sideWords);
      await publishTree(automatic.repository, files, svg, token, done => setProgress(completed + done, count, `Publishing ${completed + done} of ${count}…`));
      completed += files.length;
      repoResults.push({ repo: automatic.repository.fullName, branch: automatic.repository.branch, files });
      files.forEach(file => links.push({ repo: automatic.repository.fullName, branch: automatic.repository.branch, file }));
    }
  }
  return { requested: count, publishedCount: links.length, repos: repoResults, links };
}

function currentLinks() {
  if (!publishedResult) return [];
  const provider = providers[selectedProvider];
  return publishedResult.links.map(item => provider(item.repo, item.branch, item.file));
}

function renderResults() {
  if (!publishedResult) return;
  results.hidden = false;
  resultsSummary.textContent = `${publishedResult.publishedCount.toLocaleString()} links across ${publishedResult.repos.length.toLocaleString()} ${publishedResult.repos.length === 1 ? 'repository' : 'repositories'}.`;
  linksOutput.value = currentLinks().join('\n');
  providerTabs.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.provider === selectedProvider));
  repositoryResults.replaceChildren();
  publishedResult.repos.forEach(item => {
    const row = document.createElement('div');
    row.className = 'repo-result';
    const name = document.createElement('strong');
    name.textContent = item.repo;
    const count = document.createElement('span');
    count.textContent = `${item.files.length.toLocaleString()} SVG${item.files.length === 1 ? '' : 's'} · ${item.branch}`;
    row.append(name, count);
    repositoryResults.appendChild(row);
  });
  results.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

async function checkPresetLinks(urls, filter) {
  if (!filter || !urls.length) return '';
  let nextIndex = 0;
  const counts = { allowed: 0, blocked: 0, unknown: 0 };
  const worker = async () => {
    while (nextIndex < urls.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        const response = await fetch('/api/link-checker/check', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[index], vendor: filter }),
          cache: 'no-store'
        });
        const report = await response.json().catch(() => ({}));
        const vendors = report?.vendors && typeof report.vendors === 'object' ? report.vendors : {};
        const result = vendors[filter] || Object.values(vendors)[0] || report?.result || report;
        if (response.ok && result?.blocked === false) counts.allowed += 1;
        else if (response.ok && result?.blocked === true) counts.blocked += 1;
        else counts.unknown += 1;
      } catch {
        counts.unknown += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, urls.length) }, worker));
  if (counts.blocked) return `${counts.blocked} blocked, ${counts.allowed} allowed, and ${counts.unknown} unchecked by ${filter}.`;
  if (counts.unknown) return `${counts.allowed} allowed and ${counts.unknown} unchecked by ${filter}.`;
  return `All ${counts.allowed} ${counts.allowed === 1 ? 'link is' : 'links are'} allowed by ${filter}.`;
}

function initializeProviderTabs() {
  Object.keys(providers).forEach(provider => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.provider = provider;
    button.textContent = provider === 'jsdelivr' ? 'jsDelivr' : provider === 'gcore' ? 'Gcore' : 'Fastly';
    button.addEventListener('click', () => {
      selectedProvider = provider;
      renderResults();
    });
    providerTabs.appendChild(button);
  });
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  linksOutput.focus();
  linksOutput.select();
  document.execCommand('copy');
}

function downloadText(filename, value) {
  const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

modeInput.addEventListener('change', () => {
  const automatic = modeInput.value === 'auto';
  repoField.hidden = automatic;
  repoInput.required = !automatic;
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileDisplay.textContent = file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : (presetName === 'nyx' ? 'Nyx site SVG included' : 'Choose a self-contained SVG file');
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (publishing) return;
  const token = tokenInput.value.trim();
  const mode = modeInput.value;
  const repo = repoInput.value.trim();
  const file = fileInput.files?.[0];
  const mainWords = splitWords(mainWordsInput.value);
  const sideWords = splitWords(sideWordsInput.value);
  const count = Number.parseInt(countInput.value, 10);

  if (!token) return setMessage('Enter a GitHub token.', 'error');
  if (mode === 'existing' && !/^[^/\s]+\/[^/\s]+$/.test(repo)) return setMessage('Repository must look like owner/repository.', 'error');
  if (!file && !presetName) return setMessage('Choose an SVG file.', 'error');
  if (file && !/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') return setMessage('Only SVG files are accepted.', 'error');
  if (file && (file.size <= 0 || file.size > maxSvgBytes)) return setMessage('The SVG must be between 1 byte and 2 MB.', 'error');
  if (!mainWords.length) return setMessage('Add at least one main word.', 'error');
  if (!sideWords.length) return setMessage('Add at least one side word.', 'error');
  if (!Number.isSafeInteger(count) || count < 1 || count > maxLinksPerRun) return setMessage(`Choose between 1 and ${maxLinksPerRun.toLocaleString()} links.`, 'error');

  if (!file) await presetPromise;
  const svg = file ? await file.text() : presetSvg;
  if (!svg) return setMessage('The included Nyx SVG is unavailable. Choose an SVG file and try again.', 'error');
  if (new TextEncoder().encode(svg).length > maxSvgBytes) return setMessage('The SVG must be no larger than 2 MB.', 'error');
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement?.localName !== 'svg') return setMessage('The selected file is not valid SVG XML.', 'error');

  setPublishing(true);
  setMessage('Connecting directly to GitHub…');
  progress.hidden = false;
  progressBar.style.width = '2%';
  results.hidden = true;
  try {
    publishedResult = await publishSvgs({ token, mode, repo, svg, mainWords, sideWords, count });
    setProgress(count, count);
    setMessage(`Published ${publishedResult.publishedCount.toLocaleString()} SVG links.`, 'success');
    renderResults();
    if (presetFilter) {
      setMessage(`Published ${publishedResult.publishedCount.toLocaleString()} SVG links. Checking ${presetFilter}...`);
      const filterSummary = await checkPresetLinks(currentLinks(), presetFilter);
      setMessage(`Published ${publishedResult.publishedCount.toLocaleString()} SVG links. ${filterSummary}`, /blocked|unchecked/i.test(filterSummary) ? 'error' : 'success');
    }
  } catch (error) {
    publishedResult = null;
    results.hidden = true;
    setMessage(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    setPublishing(false);
  }
});

copyLinksButton.addEventListener('click', async () => {
  const value = currentLinks().join('\n');
  if (!value) return;
  try {
    await copyText(value);
    setMessage('Copied all CDN links.', 'success');
  } catch {
    setMessage('Clipboard access was blocked. Select and copy the links manually.', 'error');
  }
});

downloadLinksButton.addEventListener('click', () => {
  const value = currentLinks().join('\n');
  if (value) downloadText(`nyx-${selectedProvider}-links.txt`, `${value}\n`);
});

openRandomButton.addEventListener('click', () => {
  const links = currentLinks();
  if (!links.length) return;
  const opened = window.open(links[randomIndex(links.length)], '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
});

window.addEventListener('pagehide', () => { tokenInput.value = ''; });
initializeProviderTabs();
initializePreset();
modeInput.dispatchEvent(new Event('change'));
