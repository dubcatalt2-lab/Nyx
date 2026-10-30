import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile('assets/studies/study-runtime-compat.js','utf8');
for(const available of [false,true]){const calls=[];const navigator={};if(available)navigator.serviceWorker={};else Object.defineProperty(navigator,'serviceWorker',{get(){throw Error('sandbox')}});const context=vm.createContext({navigator,document:{baseURI:'https://assets.test/game/'},requestAnimationFrame:callback=>{calls.push(['request',callback]);return 42;},cancelAnimationFrame:id=>calls.push(['cancel',id])});vm.runInContext(source,context);vm.runInContext('RuntimeInterface=class {constructor(options){this.options=options}};a=new RuntimeInterface({useWorker:false});b=new RuntimeInterface({baseUrl:"https://custom.test/"});',context);assert.equal(context.a.options.baseUrl,'https://assets.test/game/');assert.equal(context.b.options.baseUrl,'https://custom.test/');assert.equal(context.a.options.useWorker,false);const callback=()=>{};assert.equal(context.cancelAnimationFrame(callback),42);context.cancelAnimationFrame(42);assert.deepEqual(calls.map(x=>x[0]),['request','cancel']);assert.equal(calls[1][1],42);if(!available){context.C3_RegisterSW=()=>{throw Error('should not run')};context.C3_RegisterSW();}else assert.equal(context.C3_RegisterSW,undefined);}
console.log('PASS Construct compatibility: callback scheduling, numeric cancellation, base URL and sandbox-only offline registration');

for(const base of ['https://assets.test/game/','https://host.test/reading-resource/https/assets.test/game/']){
 const context=vm.createContext({URL,navigator:{serviceWorker:{}},document:{baseURI:base},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},origin:'null'});
 vm.runInContext(source,context);
 vm.runInContext('RuntimeInterface=class {constructor(options){this.options=options}};r=new RuntimeInterface({scriptFolder:"https://assets.test/game/scripts/",useWorker:true});',context);
 assert.equal(context.r.options.scriptFolder,'scripts/');assert.equal(context.r.options.baseUrl,base);assert.equal(context.r.options.useWorker,false);
 assert.equal(new URL(context.r.options.baseUrl+context.r.options.scriptFolder+'dispatchworker.js').pathname.includes('/https://assets.test'),false,'Worker base must not contain a duplicated absolute URL');
}
console.log('PASS Construct absolute script folders under native/proxied bases become relative without changing engine script URLs');
