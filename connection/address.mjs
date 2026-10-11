export function route(value, base, prefix) {
  const text = String(value);
  if (!text || text.startsWith('#')) return text;
  const url = new URL(text, base);
  if (url.pathname.startsWith(prefix)) {
    try { source(url.href, prefix); return text; } catch {}
  }
  if (!['http:', 'https:'].includes(url.protocol)) return text;
  const hash = url.hash;
  url.hash = '';
  return prefix + encodeURIComponent(url.href) + hash;
}

export function source(value, prefix) {
  const url = new URL(value);
  if (!url.pathname.startsWith(prefix)) throw new Error('Unknown document route');
  const result = new URL(decodeURIComponent(url.pathname.slice(prefix.length)));
  if (!['http:', 'https:'].includes(result.protocol)) throw new Error('Unsupported document');
  for (const [name, value] of url.searchParams) result.searchParams.append(name, value);
  result.hash = url.hash;
  return result.href;
}

