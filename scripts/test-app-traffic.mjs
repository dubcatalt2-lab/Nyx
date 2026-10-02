import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';
import { createAppTraffic } from '../lib/app-traffic.mjs';

const dir = await mkdtemp(join(tmpdir(), 'nyx-traffic-test-'));
const file = join(dir, 'traffic.json');
let now = Date.UTC(2026, 9, 1, 12, 0, 10);
const collector = createAppTraffic({ file, now:()=>now, flushMs:0 });
function request(url, statusCode=200, duration=20, aborted=false) {
  const res = new EventEmitter(); res.statusCode=statusCode;
  let next=0; collector.middleware({url,headers:{authorization:'secret'},ip:'private-ip'}, res, ()=>next++);
  assert.equal(next,1); now += duration;
  if (!aborted) { res.writableFinished=true; res.emit('finish'); }
  res.emit('close');
}
try {
  request('/healthz'); request('/api/owner-dashboard/traffic?minutes=60');
  assert.equal(collector.snapshot().totals.requests,0,'Monitoring must not inflate traffic');
  assert.equal(collector.snapshot().peakMembers,null,'Old traffic cannot invent member history');
  collector.recordMembers(7); collector.recordMembers(3);
  assert.equal(collector.snapshot().peakMembers.count,7,'Peak retains concurrent high point, not accumulated visitors');
  request('/asset.js?token=secret',200,100); request('/api/example',503,300); request('/cancel',200,50,true);
  let result = collector.snapshot();
  assert.equal(result.totals.requests,3); assert.equal(result.totals.errors,1); assert.equal(result.totals.aborted,1);
  assert.equal(result.totals.completed,2); assert.equal(result.totals.averageMs,200,'Average excludes aborted requests');
  assert.equal(result.points.at(-2).requests,null,'Unmeasured history is not zero traffic');
  const first = result.peak.at;
  now=first+60000;
  collector.recordMembers(12);
  for(let i=0;i<8;i++)request('/static',200,10);
  result=collector.snapshot(); assert.equal(result.peak.requests,8); assert.equal(result.peak.at,first+60000);
  assert.equal(result.totals.requests,11); assert.equal(result.points.at(-1).partial,true);
  await collector.flush();
  const saved=await readFile(file,'utf8'); assert.doesNotMatch(saved,/secret|private-ip|asset|authorization/);
  now=first+3*60000;
  const restarted=createAppTraffic({file,now:()=>now,flushMs:0});
  assert.equal(restarted.snapshot().totals.requests,11,'Counts survive a restart');
  assert.equal(restarted.snapshot().peakMembers.count,12,'Member peak survives restart');
  assert.equal(restarted.snapshot().peakMembers.at,first+60000);
  assert.equal(restarted.snapshot().points.at(-2).requests,null,'Downtime is not reported as zero traffic');
  assert.equal(restarted.snapshot(1440).points.length,1440);
  assert.equal(restarted.snapshot(999999).points.length,60,'Arbitrary ranges cannot allocate unbounded histories');
  await restarted.close();
  now+=2*86400000; assert.equal(collector.snapshot(1440).totals.requests,0,'Old buckets expire');
  await collector.close();
  await writeFile(file,'invalid JSON');
  const invalid=createAppTraffic({file,now:()=>now,flushMs:0}); assert.equal(invalid.snapshot().totals.requests,0); await invalid.close();

  // Run the actual endpoint, including owner authorization, without live credentials.
  const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
  const presenceFunction=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id?.name==='recordOnlineMembers');
  let memberSample;
  const sessions=new Map([['a',{accountUid:'one'}],['b',{accountUid:'one'}],['c',{accountUid:'two'}],['guest',{accountUid:''}],['expired',{accountUid:'old'}]]);
  const presenceContext={Date,Set,presenceSessionDetails:sessions,pruneLocalPresence:()=>sessions.delete('expired'),appTraffic:{recordMembers:count=>memberSample=count}};
  vm.runInNewContext(source.slice(presenceFunction.start,presenceFunction.end)+';recordOnlineMembers();',presenceContext);
  assert.equal(memberSample,2,'Duplicate tabs, guests and expired sessions do not inflate peak members');
  const route=ast.body.find(n=>n.expression?.arguments?.[0]?.value==='/api/owner-dashboard/traffic');
  let handler, actor='member', reads=0;
  vm.runInNewContext(source.slice(route.start,route.end),{
    app:{get:(_path,fn)=>handler=fn},ownerDashboardActor:async()=>{
      if(actor==='anonymous')throw Object.assign(new Error('Unauthorized'),{status:401});
      return {actor:{uid:actor}};
    },founderProfileConfig:()=>({administratorUid:'founder'}),
    appTraffic:{snapshot:minutes=>{reads++;return {minutes};}}
  });
  const response=()=>({code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  for(const who of ['anonymous','member','other-owner']) {
    actor=who;const res=response();await handler({query:{}},res);assert.equal(res.code,who==='anonymous'?401:403);assert.equal(reads,0);
  }
  actor='founder';const res=response();await handler({query:{minutes:'360'}},res);assert.equal(res.code,200);assert.equal(reads,1);assert.equal(res.headers['Cache-Control'],'no-store');
  console.log('Traffic aggregation, spike timing, gaps, errors, persistence, retention, privacy and owner-only endpoint passed.');
} finally { await collector.close(); await rm(dir,{recursive:true,force:true}); }
