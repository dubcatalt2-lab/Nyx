import {Router} from 'express';
const q62='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function q21e8(id){if(!/^[a-zA-Z0-9]{1,8}$/.test(id))throw Error('Invalid Audius identifier');let n=1n;for(const c of id)n=n*62n+BigInt(q62.indexOf(c));return String(n);}
export function q39f1(value){if(!/^\d{1,16}$/.test(value))throw Error('Invalid track identifier');let n=BigInt(value),id='';while(n>1n){id=q62[Number(n%62n)]+id;n/=62n;}if(n!==1n||!id||id.length>8)throw Error('Invalid track identifier');return id;}
export function q67a9(sameOrigin){
 const router=Router(),cache=new Map();
 async function api(path,params={}){const key=path+JSON.stringify(params),old=cache.get(key);if(old&&old.until>Date.now())return old.data;const url=new URL('https://api.audius.co/v1'+path);for(const [k,v]of Object.entries({app_name:'N7XLocalTest',...params}))url.searchParams.set(k,String(v));const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});if(!r.ok)throw Object.assign(Error('Audius is temporarily unavailable'),{status:r.status===404?404:502});const data=(await r.json()).data;cache.set(key,{data,until:Date.now()+60000});while(cache.size>200)cache.delete(cache.keys().next().value);return data;}
 const cover=t=>{const s=t?.artwork?.['480x480']||t?.profile_picture?.['480x480']||'';try{return new URL(s).protocol==='https:'?s:''}catch{return ''}};
 const track=t=>({id:q21e8(t.id),title:String(t.title||''),artist:String(t.user?.name||'Unknown artist'),artistId:t.user?.id?q21e8(t.user.id):'',album:'Audius',albumId:'',duration:Number(t.duration)||0,cover:cover(t),catalog:'audius',audioAvailable:t.is_streamable!==false});
 const tracks=data=>(Array.isArray(data)?data:[]).filter(t=>t.is_streamable!==false&&!t.is_delete).map(track);
 const wrap=fn=>async(req,res)=>{if(!sameOrigin(req))return res.status(403).json({error:'Cross-origin requests are not allowed.'});try{await fn(req,res)}catch(e){res.status(e.status||502).json({error:e.message||'Audius request failed'})}};
 router.get('/api/nyxify/status',wrap(async(req,res)=>res.json({configured:true,provider:'audius',providerLabel:'Audius test'})));
 router.get('/api/nyxify/home',wrap(async(req,res)=>res.json({tracks:tracks(await api('/tracks/trending',{limit:30})),artists:[],albums:[],provider:'audius'})));
 router.get('/api/nyxify/search',wrap(async(req,res)=>{const query=String(req.query.q||'').trim().slice(0,100);if(query.length<2)return res.status(400).json({error:'Enter at least two characters.'});res.json({data:tracks(await api('/tracks/search',{query,limit:50}))});}));
 router.get('/api/nyxify/artist/:id',wrap(async(req,res)=>{const id=q39f1(req.params.id);const [u,t]=await Promise.all([api('/users/'+id),api('/users/'+id+'/tracks',{limit:50})]);res.json({name:u.name,cover:cover(u),tracks:tracks(t),albums:[]});}));
 router.get('/api/nyxify/playback/:id',wrap(async(req,res)=>{const id=q39f1(req.params.id),t=await api('/tracks/'+id);if(!t||t.is_streamable===false)return res.status(403).json({error:'This Audius track requires access that this test does not provide.'});res.json({mode:'meting',provider:'audius',title:t.title,durationSeconds:t.duration,streamUrl:'/api/nyxify/audio/'+req.params.id});}));
 router.get('/api/nyxify/audio/:id',wrap(async(req,res)=>{const id=q39f1(req.params.id),t=await api('/tracks/'+id);if(!t||t.is_streamable===false)return res.sendStatus(403);res.redirect(307,'https://api.audius.co/v1/tracks/'+id+'/stream?app_name=N7XLocalTest');}));
 router.get('/api/nyxify/full-track/:id',wrap(async(req,res)=>res.status(404).json({error:'The Audius test uses Audius audio only.'})));
 return router;
}
