import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, mkdir, symlink, unlink, rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const temp=await mkdtemp(join(tmpdir(),'nyx-release-routes-'));
const releases=join(temp,'.nyx-releases');
await mkdir(releases);
const site=join(releases,'site');
await symlink(resolve('dist'),site,process.platform==='win32'?'junction':'dir');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(key)));
const child=fork(new URL('../shepherd.js',import.meta.url),[],{silent:true,env:{...env,PORT:'0',WISP_URL:'wss://example.com/wisp/',NYX_PUBLIC_ORIGIN:'http://127.0.0.1',NYX_STATIC_ROOT:site,NYX_YOUTUBE_NATIVE_ENABLED:'0'}});
child.stdout.resume();child.stderr.resume();
try{
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Backend startup timed out')),20000);
    child.once('error',reject);
    child.on('message',message=>{if(message.type==='nyx:listening'){clearTimeout(timer);resolve(message.port);}});
  });
  const base=`http://127.0.0.1:${port}`;
  for(const path of ['/nyx','/study.html','/index.html','/apps/nyxify/','/apps/nyxtube/','/apps/movies/','/tutsi','/connect-domain','/tutsi/connect-domain','/student-resources.html']){
    const response=await fetch(base+path);
    assert.equal(response.status,200,path+' '+(response.ok?'':await response.text()));
    assert.match(response.headers.get('content-type'),/text\/html/,path);
    assert.match(await response.text(),/<(?:!doctype|html)/i,path);
  }
  for(const path of ['/.env','/.nyx-releases/site/index.html','/shepherd.js','/scripture/source-layout.mjs','/package.json']){
    assert.equal((await fetch(base+path)).status,404,path);
  }
  for(const prefix of ['', '/apps/jsdelivr-publisher/static-package/files']){
    const response=await fetch(base+prefix+'/assets/backgrounds/study-away-cover.png');
    assert.equal(response.status,200,'Away cover must ship with both builds');
    assert.match(response.headers.get('content-type'),/image\/png/);
    assert((await response.arrayBuffer()).byteLength>1000);
  }
  console.log('PASS hidden release directory: app pages load; private paths stay blocked.');
}finally{
  if(child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill();await done;}
  await unlink(site);await rmdir(releases);await rmdir(temp);
}
