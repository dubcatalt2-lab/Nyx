import {sourceFile} from '../scripture/source-layout.mjs';
import {adFreeStatus} from '../scripture/ad-free-keys.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
const source=readFileSync(sourceFile('shepherd.js'),'utf8');
const names=new Set(['nyxRolePolicies','nyxAssignableRoles','normalizeNyxRole','nyxRolePolicy','normalizeSubscriptionStatus','hasPremiumSubscription','nyxPublisherMode']);
const nodes=parse(source,{ecmaVersion:'latest',sourceType:'module'}).body.filter(n=>names.has(n.id?.name)||(n.type==='VariableDeclaration'&&n.declarations.some(d=>names.has(d.id?.name))));
assert.equal(nodes.length,names.size);
const policy=vm.runInNewContext(nodes.map(n=>source.slice(n.start,n.end)).join('\n')+'\n({nyxPublisherMode,normalizeNyxRole,nyxRolePolicy,nyxAssignableRoles})',{adFreeStatus,publisherAdsEnabled:true,publisherAdsAdkidOnly:false});
for(const role of ['moderator','developer','manager','admin','co_owner','owner'])assert.equal(policy.nyxPublisherMode(role,'free'),'off',role);
for(const role of ['member','support','tester','contributor','adkid']){
 for(const plan of ['premium','trialing'])assert.equal(policy.nyxPublisherMode(role,plan),'off',`${role}/${plan}`);
}
assert.equal(policy.nyxPublisherMode('member','free'),'standard');
assert.equal(policy.nyxPublisherMode('adkid','free'),'adkid');
assert.equal(policy.normalizeNyxRole('adkid'),'adkid');
assert.equal(policy.nyxRolePolicy('adkid').rank,policy.nyxRolePolicy('member').rank);
assert.equal(policy.nyxRolePolicy('adkid').permissions.length,0);
assert.ok(policy.nyxAssignableRoles.includes('adkid'));
console.log('PASS premium/staff ad exemption, premium precedence, adkid assignment and zero administrative privileges.');

assert.equal(policy.nyxPublisherMode('adkid','free',{adFree:{keyId:'a'.repeat(64),expiresAtMs:0}}),'off');

const limited=vm.runInNewContext(nodes.map(n=>source.slice(n.start,n.end)).join('\n')+'\nnyxPublisherMode',{adFreeStatus,publisherAdsEnabled:true,publisherAdsAdkidOnly:true});
assert.equal(limited('member','free'),'off');
assert.equal(limited('adkid','free'),'adkid');
assert.equal(limited('adkid','premium'),'off');
const disabled=vm.runInNewContext(nodes.map(n=>source.slice(n.start,n.end)).join('\n')+'\nnyxPublisherMode',{adFreeStatus,publisherAdsEnabled:false,publisherAdsAdkidOnly:true});
assert.equal(disabled('adkid','free'),'off');
console.log('PASS Adkid-only preview and disabled production precedence.');
