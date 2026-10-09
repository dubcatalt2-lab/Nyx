export function retiredLinkGenerator(req,res,next) {
  let pathname;
  try { pathname=new URL(decodeURIComponent(req.path).replaceAll('\\','/'),'http://local').pathname.toLowerCase(); }
  catch { return next(); }
  if(pathname==='/api/link-generator/auth-config')return next();
  if(/^\/(?:apps|chapels)\/link-generator(?:\/|$)/.test(pathname))return res.status(410).set('Cache-Control','no-store').type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>App removed</title><body><h1>This app is no longer available.</h1><p><a href="/study.html">Return to Nyx</a></p></body></html>');
  if(/^\/api\/link-generator(?:\/|$)/.test(pathname))return res.status(410).set('Cache-Control','no-store').json({error:'This feature has been removed.'});
  next();
}
