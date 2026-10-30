import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const calls=[];const window={fetch:async input=>{calls.push(String(input));return new Response('static library payload')},WebSocket:class{}};const context={window,parent:window,URL,Request,Response,Symbol,Error,location:new URL('https://bucket.example/studies.html'),document:{querySelector:selector=>selector.includes('nyx-static-backend')?{content:'https://backend.example'}:null},navigator:{serviceWorker:{addEventListener(){},register:async()=>{throw Error('Backend/session fixture unavailable')}}}};
vm.runInNewContext(await readFile('js/direct-s3-runtime.js','utf8'),context);
await assert.rejects(window[Symbol.for('nyx.direct-s3.ready')],/fixture unavailable/);
for(const path of ['/assets/studies/@r123!.json','/assets/reading/games.json','/assets/studies/@r123!.js'])assert.equal(await(await window.fetch(path)).text(),'static library payload');
for(const path of ['/api/private','/reading-fetch','/game-cover','/duckmath-games'])await assert.rejects(window.fetch(path),/fixture unavailable/);
assert.equal(calls.length,3,'Protected calls must not bypass failed session setup');console.log('PASS encoded library/static catalogs load with backend session unavailable; protected calls still require session');
