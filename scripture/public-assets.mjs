import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export function privateSourcePath(path) {
  try { path = decodeURIComponent(path); } catch { return true; }
  if (path.includes('\\') || path.includes('\0')) return true;
  const parts = path.toLowerCase().split('/').filter(Boolean);
  if (parts.some(part => part.startsWith('.') && part !== '.well-known')) return true;
  if (/\.(?:ps1|py|sh|cmd|bat|map|ts)$/.test(path.toLowerCase())) return true;
  return /^(?:lib|scripture|scripts|rituals|deploy|mission|ministry|tools|services|ministries|tests?|node_modules|netlify|remote-host|hermitage|companion|deacon|static-export|lectionary|docs|scrolls)(?:\/|$)/.test(parts.join('/')) ||
    /^(?:server|wisp-server|shepherd|fellowship-server)\.js$|^(?:server-http-(?:wisp|fellowship)|fellowship-gateway)\.mjs$|^(?:package(?:-lock)?\.json|agents\.md)$/i.test(parts.join('/'));
}

export function publicAssetBoundary(root) {
  let aliases = {};
  let published = false;
  try { aliases = JSON.parse(readFileSync(join(root, 'public-modules.json'), 'utf8')).aliases; published = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const [from, to] of Object.entries(aliases)) {
    if (!from.startsWith('/') || !from.endsWith('.mjs') || !to.startsWith('/') || !to.endsWith('.js') || privateSourcePath(from) || privateSourcePath(to)) throw Error('Invalid public module mapping');
  }
  return (req, res, next) => {
    if (privateSourcePath(req.path)) return res.status(404).end();
    let path;
    try { path = decodeURIComponent(req.path); } catch { return res.status(400).end(); }
    if (Object.hasOwn(aliases, path)) return res.redirect(307, aliases[path] + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
    if (published && path.endsWith('.mjs')) return res.status(404).end();
    next();
  };
}
