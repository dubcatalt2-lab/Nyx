import assert from 'node:assert/strict';
import {createLoremCloud} from '../lib/nyxcloud-lorem.mjs';
let clock=1e7,items=[],deleted=[],offline=false;
const state={version:1,migrated:true,sessionPolicy:2,syncedAt:0,entries:[]};
const desktop=(id,status='exited',owner_id='')=>({id,status,owner_id,url:`https://loremgroup.org/vm/${id}/`});
const router=createLoremCloud({key:'test',now:()=>clock,store:async task=>task(state,async()=>{}),fetchImpl:async url=>{
 if(offline)throw Error('offline');
 if(url.endsWith('/api/dev/list'))return Response.json({vms:items});
 if(url.includes('/api/delete/')){const id=url.split('/').pop();deleted.push(id);items=items.filter(v=>v.id!==id);return Response.json({status:'success'});}
 throw Error('Unexpected provider request');
}});
items=[desktop('assigned','running')];state.entries=[{uid:'a',status:'ready',vm:{id:'assigned',url:items[0].url},readyAt:clock-900001,expiresAt:clock-1,lastSeen:clock}];
await router.maintain();assert.deepEqual(deleted,['assigned']);assert.equal(state.entries.length,0);
items=[desktop('orphan'),desktop('active','running')];clock+=6000;await router.maintain();clock+=899000;await router.maintain();assert.equal(deleted.length,1);
clock+=6000;offline=true;await router.maintain();assert.equal(deleted.length,1);offline=false;clock+=6000;await router.maintain();assert.deepEqual(deleted,['assigned','orphan']);assert.equal(items[0].id,'active');
items.push(desktop('uncertain','running','request-a'));state.entries=[{uid:'a',status:'allocating',requestId:'request-a',allocationStartedAt:clock,lastSeen:clock}];clock+=6000;await router.maintain();assert.equal(state.entries[0].status,'ready');assert.equal(state.entries[0].vm.id,'uncertain');
items.push(desktop('protected'));state.entries.push({uid:'b',status:'allocating',requestId:'unknown',allocationStartedAt:clock,lastSeen:clock});clock+=6000;await router.maintain();clock+=901000;await router.maintain();assert(!deleted.includes('protected'));
router.dispose();console.log('PASS autonomous expiry, stopped orphan grace, outage safety, running protection, request ownership recovery and uncertain protection');
