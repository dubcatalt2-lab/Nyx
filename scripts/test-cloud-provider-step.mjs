import assert from 'node:assert/strict';
import {requireProviderStep} from '../services/stratus/provider-step.mjs';
assert.equal((await requireProviderStep(Response.json({status:200}),'verification')).status,200);
await assert.rejects(requireProviderStep(Response.json({status:403,msg:'Email request rejected'}),'verification'),/rejected verification \(provider 403\)/);
await assert.rejects(requireProviderStep(new Response('<html>bad gateway</html>',{status:502}),'verification'),/unreadable verification response/);
await assert.rejects(requireProviderStep(Response.json({status:200},{status:500}),'registration'),/rejected registration/);
try{await requireProviderStep(Response.json({status:400,msg:'Bad user@example.com https://example.com/private ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'}),'verification');assert.fail()}catch(error){assert(!error.message.includes('user@example.com'));assert(!error.message.includes('/private'));assert(!error.message.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ'));}
console.log('Provider response validation and diagnostic redaction passed.');
