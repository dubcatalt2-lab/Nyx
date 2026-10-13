import assert from 'node:assert/strict';
import {app} from '../shepherd.js';
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
const agents=['ClaudeBot/1.0','GPTBot/1.0','ChatGPT-User/1.0','OAI-SearchBot/1.0','Perplexity-User/1.0','curl/8.15.0'];
try {
 for(const path of ['/','/script.js','/runtime-config.js','/app.webmanifest']){
  const normal=await fetch(base+path,{headers:{'user-agent':'Mozilla/5.0',accept:'text/html,*/*'}});const body=await normal.text();
  assert.equal(normal.status,200,path);
  for(const agent of agents){const r=await fetch(base+path,{headers:{'user-agent':agent,accept:'text/html,*/*'}});assert.equal(r.status,normal.status,agent+' '+path);assert.equal(await r.text(),body,agent+' received different content at '+path);}
 }
 for(const path of ['/scripture/communion-relay.mjs','/connection/assembly.mjs','/package.json','/node_modules/wispurr/package.json'])for(const agent of ['Mozilla/5.0',...agents]){
  const r=await fetch(base+path,{headers:{'user-agent':agent}});assert.equal(r.status,404,path+' exposed');
 }
 const robots=await (await fetch(base+'/robots.txt')).text();assert.doesNotMatch(robots,/GPTBot|ClaudeBot|OAI-SearchBot|anthropic-ai/);
 console.log('PASS identical public content for browsers and AI crawlers; server sources stay private');
} finally {await new Promise(resolve=>server.close(resolve));}
