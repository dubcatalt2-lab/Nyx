import {readFile, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
export function installNookDesktopRelease(app, {root = process.env.NOOK_DESKTOP_RELEASE_ROOT || '/var/lib/nyx/nook-desktop'} = {}) {
  root = resolve(root);
  async function manifest() {
    const raw = JSON.parse(await readFile(join(root, 'release.json'), 'utf8'));
    if (!/^\d+\.\d+\.\d+$/.test(raw.version) || !Array.isArray(raw.artifacts) || raw.artifacts.length > 2) throw Error('Invalid release');
    const artifacts = [];
    for (const item of raw.artifacts) {
      if (!['x64', 'arm64'].includes(item.arch) || item.file !== `Nook-Agent-${raw.version}-windows-${item.arch}-setup.exe` || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.size) || item.size < 1000000) throw Error('Invalid artifact');
      const file = join(root, raw.version, item.file), info = await stat(file);
      if (!info.isFile() || info.size !== item.size) throw Error('Release artifact unavailable');
      artifacts.push({arch: item.arch, size: item.size, sha256: item.sha256, file: item.file, url: `/download/nook/${raw.version}/${item.file}`});
    }
    if (!artifacts.some(item => item.arch === 'x64')) throw Error('Windows x64 release unavailable');
    return {version: raw.version, signed: raw.signed === true, artifacts};
  }
  app.get('/api/nook-desktop/release', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(await manifest()); } catch { res.status(503).json({error: 'A verified Windows download is not available right now.'}); }
  });
  app.get('/download/nook/:version/:file', async (req, res) => {
    try {
      const release = await manifest(), item = release.artifacts.find(item => item.file === req.params.file);
      if (req.params.version !== release.version || !item) return res.status(404).end();
      res.set({'Cache-Control': 'public, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/octet-stream'});
      res.download(join(root, release.version, item.file), item.file);
    } catch { res.status(404).end(); }
  });
}
