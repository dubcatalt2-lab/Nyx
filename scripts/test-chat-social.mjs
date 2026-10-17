import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import {readChatRelationships, changeChatRelationship, assertChatContact} from '../lib/chat-social.mjs';

const records = new Map(); let tail = Promise.resolve();
const snap = path => ({exists: records.has(path), data: () => structuredClone(records.get(path))});
const ref = path => ({path, get: async () => snap(path)});
const db = {
  collection: name => ({doc: id => ref(name + '/' + id)}),
  runTransaction(fn) {
    const task = tail.then(async () => {
      const writes = [];
      const result = await fn({get: async r => {assert.equal(writes.length, 0, 'Reads precede writes'); return snap(r.path);}, set: (r, value) => writes.push([r.path, structuredClone(value)])});
      for (const [path, value] of writes) records.set(path, value);
      return result;
    }); tail = task.catch(() => {}); return task;
  }
};
const a = 'account-a', b = 'account-b';
const change = (uid, peer, action) => changeChatRelationship(db, uid, peer, action, {me: {displayName: 'Alice'}, other: {displayName: 'Blair'}});
const get = async (uid, peer) => (await readChatRelationships(db, uid)).find(value => value.uid === peer);
await change(a, b, 'request');
assert.equal((await get(a, b)).friend, 'outgoing'); assert.equal((await get(b, a)).friend, 'incoming');
await assert.rejects(change(a, b, 'accept'), {status: 409});
await change(b, a, 'accept'); assert.equal((await get(a, b)).friend, 'accepted'); assert.equal((await get(b, a)).friend, 'accepted');
await change(a, b, 'ignore'); assert.equal((await get(a, b)).ignored, true); assert.equal((await get(b, a)).ignored, false);
await db.runTransaction(tx => assertChatContact(db, tx, b, a)); // Ignore doesn't prohibit contact.
await change(a, b, 'block');
assert.equal((await get(a, b)).friend, ''); assert.equal((await get(b, a)).friend, '');
assert.equal((await get(b, a)).blocked, false); assert.equal((await get(b, a)).canMessage, false);
assert(!JSON.stringify(await readChatRelationships(db, b)).includes('blockedBy'));
for (const [uid, peer] of [[a, b], [b, a]]) {
  await assert.rejects(db.runTransaction(tx => assertChatContact(db, tx, uid, peer)), {status: 403});
  await assert.rejects(change(uid, peer, 'request'), {status: 403});
}
await change(a, b, 'unblock'); await db.runTransaction(tx => assertChatContact(db, tx, b, a));
assert.equal((await get(a, b)).ignored, true); assert.equal(await get(b, a), undefined);
await change(a, b, 'unignore'); assert.equal(await get(a, b), undefined);
await Promise.all([change(a, b, 'request'), change(b, a, 'request')]);
assert.equal((await get(a, b)).friend, 'outgoing'); assert.equal((await get(b, a)).friend, 'incoming');
await change(b, a, 'decline'); assert.equal(await get(a, b), undefined);
await assert.rejects(change(a, a, 'request'), {status: 400});
await assert.rejects(change(a, '../wrong', 'block'), {status: 400});
await assert.rejects(change(a, b, 'owner'), {status: 400});
await Promise.all([change(a, b, 'request'), change(b, a, 'block')]);
assert.equal((await get(a, b)).canMessage, false); assert.equal((await get(b, a)).friend, '');
await assert.rejects(db.runTransaction(async tx => {await assertChatContact(db, tx, a, b); tx.set(ref('messages/new'), {text: 'no'});}), {status: 403});
assert(!records.has('messages/new'));
for (let i = 0; i < 30; i++) await change('rate-user', 'peer-' + String(i).padStart(4, '0'), 'ignore');
await assert.rejects(change('rate-user', 'peer-9999', 'ignore'), {status: 429});

// Exercise real HTTP handlers: authentication, CSRF, persistence and UID spoofing.
const source = readFileSync('server.js', 'utf8');
const app = express(); app.use(express.json());
const context = vm.createContext({app, readChatRelationships, changeChatRelationship,
  sameOriginRequest: req => req.get('sec-fetch-site') !== 'cross-site',
  authenticatedNyxChatUser: async req => {
    if (req.get('authorization') !== 'fixture') throw Object.assign(Error('Sign in'), {status: 401});
    return {token: {uid: 'http-user'}, firebase: {firestore: db, auth: {getUser: async uid => {if (uid === 'not-found') throw Object.assign(Error('Missing'), {code: 'auth/user-not-found'}); return {uid};}}}};
  }, nyxChatIdentity: async (_, token) => ({uid: token.uid, displayName: 'Member', handle: '@member'})
});
vm.runInContext(source.slice(source.indexOf('app.get("/api/chat/relationships",'), source.indexOf('app.post("/api/chat/conversations",')), context);
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + server.address().port + '/api/chat/relationships';
try {
  assert.equal((await fetch(base)).status, 401);
  const post = (uid, body, headers = {}) => fetch(base + '/' + uid, {method: 'POST', headers: {authorization: 'fixture', 'content-type': 'application/json', ...headers}, body: JSON.stringify(body)});
  assert.equal((await post('some-user', {action: 'block'}, {'sec-fetch-site': 'cross-site'})).status, 403);
  assert.equal((await post('not-found', {action: 'request'})).status, 404);
  assert.equal((await post('some-user', {action: 'request', uid: 'spoofed-user'})).status, 200);
  assert.equal((await get('http-user', 'some-user')).friend, 'outgoing');
  assert.equal(await get('spoofed-user', 'some-user'), undefined);
  const response = await fetch(base, {headers: {authorization: 'fixture'}});
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).relationships[0].uid, 'some-user');
} finally {await new Promise(resolve => server.close(resolve));}
console.log('PASS atomic friendship lifecycle, concurrent requests/blocks, private ignores, bidirectional DM denial, account persistence, bounded writes, auth and CSRF');
