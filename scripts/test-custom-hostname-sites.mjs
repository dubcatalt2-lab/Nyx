import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {tutsiHostnames,isTutsiHostname} from '../lib/tutsi-hostnames.mjs';
const source=readFileSync('server.js','utf8');
const declarations=source.slice(source.indexOf('function normalizeNyxCustomHostname('),source.indexOf('function nyxCustomHostnameTargetIps('));
const registration=source.slice(source.indexOf('app.post("/api/custom-hostnames",'),source.indexOf('app.get("/tutsi/connect-domain",'));
const records=new Map();let handler,writes=0,lookupIps=['15.204.93.166'];
const firestore={collection:()=>({doc:id=>({id,get:async()=>snapshot(id)})}),runTransaction:async cb=>cb({get:ref=>ref.get(),set:(ref,data)=>{writes++;records.set(ref.id,data);}})};
function snapshot(id){return {exists:records.has(id),data:()=>records.get(id)};}
const make=new Function('app','isIP','createHash','tutsiHostnames','isTutsiHostname','embeddedWispAllowedOrigins','process','firebaseAdminModeConfigured','linkGeneratorFirebase','nyxCustomHostnameTargetIps','sameOriginRequest','nyxCustomHostnameRateState','nyxClientIp','nyxCustomHostnameResolvedIps','cacheNyxCustomHostnameDecision',`
const nyxCustomHostnameCollectionName='fixture', nyxCustomHostnameRegistrationMaxAttempts=10,nyxCustomHostnameRegistrationWindowMs=60000;
${declarations}\n${registration}
return {site:customHostnameSite,id:nyxCustomHostnameDocumentId,normalize:normalizeNyxCustomHostname};`);
const api=make({post:(_path,fn)=>handler=fn},isIP,createHash,tutsiHostnames,isTutsiHostname,['https://nyxlearning.org','https://www.nyxlearning.org'],{env:{NYX_PUBLIC_ORIGIN:'https://nyxlearning.org'}},()=>true,async()=>({firestore}),()=>['15.204.93.166'],req=>req.same!==false,()=>({attempts:0}),()=> 'fixture',async()=>lookupIps,()=>{});
async function register(hostname,site,extra={}){const res={code:200,set(){return this},status(code){this.code=code;return this},json(body){this.body=body;return this}};await handler({body:{hostname,site},...extra},res);return res;}
for(const bad of ['localhost','*.example.org','https://example.org/path','127.0.0.1','https://user:pass@example.org'])assert.equal(api.normalize(bad),'');
assert.equal((await register('mytutsi.example.org','tutsi',{same:false})).code,403);
assert.equal((await register('nyxlearning.org','tutsi')).code,409);
assert.equal((await register('tutsi.nyxlearning.org','nyx')).code,409);
assert.equal((await register('mytutsi.example.org','other')).code,400);
lookupIps=['192.0.2.8'];assert.equal((await register('mytutsi.example.org','tutsi')).code,422);assert.equal(writes,0);
lookupIps=['15.204.93.166'];assert.equal(await api.site('mytutsi.example.org'),'nyx');
assert.equal((await register('mytutsi.example.org','tutsi')).code,201);
assert.equal(await api.site('mytutsi.example.org'),'tutsi');
assert.equal((await register('mytutsi.example.org','tutsi')).code,200);
assert.equal((await register('mytutsi.example.org','nyx')).code,409);
records.set(api.id('oldnyx.example.org'),{hostname:'oldnyx.example.org',status:'active'});
assert.equal((await register('oldnyx.example.org','tutsi')).code,409);
assert.equal(await api.site('oldnyx.example.org'),'nyx');
records.set(api.id('disabled.example.org'),{hostname:'disabled.example.org',status:'disabled',site:'tutsi'});
assert.equal((await register('disabled.example.org','tutsi')).code,409);
assert.equal(await api.site('disabled.example.org'),'nyx');
assert.equal(await api.site('nyxlearning.org'),'nyx');assert.equal(await api.site('childsupport.donateyourboat.us'),'tutsi');
console.log('Custom domains: DNS gate, origin gate, reserved hosts, immutable brands, disabled hosts, legacy records and cache invalidation passed.');
