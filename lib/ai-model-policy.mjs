import {freeAiModels} from './ai-free-models.mjs';
export const assignableAiModels = [...new Set([
  'google/gemini-2.5-flash-image','google/gemini-2.5-flash-lite',
  'openai/gpt-5.6-luna','inception/mercury-2.5','qwen/qwen3.7-flash',
  'deepseek/deepseek-v4.1-flash','openai/gpt-5.6-sol-pro',...freeAiModels
])];
export function validateAiModelRules(value) {
  const invalid=()=>{throw Object.assign(new Error('Choose valid models, access settings, message limits (0-100000) and reset days (1-30).'),{status:400});};
  if(!Array.isArray(value)||value.length>assignableAiModels.length)invalid();
  const seen=new Set();
  return value.map(rule=>{
    if(!rule||!assignableAiModels.includes(rule.model)||seen.has(rule.model)||!['allow','deny','default'].includes(rule.access)||!(rule.messages===null||(Number.isSafeInteger(rule.messages)&&rule.messages>=0&&rule.messages<=100000))||!Number.isInteger(rule.periodDays)||rule.periodDays<1||rule.periodDays>30)invalid();
    seen.add(rule.model);
    return {model:rule.model,access:rule.access,messages:rule.messages,periodDays:rule.periodDays};
  });
}
export function aiModelRule(actor,model) {
  return Array.isArray(actor?.modelRules)?actor.modelRules.find(rule=>rule.model===model):undefined;
}
