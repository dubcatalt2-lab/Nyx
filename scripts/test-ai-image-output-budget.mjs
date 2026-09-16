import assert from 'node:assert/strict';
import {createAiAllowance,aiAllowanceConfig} from '../lib/ai-allowance.mjs';
import {aiBudgetResponse} from '../lib/ai-budget-response.mjs';
import {memoryFirestore} from './test-ai-allowance.mjs';
const config=aiAllowanceConfig({NYX_AI_DAILY_BUDGET_USD:'1'}),db=memoryFirestore(),a=createAiAllowance({db,config});
const actor={uid:'image-owner',owner:true,device:'image-fixture',network:'fixture'},session=await a.begin(actor);
const payload={model:'google/gemini-2.5-flash-image',messages:[{role:'user',content:'Create one beach image'}],modalities:['text','image'],max_tokens:2200};
const reservation=await a.reserve(session,'shared',payload);
assert.equal(reservation.price.outputRate,30);assert.ok(reservation.reserved>=66000);assert.equal(payload.max_tokens,2200);
const response=aiBudgetResponse(Response.json({choices:[{message:{images:[{image_url:{url:'x'.repeat(3*1024*1024)}}]}}],usage:{prompt_tokens:100,completion_tokens:1290,cost:.03873}}),async(usage,success)=>{assert.equal(success,true);assert.equal(usage.output,1290);await a.settle(reservation,usage);},8*1024*1024);
await response.json();assert.equal(db.records.get('nyxAiAllowance/global').reserveMoney,38730);await a.finish(session,true);
let completed;const oversized=aiBudgetResponse(new Response('x'.repeat(8*1024*1024+1)),(usage,success)=>{completed={usage,success};},8*1024*1024);await assert.rejects(oversized.text(),/size limit/);assert.deepEqual(completed,{usage:null,success:false});
// Existing dollar caps still apply to newcomers and do not silently expand for images.
const newcomer=await a.begin({uid:'new-image',device:'new',network:'fixture',createdAt:Date.parse('2026-08-01')});await assert.rejects(a.reserve(newcomer,'shared',structuredClone(payload)),e=>e.code==='ai_allowance');await a.finish(newcomer);
console.log('PASS image allowance: conservative image pricing, actual usage/cost settlement, bounded large response, preserved account spending limits');

