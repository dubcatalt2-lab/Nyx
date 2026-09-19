// Decode only this origin's controller envelope; never decode a destination twice.
export function sourceWebsiteUrl(raw, origin) {
  try {
    const parsed = new URL(raw, origin);
    if (parsed.origin === origin) {
      const match = parsed.pathname.match(/^\/~\/tm\/[^/]+\/[^/]+\/(.+)$/);
      if (!match) return '';
      const target = new URL(decodeURIComponent(match[1]));
      if (parsed.search) target.search = parsed.search;
      if (parsed.hash) target.hash = parsed.hash;
      return /^https?:$/.test(target.protocol) ? target.href : '';
    }
    return /^https?:$/.test(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}

export function websiteAddress(value, engine = 'duckduckgo', origin = location.origin) {
  const text = String(value || '').trim();
  if (!text) throw new Error('Enter a website or something to search.');
  const decoded = sourceWebsiteUrl(text, origin);
  if (decoded) return decoded;
  const host = /^(localhost|(?:[a-z\d-]+\.)+[a-z\d-]+)(?::\d+)?(?:[/?#]\S*)?$/i;
  if (host.test(text)) return new URL((/^(?:localhost|(?:\d{1,3}\.){3}\d{1,3})(?::|\/|$)/i.test(text) ? 'http://' : 'https://') + text).href;
  if (/^https?:\/\//i.test(text)) return new URL(text).href;
  if (/^[a-z][a-z\d+.-]*:/i.test(text)) throw new Error('Use an http or https website address.');
  const prefixes = {duckduckgo:'https://duckduckgo.com/?q=',google:'https://www.google.com/search?q=',bing:'https://www.bing.com/search?q='};
  return (prefixes[engine] || prefixes.duckduckgo) + encodeURIComponent(text);
}
