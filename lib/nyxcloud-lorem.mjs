import express from 'express';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {nyxCloudOwnerUid} from './nyxcloud-access.mjs';
import {transientDesktopAuth} from './desktop-flow.mjs';
import {cloudStateStore} from './nyxcloud-state.mjs';

const origin = 'https://loremgroup.org';
const failure = (message, status=502, code='provider_unavailable') => Object.assign(new Error(message), {status, code});
export function desktopUrl(value) {
  try {
    const url = new URL(value, origin);
    if(url.origin !== origin || url.username || url.password || url.search || url.hash || !/^\/vm\/[A-Za-z0-9_-]+\/$/.test(url.pathname)) return '';
    return url.href;
  } catch { return ''; }
}
export function createLoremCloud({firebase, fetchImpl=fetch, keyFile=process.env.NYXCLOUD_LOREM_KEY_FILE,
  key=process.env.NYXCLOUD_LOREM_API_KEY, now=Date.now, store=cloudStateStore(),
  capacity=Number(process.env.NYXCLOUD_MAX_DESKTOPS || 5)}={}) {
  if(!Number.isInteger(capacity) || capacity < 1 || capacity > 25) throw Error('NYXCLOUD_MAX_DESKTOPS must be between 1 and 25');
  const router = express.Router();
  const getKey = async () => {
    const value = String(key || (keyFile ? await readFile(keyFile, 'utf8').catch(()=>'') : '')).trim();
    if(!value) throw failure('The desktop service is not configured. Please contact the site owner.', 503, 'not_configured');
    return value;
  };
  async function request(path, options={}) {
    const response = await fetchImpl(origin + path, {...options, headers:{'X-API-Key':await getKey(), Accept:'application/json', ...options.headers}, redirect:'error', signal:AbortSignal.timeout(path.startsWith('/api/create?')?45000:10000)})
      .catch(() => { throw failure('The desktop service could not be reached.', 503); });
    const text = await response.text();
    if(text.length > 1024*1024) throw failure('The desktop service returned an invalid response.');
    let data; try { data = JSON.parse(text); } catch { throw failure('The desktop service returned an invalid response.'); }
    if(response.status === 429) throw failure('All desktops are busy. Your place in the queue is saved.', 429, 'capacity');
    if(!response.ok || data.status === 'error') throw failure(response.status === 401 || response.status === 403
      ? 'The desktop service rejected its configured key. Please contact the site owner.' : 'The desktop service could not complete this request.', 503);
    return data;
  }
  function vm(value) {
    const id = String(value.container_id || value.id || '');
    const code = String(value.connect_code || '');
    return {id, name:'Cloud desktop', state:String(value.state || value.status || 'running').slice(0,40),
      url:desktopUrl(value.url || (/^[A-Za-z0-9_-]+$/.test(code) ? origin+'/vm/'+code+'/' : ''))};
  }
  async function list() {
    const data = await request('/api/dev/list');
    if(!Array.isArray(data.vms)) throw failure('The desktop service returned an invalid VM list.');
    return data.vms.map(vm);
  }
  function allocate(entry, data) {
    if(data.status === 'queued' && typeof data.token === 'string') {
      entry.status = 'provider'; entry.token = data.token; entry.providerPosition = Number(data.position) || null; return;
    }
    const item = vm(data);
    if(!item.id || !item.url) throw failure('The desktop service did not return a supported desktop.');
    entry.status = 'ready'; entry.vm = item; entry.readyAt = now(); entry.expiresAt = now()+60*60*1000;
    delete entry.token; delete entry.providerPosition;
  }
  async function cancelProvider(entry) {
    if(entry.token) await request('/api/queue_cancel?token='+encodeURIComponent(entry.token), {method:'POST'});
  }
  async function sync(state, save) {
    if(now() - state.syncedAt < 5000) return;
    state.syncedAt = now();
    const items = await list();
    delete state.serviceError;
    if(!state.migrated) {
      // Pre-public desktops belong to the original owner, never the next visitor.
      for(const item of items) state.entries.push({uid:nyxCloudOwnerUid, status:'ready', vm:item, legacy:true, lastSeen:now(), readyAt:now()});
      state.migrated = true;
      await save();
    }
    // Bound provider work per pass so one slow queue cannot block every tab.
    let providerWork=false;
    const providerTurn=state.entries.filter(e=>e.status==='provider').sort((a,b)=>(a.checkedAt||0)-(b.checkedAt||0))[0];
    for(const entry of [...state.entries]) {
      if(entry.status === 'ready') {
        const current = items.find(item => item.id === entry.vm.id);
        if(!current && now()-entry.readyAt > 15000) state.entries.splice(state.entries.indexOf(entry),1);
        else if(current) {
          entry.vm = current;
          if(!entry.legacy && (now() >= entry.expiresAt || now()-entry.lastSeen > 300000)) {
            if(providerWork) continue;
            providerWork=true;
            await request('/api/delete/'+encodeURIComponent(entry.vm.id));
            state.entries.splice(state.entries.indexOf(entry),1);
          }
        }
      } else if(entry.status === 'queued' || entry.status === 'provider') {
        if(now()-entry.lastSeen > 120000) {
          if(entry.token && providerWork) continue;
          if(entry.token) providerWork=true;
          await cancelProvider(entry);
          state.entries.splice(state.entries.indexOf(entry),1);
        } else if(entry.status === 'provider') {
          if(providerWork || entry!==providerTurn) continue;
          providerWork=true; entry.checkedAt=now();
          const data = await request('/api/queue_status?token='+encodeURIComponent(entry.token));
          if(['allocated','success','ready'].includes(data.status)) allocate(entry,data);
          else if(['cancelled','expired','failed','not_found'].includes(data.status)) {
            entry.status='queued'; delete entry.token;
          } else entry.providerPosition=Number(data.position)||null;
        }
      }
      // A persisted 'allocating' intent has an uncertain outcome after a crash
      // or timeout. Never issue a duplicate or claim an unassigned desktop.
    }
    if(providerWork) return;
    const reservations = state.entries.filter(e=>['provider','allocating'].includes(e.status)).length;
    const missingReady = state.entries.filter(e=>e.status==='ready'&&!items.some(v=>v.id===e.vm.id)).length;
    if(items.length + reservations + missingReady >= capacity) return;
    const next = state.entries.find(e=>e.status==='queued');
    if(!next) return;
    next.status='allocating'; next.requestId=randomUUID();
    await save();
    try {
      allocate(next, await request('/api/create?'+new URLSearchParams({site_limit:String(capacity),delete_after:'300',owner_id:next.requestId})));
    } catch(error) {
      if(error.code==='capacity') next.status='queued';
      else throw error;
    }
    await save();
  }
  function result(state, uid) {
    const entry = state.entries.find(e=>e.uid===uid);
    if(!entry) return {status:'idle', capacity};
    if(entry.status==='ready') return {status:'ready', vm:entry.vm, expiresAt:entry.expiresAt || null};
    if(entry.status==='allocating') return {status:'recovering', message:'The provider has not confirmed your desktop request. Your reservation is held to prevent duplicate desktops. Please contact the site owner if this continues.'};
    const waiting=state.entries.filter(e=>['queued','provider'].includes(e.status));
    return {status:'queued', position:waiting.indexOf(entry)+1, providerPosition:entry.providerPosition||null,
      capacity, reason:state.serviceError ? 'service_unavailable' : entry.status==='provider' ? 'provider_capacity' : 'capacity', retryAfter:5};
  }
  router.use(async(req,res,next)=>{
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    try {
      const token=String(req.get('authorization')||'').match(/^Bearer (.{1,8192})$/)?.[1];
      if(!token) throw failure('Sign in to Nyx to open a desktop.',401,'sign_in_required');
      const identity=await(await firebase()).auth.verifyIdToken(token,true);
      if(!identity.uid || identity.firebase?.sign_in_provider==='anonymous') throw failure('Sign in to a Nyx account to open a desktop.',401,'sign_in_required');
      if(req.method!=='GET') {
        let valid=false;
        try { const source=new URL(req.get('origin')); valid=['http:','https:'].includes(source.protocol)&&source.host===req.get('host'); } catch {}
        if(!valid) throw failure('Open VMs from this Nyx site and try again.',403,'origin_mismatch');
      }
      req.cloudUid=identity.uid; next();
    } catch(error) {
      const status=error.status || (transientDesktopAuth(error)?503:401);
      res.status(status).json({error:error.status?error.message:status===503?'Account verification is temporarily unavailable.':'Sign in to Nyx again to reconnect.',code:error.status?error.code:status===503?'auth_unavailable':'sign_in_required'});
    }
  });
  const handle=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(error){res.status(error.status||503).json({error:error.status?error.message:'The desktop queue is temporarily unavailable. Please retry.',code:error.status?error.code:'queue_unavailable'});}};
  router.get('/status',handle(async()=>({configured:Boolean(await getKey()),capacity})));
  async function access(uid, join=false) {
    await getKey();
    return store(async(state,save)=>{
      let entry=state.entries.find(e=>e.uid===uid);
      if(entry) entry.lastSeen=now();
      try { await sync(state,save); }
      catch(error) { state.serviceError=true; if(!entry && !join) throw error; }
      entry=state.entries.find(e=>e.uid===uid);
      if(!entry && join) {
        if(state.entries.length>=200) throw failure('The queue is full. Please try again shortly.',429,'queue_full');
        state.entries.push({uid,status:'queued',lastSeen:now(),joinedAt:now()});
      }
      return result(state,uid);
    });
  }
  router.get('/vms',handle(async req=>{const data=await access(req.cloudUid);return {...data,vms:data.vm?[data.vm]:[],queued:['queued','recovering'].includes(data.status)};}));
  router.post('/create',handle(req=>access(req.cloudUid,true)));
  router.get('/queue',handle(req=>access(req.cloudUid)));
  router.post('/cancel',handle(req=>store(async state=>{
    const entry=state.entries.find(e=>e.uid===req.cloudUid);
    if(entry?.status==='ready') return result(state,req.cloudUid);
    if(entry?.status==='allocating') throw failure('This request is awaiting provider confirmation. Its reservation cannot safely be released yet.',409,'allocation_uncertain');
    if(entry && entry.status!=='ready') {await cancelProvider(entry);state.entries.splice(state.entries.indexOf(entry),1);}
    return {status:'cancelled'};
  })));
  router.post('/end',handle(req=>store(async state=>{
    const entry=state.entries.find(e=>e.uid===req.cloudUid);
    if(entry?.status==='ready') {await request('/api/delete/'+encodeURIComponent(entry.vm.id));state.entries.splice(state.entries.indexOf(entry),1);}
    return {status:'ended'};
  })));
  router.post('/start/:id',handle(req=>store(async state=>{
    const entry=state.entries.find(e=>e.uid===req.cloudUid && e.status==='ready' && e.vm.id===req.params.id);
    if(!entry) throw failure('Desktop not found for this account.',404,'not_found');
    await request('/api/start/'+encodeURIComponent(entry.vm.id)); entry.lastSeen=now(); return {status:'started'};
  })));
  return router;
}
