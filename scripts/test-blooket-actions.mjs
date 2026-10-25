import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const runtime=await readFile('apps/blooket/connector-runtime.js','utf8'),catalog=JSON.parse(await readFile('apps/blooket/catalog.json','utf8'));
const actions=catalog.entries.filter(e=>e.category!=='interfaces');assert.equal(actions.length,109);
for(const entry of actions){assert(!entry.code.includes('function react('));new vm.Script('(async function(setInterval,setTimeout,resolveBlooketState){return await '+entry.code+'})');}
function context(model,{legacy=false,other=null,current=null}={}){
 class Node{};const element=new Node();element.first='unrelated';element.__reactProps$test={children:[{_owner:legacy?{stateNode:model}:null}]};
 if(!legacy)element.__reactFiber$test={stateNode:element,return:current?{stateNode:{current}}:{stateNode:model,child:other?{stateNode:other}:null}};
 const ctx=vm.createContext({Node,document:{querySelectorAll:()=>[element]},window:{},Symbol,location:{hostname:'brawl.blooket.com'}});vm.runInContext(runtime,ctx);return ctx;
}
function fixture(){
 const calls={events:[],damage:0,magnet:0,respawn:0,spawn:null};
 class Enemy{start(){this.val=10;this.speed=8;this.hp=12;}}const enemy=new Enemy();enemy.start();enemy.receiveDamage=()=>calls.damage++;
 const enemies={classType:Enemy,children:{entries:[enemy]}};
 const damage={callbackContext:function(){return 'dmgCd'},object2:enemies,collideCallback:()=>calls.damage++};
 const magnet={collideCallback:function(){const magnetTime=1;calls.magnet+=magnetTime;}};
 const xp={collideCallback:function(){return 'emit("xp'},object1:{x:3,y:4},object2:{get:()=>({spawn:(...a)=>calls.spawn=a})}};
 const obstacle={frame:{texture:{key:'obstacle-tree'}},destroy:()=>calls.destroyed=true};
 const scene={physics:{world:{colliders:{_active:[damage,magnet,xp]},bodies:{entries:[{gameObject:enemy},{gameObject:obstacle}]}}},game:{events:{emit:(...a)=>calls.events.push(a)}}};
 const model={state:{abilities:{laser:2},level:5,secret:'DO_NOT_TRANSFER'},props:{},xp:2,setState(v){Object.assign(this.state,v)},game:{current:{config:{sceneConfig:scene},events:{_events:{respawn:{fn:()=>calls.respawn++}}}}}};
 return {model,calls,enemy,enemies,scene,damage};
}
// Current Brawl behavior is tested with the supplied game classes in test-blooket-current-brawl.mjs.
const a={state:{tokens:0},setState(){}};assert.equal(context(a,{legacy:true}).findBlooketComponent(['state.tokens']),a);
assert.equal(context(a,{other:{state:{gold:0},setState(){}}}).findBlooketComponent(['state.tokens']),a);
assert.throws(()=>context(a,{other:{state:{tokens:1},setState(){}}}).findBlooketComponent(['state.tokens']),/More than one/);
const live={state:{tokens:2},setState(){}};assert.equal(context(a,{current:{stateNode:null,child:{stateNode:live}}}).findBlooketComponent(['state.tokens']),live);
assert.throws(()=>context({}).findBlooketComponent(['state.tokens']),/does not expose/);
{
 const ctx=context({state:{},setState(){}}), body={gameObject:{frame:{texture:{key:'blook-cat'}},alpha:1,setAlpha(v){this.alpha=v}},checkCollision:{none:false}};
 let score=0;const deps=[{current:{config:{sceneConfig:{physics:{world:{bodies:{entries:[body]}}}}}}},value=>score=value];
 const effect={deps};effect.next=effect;
 const element={unrelated:{},__reactFiber$test:{return:{updateQueue:{lastEffect:effect}}}};
 ctx.document.querySelector=()=>element;ctx.document.createElement=()=>({contentWindow:{prompt:()=> '77'},remove(){}});ctx.document.body={append(){}};ctx.prompt=()=> '77';ctx.resolveBlooketEffect=ctx.findBlooketEffect;ctx.resolveBlooketScene=()=>deps[0].current.config.sceneConfig;
 await vm.runInContext(actions.find(e=>e.path==='flappy/setScore.js').code,ctx);assert.equal(score,77);
 const ghost=actions.find(e=>e.path==='flappy/toggleGhost.js').code;await vm.runInContext(ghost,ctx);assert.equal(body.gameObject.alpha,.5);assert.equal(body.checkCollision.none,true);await vm.runInContext(ghost,ctx);assert.equal(body.gameObject.alpha,1);assert.equal(body.checkCollision.none,false);
}
const code=path=>actions.find(e=>e.path===path).code;
{
 const scene=status=>({sys:{isActive:()=>status==='running',isPaused:()=>status==='paused',isSleeping:()=>status==='sleeping'},physics:{world:{}}});
 const paused=scene('paused'),running=scene('running'),sleeping=scene('sleeping');
 const managed=scenes=>context({game:{current:{scene:{getScenes(activeOnly){assert.equal(activeOnly,false,'Paused scenes must be included');return scenes}}}}});
 assert.equal(managed([paused]).findBlooketScene(),paused);
 assert.equal(managed([running,sleeping,{sys:{isActive:()=>true}}]).findBlooketScene(),running);
 assert.throws(()=>managed([sleeping]).findBlooketScene(),/No running or paused physics scene/);
 assert.throws(()=>managed([running,paused]).findBlooketScene(),/2 running or paused physics scenes/);
 const gameplay=fixture();gameplay.scene.sys=paused.sys;
 assert.equal(managed([running,gameplay.scene]).findBlooketScene('brawl-enemies'),gameplay.scene,'Select the actual enemy scene despite another physics world');
 const second=fixture();second.scene.sys=running.sys;
 assert.throws(()=>managed([gameplay.scene,second.scene]).findBlooketScene('brawl-enemies'),/2 running or paused physics scenes/,'Reject two actual matches');
 assert.equal(gameplay.enemy.hp,12);assert.equal(second.enemy.hp,12);
 assert.throws(()=>managed([running]).findBlooketScene('brawl-enemies'),/No running or paused physics scene/,'Do not accept a scene without the tool dependencies');
 const details=managed([paused]).blooketConnectionDetails();assert.equal(details.version,10);assert.equal(details.games[0].scenes[0].paused,true);
 const hookContext=context({}, {current:{stateNode:null,memoizedState:{memoizedState:{level:9,privateValue:'NEVER_PRINT_THIS'},queue:{dispatch(){}},next:null}}});
 const report=hookContext.blooketConnectionDetails('brawl/instantKill.js');assert.equal(report.lastAction,'brawl/instantKill.js');assert.equal(report.hookStates[0].type,'object');assert(!JSON.stringify(report).includes('NEVER_PRINT_THIS'));
}
for(const entry of actions)assert(!/window\.set(?:Interval|Timeout)\(/.test(entry.code),entry.path+' bypasses Stop');

{
 let updates=0;const model={props:{tower:{cards:[{}]}},setState(){},forceUpdate(){updates++}},ctx=context(model);
 ctx.resolveBlooketState=ctx.findBlooketComponent;ctx.window.location={pathname:'/tower/map'};ctx.document.body={append(){}};ctx.document.createElement=()=>({contentWindow:{alert(){}},remove(){}});
 await vm.runInContext(code('doom/maxCards.js'),ctx);assert.deepEqual(model.props.tower.cards[0],{strength:20,charisma:20,wisdom:20});assert.equal(updates,1);
}
// Native question actions are covered in test-blooket-question-tools.mjs against DOM controls.
{
 const partial={state:{tokens:0},setState(){}};
 assert.throws(()=>context(partial).findBlooketComponent(['state.tokens','state.round']),/does not expose/);
 assert.equal(context(partial).findBlooketComponent([['state.tokens','setState'],['state.cash','setState']]),partial);
}

{
 const model={state:{blookData:{Chick:3,Dragon:2}},setState(update,done){queueMicrotask(()=>{Object.assign(this.state,update);done()})},async sellBlook(){assert.equal(this.state.blook,'Chick');sold.push(this.state.numToSell)}};
 const sold=[],ctx=context(model);ctx.resolveBlooketState=()=>model;ctx.window.location={pathname:'/blooks'};ctx.document.body={append(){}};ctx.document.createElement=()=>({contentWindow:{alert(){},confirm:()=>true},remove(){}});ctx.confirm=()=>true;ctx.alert=()=>{};
 ctx.document.querySelector=()=>({innerText:model.state.blook==='Chick'?'Uncommon':'Legendary'});
 await vm.runInContext(code('global/sellDuplicateBlooks.js'),ctx);assert.deepEqual(sold,[2],'Wait for selected blook before checking rarity and selling');
}
{
 const ctx=context({setState(){}});ctx.window.location={pathname:'/blooks'};ctx.document.body={append(){}};ctx.document.createElement=()=>({contentWindow:{alert(){}},remove(){}});ctx.resolveBlooketState=()=>({render(){throw Error('render failed')}});
 vm.runInContext('globalThis.originalKeys = Object.keys',ctx);
 await assert.rejects(vm.runInContext(code('global/useAnyBlook.js'),ctx),/render failed/);assert(vm.runInContext('Object.keys === originalKeys',ctx),'Restore built-in Object.keys even when render fails');
}
{
 const ctx=context({setState(){}});ctx.window.location={pathname:'/market'};ctx.document.body={append(){}};ctx.document.createElement=()=>({contentWindow:{alert(){},prompt:()=> 'Ice',confirm:()=>false},remove(){}});let prompts=['Ice','1'];ctx.prompt=()=>prompts.shift();ctx.confirm=()=>false;
 ctx.document.querySelectorAll=()=>[{querySelector(selector){return selector.includes('blookContainer')?null:selector.includes('packImgContainer')?{alt:'Ice'}:{textContent:'20'}}}];ctx.resolveBlooketState=()=>({state:{tokens:100},async buyPack(){throw Error('purchase rejected')}});
 await assert.rejects(vm.runInContext(code('global/spamBuyBlooks.js'),ctx),/purchase rejected/,'Do not report completion before an asynchronous purchase finishes');
}
{
 const model={state:{choices:[]},setState(v){Object.assign(this.state,v)}},ctx=context(model,{other:{setState(){throw Error('Wrong component')}}});ctx.resolveBlooketState=ctx.findBlooketComponent;ctx.setInterval=(fn,delay,...args)=>fn(...args);
 await vm.runInContext(code('crypto/alwaysTriple.js'),ctx);assert.equal(model.state.choices[0].val,3);
}
for(const fail of [false,true]){
 const ctx=context({setState(){}});vm.runInContext('globalThis.originalIterator=Array.prototype[Symbol.iterator];globalThis.choices=[{type:"gold"},{type:"nothing"},{type:"divide"}];globalThis.target={constructor:{prototype:{answerNext(){if(globalThis.fail)throw Error("answer failed");globalThis.remaining=[...choices]}}}}',ctx);ctx.fail=fail;const cleanup=[];ctx.onBlooketCleanup=fn=>cleanup.push(fn);ctx.resolveBlooketState=()=>ctx.target;
 const result=vm.runInContext(code('gold/removeBadChoices.js'),ctx);
 if(fail)await assert.rejects(result,/answer failed/);else{await result;assert.equal(ctx.remaining.length,1);assert.equal(ctx.remaining[0].type,'gold');}
 assert(vm.runInContext('Array.prototype[Symbol.iterator]===originalIterator',ctx));cleanup.forEach(fn=>fn());
}
console.log('PASS 109 action syntax, legacy component/scene resolution, Flappy, legacy Crypto, Gold, Doom, asynchronous selling/purchase failures and built-in restoration. Current Brawl actions and question tools have separate behavior suites; no live verification claimed.');
