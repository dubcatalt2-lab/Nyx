import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import vm from 'node:vm';

const source=readFileSync('gospel.js','utf8');
let load='',destroy='';
function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration'&&node.id?.name==='loadScramjetTab')load=source.slice(node.start,node.end);
  if(node.type==='FunctionDeclaration'&&node.id?.name==='destroyProxyPrivacySession')destroy=source.slice(node.start,node.end);
  for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
}
visit(parse(source,{ecmaVersion:'latest'}));assert(load&&destroy);
const turn=()=>new Promise(resolve=>setImmediate(resolve));
for(const action of ['navigate','close']){
  let ready,created=0,closed=0,untracked=0;
  const pending=new Promise(resolve=>ready=resolve),calls=[];
  const tab={navigationIntent:'first',history:[],index:-1,frame:{getAttribute:()=>'',removeAttribute(){},addEventListener(){}}};
  const controller={cookieSyncChannel:{close(){}},port:{close(){closed++}},nyxStopWorkerTracking(){untracked++},createFrame(){return {addEventListener(){},go(url){assert.equal(closed,0);calls.push(url)}}}};
  const context={state:{tabs:[tab]},navigator:{userAgent:''},scramjetController:{transport:{}},
    installScramjet:async()=>true,ensureScramjetWorkerConnection:async()=>{},createPrivateScramjetController:()=>{created++;return pending},
    browserShellSourceUrl:x=>x,setTimeout:()=>0,browserHost:()=>'',hostMatches:()=>false,
    proxyPrivacyGuardSource:'',browserAdBlockRuntimeSource:'',engines:{},waitForTabResultPaint:async()=>true,
    browserFrameStillAtSource:()=>true,proxyFailureHtml:()=> 'failed'};
  for(const name of ['setTabLoading','isNvidiaAuthFamilyUrl','isSpotifyFamilyUrl','shouldUseScramjetRuntimeGuard','shouldUseScramjetMinimalGuard','shouldUseScramjetHelperGuard','setFrameSandbox','clearFrameDocument','installPopupBridge','createScramjetCompatibilityPlugin','shouldStripScramjetDuckDuckGoScripts','setTabMeta','monitorBrowserTabSecurity','watchProxyLoad','watchFrameTransportErrors','watchScramjetHealth','stopSpotifyChromeOsFrameCompatibility'])context[name]=()=>false;
  vm.createContext(context);vm.runInContext(destroy+'\n'+load,context);
  context.loadScramjetTab(tab,'https://first.example');await turn();assert.equal(created,1);
  if(action==='navigate'){
    tab.navigationIntent='second';context.loadScramjetTab(tab,'https://second.example');await turn();assert.equal(created,1);
  }else{context.state.tabs=[];context.destroyProxyPrivacySession(tab);}
  ready(controller);await turn();await turn();
  if(action==='navigate'){
    assert.equal(closed,0,'A superseded navigation must not close the newer navigation’s shared session');
    assert.deepEqual(calls,['https://second.example']);assert.equal(tab.privateScramjetController,controller);
    context.destroyProxyPrivacySession(tab);assert.equal(closed,1);assert.equal(untracked,1);
  }else{assert.deepEqual(calls,[]);assert.equal(closed,1);assert.equal(untracked,1,'Closed tabs must release late controller tracking');}
}
console.log('PASS overlapping searches share the live session; closing during startup releases the late controller.');
