import assert from 'node:assert/strict';
import { memoryFirestore } from './test-ai-allowance.mjs';
import { aiAllowanceConfig, createAiAllowance, aiModelAllowed } from '../lib/ai-allowance.mjs';

const actor = (uid, extra = {}) => ({ uid, createdAt: Date.parse('2026-08-01'), trusted: true, ...extra });
for (const privilege of [{ premium: true }, { owner: true }, { coOwner: true }]) {
  const db = memoryFirestore();
  let time = Date.parse('2026-09-16T12:00:00Z');
  const config = aiAllowanceConfig({ NYX_AI_CONCURRENT_GLOBAL: 3 });
  const allowance = createAiAllowance({ db, config, now: () => time });
  const first = await allowance.begin(actor('regular-a'));
  const second = await allowance.begin(actor('regular-b'));
  await assert.rejects(allowance.begin(actor('regular-c')), /busy/);
  const priority = actor('priority', privilege);
  const reserved = await allowance.begin(priority);
  await assert.rejects(allowance.begin(actor('other-priority', privilege)), /busy/, 'Global cap remains enforced');
  await assert.rejects(allowance.begin(priority), /busy/, 'One in-flight request per account');
  await Promise.all([first, second, reserved].map(s => allowance.finish(s)));
  for (let n = 0; n < 4; n++) await allowance.finish(await allowance.begin(priority));
  await assert.rejects(allowance.begin(actor('blocked', { ...privilege, blocked: true })), /restricted/);
  // Avoid the separate co-owner daily cap while checking the minute cap.
  for (let n = 5; n < 12; n++) {
    if (privilege.coOwner && n >= 10) break;
    await allowance.finish(await allowance.begin(priority));
  }
  if (!privilege.coOwner) {
    await assert.rejects(allowance.begin(priority), e => e.retryAfter === 60 && /Please wait/.test(e.message));
    time += 31000;
    await assert.rejects(allowance.begin(priority), e => e.retryAfter === 29);
    time += 30000;
    await allowance.finish(await allowance.begin(priority));
  }
  assert.equal(aiModelAllowed('openai/gpt-5.6-sol-pro', priority), privilege.owner === true);
}
{
  const allowance = createAiAllowance({ db: memoryFirestore(), config: aiAllowanceConfig({}) });
  for (let n = 0; n < 4; n++) await allowance.finish(await allowance.begin(actor('regular')));
  await assert.rejects(allowance.begin(actor('regular')), /Please wait/);
  for (let n = 0; n < 2; n++) await allowance.finish(await allowance.begin(actor('api', { premium: true, apiVerified: true, apiMinuteRequests: 2 })));
  await assert.rejects(allowance.begin(actor('api', { premium: true, apiVerified: true, apiMinuteRequests: 2 })), /Please wait/);
}
console.log('AI priority: verified privilege reserve access, faster pacing, accurate retry delay, global/account caps and API-key limits passed.');
