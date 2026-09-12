import https from 'node:https';
import {lookup} from 'node:dns';
import {BlockList} from 'node:net';
import {randomBytes} from 'node:crypto';

export const movieProviders=Object.freeze([{id:'vixsrc',name:'VixSrc'}]);
const blocked=new BlockList();
for(const [ip,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])blocked.addSubnet(ip,bits);
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6');blocked.addSubnet('2001:db8::',32,'ipv6');
const fail=(message,status=503)=>Object.assign(Error(message),{status});
export function movieMediaUrl(value,provider='vixsrc'){
 const url=new URL(value);
 if(provider!=='vixsrc'||url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!(url.hostname==='vixsrc.to'||url.hostname.endsWith('.vix-content.net')))throw fail('The video source returned an unsupported address.');
 return url;
}
const agent=new https.Agent({keepAlive:true,maxSockets:8,maxFreeSockets:2,lookup(host,options,callback){
 lookup(host,{all:true},(error,addresses)=>{
  if(error)return callback(error);
  if(!addresses.length||addresses.some(({address,family})=>family===4?blocked.check(address):!globalV6.check(address,'ipv6')||blocked.check(address,'ipv6')))return callback(Error('Non-public source address'));
  if(options.all)callback(null,addresses);else callback(null,addresses[0].address,addresses[0].family);
 });
}});
async function upstream(value,signal,range,redirects=0,provider='vixsrc'){
 const url=movieMediaUrl(value,provider);
 const response=await new Promise((resolve,reject)=>{
  const request=https.get(url,{agent,signal,headers:{'User-Agent':'Mozilla/5.0','Referer':'https://vixsrc.to/','Origin':'https://vixsrc.to',...(range?{Range:range}:{})}},resolve);
  request.on('error',reject);
 });
 if([301,302,303,307,308].includes(response.statusCode)){
  response.resume();if(redirects>=3||!response.headers.location)throw fail('Video source redirect failed.');
  return upstream(new URL(response.headers.location,url).href,signal,range,redirects+1,provider);
 }
 if(![200,206].includes(response.statusCode)){response.resume();throw fail(response.statusCode===404?'This movie has no available stream.':'The video source is temporarily unavailable.',response.statusCode===404?404:503);}
 return {response,url:url.href};
}
async function readBounded(response,limit){
 const parts=[];let length=0;
 for await(const chunk of response){length+=chunk.length;if(length>limit){response.destroy();throw fail('The video source returned too much data.');}parts.push(chunk);}
 return Buffer.concat(parts).toString('utf8');
}
export async function resolveMovieStream(id,signal,provider='vixsrc'){
 if(!/^[1-9]\d{0,9}$/.test(String(id)))throw fail('Invalid movie.',400);
 if(!movieProviders.some(source=>source.id===provider))throw fail('Unknown video source.',400);
 const first=await upstream('https://vixsrc.to/api/movie/'+id,signal);
 const data=JSON.parse(await readBounded(first.response,65536));
 const embed=movieMediaUrl(new URL(data.src,'https://vixsrc.to').href);
 if(embed.hostname!=='vixsrc.to'||!embed.pathname.startsWith('/embed/'))throw fail('No compatible video source was found.');
 const second=await upstream(embed.href,signal);
 const html=await readBounded(second.response,524288);
 // Read public player configuration as data; never execute provider scripts.
 const config=html.match(/window\.masterPlaylist\s*=\s*\{([\s\S]*?)\n\s*\}/)?.[1]||'';
 const token=config.match(/['"]token['"]\s*:\s*['"]([^'"]+)['"]/)?.[1];
 const expires=config.match(/['"]expires['"]\s*:\s*['"](\d+)['"]/)?.[1];
 const path=html.match(/window\.masterPlaylist[\s\S]*?\burl\s*:\s*['"]([^'"]+)['"]/)?.[1];
 if(!token||!expires||!path||Number(expires)*1000<Date.now()+60000)throw fail('No compatible video source was found.');
 const url=movieMediaUrl(path);url.searchParams.set('token',token);url.searchParams.set('expires',expires);url.searchParams.set('h','1');
 return {url:url.href,expires:Math.min(Number(expires)*1000,Date.now()+2*60*60*1000)};
}
export function installMoviePlayback(app,{clientId=req=>req.ip,resolveStream=resolveMovieStream,open=upstream,validateMovie=async()=>{}}={}){
 const sessions=new Map(),starts=new Map();let resolving=0,active=0;
 function clean(){const now=Date.now();for(const [id,s]of sessions)if(s.expires<now||s.last<now-15*60*1000)sessions.delete(id);for(const [id,r]of starts)if(r.until<now)starts.delete(id);}
 function viewer(req){return String(req.headers.cookie||'').match(/(?:^|;\s*)nyx_movie_viewer=([A-Za-z0-9_-]{32})(?:;|$)/)?.[1]||'';}
 function sameSite(req){return req.headers['sec-fetch-site']!=='cross-site'&&(!req.headers.origin||req.headers.origin===`${req.protocol}://${req.get('host')}`);}
 function replyError(res,error){if(!res.headersSent)res.status(error.status||503).json({error:error.status?error.message:'Video could not be loaded. Please try again.'});else res.destroy();}
 app.post('/api/movies/:id/playback',async(req,res)=>{
  res.set('Cache-Control','no-store');clean();
  if(!sameSite(req))return res.status(403).json({error:'Open the player from Nyx.'});
  const provider=req.query.provider??'vixsrc';const definition=movieProviders.find(source=>source.id===provider);
  if(!definition)return res.status(400).json({error:'Unknown video source.'});
  const client=String(clientId(req)||'unknown');let limit=starts.get(client);
  if(!limit){if(starts.size>=1024)return res.status(429).json({error:'The player is busy. Try again shortly.'});limit={count:0,until:Date.now()+60000};starts.set(client,limit);}
  if(++limit.count>30||resolving>=2||sessions.size>=12)return res.status(429).json({error:'The player is busy. Try again shortly.'});
  const owner=viewer(req)||randomBytes(24).toString('base64url');
  if(!viewer(req))res.cookie('nyx_movie_viewer',owner,{httpOnly:true,sameSite:'strict',secure:req.secure,path:'/api/movies',maxAge:86400000});
  const abort=new AbortController();const disconnected=()=>abort.abort();res.on('close',disconnected);resolving++;
  try{
   if(!/^[1-9]\d{0,9}$/.test(req.params.id))throw fail('Invalid movie.',400);
   await validateMovie(req.params.id);
   const source=await resolveStream(req.params.id,AbortSignal.any([abort.signal,AbortSignal.timeout(20000)]),provider);
   if(abort.signal.aborted)return;
   // Each browser can retain at most two sessions, including an old player during renewal.
   const owned=[...sessions].filter(([,s])=>s.owner===owner);while(owned.length>=2)sessions.delete(owned.shift()[0]);
   const id=randomBytes(24).toString('base64url');
   const session={client,owner,provider,expires:source.expires,last:Date.now(),targets:new Map(),reverse:new Map(),active:0};
   const master=register(session,id,source.url,'playlist');sessions.set(id,session);
   res.json({url:master,expires:source.expires,source:definition.name,provider});
  }catch(error){replyError(res,error);}finally{resolving--;res.off('close',disconnected);}
 });
 function register(s,id,value,kind){const url=movieMediaUrl(value,s.provider).href;let key=s.reverse.get(url);if(!key){if(s.targets.size>=8192)throw fail('This playback session is full. Reload the player.');key=String(s.targets.size+1);s.targets.set(key,{url,kind});s.reverse.set(url,key);}return `/api/movies/media/${id}/${key}`;}
 app.delete('/api/movies/playback/:session', (req,res)=>{if(!sameSite(req))return res.sendStatus(403);const s=sessions.get(req.params.session);if(s&&s.owner===viewer(req))sessions.delete(req.params.session);res.set('Cache-Control','no-store').sendStatus(204);});
 app.get('/api/movies/media/:session/:resource',async(req,res)=>{
  res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});clean();
  const s=sessions.get(req.params.session),target=s?.targets.get(req.params.resource);
  if(!sameSite(req)||!s||!target||s.owner!==viewer(req))return res.status(410).json({error:'Playback expired. Reload the player.'});
  if(active>=8||s.active>=4)return res.status(429).set('Retry-After','1').json({error:'Video is buffering. Try again shortly.'});
  const range=req.headers.range;if(range&&!/^bytes=\d+-\d*$/.test(range))return res.sendStatus(416);
  const abort=new AbortController(),signal=AbortSignal.any([abort.signal,AbortSignal.timeout(45000)]);res.on('close',()=>abort.abort());active++;s.active++;s.last=Date.now();
  try{
   const {response,url}=await open(target.url,signal,range,0,s.provider);
   if(target.kind==='playlist'){
    const text=await readBounded(response,2*1024*1024);if(!text.trimStart().startsWith('#EXTM3U'))throw fail('The source did not return a video playlist.');
    let variant=false;
    const rewritten=text.split(/\r?\n/).map(line=>{
     if(line.startsWith('#')){if(line.startsWith('#EXT-X-STREAM-INF:'))variant=true;return line.replace(/URI="([^"]+)"/g,(_m,u)=>`URI="${register(s,req.params.session,new URL(u,url).href,/^#EXT-X-(?:MEDIA|I-FRAME-STREAM-INF):/.test(line)?'playlist':'media')}"`);}
     if(!line.trim())return line;const kind=variant?'playlist':'media';variant=false;return register(s,req.params.session,new URL(line.trim(),url).href,kind);
    }).join('\n');
    res.type('application/vnd.apple.mpegurl').send(rewritten);
   }else{
    const type=String(response.headers['content-type']||'application/octet-stream').split(';')[0];
    if(!/^(?:video\/|audio\/|application\/(?:octet-stream|mp4))/.test(type)){response.destroy();throw fail('The source returned an invalid video segment.');}
    const length=Number(response.headers['content-length']);if(length>16*1024*1024){response.destroy();throw fail('Video segment is too large.');}
    res.status(response.statusCode||200).type(type);
    if(response.headers['content-range'])res.set('Content-Range',response.headers['content-range']);
    if(Number.isFinite(length)&&length>0)res.set('Content-Length',String(length));
    res.set('Accept-Ranges','bytes');let size=0;
    for await(const chunk of response){size+=chunk.length;if(size>16*1024*1024)throw fail('Video segment is too large.');if(!res.write(chunk))await new Promise(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);});if(abort.signal.aborted)break;}
    res.end();
   }
  }catch(error){replyError(res,error);}finally{abort.abort();active--;s.active--;}
 });
}
