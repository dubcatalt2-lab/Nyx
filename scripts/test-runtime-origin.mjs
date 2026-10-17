import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile('server.js','utf8');
const start=source.indexOf('app.get("/runtime-config.js",');
const end=source.indexOf('\n});',start)+4;
assert(start>=0 && end>start);
let handler;
vm.runInNewContext(source.slice(start,end),{app:{get(path,callback){handler=callback;}},externalWispUrl:'',process:{env:{}},normalizePublicWispUrl:x=>x,URL});
let code;
handler({}, {setHeader(){},type(){return this;},send(value){code=value;}});
for(const origin of ['http://localhost:8080','https://bible.altarworship.org.uk']) {
 const context={location:{origin,href:origin+'/nested/page?x=1#y'},URL};
 vm.runInNewContext(code,context);
 assert.equal(context.english_RUNTIME_CONFIG.publicOrigin,origin);
 assert.equal(context.english_RUNTIME_CONFIG.presenceUrl,origin+'/api/presence');
 assert(Object.isFrozen(context.english_RUNTIME_CONFIG));
 assert(!code.includes('nyxlearning.org'));
}
console.log('PASS runtime configuration uses current origin on localhost and custom host, independent of page path.');
