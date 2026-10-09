import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import express from 'express';
import {retiredLinkGenerator} from '../scripture/retired-link-generator.mjs';
const app=express();app.use(retiredLinkGenerator);app.use((_req,res)=>res.status(204).end());
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const origin='http://127.0.0.1:'+server.address().port;
try{
  for(const path of ['/apps/link-generator/','/apps/link-generator/bulk.html','/chapels/link-generator/app.js','/api/link-generator','/api/link-generator/status'])assert.equal((await fetch(origin+path)).status,410,path);
  assert.equal((await fetch(origin+'/api/link-generator',{method:'POST'})).status,410);
  for(const path of ['/api/link-generator/auth-config','/api/apps','/apps/jsdelivr-publisher/','/api/account/sign-in'])assert.equal((await fetch(origin+path)).status,204,path);
  const frontend=await readFile('gospel.js','utf8'),backend=await readFile('shepherd.js','utf8');
  assert(!frontend.includes("['link-generator','link-generator','Link Generator','/apps/link-generator/']"));
  assert(!backend.includes('{ id: "link-generator", icon: "link-generator", name: "Link Generator"'));
  for(const file of ['chapels/link-checker/index.html','chapels/jsdelivr-publisher/index.html'])assert(!(await readFile(file,'utf8')).includes('href="../link-generator/"'));
  console.log('PASS retired app/API routes, removed default entries/navigation, and preserved shared account configuration.');
}finally{server.close();}
