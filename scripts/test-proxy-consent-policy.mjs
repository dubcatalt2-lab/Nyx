import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {rewriteRuntimeNames} from './build-runtime-names.mjs';

for(const built of [false,true]){
const context=vm.createContext({URL,Response,Headers,importScripts(){},setTimeout(){},self:{addEventListener(){}}});
const source=readFileSync('scramjet.sw.js','utf8')+';this.shouldBlock=nyxShouldBlockScramjetRequest;';
vm.runInContext(built?rewriteRuntimeNames(source):source,context);
const blocked=url=>context.shouldBlock({request:{url:`https://nyx.test/~/${built?'study':'sj'}/session/frame/`+encodeURIComponent(url)}});
assert.equal(blocked('https://cmp.inmobi.com/tcfv2/cmp2.js'),false,'Cookie consent must remain functional');
assert.equal(blocked('https://cdn.cmp.inmobi.com/consent.js'),false);
assert.equal(blocked('https://ads.inmobi.com/banner.js'),true,'Advertising restrictions remain enabled');
assert.equal(blocked('https://googleads.g.doubleclick.net/pagead/ads'),true);
}
console.log('PASS consent manager loads while advertising requests stay blocked.');
