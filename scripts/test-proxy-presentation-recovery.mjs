import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
const source=readFileSync('script.js','utf8');let code='';
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name==='watchScramjetHealth')code=source.slice(n.start,n.end);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
visit(parse(source,{ecmaVersion:'latest'}));assert(code);
function fixture(){
 let time=0,presentation={reachable:true,blank:false,unstyled:false,hasErrorText:false,readyState:'complete'};
 const tasks=[],calls=[],listeners=new Map();
 const frame={isConnected:true,contentDocument:{},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const tab={frame,scramjetFrame:{go:url=>calls.push(url)}};
 const context=vm.createContext({Date:{now:()=>time},Math,browserShellSourceUrl:v=>v,browserFrameStillAtSource:()=>true,inspectFramePresentation:()=>presentation,setTimeout:(fn,delay)=>tasks.push({fn,at:time+delay}),refreshScramjetServiceWorker:async()=>{},installScramjet:async()=>{}});
 vm.runInContext(code+';this.watch=watchScramjetHealth',context);
 return {tab,calls,watch:(url='https://fixture.test/')=>context.watch(tab,url),change:changes=>Object.assign(presentation,changes),load:()=>listeners.get('load')?.(),async advance(to){for(;;){tasks.sort((a,b)=>a.at-b.at);if(!tasks.length||tasks[0].at>to)break;const t=tasks.shift();time=t.at;t.fn();await Promise.resolve();}time=to;await Promise.resolve();}};
}
for(const changes of [{blank:true},{unstyled:true}]){
 const f=fixture();f.watch();await f.advance(2500);f.change(changes);await f.advance(9000);
 assert.deepEqual(f.calls,[],'Rendered document must survive consent/UI transitions');
}
{
 const f=fixture();f.watch();await f.advance(2500);f.watch('https://fixture.test/next');f.change({blank:true});await f.advance(12000);
 assert.deepEqual(f.calls,[],'A same-document route must not rearm presentation recovery');
}
for(const changes of [{blank:true},{unstyled:true}]){
 const f=fixture();f.change(changes);f.watch();await f.advance(9000);
 assert(f.calls.length>0,'A document that never renders still receives bounded recovery');
}
{
 const f=fixture();f.watch();await f.advance(2500);f.tab.frame.contentDocument={};f.change({unstyled:true});f.load();await f.advance(9000);
 assert(f.calls.length>0,'A new failed document retains recovery even after a previous success');
}
{
 const f=fixture();f.change({readyState:'loading'});f.watch();await f.advance(2500);assert.equal(f.tab.scramjetHealthyDocument,undefined);
 f.tab.frame.isConnected=false;f.change({blank:true});await f.advance(9000);assert.deepEqual(f.calls,[],'Disposed tabs stay disposed');
}
console.log('PASS presentation recovery: rendered document transitions, SPA routes, failed first/new documents, loading and closed tabs.');
