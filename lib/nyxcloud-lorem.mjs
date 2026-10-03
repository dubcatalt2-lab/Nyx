import express from 'express';
import {readFile} from 'node:fs/promises';
import {hasNyxCloudAccess} from './nyxcloud-access.mjs';

const origin='https://loremgroup.org';
const failure=(message,status=502)=>Object.assign(new Error(message),{status});
export function desktopUrl(value){
  try{
    const url=new URL(value,origin);
    if(url.origin!==origin||url.username||url.password||url.search||url.hash||!/^\/vm\/[A-Za-z0-9_-]+\/$/.test(url.pathname))return '';
    return url.href;
  }catch{return '';}
}
export function createLoremCloud({firebase,fetchImpl=fetch,keyFile=process.env.NYXCLOUD_LOREM_KEY_FILE,key=process.env.NYXCLOUD_LOREM_API_KEY,now=Date.now}){
  const router=express.Router();let pending=null,creating=null,lastCreate=0;
  const getKey=async()=>{
    const value=String(key||(keyFile?await readFile(keyFile,'utf8').catch(()=>''): '')).trim();
    if(!value)throw failure('The VM service API key is not configured.',503);
    return value;
  };
  async function request(path,options={}){
    const response=await fetchImpl(origin+path,{...options,headers:{'X-API-Key':await getKey(),'Accept':'application/json',...options.headers},redirect:'error',signal:AbortSignal.timeout(45000)}).catch(()=>{throw failure('The VM service could not be reached.');});
    const text=await response.text();if(text.length>1024*1024)throw failure('The VM service returned an oversized response.');
    let data;try{data=JSON.parse(text);}catch{throw failure('The VM service returned an invalid response.');}
    if(!response.ok||data.status==='error')throw failure(response.status===401||response.status===403?'The VM service rejected the configured API key.':response.status===429?'The VM service is busy or your plan limit was reached.':'The VM service could not complete this request.');
    return data;
  }
  function vm(value){
    const id=String(value.container_id||value.id||'');
    const code=String(value.connect_code||'');
    return {id,name:String(value.name||'Cloud desktop').slice(0,100),state:String(value.state||value.status||'unknown').slice(0,40),url:desktopUrl(value.url||(/^[A-Za-z0-9_-]+$/.test(code)?origin+'/vm/'+code+'/':''))};
  }
  const list=async()=>{const data=await request('/api/dev/list');if(!Array.isArray(data.vms))throw failure('The VM service returned an invalid VM list.');return data.vms.map(vm);};
  function allocation(data){
    if(data.status==='queued'&&typeof data.token==='string'){
      pending={token:data.token,at:now()};return {status:'queued',position:Number(data.position)||null};
    }
    const item=vm(data);if(!item.url)throw failure('The VM service did not return a supported desktop URL.');
    pending=null;return {status:'ready',vm:item};
  }
  router.use(async(req,res,next)=>{
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    try{
      const token=String(req.get('authorization')||'').match(/^Bearer (.{1,8192})$/)?.[1];if(!token)throw Error();
      const identity=await(await firebase()).auth.verifyIdToken(token,true);if(!hasNyxCloudAccess(identity))throw Error();
      if(req.method!=='GET'&&req.get('origin')!==`${req.protocol}://${req.get('host')}`)throw Error();
      next();
    }catch{res.status(404).json({error:'Not available.'});}
  });
  const handle=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||502).json({error:e.status?e.message:'The VM service request failed.'});}};
  router.get('/status',handle(async()=>({configured:Boolean(await getKey())})));
  router.get('/vms',handle(async()=>({vms:await list(),queued:Boolean(pending)})));
  router.post('/create',handle(async()=>{
    if(pending)return {status:'queued'};
    if(creating)return creating;
    if(now()-lastCreate<60000)throw failure('Wait a minute before requesting another VM.',429);
    lastCreate=now();
    creating=(async()=>{const existing=await list();if(existing.length)throw failure('A VM already exists. Open it from the list.',409);return allocation(await request('/api/create?site_limit=1&delete_after=300'));})();
    try{return await creating;}finally{creating=null;}
  }));
  router.get('/queue',handle(async()=>{
    if(!pending)return {status:'idle'};
    const data=await request('/api/queue_status?token='+encodeURIComponent(pending.token));
    if(data.status==='allocated'||data.status==='success')return allocation(data);
    if(['cancelled','expired','failed','not_found'].includes(data.status)){pending=null;return {status:'ended'};}
    return {status:'queued',position:Number(data.position)||null};
  }));
  router.post('/cancel',handle(async()=>{
    if(pending)await request('/api/queue_cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:pending.token})});
    pending=null;return {status:'cancelled'};
  }));
  router.post('/start/:id',handle(async req=>{
    const items=await list();if(!items.some(v=>v.id===req.params.id))throw failure('VM not found.',404);
    await request('/api/start/'+encodeURIComponent(req.params.id));return {status:'started'};
  }));
  return router;
}
