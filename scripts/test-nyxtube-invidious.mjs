import assert from 'node:assert/strict';
import {createInvidiousFallback, invidiousInfo} from '../lib/nyxtube-invidious.mjs';
import {createTubeCatalog} from '../lib/nyxtube-catalog.mjs';
import {TubeError} from '../lib/nyxtube-streaming.mjs';
const id = 'YE7VzlLtp-4', channelId = 'UCSMOQeBJ2RAnuFungnQOxLg';
const item = {videoId:id, type:'video', title:'Public video', author:'Creator', authorId:channelId,
  isListed:true, isFamilyFriendly:true, allowedRegions:['US'], lengthSeconds:90, published:1700000000,
  adaptiveFormats:[
    {itag:136, type:'video/mp4; codecs="avc1.64001f"', resolution:'720p', url:'https://r1.googlevideo.com/signed-video',clen:'12345'},
    {itag:140, type:'audio/mp4; codecs="mp4a.40.2"', url:'https://r1.googlevideo.com/signed-audio',bitrate:'128000'},
    {itag:22, type:'video/mp4; codecs="avc1.64001f, mp4a.40.2"',resolution:'720p',url:'https://127.0.0.1/private'}]};
let calls=0, primary=0, clock=100000, bad=false;
const fallback=createInvidiousFallback({env:{NYX_INVIDIOUS_ORIGINS:'https://fixture.example'},now:()=>clock,
  fetch:async(url, options)=>{
    calls++; assert.equal(options.redirect,'error'); assert.deepEqual(options.headers,{accept:'application/json'});
    if(bad)return new Response('challenge',{status:429});
    let body=url.pathname.includes('/search')?[item]:url.pathname.includes('/comments/')?{comments:[{commentId:'c',content:'Hello'}]}:url.pathname.includes('/channels/')?{authorId:channelId,author:'Creator',latestVideos:[item]}:item;
    return Response.json(body);
  }});
const catalog=createTubeCatalog({fallback,env:{},now:()=>clock,execute:async()=>{primary++;throw new TubeError('authentication','Primary login unavailable.');}});
try {
  const searches=await Promise.all(Array.from({length:30},()=>catalog.search('science')));
  assert.equal(primary,1);assert.equal(calls,1);assert.equal(searches[0][0].isShort,true);
  assert.ok(!JSON.stringify(searches).includes('signed-'));
  const detail=await catalog.video(id);assert.equal(detail.detailsPending,false);assert.equal(primary,1);
  assert.deepEqual((await catalog.info(id)).formats, []);
  await assert.rejects(catalog.playbackInfo(id), e => e.code === 'service' && /temporarily unavailable/.test(e.message));
  assert.equal((await catalog.comments(id)).comments[0].text,'Hello');
  clock+=31000;await catalog.search('another query');assert.equal(primary,2,'primary is retried after the fixed cooldown');
  const before=calls;bad=true;await assert.rejects(fallback.search('fail',5));
  await assert.rejects(fallback.search('again',5));assert.equal(calls,before+1,'failed instance is not hammered');
  for(const fields of [{isListed:false},{isFamilyFriendly:false},{paid:true},{premium:true},{allowedRegions:['CA']},{isUpcoming:true},{liveNow:true}])assert.throws(()=>invidiousInfo({...item,...fields},id),e=>e.code==='video');
  assert.throws(()=>invidiousInfo({...item,videoId:'aqz-KE-bpKQ'},id));
  assert.equal(invidiousInfo(item,id).formats.length,0,'unverified backup stream URLs are never advertised');
  assert.ok(!JSON.stringify(await catalog.info(id)).includes('googlevideo.com'));
  assert.equal(createInvidiousFallback({env:{NYX_INVIDIOUS_ORIGINS:''}}).enabled,false);
  console.log('PASS Invidious search/details/channel/comments fallback, Shorts metadata, 30-request coalescing, fixed cooldown, restrictions and metadata-only playback boundary');
} finally {await catalog.close();}
let backups=0;
const denied=createTubeCatalog({env:{},fallback:{enabled:true,info:async()=>{backups++;},close(){}},execute:async()=>{throw new TubeError('video','Restricted',422);}});
try{await assert.rejects(denied.info(id),e=>e.status===422);assert.equal(backups,0);}finally{await denied.close();}
