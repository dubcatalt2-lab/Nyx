import {sourceFile} from '../scripture/source-layout.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';

const source=readFileSync(sourceFile('script.js'),'utf8');let create='',normalize='',defaultTransport='';
function visit(node){
  if(!node || typeof node!=='object')return;
  if(node.type==='FunctionDeclaration' && node.id?.name==='createScramjetTransport')create=source.slice(node.start,node.end);
  if(node.type==='FunctionDeclaration' && node.id?.name==='normalizeBrowserTransportName')normalize=source.slice(node.start,node.end);
  if(node.type==='VariableDeclarator' && node.id?.name==='DEFAULT_BROWSER_TRANSPORT')defaultTransport=node.init.value;
  for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
}
visit(parse(source,{ecmaVersion:'latest'}));assert(create);
const fakeModule='data:text/javascript,'+encodeURIComponent(`export default class {
  ready=false;constructor(options){this.options=options;globalThis.__nyxTransportInitTest.created++;}
  async init(){const state=globalThis.__nyxTransportInitTest;state.entered();await state.gate;this.ready=true;}
}`);
create=create.replace("'/assets/transports/libcurl-scramjet.mjs'",JSON.stringify(fakeModule));
const relayModule='data:text/javascript,'+encodeURIComponent("import {RelayTransport as Base} from "+JSON.stringify(new URL('../apps/tutsi/relay.mjs',import.meta.url).href)+";export class RelayTransport extends Base {constructor(options){super({...options,probe:async()=>true,online:()=>true});}}");
create=create.replace("'/apps/tutsi/relay.mjs'",JSON.stringify(relayModule));
const normalizeName=new Function('DEFAULT_BROWSER_TRANSPORT',`${normalize};return normalizeBrowserTransportName;`)(defaultTransport);
assert.equal(defaultTransport,'libcurlRaw');
const make=new Function('selectWispRelay','normalizeBrowserTransportName','store','wispUrl','setTimeout',`
  let browserTransportOverride='',scramjetTransport=null,scramjetTransportKey='',scramjetTransportPending=null;
  const browserHttpRelayUrl=()=> 'wss://fixture.test/api/tutsi-relay/socket/'; const DEFAULT_BROWSER_TRANSPORT=${JSON.stringify(defaultTransport)};${create};return createScramjetTransport;
`);
function state(){
  let entered,resolve,reject;
  const started=new Promise(r=>entered=r),gate=new Promise((r,j)=>{resolve=r;reject=j;});
  const value={created:0,entered,gate,started,resolve,reject};globalThis.__nyxTransportInitTest=value;return value;
}
try{
  // No stored choice and older Auto preferences must select the libcurl
  // adapter even when a launcher calls the transport before normal tab setup.
  for(const configured of [undefined,'auto','libcurl','libcurlRaw']){
    const createDefault=make(async()=>{},normalizeName,{text:(_,fallback)=>configured??fallback},()=> 'wss://fixture.test/wisp/',()=>0);
    const current=state(),request=createDefault();current.resolve();
    assert.equal((await request).ready,true);assert.equal(current.created,1);
  }
  assert.equal(normalizeName('epoxy'),'epoxy','Keep explicit alternative choices');
  assert.equal(normalizeName('wisp'),'wisp');
  const create=make(async()=>{},x=>x,{text:()=> 'libcurlRaw'},()=> 'wss://fixture.test/wisp/',()=>0);
  const first=state(),a=create(),b=create();await first.started;
  assert.equal(first.created,1,'Concurrent cold calls must share one SDK initialization');
  first.resolve();const [left,right]=await Promise.all([a,b]);
  assert.equal(left,right);assert.equal(left.ready,true);assert.equal(await create(),left);assert.equal(first.created,1);

  const retry=make(async()=>{},x=>x,{text:()=> 'libcurlRaw'},()=> 'wss://fixture.test/wisp/',()=>0);
  const failed=state(),attempt=retry();await failed.started;failed.reject(new Error('fixture init failed'));
  await assert.rejects(attempt,/No configured Wisp relay/);
  const next=state(),recovered=retry();await next.started;next.resolve();assert.equal((await recovered).ready,true);
  assert.equal(next.created,1,'Failure must release the pending initializer for a later retry');

  let relay='wss://one.test/wisp/';
  const change=make(async()=>{},x=>x,{text:()=> 'libcurlRaw'},()=>relay,()=>0);
  const old=state(),oldRequest=change();await old.started;
  relay='wss://two.test/wisp/';
  const newer=state(),newRequest=change();await newer.started;newer.resolve();const newest=await newRequest;
  old.resolve();const previous=await oldRequest;
  assert.notEqual(previous,newest);assert.equal(await change(),newest,'Late initialization must not overwrite the newer relay');
}finally{delete globalThis.__nyxTransportInitTest;}
console.log('Proxy transport initialization: concurrent callers, ready cache and failed-init retry passed.');
