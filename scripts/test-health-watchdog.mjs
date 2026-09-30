import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {assessHealth,probeHealth} from '../deploy/health-watchdog.mjs';

const unit={ActiveState:'active',SubState:'running',MainPID:'123',ActiveEnterTimestampMonotonic:'1000000'};
let previous={};
for(let i=0;i<3;i++){
 const result=assessHealth({unit,previous,now:100+i*30,healthy:false});previous=result.state;
 assert.equal(result.action,i===2?'restart':'failed-check');
}
assert.equal(previous.lastRestart,160);
for(let i=0;i<3;i++){
 const result=assessHealth({unit,previous,now:190+i*30,healthy:false});previous=result.state;
 assert.notEqual(result.action,'restart','Cooldown must prevent restart loops');
}
assert.equal(assessHealth({unit,previous,now:460,healthy:false}).action,'restart');
const recovered=assessHealth({unit,previous,now:300,healthy:true});assert.equal(recovered.state.failures,0);
assert.equal(assessHealth({unit,previous:recovered.state,now:330,healthy:false}).action,'failed-check');
for(const state of ['inactive','failed','activating','deactivating']){
 const result=assessHealth({unit:{...unit,ActiveState:state},previous,now:500,healthy:false});
 assert.equal(result.action,'inactive');assert.equal(result.state.failures,0);
}
assert.equal(assessHealth({unit,previous,now:20,healthy:false}).action,'startup');
assert.equal(assessHealth({unit:{...unit,MainPID:'456'},previous,now:500,healthy:false}).state.failures,1);
assert.equal(assessHealth({unit,previous:{failures:NaN,lastRestart:'bad'},now:500,healthy:false}).state.failures,1);

const server=createServer((req,res)=>{
 if(req.url==='/stall')return;
 if(req.url==='/redirect'){res.writeHead(302,{Location:'/ok'});res.end();return;}
 if(req.url==='/failed'){res.writeHead(503);res.end();return;}
 res.setHeader('Content-Type','application/json');
 res.end(req.url==='/invalid'?'invalid JSON':JSON.stringify({ok:true,service:req.url==='/wrong'?'other':'nyx'}));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 const origin='http://127.0.0.1:'+server.address().port;
 assert.equal(await probeHealth(origin+'/ok'),true);
 for(const path of ['/failed','/wrong','/invalid','/redirect','/stall'])assert.equal(await probeHealth(origin+path,100),false,path);
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
console.log('PASS three-failure recovery, cooldown, healthy reset, startup grace, intentional stop, new process and real HTTP failure/timeout probes.');
