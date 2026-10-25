import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {rewriteRuntimeNames} from './build-runtime-names.mjs';

for(const built of [false,true]){
const context=vm.createContext({URL,Response,Headers,importScripts(){},setTimeout(){},TextEncoder,TextDecoder,btoa,atob,self:{addEventListener(){}}});
const source=readFileSync('polygon.studies.js','utf8')+';this.shouldBlock=nyxShouldBlockscrRequest;';
vm.runInContext(readFileSync('js/proxy-url-codec.js','utf8'),context);
context.self.NyxProxyUrlCodec=context.NyxProxyUrlCodec;
vm.runInContext(built?rewriteRuntimeNames(source):source,context);
const blocked=url=>context.shouldBlock({request:{url:`https://nyx.test/${built?'4otig':'~/sj'}/session/frame/`+context.self.NyxProxyUrlCodec.encode(url)}});
assert.equal(blocked('https://cmp.inmobi.com/tcfv2/cmp2.js'),false,'Cookie consent must remain functional');
assert.equal(blocked('https://cdn.cmp.inmobi.com/consent.js'),false);
assert.equal(blocked('https://ads.inmobi.com/banner.js'),true,'Advertising restrictions remain enabled');
assert.equal(blocked('https://googleads.g.doubleclick.net/pagead/ads'),true);
}
console.log('PASS consent manager loads while advertising requests stay blocked.');
