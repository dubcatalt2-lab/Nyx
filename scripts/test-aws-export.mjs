import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import express from 'express';
import {chromium} from 'playwright';
import {awsTemplate,q83c71,q64a29} from '../static-export/aws-template.mjs';
const root=process.argv[2];if(!root)throw Error('Pass the exported package path');
const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
for(const file of manifest.files){const bytes=readFileSync(join(root,file.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);}
assert(!existsSync(join(root,'site','server.js')));assert(!existsSync(join(root,'site','.env')));
const template=awsTemplate(),distribution=template.Resources.Distribution.Properties.DistributionConfig;
assert.equal(template.Resources.Uncached.Properties.CachePolicyConfig.MaxTTL,0);
assert.equal(template.Resources.ForwardService.Properties.OriginRequestPolicyConfig.CookiesConfig.CookieBehavior,'all');
assert(distribution.CacheBehaviors.find(item=>item.PathPattern==='api/*').AllowedMethods.includes('POST'));
const event=(origin='https://package.test',site='same-origin')=>({request:{uri:'/api/chat/messages',method:'POST',headers:{host:{value:'package.test'},origin:{value:origin},'sec-fetch-site':{value:site},authorization:{value:'fixture-token'},range:{value:'bytes=0-10'}},cookies:{example:{value:'fixture'}},querystring:{q:{value:'hello'}}}});
const mapped=q83c71(event(),'backend.test');assert.equal(mapped.headers.origin.value,'https://backend.test');assert.equal(mapped.headers.authorization.value,'fixture-token');assert.equal(mapped.headers.range.value,'bytes=0-10');assert.equal(mapped.cookies.example.value,'fixture');assert.equal(mapped.querystring.q.value,'hello');
assert.equal(q83c71(event('https://attacker.test'),'backend.test').statusCode,403);assert.equal(q83c71(event('null'),'backend.test').statusCode,403);assert.equal(q83c71(event('https://package.test','cross-site'),'backend.test').statusCode,403);
assert.equal(q64a29({request:{uri:'/apps/chat/'}}).uri,'/apps/chat/index.html');
const app=express();app.get(['/healthz','/api/nyxtube/status','/api/nyxify/status','/api/founder-profile/auth-config'],async(req,res)=>{try{const upstream=await fetch('https://vps-a556737a.vps.ovh.us'+req.originalUrl,{signal:AbortSignal.timeout(15000)});res.status(upstream.status).type(upstream.headers.get('content-type')||'application/json').send(Buffer.from(await upstream.arrayBuffer()));}catch{res.sendStatus(502);}});
app.use(express.static(join(root,'site'),{dotfiles:'allow'}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/');
 await page.waitForFunction(()=>document.querySelector('script[src*="@r"]'));
 for(const path of ['/healthz','/api/nyxtube/status','/api/nyxify/status','/api/founder-profile/auth-config']){const status=await page.evaluate(async path=>{const r=await fetch(path);await r.json();return r.status;},path);assert.equal(status,200,path);}
 const aliases=JSON.parse(readFileSync(join(root,'site/frontend-assets.json'),'utf8')).aliases;
 for(const path of ['/apps/nyxtube/','/apps/nyxify/','/ai.html','/apps/chat/'])assert.equal((await page.request.get(base+path)).status(),200,path);
 for(const path of ['/apps/nyxtube/app.js','/apps/nyxify/app.js','/apps/chat/app.js'])assert.equal((await page.request.get(base+aliases[path])).status(),200,path);
 console.log('PASS package integrity, opaque app assets, private-file exclusion, uncached authenticated routing, cross-site rejection, folder entries and live backend status/config through same-origin browser requests');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
