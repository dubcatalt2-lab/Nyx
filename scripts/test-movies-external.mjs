import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import express from 'express';
const source=readFileSync('script.js','utf8');
const start=source.indexOf('  function normalizeInternalAppUrl('),end=source.indexOf('  function homeShortcuts()',start);
const context=vm.createContext({educationShortcutTitles:new Map()});
vm.runInContext(source.slice(start,end)+';globalThis.normalize=normalizeHomeShortcut',context);
for(const url of ['/apps/movies/','/apps/movies/index.html','apps/movies/','https://cinejoy.to/'])assert.equal(context.normalize({url,title:'Movies'}).url,'https://cinejoy.to/');
assert(source.includes("['movies','nyx-movies','Movies','https://cinejoy.to/']"));
assert(!existsSync('apps/movies/app.js'));assert(!existsSync('lib/movies.mjs'));
const serverSource=readFileSync('server.js','utf8');const a=serverSource.indexOf('app.get(/^\\/apps\\/movies'),b=serverSource.indexOf('\nfunction linkGeneratorRateState',a);assert(a>0&&b>a);
const app=express();Function('app',serverSource.slice(a,b))(app);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{const origin='http://127.0.0.1:'+server.address().port;for(const path of ['/apps/movies','/apps/movies/','/apps/movies/index.html']){const response=await fetch(origin+path,{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'https://cinejoy.to/');}assert.equal((await fetch(origin+'/api/movies/search')).status,410);console.log('PASS Movies: legacy shortcuts and routes open CineJoy; built-in catalog removed');}finally{await new Promise(r=>server.close(r));}
