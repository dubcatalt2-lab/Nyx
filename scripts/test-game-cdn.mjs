import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {gameResourceUrl,gameResourceTarget,normalizeGameCdnUrl} from '../assets/games/game-cdn.js';
import {prepareGameDocument} from '../assets/games/game-document.js';
import {repairGameResource} from '../lib/game-resource-repairs.mjs';

const origin='https://games.test';
const upstream='https://cdn.jsdelivr.net/owner/repo@main/Build/game.json';
const proxied=gameResourceUrl(upstream,undefined,origin);
assert.equal(proxied,origin+'/gn-math-resource/https/cdn.jsdelivr.net/gh/owner/repo@main/Build/game.json');
for(const dependency of ['game.wasm','../StreamingAssets/config.json','chunks/a.js?version=2']){
 const resolved=new URL(dependency,proxied);
 assert.equal(gameResourceTarget(resolved.href).href,new URL(dependency,normalizeGameCdnUrl(upstream)).href);
}
assert.equal(gameResourceUrl(proxied,undefined,origin),proxied);
assert.equal(normalizeGameCdnUrl('https://cdn.jsdelivr.net/gh/web-ports/fear-and-hunger-2@latest/data/Map028.json').pathname,'/gh/web-ports/fear-and-hunger-2@latest/data/map028.json');
assert.equal(normalizeGameCdnUrl('https://cdn.jsdelivr.net/npm/library@1/index.js').pathname,'/npm/library@1/index.js');
for(const bad of ['https://evil.test/a','https://cdn.jsdelivr.net.evil.test/a','https://user:secret@cdn.jsdelivr.net/a','https://cdn.jsdelivr.net:8080/a','file:///tmp/a'])assert.equal(normalizeGameCdnUrl(bad),null);
for(const bad of ['/gn-math-resource/https/localhost/a','/gn-math-resource/file/cdn.jsdelivr.net/a','/gn-math-resource/https/cdn.jsdelivr.net@evil.test/a'])assert.equal(gameResourceTarget(bad),null);
globalThis.location={origin};
const html=prepareGameDocument('<html><head><base href="https://cdn.jsdelivr.net/owner/repo@main/"><script src="game.js"></script></head><body><script>const config={streamingAssetsUrl:"StreamingAssets"};</script></body></html>','test.html');
assert(html.includes(origin+'/gn-math-resource/https/cdn.jsdelivr.net/gh/owner/repo@main/game.js'));
assert(html.includes('streamingAssetsUrl:"'+origin+'/gn-math-resource/https/cdn.jsdelivr.net/gh/owner/repo@main/StreamingAssets"'));
assert(!html.includes('gn-math-proxy?'));
const cloudflare=prepareGameDocument('<script type="abcd1234-module" src="game.js"></script><script src="scripts/rocket-loader.min.js"></script>','test.html');
assert(cloudflare.includes('type="module"'));
assert(!cloudflare.includes('rocket-loader.min.js'));
delete globalThis.location;
const typo=Buffer.from('this.require(" decompress.js")');
assert.equal(repairGameResource(new URL('https://cdn.jsdelivr.net/gh/freebuisness/assets@main/116/Build/bike1.loader.js'),typo).toString(),'this.require("decompress.js")');
assert.equal(repairGameResource(new URL('https://cdn.jsdelivr.net/gh/other/game@main/loader.js'),typo),typo);

const callbacks={},storage=new Map();
const context=vm.createContext({URL,DOMException,origin:'null',navigator:{language:'en-US'},document:{baseURI:proxied,addEventListener:(name,fn)=>callbacks[name]=fn},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
await vm.runInContext(await readFile('assets/games/game-runtime-compat.js','utf8'),context);
assert.equal(context.EJS_disableDatabases,true);
let actual;
context.createUnityInstance=(_canvas,config)=>actual=config;
callbacks.load({target:{tagName:'SCRIPT'}});
context.createUnityInstance(null,{streamingAssetsUrl:'../StreamingAssets',dataUrl:'game.data'});
assert.equal(actual.streamingAssetsUrl,new URL('../StreamingAssets',proxied).href);
assert.equal(actual.dataUrl,'game.data');
assert.equal(await context.ytgame.system.getLanguage(),'en-US');
assert.equal(await context.ytgame.ads.requestAd(),context.ytgame.ads.AdResult.REJECTED);
await context.ytgame.game.saveData('first');
context.document.baseURI=origin+'/other-game/';
assert.equal(await context.ytgame.game.loadData(),'');
console.log('PASS game CDN directory resolution, malformed-prefix repair, host validation, Unity sandbox URLs and isolated playable saves');
