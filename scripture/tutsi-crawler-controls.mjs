import { isTutsiHostname } from "./tutsi-hostnames.mjs";
// Private workspace indexing policy and a bounded diagnostic counter.
export function installTutsiCrawlerControls(app) {
  let trapHits=0;
  app.get('/tutsi/resource-index',(_req,res)=>{
    trapHits++;
    if(trapHits<=5||trapHits%100===0)console.info(`Tutsi crawler trap: ${trapHits} requests`);
    res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}).status(404).type('text').send('Not found.');
  });
  app.use((req,res,next)=>{
    const host=String(req.hostname||'').toLowerCase();
    const scoped=isTutsiHostname(host)||/^\/(?:tutsi(?:\/|$)|apps\/tutsi(?:\/|$)|api\/tutsi-relay(?:\/|$))/.test(req.path);
    if(!scoped)return next();
    res.set('X-Robots-Tag','noindex, nofollow, noarchive');
    if(isTutsiHostname(host)&&req.path==='/robots.txt')return res.type('text').send('User-agent: *\nDisallow: /\n');
    if(req.path==='/healthz')return next();
    next();
  });
}
