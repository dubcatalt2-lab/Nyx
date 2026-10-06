// Private, account-scoped relationships. Both sides change in one transaction.
const actions = new Set(['request', 'accept', 'decline', 'cancel', 'remove', 'block', 'unblock', 'ignore', 'unignore']);
const fail = (message, status = 409) => Object.assign(new Error(message), {status});
const refFor = (db, uid) => db.collection('nyxChatRelationships').doc(uid);
const entries = snapshot => new Map(Object.entries(snapshot.data()?.peers || {}));
const active = entry => entry.friend || entry.blocked || entry.blockedBy || entry.ignored;
const caches = new WeakMap();
function cacheFor(db) {
  if (!caches.has(db)) caches.set(db, new Map());
  return caches.get(db);
}

export function publicRelationships(snapshot) {
  return [...entries(snapshot)].filter(([, value]) => value.friend || value.blocked || value.blockedBy || value.ignored).map(([uid, value]) => ({
    uid, friend: value.friend || '', blocked: value.blocked === true,
    ignored: value.ignored === true, canMessage: !value.blocked && !value.blockedBy,
    member: {uid, displayName: value.name || 'Nyx member', handle: value.handle || '', avatarUrl: value.avatarUrl || ''}
  }));
}

export async function readChatRelationships(db, uid) {
  const cache = cacheFor(db), previous = cache.get(uid);
  if (previous && previous.expires > Date.now()) return previous.promise;
  const entry = {expires: Date.now() + 10000};
  entry.promise = refFor(db, uid).get().then(publicRelationships).catch(error => {
    if (cache.get(uid) === entry) cache.delete(uid);
    throw error;
  });
  cache.set(uid, entry);
  while (cache.size > 1000) cache.delete(cache.keys().next().value);
  return entry.promise;
}

// Call inside the same transaction as a DM write, so a simultaneous block wins
// on retry. Public channel access and existing DM history are unaffected.
export async function assertChatContact(db, transaction, uid, otherUid) {
  if (!otherUid) return;
  const [mine, theirs] = await Promise.all([transaction.get(refFor(db, uid)), transaction.get(refFor(db, otherUid))]);
  if (entries(mine).get(otherUid)?.blocked || entries(theirs).get(uid)?.blocked) {
    throw fail('Direct messages are unavailable between these accounts.', 403);
  }
}

export async function changeChatRelationship(db, uid, targetUid, action, profiles = {}) {
  if (!actions.has(action) || !/^[A-Za-z0-9_-]{8,128}$/.test(targetUid) || targetUid === uid) throw fail('Choose another member and a valid action.', 400);
  const mineRef = refFor(db, uid), theirsRef = refFor(db, targetUid);
  const result = await db.runTransaction(async transaction => {
    const [mine, theirs] = await Promise.all([transaction.get(mineRef), transaction.get(theirsRef)]);
    const minePeers = entries(mine), theirPeers = entries(theirs);
    const a = {...minePeers.get(targetUid)}, b = {...theirPeers.get(uid)};
    const stamp = (entry, profile) => {
      if (!profile) return;
      entry.name = String(profile.displayName || 'Nyx member').slice(0, 48);
      entry.handle = String(profile.handle || '').slice(0, 64);
      const source = String(profile.avatarUrl || '');
      entry.avatarUrl = source.length <= 2048 ? source : '';
    };
    stamp(a, profiles.other); stamp(b, profiles.me);
    const now = Date.now();
    const attempts = (mine.data()?.attempts || []).filter(time => time > now - 60000);
    if (attempts.length >= 30) throw fail('Please wait a minute before changing more relationships.', 429);
    if (['request', 'accept'].includes(action) && (a.blocked || b.blocked)) throw fail('Friend requests are unavailable between these accounts.', 403);
    switch (action) {
      case 'request':
        if (!a.friend) {a.friend = 'outgoing'; b.friend = 'incoming';}
        break;
      case 'accept':
        if (a.friend === 'accepted') break;
        if (a.friend !== 'incoming' || b.friend !== 'outgoing') throw fail('This friend request is no longer available.');
        a.friend = b.friend = 'accepted'; break;
      case 'decline': case 'cancel': case 'remove': {
        const expected = {decline: 'incoming', cancel: 'outgoing', remove: 'accepted'}[action];
        if (a.friend && a.friend !== expected) throw fail('This relationship changed. Refresh and try again.');
        delete a.friend; delete b.friend; break;
      }
      case 'block': a.blocked = true; b.blockedBy = true; delete a.friend; delete b.friend; break;
      case 'unblock': delete a.blocked; delete b.blockedBy; break;
      case 'ignore': a.ignored = true; break;
      case 'unignore': delete a.ignored; break;
    }
    const update = (map, key, value) => active(value) ? map.set(key, value) : map.delete(key);
    update(minePeers, targetUid, a); update(theirPeers, uid, b);
    if (minePeers.size > 500 || theirPeers.size > 500) throw fail('The relationship limit has been reached. Remove an old relationship first.');
    const next = {...mine.data(), peers: Object.fromEntries(minePeers), attempts: [...attempts, now]};
    transaction.set(mineRef, next);
    if (!['ignore', 'unignore'].includes(action)) transaction.set(theirsRef, {...theirs.data(), peers: Object.fromEntries(theirPeers)});
    return publicRelationships({data: () => next});
  });
  const cache = cacheFor(db); cache.delete(uid); cache.delete(targetUid);
  return result;
}
