import {randomBytes, createHash} from 'node:crypto';

const day = 86400000;
const fail = (message, status = 400, code = 'AD_FREE_INVALID') => Object.assign(new Error(message), {status, code});
const keyId = key => createHash('sha256').update(key).digest('hex');
const normalizeKey = value => String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
const validId = id => /^[a-f0-9]{64}$/.test(String(id));
export function adFreeStatus(administration = {}, now = Date.now()) {
  const grant = administration.adFree;
  const active = !!grant && validId(grant.keyId) && Number.isFinite(grant.expiresAtMs) &&
    (grant.expiresAtMs === 0 || grant.expiresAtMs > now);
  return {active, expiresAtMs: active ? grant.expiresAtMs : null};
}

export function createAdFreeKeys(db, clock = Date.now) {
  const keys = db.collection('nyxAdFreeKeys');
  const accounts = db.collection('nyxUserAdministration');
  const attempts = db.collection('nyxAdFreeAttempts');
  const summary = (id, row) => ({id, suffix:row.suffix, label:row.label, durationDays:row.durationDays,
    status:row.status === 'active' && row.expiresAtMs > 0 && row.expiresAtMs <= clock() ? 'expired' : row.status,
    createdAtMs:row.createdAtMs, assignedUid:row.assignedUid || '', assignedAtMs:row.assignedAtMs || null,
    expiresAtMs:row.expiresAtMs ?? null});
  function grant(row, id, uid, now) {
    const expiresAtMs = row.durationDays === 0 ? 0 : now + row.durationDays * day;
    return {row:{...row, status:'active', assignedUid:uid, assignedAtMs:now, expiresAtMs},
      account:{adFree:{keyId:id, grantedAtMs:now, expiresAtMs}}};
  }
  return {
    async create({ownerUid, durationDays = 30, label = '', uid = ''}) {
      if (!Number.isInteger(durationDays) || durationDays < 0 || durationDays > 3650) throw fail('Choose a duration between 1 and 3,650 days, or no expiry.');
      const raw = randomBytes(16).toString('hex').toUpperCase();
      const code = 'NYX-ADFREE-' + raw.match(/.{8}/g).join('-');
      const id = keyId(normalizeKey(code));
      const now = clock();
      let row = {status:'unused', label:String(label).trim().slice(0,80), suffix:raw.slice(-8), durationDays, createdBy:ownerUid, createdAtMs:now, assignedUid:'', expiresAtMs:null};
      await db.runTransaction(async tx => {
        if (uid) {
          const account = await tx.get(accounts.doc(uid));
          if (adFreeStatus(account.data(), now).active) throw fail('That account already has an active ad-free key.',409);
          const applied = grant(row,id,uid,now);
          row = applied.row;
          tx.set(accounts.doc(uid),applied.account,{merge:true});
        }
        tx.create(keys.doc(id), row);
      });
      return {...summary(id,row), key:code};
    },
    async list(cursor = '') {
      let query = keys.orderBy('createdAtMs','desc').limit(51);
      if (cursor) {
        if (!validId(cursor)) throw fail('Invalid page.');
        const previous = await keys.doc(cursor).get();
        if (!previous.exists) throw fail('That page is no longer available.');
        query = query.startAfter(previous);
      }
      const snapshot = await query.get();
      const rows = snapshot.docs.slice(0,50);
      return {keys:rows.map(doc=>summary(doc.id,doc.data())),nextCursor:snapshot.docs.length>50?rows.at(-1).id:''};
    },
    async assign(id, uid) {
      if (!validId(id)) throw fail('Invalid key.');
      return db.runTransaction(async tx => {
        const [key, account] = await Promise.all([tx.get(keys.doc(id)),tx.get(accounts.doc(uid))]);
        const row = key.data();
        if (!key.exists || row.status !== 'unused') throw fail('Only unused keys can be assigned.',409);
        if (adFreeStatus(account.data(),clock()).active) throw fail('That account already has an active ad-free key.',409);
        const applied = grant(row,id,uid,clock());
        tx.set(keys.doc(id),applied.row);
        tx.set(accounts.doc(uid),applied.account,{merge:true});
        return summary(id,applied.row);
      });
    },
    async redeem(value, uid) {
      const now = clock();
      const allowed = await db.runTransaction(async tx => {
        const ref = attempts.doc(uid);
        const snapshot = await tx.get(ref);
        const previous = snapshot.data() || {};
        const start = Number(previous.startedAtMs) || 0;
        const inWindow = now - start < 60000 && now >= start;
        const count = inWindow ? Number(previous.count) || 0 : 0;
        if (count >= 5) return false;
        tx.set(ref,{startedAtMs:inWindow?start:now,count:count+1});
        return true;
      });
      if (!allowed) throw fail('Too many attempts. Try again in a minute.',429,'AD_FREE_COOLDOWN');
      const normalized = normalizeKey(value);
      if (!/^NYXADFREE[A-F0-9]{32}$/.test(normalized)) throw fail('That key is invalid or no longer available.');
      const id = keyId(normalized);
      return db.runTransaction(async tx => {
        const [key, account] = await Promise.all([tx.get(keys.doc(id)),tx.get(accounts.doc(uid))]);
        const row = key.data();
        if (row?.status === 'active' && row.assignedUid === uid && account.data()?.adFree?.keyId === id && adFreeStatus(account.data(),now).active) return adFreeStatus(account.data(),now);
        if (!key.exists || row.status !== 'unused') throw fail('That key is invalid or no longer available.');
        if (adFreeStatus(account.data(),now).active) throw fail('You already have an active ad-free key.',409);
        const applied = grant(row,id,uid,now);
        tx.set(keys.doc(id),applied.row);
        tx.set(accounts.doc(uid),applied.account,{merge:true});
        return adFreeStatus(applied.account,now);
      });
    },
    async revoke(id) {
      if (!validId(id)) throw fail('Invalid key.');
      return db.runTransaction(async tx => {
        const key = await tx.get(keys.doc(id));
        if (!key.exists) throw fail('Key not found.',404);
        const row = key.data();
        const account = row.assignedUid ? await tx.get(accounts.doc(row.assignedUid)) : null;
        if (row.status === 'revoked') return summary(id,row);
        const updated = {...row,status:'revoked',revokedAtMs:clock()};
        tx.set(keys.doc(id),updated);
        if (account?.data()?.adFree?.keyId === id) tx.set(accounts.doc(row.assignedUid),{adFree:null},{merge:true});
        return summary(id,updated);
      });
    }
  };
}

export function installAdFreeRoutes(app, {owner, user, sameOrigin, audit}) {
  function route(method,path,access,handler) {
    app[method](path,async(req,res)=>{
      res.set('Cache-Control','no-store');
      try {
        if (method !== 'get' && !sameOrigin(req)) throw fail('Cross-origin requests are not allowed.',403);
        const context = await access(req);
        await handler(req,res,context,createAdFreeKeys(context.firebase.firestore));
      } catch(error) {
        if (error.status === 429) res.set('Retry-After','60');
        res.status(error.status || 503).json({error:error.status?error.message:'Ad-free keys are temporarily unavailable.',code:error.code || 'AD_FREE_UNAVAILABLE'});
      }
    });
  }
  async function target(firebase,value) {
    const uid = String(value || '').trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw fail('Enter a valid account ID.');
    const account = await firebase.auth.getUser(uid).catch(()=>null);
    if (!account || account.disabled) throw fail('That account is unavailable.',404);
    return uid;
  }
  const record = (context,action,row) => audit(context.firebase,{actorUid:context.token.uid,action,targetUid:row.assignedUid || '',details:{keyId:row.id}});
  route('get','/api/owner-dashboard/ad-free-keys',owner,async(req,res,context,store)=>res.json(await store.list(String(req.query.cursor || ''))));
  route('post','/api/owner-dashboard/ad-free-keys',owner,async(req,res,context,store)=>{
    const uid = req.body?.uid ? await target(context.firebase,req.body.uid) : '';
    const row = await store.create({ownerUid:context.token.uid,uid,durationDays:req.body?.durationDays ?? 30,label:req.body?.label || ''});
    await record(context,'ad_free_key_created',row);
    res.status(201).json(row);
  });
  route('post','/api/owner-dashboard/ad-free-keys/:id/assign',owner,async(req,res,context,store)=>{
    const row = await store.assign(req.params.id,await target(context.firebase,req.body?.uid));
    await record(context,'ad_free_key_assigned',row);
    res.json(row);
  });
  route('post','/api/owner-dashboard/ad-free-keys/:id/revoke',owner,async(req,res,context,store)=>{
    const row = await store.revoke(req.params.id);
    await record(context,'ad_free_key_revoked',row);
    res.json(row);
  });
  route('post','/api/account/ad-free/redeem',user,async(req,res,context,store)=>{
    const status = await store.redeem(req.body?.key,context.token.uid);
    res.json({uid:context.token.uid,adFree:status,publisherMode:'off'});
  });
}
