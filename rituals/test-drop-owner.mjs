import assert from 'node:assert/strict';
import {createDropOwnerScope} from '../scripture/drop-owner.mjs';
import {hasFullAiCatalog} from '../scripture/ai-owner-catalog.mjs';
const scope=createDropOwnerScope({env:{DROP_OWNER_UID:'drop-owner'},verify:async token=>{if(token==='invalid')throw Error('Invalid');return {uid:token};}});
const run=async(host,path,token)=>{let result;await scope.middleware({hostname:host,path,get:()=>`Bearer ${token}`},{},async()=>{await new Promise(r=>setTimeout(r,5));result=scope.uid();});return result;};
assert.deepEqual(await Promise.all([
 run('drop.ridgewoodstem.org','/api/owner-dashboard','drop-owner'),
 run('nyxlearning.org','/api/owner-dashboard','drop-owner'),
 run('drop.ridgewoodstem.org','/api/owner-dashboard','member'),
 run('drop.ridgewoodstem.org','/api/owner-dashboard','invalid'),
 run('drop.ridgewoodstem.org','/api/account/profile','drop-owner'),
 run('drop.ridgewoodstem.org','/api/drop-ai','drop-owner')
]),['drop-owner','','','','','drop-owner']);
assert.equal(scope.uid(),'');
process.env.DROP_OWNER_UID='drop-owner';
assert(hasFullAiCatalog({uid:'drop-owner',app:'drop'}));
assert(!hasFullAiCatalog({uid:'drop-owner',app:'nyx'}));
assert(!hasFullAiCatalog({uid:'member',app:'drop',owner:true}));
assert(!hasFullAiCatalog({uid:'drop-owner',app:'drop',apiVerified:true}));
delete process.env.DROP_OWNER_UID;
console.log('PASS Drop owner verified identity, hostname and route scope, concurrent isolation and AI-only exemption');
