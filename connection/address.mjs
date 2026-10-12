import {partitionOrigin,partitionSuffix} from './partition.mjs';

export function route(value, base, prefix) {
  const text = String(value);
  if (!text || text.startsWith('#')) return text;
  const url = new URL(text, base);
  const absolute=/^https?:/.test(prefix)?new URL(prefix):null;
  const path=absolute?.pathname||prefix;
  if (url.pathname.startsWith(path)) {
    try {
      const decoded=source(url.href, prefix);
      if(!absolute)return text;
      if(partitionSuffix(url.hostname)===partitionSuffix(absolute.hostname)&&url.origin===partitionOrigin(decoded,absolute.origin))return url.href;
    } catch {}
  }
  if (!['http:', 'https:'].includes(url.protocol)) return text;
  const hash = url.hash;
  url.hash = '';
  return (absolute?partitionOrigin(url.origin,absolute.origin)+path:prefix) + encodeURIComponent(url.href) + hash;
}

export function source(value, prefix) {
  const url = new URL(value);
  const path=/^https?:/.test(prefix)?new URL(prefix).pathname:prefix;
  if (!url.pathname.startsWith(path)) throw new Error('Unknown document route');
  const result = new URL(decodeURIComponent(url.pathname.slice(path.length)));
  if (!['http:', 'https:'].includes(result.protocol)) throw new Error('Unsupported document');
  for (const [name, value] of url.searchParams) result.searchParams.append(name, value);
  result.hash = url.hash;
  return result.href;
}

