import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createMediaConnector } from '../lib/nyxify-media-fetch.mjs';
const sockets = [], seen = [];
const keepAlive = setInterval(() => {}, 1000);
try {
const connector = createMediaConnector({
  lookupImpl: async () => [{ address: '192.0.2.1', family: 4 }, { address: '192.0.2.2', family: 4 }],
  connectImpl: options => {
    assert.equal(options.servername, 'media.example');
    assert.equal(options.rejectUnauthorized, true);
    const s = new EventEmitter(); s.destroy = () => { s.destroyed = true; };
    s.setTimeout = () => {}; sockets.push(s); seen.push(options.host);
    // First address connects TCP but never completes TLS; second succeeds.
    if (options.host.endsWith('.2')) setTimeout(() => s.emit('secureConnect'), 5);
    return s;
  }, staggerMs: 10, attemptMs: 100, deadlineMs: 200
});
const connect = fn => new Promise((resolve, reject) => fn({ hostname: 'media.example', port: 443 }, (e, s) => e ? reject(e) : resolve(s)));
const winner = await connect(connector);
assert.equal(winner, sockets[1]); assert.equal(sockets[0].destroyed, true);
await connect(connector); assert.equal(seen[2], '192.0.2.2', 'working address preferred while still present in DNS');
let lateSocket = false;
const late = createMediaConnector({ lookupImpl: () => new Promise(r => setTimeout(() => r([{ address: '192.0.2.1' }]), 40)), connectImpl: () => { lateSocket = true; }, deadlineMs: 15 });
await assert.rejects(connect(late), { code: 'ETIMEDOUT' });
await new Promise(r => setTimeout(r, 50)); assert.equal(lateSocket, false);
const throws = createMediaConnector({ lookupImpl: async () => [{ address: '192.0.2.1', family: 4 }], connectImpl: () => { throw new Error('socket allocation failed'); } });
await assert.rejects(connect(throws), /socket allocation failed/);
const dnsFailure = createMediaConnector({ lookupImpl: async () => { throw new Error('DNS unavailable'); } });
await assert.rejects(connect(dnsFailure), /DNS unavailable/);
console.log('PASS: TLS-stalled address failover, losing socket cleanup, working-address preference, certificate options and DNS deadline.');
} finally { clearInterval(keepAlive); }
