import {randomBytes} from 'node:crypto';
export function directS3Origin(value){
 const url=new URL(value);
 if(url.port||url.protocol!=='https:'||url.origin!==value||!/^([a-z0-9][a-z0-9-]{1,61}[a-z0-9])\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname))throw Error('Use an exact, bucket-specific HTTPS S3 origin.');
 return url.origin;
}
export function createStaticHostAccess(values=[]){
 const origins=new Set(values.filter(Boolean).map(directS3Origin));
 const allowed=origin=>origins.has(String(origin||''));
 const paths=/^\/(?:api(?:\/|$)|socket\.io(?:\/|$)|healthz$|resources\/live(?:\/|$)|wisp(?:\/|$)|download\/|gn-math-|cloud\/v1\/|assets\/(?:profile|backgrounds|jumpscares)\/)/;
 const probe='nyx_static_probe';
 function middleware(req,res,next){
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
   if(String(name).toLowerCase()==='set-cookie')value=(Array.isArray(value)?value:[value]).map(cookie=>/^(?:nyx_q74bd9|nyx_ai_device)=/.test(cookie)?cookie.replace(/;\s*SameSite=[^;]+/ig,'').replace(/;\s*Secure(?=;|$)/ig,'').replace(/;\s*Partitioned(?=;|$)/ig,'')+'; SameSite=None; Secure; Partitioned':cookie);
   return set.call(this,name,value);
  };
  if(req.path==='/api/static-host/check'){
   res.setHeader('Cache-Control','no-store');
   const present=String(req.headers.cookie||'').split(';').some(c=>c.trim().startsWith(probe+'='));
   if(!present)res.append('Set-Cookie',`${probe}=${randomBytes(16).toString('hex')}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=31536000`);
   return res.json({supported:true,cookies:present});
  }
  if(!String(req.headers.cookie||'').split(';').some(c=>c.trim().startsWith(probe+'=')))return res.status(428).json({error:'Open Nyx from its S3 entry page to establish this br00ser session.'});
  next();
 }
 return {allowed,middleware};
}
