import assert from 'node:assert/strict';
import {rewriteFrontendReferences,scatteredAssetPath} from './build-frontend-assets.mjs';
const aliases={'/apps/code-studio/app.js':'/apps/code-studio/@runtime!.js'};
const path='/apps/code-studio/loader.js';
for(const data of ['const language={file:"app.js"};','const example="app.js";','const file=`app.js`;'])assert.equal(rewriteFrontendReferences(data,path,aliases),data);
for(const code of ['import "./app.js";','export * from "./app.js";','import("./app.js");','fetch("./app.js");','new URL("./app.js",import.meta.url);','new Worker("./app.js");','navigator.serviceWorker.register("./app.js");','script.src="./app.js";','script.setAttribute("src","./app.js");'])assert.equal(rewriteFrontendReferences(code,path,aliases),code.replace('./app.js','./@runtime!.js'));
assert.equal(rewriteFrontendReferences('import("./app.js?v=1#part")',path,aliases),'import("./@runtime!.js?v=1#part")');
assert.equal(rewriteFrontendReferences('fetch("./app.json");',path,aliases),'fetch("./app.json");');
assert.equal(rewriteFrontendReferences('<script src="./app.js?v=1"></script>','/apps/code-studio/index.html',aliases),'<script src="./@runtime!.js?v=1"></script>');
console.log('PASS filename data preserved; imports, asset URLs and HTML references use aliases');

const destination=scatteredAssetPath(path);
assert.match(destination,/\/@[a-f0-9]{8}\/[a-f0-9]{8}\/@r[a-f0-9]{24}!\.js$/);
const moved=rewriteFrontendReferences('import "./app.js"; import "../shared/data.js"; const resource=new URL("./cover.png",import.meta.url);',path,aliases,destination);
assert(moved.includes('../../@runtime!.js'));
assert(moved.includes('../../../shared/data.js'));
assert(moved.includes('new URL("/apps/code-studio/loader.js",import.meta.url).href'));
assert.equal(scatteredAssetPath(path),destination);
console.log('PASS scattered paths, moved module imports and original resource URL base');

assert.equal(rewriteFrontendReferences('fetch("./app.js"); script.src="./app.js";',path,aliases,destination),'fetch("./@runtime!.js"); script.src="./@runtime!.js";');
