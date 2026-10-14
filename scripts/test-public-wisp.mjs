import assert from 'node:assert/strict';
import WebSocket from 'ws';
const endpoint=process.argv[2]||'ws://localhost:8080/wisp/';
const result=await new Promise((resolve,reject)=>{
 const socket=new WebSocket(endpoint,{origin:'https://independent-client.example'});
 const timer=setTimeout(()=>{socket.terminate();reject(Error('Wisp handshake timed out'));},8000);
 socket.once('error',error=>{clearTimeout(timer);reject(error);});
 socket.once('message',data=>{clearTimeout(timer);socket.close();resolve(data);});
});
assert.equal(result[0],3,'Wisp CONTINUE greeting');assert.equal(result.readUInt32LE(1),0,'connection control stream');assert(result.length>=9);assert(result.readUInt32LE(5)>0);
console.log('PASS public cross-origin Wisp handshake:',endpoint);
