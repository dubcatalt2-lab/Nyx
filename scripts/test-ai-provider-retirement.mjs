import assert from 'node:assert/strict';
for(const name of ['NYX_AI_API_KEY','NYX_GROQ_API_KEY','NYX_NAVY_API_KEY','NYX_HUGGINGFACE_API_KEY','NYX_HUGGINGFACE_API_KEY_2','NYX_HUGGINGFACE_API_KEY_3','NYX_OFOX_API_KEY','NYX_TOKENMIX_API_KEY'])process.env[name]='retired-fixture-only';
process.env.NYX_AI_ENDPOINT='https://retired.invalid/api/ai';
delete process.env.NYX_OPENROUTER_API_KEY;
const originalFetch=globalThis.fetch,upstream=[];
globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('http://127.0.0.1:'))return originalFetch(url,options);
  upstream.push(String(url));
  assert.equal(String(url),'https://openrouter.ai/api/v1/models','A retired provider was contacted');
  return new Response(JSON.stringify({data:[{id:'google/gemini-2.5-flash-lite',name:'Gemini 2.5 Flash Lite',architecture:{input_modalities:['text','image']}},{id:'deepseek/deepseek-v4-flash',name:'DeepSeek'},{id:'openai/gpt-5.6-luna',name:'Luna',architecture:{input_modalities:['text','image']}}]}),{headers:{'content-type':'application/json'}});
};
const {app}=await import('../server.js');
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
try {
  assert.deepEqual(await (await fetch(origin+'/api/nyx-ai/providers')).json(),{providers:[]});
  assert.equal((await fetch(origin+'/api/nyx-ai/models')).status,503);
  for(const name of ['navy','groq','huggingface','ofox','tokenmix'])assert.equal((await fetch(origin+'/api/nyx-ai/models',{headers:{'x-nyx-ai-provider':name}})).status,410);
  assert.equal((await fetch(origin+'/api/nyx-ai/models',{headers:{'x-nyx-ai-api-key':'retired-fixture-personal'}})).status,410);
  assert.equal((await fetch(origin+'/api/v1/ai',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,503);
  assert.equal(upstream.length,0,'Retired credentials must not authorize any provider requests');
  process.env.NYX_OPENROUTER_API_KEY='new-fixture-only';
  process.env.NYX_AI_DAILY_BUDGET_USD='1';
  process.env.NYX_AI_MODEL_PRICES_JSON=JSON.stringify({'shared:google/gemini-2.5-flash-lite':{inputPerMillion:.1,outputPerMillion:.4},'shared:openai/gpt-5.6-luna':{inputPerMillion:.25,outputPerMillion:1.2}});
  assert.deepEqual(await (await fetch(origin+'/api/nyx-ai/providers')).json(),{providers:[{id:'shared',label:'OpenRouter'}]});
  const catalog=await (await fetch(origin+'/api/nyx-ai/models')).json();assert.deepEqual(catalog.models.map(m=>m.id),['google/gemini-2.5-flash-lite','openai/gpt-5.6-luna']);assert.ok(catalog.models.every(m=>m.vision));
  assert.deepEqual(upstream,['https://openrouter.ai/api/v1/models']);
  console.log('PASS: retired server credentials ignored, old provider/personal options rejected, legacy gateway keys retired, only OpenRouter exposed');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));globalThis.fetch=originalFetch;}
