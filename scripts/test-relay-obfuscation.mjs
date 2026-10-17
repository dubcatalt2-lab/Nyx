import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {minify} from 'terser';
import {scrambleProxyCode} from './build-proxy-assets.mjs';
import {zakaIdentifiers} from './zaka-identifiers.mjs';

const source=await readFile('apps/tutsi/http-relay.mjs','utf8');
const first=await minify(source,{module:true,compress:{passes:4},mangle:{toplevel:true,nth_identifier:zakaIdentifiers(source)}});
const second=await scrambleProxyCode(first.code,{module:true});
const relay=await import('data:text/javascript,'+encodeURIComponent(second.code));
const original=globalThis.WebSocket,listen=globalThis.addEventListener;
globalThis.addEventListener=()=>{};
try{
  relay.installHttpRelaySocket();
  assert.notEqual(globalThis.WebSocket,original,'The twice-obfuscated initializer must install the HTTP relay');
  const installed=globalThis.WebSocket;
  relay.installHttpRelaySocket();
  assert.equal(globalThis.WebSocket,installed,'Repeated installation is idempotent');
}finally{globalThis.WebSocket=original;globalThis.addEventListener=listen;}
console.log('PASS two-stage obfuscation preserves HTTP relay initialization and idempotence');
