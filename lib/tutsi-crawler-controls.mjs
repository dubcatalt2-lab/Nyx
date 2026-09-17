// Honest crawler opt-out and a bounded trap counter; not a human-verification system.
export function installTutsiCrawlerControls(app) {
  const crawler=/(?:googlebot|bingbot|duckduckbot|baiduspider|yandexbot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|applebot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|claude-searchbot|anthropic-ai|perplexitybot|perplexity-user|bytespider|ccbot|amazonbot|cohere-ai)/i;
  let trapHits=0;
  app.get('/tutsi/resource-index',(_req,res)=>{
    trapHits++;
    if(trapHits<=5||trapHits%100===0)console.info(`Tutsi crawler trap: ${trapHits} requests`);
    res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}).status(404).type('text').send('Not found.');
  });
  app.use((req,res,next)=>{
    const host=String(req.hostname||'').toLowerCase();
    const scoped=host==='tutsi.nyxlearning.org'||/^\/(?:tutsi(?:\/|$)|apps\/tutsi(?:\/|$)|api\/tutsi-relay(?:\/|$))/.test(req.path);
    if(!scoped)return next();
    res.set('X-Robots-Tag','noindex, nofollow, noarchive');
    if(host==='tutsi.nyxlearning.org'&&req.path==='/robots.txt')return res.type('text').send('User-agent: *\nDisallow: /\n');
    if(req.path==='/healthz')return next();
    res.vary('User-Agent');
    if(crawler.test(String(req.get('user-agent')||'')))return res.set('Cache-Control','private, no-store').status(403).type('text').send('Automated access is not permitted.');
    next();
  });
}
