export const retiredDropHosts = new Set(['drop.ridgewoodstem.org', 'drop.altarworship.org.uk']);

export function retiredDrop(req, res, next) {
  let pathname;
  try { pathname = new URL(decodeURIComponent(req.path).replaceAll('\\', '/'), 'http://local').pathname.toLowerCase(); }
  catch { return next(); }
  if (!retiredDropHosts.has(req.hostname.toLowerCase().replace(/\.$/, '')) && !/^\/(?:drop|(?:apps|chapels)\/drop|api\/drop-ai)(?:\/|$)/.test(pathname)) return next();
  return res.status(410).set('Cache-Control', 'no-store').type('text').send('This app has been removed.');
}
