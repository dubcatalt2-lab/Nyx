import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createCompanion,runCommand} from '../companion/core.mjs';
import {parseAgentReply} from '../lib/agent-protocol.mjs';
import {companionZip} from '../lib/agent-download.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'nyx-companion-test-'));
const workspace=path.join(root,'workspace'),outside=path.join(root,'outside');await mkdir(workspace);await mkdir(outside);
await writeFile(path.join(workspace,'hello.txt'),'original');await writeFile(path.join(workspace,'.env'),'secret');await writeFile(path.join(outside,'private.txt'),'private');
let accepted=true,approvals=0,commands=0,alterOnApproval=false;
const companion=await createCompanion({workspace,port:0,approve:async()=>{approvals++;if(alterOnApproval)await writeFile(path.join(workspace,'hello.txt'),'external change');return accepted;},run:async()=>{commands++;return {output:'test command',exitCode:0};}});
const origin='https://nook.nyxlearning.org',base=`http://127.0.0.1:${companion.port}`;
async function request(route,body,headers={}){const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:origin,Authorization:'Bearer '+companion.token,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()};}
const tool=(name,args={})=>request('/tool',{tool:name,args});
try{
 assert.equal((await request('/status',null,{Origin:'https://evil.example'})).status,403);
 assert.equal((await request('/status',null,{Authorization:'Bearer wrong'})).status,401);
 assert.equal((await tool('read',{path:'hello.txt'})).status,403);
 assert.equal((await request('/connect',{})).connected,true);assert.equal(approvals,1);
 const file=await tool('read',{path:'hello.txt'});assert.equal(file.content,'original');
 for(const name of ['../outside/private.txt','C:/Windows/win.ini','hello.txt:stream','.env','folder\\file','CON','hello.txt.'])assert.equal((await tool('read',{path:name})).status,400,name);
 await symlink(outside,path.join(workspace,'linked'),process.platform==='win32'?'junction':'dir');
 assert.equal((await tool('read',{path:'linked/private.txt'})).status,400);
 assert(!(await tool('list')).entries.some(item=>['linked','.env'].includes(item.name)));
 accepted=false;assert.equal((await tool('write',{path:'hello.txt',content:'declined',expectedHash:file.hash})).denied,true);assert.equal(await readFile(path.join(workspace,'hello.txt'),'utf8'),'original');
 assert.equal((await tool('command',{command:'echo test'})).denied,true);assert.equal(commands,0);
 accepted=true;assert.equal((await tool('write',{path:'hello.txt',content:'stale',expectedHash:'wrong'})).status,409);
 const changed=await tool('write',{path:'hello.txt',content:'updated',expectedHash:file.hash});assert.equal(changed.changed,true);assert.equal(await readFile(path.join(workspace,'hello.txt'),'utf8'),'updated');
 assert.equal((await tool('undo',{id:changed.id})).undone,true);assert.equal(await readFile(path.join(workspace,'hello.txt'),'utf8'),'original');
 alterOnApproval=true;assert.equal((await tool('write',{path:'hello.txt',content:'would overwrite',expectedHash:file.hash})).status,409);alterOnApproval=false;
 const created=await tool('write',{path:'new.txt',content:'new',expectedHash:null});assert.equal(created.changed,true);await tool('undo',{id:created.id});await assert.rejects(readFile(path.join(workspace,'new.txt')));
 const latest=await tool('read',{path:'hello.txt'}),removed=await tool('delete',{path:'hello.txt',expectedHash:latest.hash});assert.equal(removed.changed,true);assert.equal((await tool('undo',{id:removed.id})).undone,true);
 assert.equal((await tool('command',{command:'echo test'})).exitCode,0);assert.equal(commands,1);
 const real=await runCommand(process.platform==='win32'?"Write-Output 'companion-ok'":"printf companion-ok",workspace,new AbortController().signal);assert.match(real.output,/companion-ok/);assert.equal(real.exitCode,0);
 const cancellation=new AbortController();
 const pending=runCommand(process.platform==='win32'?'Start-Sleep -Seconds 30':'sleep 30',workspace,cancellation.signal);
 const cancelTimer=setTimeout(()=>cancellation.abort(),300);
 try{assert.equal((await pending).stopped,true);}finally{clearTimeout(cancelTimer);}
 assert.equal((await tool('search',{query:'external'})).matches[0].path,'hello.txt');
 assert.equal(parseAgentReply('{"message":"done","done":true}').done,true);assert.throws(()=>parseAgentReply('{"message":"bad","tool":"run-anything","args":{}}'));
 const zip=await companionZip(process.cwd());assert.equal(zip.readUInt32LE(0),0x04034b50);assert(zip.includes(Buffer.from('Start-Nyx-Agents.cmd')));
 console.log('PASS companion pairing, origin/token guards, paths/junctions, approval denial, stale edits, backups/undo, command execution and downloadable ZIP');
}finally{await companion.close();for(const target of [root,companion.backupRoot]){assert(path.resolve(target).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(target,{recursive:true,force:true});}}
