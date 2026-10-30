import {randomBytes} from 'node:crypto';
import {createHostingSessions} from './k72c9.mjs';
export function directS3Origin(value){
 const url=new URL(value);
 if(url.port||url.protocol!=='https:'||url.origin!==value||!/^([a-z0-9][a-z0-9-]{1,61}[a-z0-9])\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname))throw Error('Use an exact, bucket-specific HTTPS S3 origin.');
 return url.origin;
}
export function createStaticHostAccess(values=[],options={}){
 const fallbackKey=randomBytes(32);
 const sessions=createHostingSessions({secret:options.secret||(async()=>fallbackKey)});
 const origins=new Set(values.filter(Boolean).map(directS3Origin));
 const allowed=origin=>origins.has(String(origin||''));
 const paths=/^\/(?:api(?:\/|$)|socket\.io(?:\/|$)|healthz$|resources\/live(?:\/|$)|wisp(?:\/|$)|download\/|(?:reading|math|gn-math|gms-games|gms-studies|reds-misc)-|cloud\/v1\/|assets\/(?:profile|backgrounds|jumpscares)\/)/;
 const probe='nyx_static_probe';
 async function middleware(req,res,next){
  const origin=req.headers.origin;
  if(!allowed(origin)||!paths.test(req.path))return next();
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');res.vary('Origin');
  res.setHeader('Access-Control-Expose-Headers','Content-Type, Content-Length, Content-Range, Accept-Ranges, Retry-After');
  if(req.method==='OPTIONS'){
   const headers=String(req.headers['access-control-request-headers']||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
   if(headers.some(h=>!['authorization','content-type','range','last-event-id','x-tutsi-sequence'].includes(h)&&!/^x-nyx-[a-z0-9-]+$/.test(h)))return res.status(403).end();
   res.setHeader('Access-Control-Allow-Headers',headers.join(', '));res.setHeader('Access-Control-Allow-Methods','GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');res.setHeader('Access-Control-Max-Age','600');return res.status(204).end();
  }
  const set=res.setHeader;
  res.setHeader=function(name,value){
   if(String(name).toLowerCase()==='access-control-allow-origin')value=origin;
   if(String(name).toLowerCase()==='set-cookie')value=(Array.isArray(value)?value:[value]).map(cookie=>/^(?:nyx_q74bd9|nyx_ai_device)=/.test(cookie)?cookie.replace(/;\s*SameSite=[^;]+/ig,'').replace(/;\s*Secure(?=;|$)/ig,'').replace(/;\s*Partitioned(?=;|$)/ig,'')+'; SameSite=None; Secure; Partitioned':cookie);
   return set.call(this,name,value);
  };
  if(req.path==='/api/static-host/check'){
   res.setHeader('Cache-Control','no-store');
   const present=String(req.headers.cookie||'').split(';').some(c=>c.trim().startsWith(probe+'='));
   if(!present)res.append('Set-Cookie',`${probe}=${randomBytes(16).toString('hex')}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=31536000`);
   const client=req.headers['x-nyx-host-client'];
   if(!client)return res.json({supported:true,cookies:present});
   try{return res.json({supported:true,cookies:present,session:await sessions.issue({origin,client,cookie:req.headers.cookie,previous:req.headers['x-nyx-host-session']})});}
   catch(error){return res.status(error.status||503).json({error:error.status?error.message:'The connection could not be established.'});}
  }
  const token=req.headers['x-nyx-host-session'];
  if(token){
   try{const session=await sessions.read(token,origin);if(!session)return res.status(428).json({code:'HOST_SESSION_REQUIRED',error:'The connection session needs to be renewed.'});req.nyxHostSession=session;req.q74bd9=sessions.identity(session);}
   catch{return res.status(503).json({error:'The connection could not be verified.'});}
  }else if(!String(req.headers.cookie||'').split(';').some(c=>c.trim().startsWith(probe+'=')))return res.status(428).json({code:'HOST_SESSION_REQUIRED',error:'Open Nyx from its S3 entry page to establish this br00ser session.'});
  next();
 }
 async function upgrade(req){
  if(!allowed(req.headers.origin))return true;
  let path;try{path=new URL(req.url,'http://localhost').pathname;}catch{return false;}
  if(!/^\/(?:resources\/live|wisp)(?:\/|$)/.test(path))return true;
  const protocols=String(req.headers['sec-websocket-protocol']||'').split(',').map(s=>s.trim()).filter(Boolean),tokens=protocols.filter(s=>s.startsWith('nyx-host.'));
  if(!tokens.length)return String(req.headers.cookie||'').split(';').some(s=>s.trim().startsWith(probe+'='));
  if(tokens.length!==1)return false;
  const session=await sessions.read(tokens[0].slice(9),req.headers.origin);if(!session)return false;
  req.nyxHostSession=session;req.q74bd9=sessions.identity(session);
  const original=protocols.filter(s=>!s.startsWith('nyx-host.'));if(original.length)req.headers['sec-websocket-protocol']=original.join(', ');
  return true;
 }
 return {allowed,middleware,upgrade};
}
