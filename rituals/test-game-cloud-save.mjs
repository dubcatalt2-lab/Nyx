import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use('/assets/games',express.static('relics/games'));app.get('/',(_,r)=>r.send('<!doctype html><title>Save fixture</title>'));
const cloud=new Map();let fail=false,puts=0;
app.use(express.json({limit:'1mb'}));
app.post('/cloud',(req,res)=>{const {type,gameKey,accountUid,storage,removed}=req.body;const key='alice:'+gameKey;if(type.endsWith('load'))return res.json({accountUid:'alice',storage:cloud.get(key)||{}});puts++;if(fail)return res.status(503).json({error:'offline fixture'});if(accountUid!=='alice')return res.status(409).json({error:'account changed'});const value={...cloud.get(key),...storage};for(const name of removed||[])delete value[name];cloud.set(key,value);res.json({saved:true});});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
const workspace=await chromium.launch({channel:'msedge',headless:true});
async function setup(page,key='soccer'){
 await page.goto(origin);await page.evaluate(async key=>{
  const {createGameCloudSave}=await import('/assets/games/game-cloud-save.js');window.saveMessages=[];
  window.session=createGameCloudSave({gameKey:key,current:()=>true,status:text=>saveMessages.push(text),request:async(type,data)=>{const response=await fetch('/cloud',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,...data})});const value=await response.json();if(!response.ok)throw Error(value.error);return value;}});
  await session.start();
  window.writeFile=async(contents)=>{const req=indexedDB.open('/userfs',21);const db=await new Promise((resolve,reject)=>{req.onupgradeneeded=()=>req.result.createObjectStore('FILE_DATA');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});await new Promise((resolve,reject)=>{const tx=db.transaction('FILE_DATA','readwrite');tx.objectStore('FILE_DATA').put({timestamp:new Date(),mode:33206,contents:new Uint8Array(contents)},'/userfs/soccer/save.dat');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});db.close()};
  window.readFile=async()=>{const req=indexedDB.open('/userfs');const db=await new Promise(r=>req.onsuccess=()=>r(req.result));try{return await new Promise(r=>{const get=db.transaction('FILE_DATA').objectStore('FILE_DATA').get('/userfs/soccer/save.dat');get.onsuccess=()=>r(get.result)})}finally{db.close()}};
 },key);
}
try{
 const context=await workspace.newContext(),page=await context.newPage();await setup(page);
 await page.evaluate(()=>{localStorage.setItem('soccer-level','7');localStorage.setItem('nyx.secret','must not upload')});
 await page.evaluate(()=>writeFile([4,5,6]));
 await page.waitForTimeout(5800);
 assert.equal(cloud.get('alice:soccer')['soccer-level'],'7');assert(!('nyx.secret' in cloud.get('alice:soccer')));assert(Object.keys(cloud.get('alice:soccer')).some(k=>k.startsWith('__nyx_game_files')));
 const noChanges=puts;await page.evaluate(()=>session.flush());assert.equal(puts,noChanges,'Unchanged saves must not upload');
 fail=true;await page.evaluate(async()=>{localStorage.setItem('soccer-level','9');await writeFile([9,8,7]);await session.flush()});
 assert(await page.evaluate(()=>saveMessages.some(x=>x.includes('offline'))));
 await setup(page);assert.equal(await page.evaluate(()=>localStorage.getItem('soccer-level')),'9','Old cloud must not overwrite pending local progress');
 fail=false;await page.evaluate(()=>session.flush());assert.equal(cloud.get('alice:soccer')['soccer-level'],'9');
 await page.evaluate(()=>localStorage.setItem('soccer-level','10'));await setup(page);assert.equal(await page.evaluate(()=>localStorage.getItem('soccer-level')),'10','Changes after last checkpoint must survive reload');await page.evaluate(()=>session.flush());
 const remote=await workspace.newContext(),other=await remote.newPage();await setup(other);assert.equal(await other.evaluate(()=>localStorage.getItem('soccer-level')),'10');
 const restored=await other.evaluate(async()=>{const saved=await readFile();return {bytes:[...saved.contents],date:saved.timestamp instanceof Date,mode:saved.mode}});assert.deepEqual(restored,{bytes:[9,8,7],date:true,mode:33206});
 await other.evaluate(async()=>{localStorage.removeItem('soccer-level');await session.flush()});assert(!('soccer-level' in cloud.get('alice:soccer')));
 const old=puts;await other.evaluate(async()=>{await session.stop();localStorage.setItem('not-this-game','value')});await other.waitForTimeout(5200);assert.equal(puts,old,'Closed games must stop polling');
 await remote.close();await context.close();console.log('PASS periodic localStorage + Godot IDB saves, pending offline retries, refresh conflict protection, fresh-device restore, binary/Date types, deletions, no-op suppression, private-key exclusion and stop cleanup.');
}finally{await workspace.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
