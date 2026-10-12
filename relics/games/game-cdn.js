

export const gameCdnHosts = new Set(['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'gcore.jsdelivr.net', 'raw.githubusercontent.com', 'rawcdn.githack.com', 'raw.githack.com', 'unpkg.com']);

// Old catalogs are accepted as inputs; delivery uses the repository or npm mirror.
export function gameDeliveryUrl(value) {
  const url = new URL(value);
  if (!/(^|\.)jsdelivr\.net$/.test(url.hostname)) return url;
  let path = url.pathname;
  if (/^\/(?!gh\/|npm\/|combine\/)[\w.-]+\/[\w.-]+@[^/]+\//.test(path)) path = '/gh' + path;
  if (path.startsWith('/npm/')) {
    url.hostname = 'unpkg.com'; url.pathname = path.slice(4); return url;
  }
  const match = path.match(/^\/gh\/([^/]+)\/([^/@]+)(?:@([^/]+))?(\/.*)?$/);
  if (!match) throw new TypeError('Unsupported game source address');
  const ref = !match[3] || match[3] === 'latest' ? 'HEAD' : match[3];
  url.hostname = 'raw.githack.com';
  url.pathname = `/${match[1]}/${match[2]}/${ref}${match[4] || '/'}`;
  return url;
}

// Replace only the repository/package prefix, preserving asset paths and templates.
export function gameSourceText(text) {
  return String(text)
    .replace(/(?:https?:)?\/\/[\w.-]*jsdelivr\.net\/npm\//gi,'https://unpkg.com/')
    .replace(/(?:https?:)?\/\/[\w.-]*jsdelivr\.net\/gh\/([^/\s"'`<>]+)\/([^/@\s"'`<>]+)(?:@([^/\s"'`<>]+))?\//gi,
      (_match,owner,repository,ref)=>`https://raw.githack.com/${owner}/${repository}/${!ref||ref==='latest'?'HEAD':ref}/`);
}

export function gameRoutedSource(text,prefix='/gn-math-resource',convert=gameSourceText) {
  return convert(text).replace(/https?:\/\/(raw\.githubusercontent\.com|raw(?:cdn)?\.githack\.com|unpkg\.com)\//gi,
    (_match,host)=>`${prefix}/https/${host.toLowerCase()}/`);
}

export function repairGameResourcePath(pathname) {

  pathname=pathname.replace(/\/genizy\/google-class(?=@|\/)/g,'/taskmaster773/google-class')
    .replace(/\/gh\/genizy\/ovo-3-dimension@[^/]+\//g,'/gh/bubblfan/ovo-3-dimension@102179bf4242fd237c46c555ba154c2f325d351c/')
    .replace(/\/genizy\/ovo-3-dimension\/[^/]+\//g,'/bubblfan/ovo-3-dimension/102179bf4242fd237c46c555ba154c2f325d351c/')
    .replace(/\/genizy\/fnaf\/[^/]+\//g,'/bubblfan/fnaf/HEAD/');

  return pathname.replace(/(\/web-ports\/fear-and-hunger-2(?:@[^/]+|\/[^/]+)\/(?:js\/plugins|data)\/)([^/]+\.(?:js|json))$/i,(_all,root,file)=>root+file.toLowerCase());
}

export function normalizeGameCdnUrl(value, base) {
  try {
    const url = new URL(String(value), base);
    if (!['http:', 'https:'].includes(url.protocol) || !gameCdnHosts.has(url.hostname) || url.username || url.password || url.port) return null;
    if (url.hostname === 'cdn.jsdelivr.net' && /^\/(?!gh\/|npm\/|combine\/)[\w.-]+\/[\w.-]+@[^/]+\//.test(url.pathname)) url.pathname = '/gh' + url.pathname;
    url.pathname=repairGameResourcePath(url.pathname);
    return gameDeliveryUrl(url);
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
