import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,scryptSync} from 'node:crypto';
import {createGate} from './server.mjs';
test('gate validates credentials server-side and rejects bypasses',async()=>{
  const password='test-⒮;&&#x34;';
  const salt=randomBytes(16).toString('hex');
  const server=createGate({salt,hash:scryptSync(password,salt,64).toString('hex'),key:randomBytes(32).toString('hex')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const login=(value,username='any person',origin='https://sec.ridgewoodstem.org')=>fetch(base+'/_q83entry/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({username,password:value})});
  try{
    const locked=await fetch(base+'/verify');assert.equal(locked.status,401);assert.equal((await locked.text()).includes(password),false);
    assert.equal((await login(password,'any','https://evil.example')).status,403);
    assert.equal((await login(password,'')).status,400);
    assert.equal((await login('wrong')).status,401);
    assert.ok(password.includes('\u24ae'));
    assert.equal((await login(password.replace('\u24ae','?'))).status,401);
    const success=await login(password);assert.equal(success.status,204);
    const cookie=success.headers.get('set-cookie');assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);
    assert.equal((await fetch(base+'/verify',{headers:{Cookie:cookie.split(';')[0]}})).status,204);
    assert.equal((await fetch(base+'/verify',{headers:{Cookie:cookie.split(';')[0]+'bad'}})).status,401);
    assert.equal((await fetch(base+'/_q83entry/unknown')).status,404);
    for(let i=0;i<10;i++)assert.equal((await login('bad')).status,401);
    assert.equal((await login(password)).status,429);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
