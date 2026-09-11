import express from 'express';
import { TubeError } from './nyxtube-streaming.mjs';

export function tubeStreamingRoutes({ backend, sameOrigin, owner, publicVideo, clientIp }) {
  const router=express.Router(), attempts=new Map();
  let streaming = 0;
  const wrap=fn=>async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(!sameOrigin(req)) return res.status(403).json({error:'Cross-site video requests are not allowed.'});
    try {await fn(req,res);} catch(error) {if(!res.headersSent&&!res.destroyed)res.status(error.status||503).json({error:error instanceof TubeError||error.status===401||error.status===403?error.message:'The video service is unavailable.',code:error instanceof TubeError?error.code:'service'});}
  };
  function limit(req) {
    const now=Date.now(), key=clientIp(req), recent=(attempts.get(key)||[]).filter(t=>t>now-600000);
    if(recent.length>=10) throw new TubeError('quota','Too many video preparations. Try again in a few minutes.',429);
    if(attempts.size>=2000&&!attempts.has(key)) {
      for(const [ip,times] of attempts)if(!times.some(t=>t>now-600000))attempts.delete(ip);
      if(attempts.size>=2000)throw new TubeError('busy','The video service is busy.',429);
    }
    return ()=>{const accepted=(attempts.get(key)||[]).filter(t=>t>Date.now()-600000);accepted.push(Date.now());attempts.set(key,accepted);};
  }
  const id=req=>{const value=String(req.params.id||'');if(!/^[A-Za-z0-9_-]{11}$/.test(value))throw new TubeError('video','Invalid video ID.',400);return value;};
  router.get('/api/owner-dashboard/nyxtube',wrap(async(req,res)=>{await owner(req);res.json(await backend.status());}));
  router.post('/api/owner-dashboard/nyxtube/check',wrap(async(req,res)=>{await owner(req);res.json(await backend.check());}));
  router.get('/api/nyxtube/native/formats/:id',wrap(async(req,res)=>{
    if(!backend.enabled)throw new TubeError('setup','Native playback is not enabled.');
    const videoId=id(req),consume=limit(req);await publicVideo(videoId);const formats=await backend.formats(videoId);consume();res.json({formats});
  }));
  router.post('/api/nyxtube/native/prepare/:id/:height',wrap(async(req,res)=>{
    if(!backend.enabled)throw new TubeError('setup','Native playback is not enabled.');
    const videoId=id(req),height=Number(req.params.height);if(![360,480,720].includes(height))throw new TubeError('video','Unsupported quality.',400);
    const consume=limit(req);await publicVideo(videoId);const result=await (req.query.mode==='hls'?backend.prepareSegments(videoId,height):backend.prepare(videoId,height));consume();res.json(result);
  }));
  router.get('/api/nyxtube/native/jobs/:id/:height',wrap(async(req,res)=>{if(!backend.enabled)throw new TubeError('setup','Native playback is not enabled.');res.json(backend.jobStatus(id(req),Number(req.params.height)));}));
  router.get('/api/nyxtube/native/hls/:token/:name',wrap(async(req,res)=>{
    const {token,name}=req.params;
    if(!/^[a-f0-9]{32}$/.test(token))throw new TubeError('video','Unknown video session.',404);
    res.set('X-Content-Type-Options','nosniff');
    if(/^(master|video|audio)\.m3u8$/.test(name))return res.type('application/vnd.apple.mpegurl').send(await backend.playlist(token,name));
    const init=/^(video|audio)-init\.mp4$/.exec(name);
    if(init)return res.type(`${init[1]}/mp4`).send(await backend.init(token,init[1]));
    const part=/^(video|audio)-(\d{1,6})\.m4s$/.exec(name);
    if(!part)throw new TubeError('video','Unknown video segment.',404);
    if(streaming>=40)throw new TubeError('busy','Video playback is busy. Try again shortly.',429);
    streaming++;
    const controller=new AbortController();
    let lease, released=false;
    const release=()=>{if(released)return;released=true;streaming--;controller.abort();lease?.release();};
    res.once('close',release);
    try {
      lease=await backend.segment(token,part[1],Number(part[2]),controller.signal);
      if(res.destroyed){lease.release();return;}
      res.set({'Cache-Control':'private, max-age=60','Content-Type':`${part[1]}/mp4`});
      res.sendFile(lease.path,error=>{release();if(error&&!res.headersSent&&!res.destroyed)res.status(error.statusCode||500).end();});
    } catch(error) {release();throw error;}
  }));
  router.get('/api/nyxtube/native/media/:name',wrap(async(req,res)=>{
    const lease=backend.lease(req.params.name);if(!lease)return res.status(404).json({error:'This cached video has expired. Prepare it again.'});
    res.set({'Cache-Control':'private, max-age=60','Content-Type':'video/mp4','X-Content-Type-Options':'nosniff'});
    res.once('close',lease.release);
    res.sendFile(lease.path,error=>{lease.release();if(error&&!res.headersSent)res.status(error.statusCode||500).end();});
  }));
  return router;
}
