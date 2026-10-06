import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {repairGameResource} from '../scripture/game-resource-repairs.mjs';import {prepareGameDocument} from "../relics/games/game-document.js";
const source=await readFile(sourceFile('shepherd.js'),'utf8');
const fn=source.slice(source.indexOf('function gnMathResourceContentType('),source.indexOf('\nfunction rewriteGnMathJsonAssets('));
const ctx=vm.createContext({});vm.runInContext(fn,ctx);
for(const [path,expected] of [['framework.js.br','application/javascript; charset=utf-8'],['runtime.mjs.gz','application/javascript; charset=utf-8'],['game.wasm.br','application/wasm'],['game.data.br','application/octet-stream'],['image.webp','image/webp']])assert.equal(ctx.gnMathResourceContentType({pathname:path},path.endsWith('.webp')?'image/webp':'application/octet-stream'),expected);
const compiled='var _0x47E8=["","",":","split","/","://","href","location"]; result=this[_0x47E8[7]][_0x47E8[6]].split("://")[1].split("/")[0];';
const url=new URL('https://cdn.jsdelivr.net/gh/bubbls/fnf-mods@main/rev-mixed/PsychEngine.js');
assert.throws(()=>vm.runInNewContext(compiled,{location:{protocol:'about:',href:'about:srcdoc'}}));
for(const protocol of ['about:','https:']){const context={location:{protocol,href:protocol==='about:'?'about:srcdoc':'https://original.test/game'},document:{baseURI:'https://assets.test/game/'}};vm.runInNewContext(repairGameResource(url,Buffer.from(compiled)).toString(),context);assert.equal(context.result,protocol==='about:'?'assets.test':'original.test');}
const input=Buffer.from(compiled);assert.equal(repairGameResource(new URL('https://cdn.jsdelivr.net/gh/unrelated/game@main/runtime.js'),input),input);
for(const path of ['bubbls/fnf-mods@main/alternated/PsychEngine.js','waycrosspublicmedia/fnf/qt/QT.js']){
 const context={location:{protocol:'about:',href:'about:srcdoc'},document:{baseURI:'https://assets.test/game/'}};
 vm.runInNewContext(repairGameResource(new URL('https://cdn.jsdelivr.net/gh/'+path),input).toString(),context);
 assert.equal(context.result,'assets.test');
}
globalThis.location={origin:'https://fixture.test'};
assert(prepareGameDocument('<base href = "https://cdn.jsdelivr.net/gh/test/repo@main/game/"><script src="engine.js"></script>','768.html').includes('/gn-math-resource/https/cdn.jsdelivr.net/gh/test/repo@main/game/engine.js'));
const html=prepareGameDocument('<html><head></head><body><script>async function load(){const response={arrayBuffer:async()=>new ArrayBuffer(8)};var EJS_color;await response.rrayBuffer();EJS_color = "#0064ff";a;return true;}</script></body></html>','823-fix2.html');
delete globalThis.location;
const repairedScript=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('async function load'))[1];
const test=vm.createContext({ArrayBuffer});vm.runInContext(repairedScript,test);assert.equal(await test.load(),true);
const aquapark='var clickedFake = false; function hideScreen(){return playBtnClicked;} function click(){playBtnClicked=true;}';
const playable=vm.createContext({});vm.runInContext(repairGameResource(new URL('https://cdn.jsdelivr.net/gh/bubbls/youtube-playables@main/aquapark-io/main.js'),Buffer.from(aquapark)).toString(),playable);
assert.equal(playable.hideScreen(),false);playable.click();assert.equal(playable.hideScreen(),true);
const dos='var inMemoryFS = new BrowserFS.FileSystem.InMemory(); result = new BrowserFS.FileSystem.OverlayFS(deltaFS);';
const memory={};const dosContext=vm.createContext({BrowserFS:{FileSystem:{InMemory:function(){return memory},OverlayFS:function(fs){assert.equal(fs,memory);}}}});
vm.runInContext(repairGameResource(new URL('https://cdn.jsdelivr.net/gh/bubbls/dosbox/js/loader.js'),Buffer.from(dos)).toString(),dosContext);
console.log('PASS compressed Unity MIME, opaque Lime URL parsing, unrelated-resource preservation, Ace Attorney, Aquapark and DOS fallback loaders');
