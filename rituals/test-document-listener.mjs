import assert from 'node:assert/strict';
import {once} from 'node:events';
import {application} from '../connection/assembly.mjs';
const first=application();first.listen(0,'127.0.0.1');await once(first,'listening');
const second=application();
try{
 const failed=once(second,'error');second.listen(first.address().port,'127.0.0.1');
 assert.equal((await failed)[0].code,'EADDRINUSE');
 assert.equal((await fetch('http://127.0.0.1:'+first.address().port+'/healthz')).status,200);
 second.listen(0,'127.0.0.1');await once(second,'listening');
 assert.notEqual(second.address().port,first.address().port);
 assert.equal((await fetch('http://127.0.0.1:'+second.address().port+'/healthz')).status,200);
 console.log('PASS document listener: occupied port fails explicitly, existing listener stays healthy, retry on a free port succeeds');
}finally{
 for(const server of [first,second]){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
