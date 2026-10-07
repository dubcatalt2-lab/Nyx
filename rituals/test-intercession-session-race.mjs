import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'acorn';
import vm from 'node:vm';

const source=readFileSync('gospel.js','utf8');
let load='',destroy='';
function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration'&&node.id?.name==='loadStudyjetTab')load=source.slice(node.start,node.end);
  if(node.type==='FunctionDeclaration'&&node.id?.name==='destroyConnectionPrivacySession')destroy=source.slice(node.start,node.end);
  for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
}
visit(parse(source,{ecmaVersion:'latest'}));assert(load&&destroy);
const turn=()=>new Promise(resolve=>setImmediate(resolve));
for(const action of ['navigate','close']){
  let ready,created=0,closed=0,untracked=0;
  const pending=new Promise(resolve=>ready=resolve),calls=[];
  const tab={navigationIntent:'first',history:[],index:-1,frame:{getAttribute:()=>'',removeAttribute(){},addEventListener(){}}};
  const controller={cookieSyncChannel:{close(){}},port:{close(){closed++}},nyxStopWorkerTracking(){untracked++},createFrame(){return {addEventListener(){},go(url){assert.equal(closed,0);calls.push(url)}}}};
  const context={state:{tabs:[tab]},navigator:{userAgent:''},studyjetController:{transport:{}},
    installStudyjet:async()=>true,ensureStudyjetWorkerConnection:async()=>{},createPrivateStudyjetController:()=>{created++;return pending},
    workspaceShellSourceUrl:x=>x,setTimeout:()=>0,workspaceHost:()=>'',hostMatches:()=>false,
    connectionPrivacyGuardSource:'',workspaceAdBlockRuntimeSource:'',engines:{},waitForTabResultPaint:async()=>true,
    workspaceFrameStillAtSource:()=>true,connectionFailureHtml:()=> 'failed'};
  for(const name of ['setTabLoading','isNvidiaAuthFamilyUrl','isSpotifyFamilyUrl','shouldUseStudyjetRuntimeGuard','shouldUseStudyjetMinimalGuard','shouldUseStudyjetHelperGuard','setFrameSandbox','clearFrameDocument','installPopupBridge','createStudyjetCompatibilityPlugin','shouldStripStudyjetDuckDuckGoScripts','setTabMeta','monitorWorkspaceTabSecurity','watchConnectionLoad','watchFrameTransportErrors','watchStudyjetHealth','stopSpotifyChromeOsFrameCompatibility'])context[name]=()=>false;
  vm.createContext(context);vm.runInContext(destroy+'\n'+load,context);
  context.loadStudyjetTab(tab,'https://first.example');await turn();assert.equal(created,1);
  if(action==='navigate'){
    tab.navigationIntent='second';context.loadStudyjetTab(tab,'https://second.example');await turn();assert.equal(created,1);
  }else{context.state.tabs=[];context.destroyConnectionPrivacySession(tab);}
  ready(controller);await turn();await turn();
  if(action==='navigate'){
    assert.equal(closed,0,'A superseded navigation must not close the newer navigation’s shared session');
    assert.deepEqual(calls,['https://second.example']);assert.equal(tab.privateScramjetController,controller);
    context.destroyConnectionPrivacySession(tab);assert.equal(closed,1);assert.equal(untracked,1);
  }else{assert.deepEqual(calls,[]);assert.equal(closed,1);assert.equal(untracked,1,'Closed tabs must release late controller tracking');}
}
console.log('PASS overlapping searches share the live session; closing during startup releases the late controller.');
