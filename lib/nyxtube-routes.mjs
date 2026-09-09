import express from 'express';
import { TubeError } from './nyxtube-streaming.mjs';

export function tubeStreamingRoutes({ backend, sameOrigin, owner, publicVideo, clientIp }) {
  const router=express.Router(), attempts=new Map();
  const wrap=fn=>async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(!sameOrigin(req)) return res.status(403).json({error:'Cross-site video requests are not allowed.'});
    try {await fn(req,res);} catch(error) {res.status(error.status||503).json({error:error instanceof TubeError||error.status===401||error.status===403?error.message:'The video service is unavailable.',code:error instanceof TubeError?error.code:'service'});}
  };
  function limit(req) {
    const now=Date.now(), key=clientIp(req), recent=(attempts.get(key)||[]).filter(t=>t>now-600000);
    if(recent.length>=10) throw new TubeError('busy','Too many video preparations. Try again in a few minutes.',429);
    if(attempts.size>=2000&&!attempts.has(key)) {
      for(const [ip,times] of attempts)if(!times.some(t=>t>now-600000))attempts.delete(ip);
      if(attempts.size>=2000)throw new TubeError('busy','The video service is busy.',429);
    }
    recent.push(now);attempts.set(key,recent);
  }
  const id=req=>{const value=String(req.params.id||'');if(!/^[A-Za-z0-9_-]{11}$/.test(value))throw new TubeError('video','Invalid video ID.',400);return value;};
  router.get('/api/owner-dashboard/nyxtube',wrap(async(req,res)=>{await owner(req);res.json(await backend.status());}));
  router.post('/api/owner-dashboard/nyxtube/check',wrap(async(req,res)=>{await owner(req);res.json(await backend.check());}));
  router.get('/api/nyxtube/native/formats/:id',wrap(async(req,res)=>{
    if(!backend.enabled)throw new TubeError('setup','Native playback is not enabled.');
    const videoId=id(req);limit(req);await publicVideo(videoId);res.json({formats:await backend.formats(videoId)});
  }));
  router.post('/api/nyxtube/native/prepare/:id/:height',wrap(async(req,res)=>{
    if(!backend.enabled)throw new TubeError('setup','Native playback is not enabled.');
    const videoId=id(req),height=Number(req.params.height);if(![360,480,720].includes(height))throw new TubeError('video','Unsupported quality.',400);
    limit(req);await publicVideo(videoId);res.json(await backend.prepare(videoId,height));
  }));
  router.get('/api/nyxtube/native/jobs/:id/:height',wrap(async(req,res)=>{if(!backend.enabled)throw new TubeError('setup','Native playback is not enabled.');res.json(backend.jobStatus(id(req),Number(req.params.height)));}));
  router.get('/api/nyxtube/native/media/:name',wrap(async(req,res)=>{
    const lease=backend.lease(req.params.name);if(!lease)return res.status(404).json({error:'This cached video has expired. Prepare it again.'});
    res.set({'Cache-Control':'private, max-age=60','Content-Type':'video/mp4','X-Content-Type-Options':'nosniff'});
    res.once('close',lease.release);
    res.sendFile(lease.path,error=>{lease.release();if(error&&!res.headersSent)res.status(error.statusCode||500).end();});
  }));
  return router;
}
