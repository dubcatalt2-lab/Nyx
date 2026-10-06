import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createAccountCloudPreferences} from '../scripture/account-cloud-preferences.mjs';
const records=new Map();let tail=Promise.resolve();
const ref=path=>({path,collection:name=>({doc:id=>ref(`${path}/${name}/${id}`)})});
const db={collection:name=>({doc:id=>ref(`${name}/${id}`)}),runTransaction(fn){
 const next=tail.then(async()=>{const changes=[];const result=await fn({
  get:async r=>{assert.equal(changes.length,0);const value=structuredClone(records.get(r.path));return {data:()=>value};},
  set:(r,value,options)=>changes.push(()=>records.set(r.path,options?{...records.get(r.path),...structuredClone(value)}:structuredClone(value))),
  delete:r=>changes.push(()=>records.delete(r.path))});changes.forEach(change=>change());return result;});tail=next.catch(()=>{});return next;
}};
const normalize=value=>Object.fromEntries(Object.entries(value||{}).map(([key,value])=>{assert(value.length<24000,'Images must not enter small preference fields');return [key,value];}));
const store=createAccountCloudPreferences({db,normalize});
const image='data:image/gif;base64,'+Buffer.alloc(800000,7).toString('base64');
await store.write('alice',{'nyx.theme':'halloween','nyx.customBgData':image,'nyx.beamTheme':'custom-wallpaper'});
assert.equal((await store.read('alice')).preferences['nyx.customBgData'],image);
assert.equal((await store.read('bob')).preferences['nyx.customBgData'],undefined);
assert([...records.values()].every(value=>JSON.stringify(value).length<460000));
await store.write('alice',{'nyx.theme':'dark'});
assert.equal((await store.read('alice')).preferences['nyx.customBgData'],image,'Omitted image preserves the existing wallpaper');
await assert.rejects(store.write('alice',{'nyx.customBgData':'javascript:alert(1)'}));
await assert.rejects(store.write('alice',{'nyx.customBgData':'data:image/png;base64,'+'A'.repeat(6000000)}),e=>e.status===413);
assert.equal((await store.read('alice')).preferences['nyx.customBgData'],image);
const smaller='data:image/png;base64,AAAA';await store.write('alice',{'nyx.customBgData':smaller});
assert.equal([...records.keys()].filter(key=>key.includes('/wallpaper/')).length,1);
await store.write('alice',{'nyx.customBgData':''});assert.equal([...records.keys()].filter(key=>key.includes('/wallpaper/')).length,0);
assert.equal((await store.read('alice')).preferences['nyx.customBgData'],'');

// Exercise the actual browser sync functions with separate browser stores and
// delayed network replies, without touching any real account or browser session.
const source=await readFile(sourceFile('script.js'),'utf8');
const sync=source.slice(source.indexOf('  const NYX_CLOUD_PREFERENCE_KEYS='),source.indexOf('  async function loadNyxCloudGameSave('));
function client(uid,initial={}){
 const storage=new Map(Object.entries(initial)),requests=[];
 const context=vm.createContext({console,setTimeout,clearTimeout,setInterval,clearInterval,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  nyxFounderSignedInUser:{uid,getIdToken:async()=>uid},applyUserSettings(){},applyNyxPerformanceTier(){},getNyxPerformanceTier(){return 'high'},
  fetch:async(path,options)=>{requests.push(options);const who=options.headers.Authorization.slice(7);return {ok:true,json:async()=>options.method==='PUT'?store.write(who,JSON.parse(options.body).preferences):store.read(who)};}
 });vm.runInContext(sync,context);return {context,storage,requests,run:code=>vm.runInContext(code,context)};
}
const first=client('alice',{'nyx.customBgData':image,'nyx.beamTheme':'custom-wallpaper'});
// Simulate the existing account before wallpaper sync was supported.
records.delete('nyxCloudSaves/alice');await first.run('loadNyxCloudPreferences()');await first.run('saveNyxCloudPreferences()');
const other=client('alice');await other.run('loadNyxCloudPreferences()');assert.equal(other.storage.get('nyx.customBgData'),image);
other.storage.set('nyx.theme','halloween');await other.run('saveNyxCloudPreferences()');
assert(!Object.hasOwn(JSON.parse(other.requests.at(-1).body).preferences,'nyx.customBgData'),'Settings changes do not re-upload unchanged wallpaper');
other.storage.set('nyx.customBgData','');await other.run('saveNyxCloudPreferences()');await first.run('loadNyxCloudPreferences()');assert.equal(first.storage.get('nyx.customBgData'),'');
first.storage.set('nyx.customBgData',image);await first.run('saveNyxCloudPreferences()');
first.run("stopNyxCloudPreferenceSync();nyxFounderSignedInUser={uid:'bob',getIdToken:async()=>'bob'}");await first.run('loadNyxCloudPreferences()');await first.run('saveNyxCloudPreferences()');assert.equal((await store.read('bob')).preferences['nyx.customBgData'],'');
let release,started;const gate=new Promise(resolve=>{release=resolve}),begin=new Promise(resolve=>{started=resolve});const late=client('alice');const request=late.context.fetch;late.context.fetch=async(...args)=>{started();await gate;return request(...args);};
const pending=late.run('loadNyxCloudPreferences()');await begin;late.run("stopNyxCloudPreferenceSync();nyxFounderSignedInUser={uid:'bob',getIdToken:async()=>'bob'}");release();await pending;
assert.equal(late.storage.has('nyx.customBgData'),false,'A late response cannot apply another account wallpaper');
console.log('PASS original/animated wallpaper round-trip, bounded chunks, replacement/removal, cross-device restore, one-time migration, account switching and delayed-response isolation');
