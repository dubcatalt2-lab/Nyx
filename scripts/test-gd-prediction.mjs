import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('assets/studies/study-practice.js','utf8');
const steer=vm.runInNewContext('('+source.slice(source.indexOf('  function steer('),source.indexOf('  let timer;'))+')',{playerSpeed:11.540004,options:{coins:true,learn:false},levelObjects:()=>[],secretFlightTarget:()=>null});
function fixture(distance,{flip=false,mirror=false,mini=false}={}){
 const calls=[],scratch=[];const sign=flip?-1:1,dir=mirror?-1:1;
 const scene={_playerWorldX:0,_state:{y:(mini?18:30)*sign,yVelocity:0,onGround:true,canJump:true,gravityFlipped:flip,mirrored:mirror,isMini:mini},_level:{getFloorY:()=>flip?-600:0,getCeilingY:()=>flip?0:null,getNearbySectionObjects(x){calls.push(x);scratch.length=0;if(Math.abs(x)<250&&distance!==null)scratch.push({type:'hazard',x:distance*dir,y:30*sign,w:12,h:24});return scratch}}};
 const before=JSON.stringify(scene._state);const result=steer(scene);assert.equal(JSON.stringify(scene._state),before,'prediction must not mutate player state');assert(calls.some(x=>Math.abs(x)===6000),'scan all 100 blocks');return result;
}
assert.equal(fixture(null),false);assert.equal(fixture(140),false);assert.equal(fixture(80),true);assert.equal(fixture(80,{flip:true}),true);assert.equal(fixture(80,{mirror:true}),true);
console.log('PASS: 100-block scan, reused obstacle buffer, jump timing, inverted gravity, mirrored movement, no live-state mutation.');

function special(state,objects){return steer({_playerWorldX:0,_spaceWasDown:true,_state:{y:100,yVelocity:0,...state},_level:{getFloorY:()=>0,getCeilingY:()=>600,getNearbySectionObjects:()=>objects}})}
assert.equal(special({isDashing:true,dashYVelocity:0},[]),true,'dash must hold across frames');
assert.equal(special({isDashing:true,dashYVelocity:0},[{type:'solid',x:30,y:100,w:30,h:90}]),false,'dash releases before a wall');
assert.equal(special({isFlying:true,y:300},[{type:'coin',x:180,y:400,w:30,h:30}]),true,'ship climbs toward a reachable coin');
assert.equal(special({isFlying:true,y:300},[{type:'coin',x:180,y:200,w:30,h:30}]),false,'ship descends toward a reachable coin');
console.log('PASS: native dash hold/release and flying coin targeting.');

const memoryStorage=new Map();const context={window:{currentlevel:['test','test','test-level']},localStorage:{getItem:k=>memoryStorage.get(k),setItem:(k,v)=>memoryStorage.set(k,v)},options:{autoplay:true,learn:true,noclip:false},status:{textContent:''}};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  const learning='),source.indexOf('  function steer(')),context);
context.scene={_state:{isDead:false},_playerWorldX:100,_spaceWasDown:false};vm.runInContext('observeAttempt(scene,true)',context);context.scene._state.isDead=true;context.scene._playerWorldX=180;vm.runInContext('observeAttempt(scene,false);observeAttempt(scene,false)',context);
assert.equal(JSON.parse(memoryStorage.get('nyx.gd.retry.test-level')).length,1,'learn once per death');assert.match(context.status.textContent,/Adjusted timing/);
context.options.noclip=true;context.scene._state.isDead=false;vm.runInContext('observeAttempt(scene,true)',context);context.scene._state.isDead=true;vm.runInContext('observeAttempt(scene,false)',context);assert.equal(JSON.parse(memoryStorage.get('nyx.gd.retry.test-level')).length,1,'do not learn noclip deaths');
console.log('PASS: per-level persisted retry learning, deduplicated death and noclip exclusion.');

const retrySteer=vm.runInNewContext('('+source.slice(source.indexOf('  function steer('),source.indexOf('  let timer;'))+')',{playerSpeed:11.540004,options:{coins:false,learn:true},levelObjects:()=>[],secretFlightTarget:()=>null,learningFor:()=>({failures:[{launch:0,death:130,missed:true}]})});
const retryScene={_playerWorldX:0,_state:{y:30,yVelocity:0,onGround:true,canJump:true},_level:{getFloorY:()=>0,getCeilingY:()=>null,getNearbySectionObjects:()=>[{type:'hazard',x:130,y:30,w:12,h:24}]}};
assert.equal(steer(retryScene),false);assert.equal(retrySteer(retryScene),true,'a recorded missed jump must change the next input');console.log('PASS: missed-jump learning changes the next action, not only the status.');

const routeContext=vm.createContext({});vm.runInContext(source.slice(source.indexOf('  const levelIndexes='),source.indexOf('  const learning=')),routeContext);
routeContext.level={objects:[{type:'coin',x:10000,y:750,w:60,h:60},{type:'portal_fly',x:6000,y:630,w:60,h:180}],getCeilingY:()=>600};routeContext.player={p:{y:300},_isObjectActivated:()=>false};vm.runInContext('levelObjects(level)',routeContext);assert(vm.runInContext('secretFlightTarget(level,player,5500)',routeContext)>=570,'aim at the earlier secret entrance, even when the coin is far outside the visible area');console.log('PASS: full-level hidden coin indexing and early entrance targeting.');

const boundarySteer=vm.runInNewContext('('+source.slice(source.indexOf('  function steer('),source.indexOf('  let timer;'))+')',{playerSpeed:11.540004,options:{coins:true,learn:false},levelObjects:()=>[],secretFlightTarget:()=>570});
const boundaryScene={_playerWorldX:0,_state:{isFlying:true,y:562,yVelocity:1},_level:{getFloorY:()=>0,getCeilingY:()=>600,getNearbySectionObjects:()=>[{type:'portal_fly',x:80,y:630,w:180,h:60}]}};
assert.equal(boundarySteer(boundaryScene),true,'keep thrust into a ceiling portal rather than braking below its trigger');
console.log('PASS: held thrust activates boundary flight portals.');
