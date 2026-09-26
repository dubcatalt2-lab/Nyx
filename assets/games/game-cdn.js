// Keep the upstream directory in the proxy path: modules, CSS, workers and
// Unity manifests resolve relative resources against their own request URL.
export const gameCdnHosts = new Set(['cdn.jsdelivr.net', 'raw.githubusercontent.com', 'rawcdn.githack.com', 'raw.githack.com']);

export function repairGameResourcePath(pathname) {
  // This mirror lowercased RPG Maker data and plugin files, but not all references.
  return pathname.replace(/(\/web-ports\/fear-and-hunger-2@[^/]+\/(?:js\/plugins|data)\/)([^/]+\.(?:js|json))$/i,(_all,root,file)=>root+file.toLowerCase());
}

export function normalizeGameCdnUrl(value, base) {
  try {
    const url = new URL(String(value), base);
    if (!['http:', 'https:'].includes(url.protocol) || !gameCdnHosts.has(url.hostname) || url.username || url.password || url.port) return null;
    if (url.hostname === 'cdn.jsdelivr.net' && /^\/(?!gh\/|npm\/|combine\/)[\w.-]+\/[\w.-]+@[^/]+\//.test(url.pathname)) url.pathname = '/gh' + url.pathname;
    if(url.hostname==='cdn.jsdelivr.net')url.pathname=repairGameResourcePath(url.pathname);
    return url;
  } catch { return null; }
}

export function gameResourceUrl(value, base, origin) {
  const url = normalizeGameCdnUrl(value, base);
  return url ? `${origin}/gn-math-resource/${url.protocol.slice(0, -1)}/${url.host}${url.pathname}${url.search}${url.hash}` : String(value);
}

export function gameResourceTarget(requestUrl) {
  try {
    const request = new URL(requestUrl, 'https://nyx.invalid');
    const match = request.pathname.match(/^\/gn-math-resource\/(https?)\/([^/]+)(\/.*)$/);
    return match ? normalizeGameCdnUrl(`${match[1]}://${match[2]}${match[3]}${request.search}`) : null;
  } catch { return null; }
}
