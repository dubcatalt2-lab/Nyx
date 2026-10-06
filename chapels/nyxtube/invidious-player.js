(() => {
  'use strict';
  window.NyxInvidiousPlayer = function(host,{id,loop=false,restore={},onLoading=()=>{},onFailure=()=>{}}){
    const video=document.createElement('video');
    video.controls=true;video.playsInline=true;video.loop=loop;video.preload='auto';
    video.style.cssText='width:100%;height:100%;object-fit:contain;background:#0b0c0f';
    video.muted=restore.muted??loop;video.volume=Math.max(0,Math.min(1,(restore.volume??100)/100));
    let rate=restore.rate||1;video.defaultPlaybackRate=rate;video.playbackRate=rate;
    host.replaceChildren(video);
    let destroyed=false,attempt=0,controller=null,retryTimer=0,stallTimer=0,position=restore.time||0;
    let paused=restore.paused===true,retrying=false,loaded=false;
    function clearStall(){clearTimeout(stallTimer);stallTimer=0;}
    function armStall(){
      clearStall();if(destroyed||paused)return;
      stallTimer=setTimeout(()=>recover(),15000);
    }
    function recover(){
      if(destroyed||retrying)return;
      clearStall();position=Math.max(position,video.currentTime||0);rate=video.playbackRate;
      if(attempt>=2){const snapshot={time:position,paused,muted:video.muted,volume:video.volume*100,rate};destroy();onFailure(snapshot);return;}
      retrying=true;controller?.abort();onLoading(position<=0);
      retryTimer=setTimeout(()=>{retrying=false;attempt++;void load();},attempt?3000:1000);
    }
    async function load(){
      if(destroyed)return;
      loaded=false;controller?.abort();const request=controller=new AbortController();
      const timeout=setTimeout(()=>request.abort(),12000);onLoading(position<=0);
      try{
        const response=await fetch(`/api/nyxtube/invidious-playback?id=${encodeURIComponent(id)}${attempt?'&refresh=1':''}`,{cache:'no-store',signal:request.signal});
        const data=await response.json();if(!response.ok)throw Error('Video unavailable');
        const source=new URL(data.url);
        if(data.id!==id||data.type!=='video/mp4'||source.protocol!=='https:')throw Error('Invalid video response');
        if(destroyed||request!==controller)return;
        loaded=true;video.src=source.href;video.load();armStall();
      }catch{if(!destroyed&&request===controller)recover();}
      finally{clearTimeout(timeout);}
    }
    video.addEventListener('loadedmetadata',()=>{
      video.defaultPlaybackRate=rate;video.playbackRate=rate;
      if(position>0)video.currentTime=Math.min(position,Math.max(0,video.duration-.1));
      if(!paused)video.play().catch(error=>{if(error.name==='NotAllowedError'){paused=true;clearStall();onLoading(false);}});
      else{clearStall();onLoading(false);}
    });
    video.addEventListener('playing',()=>{paused=false;clearStall();onLoading(false);});
    video.addEventListener('timeupdate',()=>{if(video.readyState>=2&&!video.paused&&video.currentTime!==position){position=video.currentTime;clearStall();onLoading(false);}});
    video.addEventListener('waiting',()=>{if(loaded&&!retrying){onLoading(position<=0);armStall();}});
    video.addEventListener('stalled',()=>{if(loaded&&!retrying)armStall();});
    video.addEventListener('pause',()=>{if(!retrying&&!video.error&&video.readyState>=2){paused=true;clearStall();onLoading(false);}});
    video.addEventListener('play',()=>{paused=false;armStall();});
    video.addEventListener('error',recover);
    function destroy(){if(destroyed)return;destroyed=true;controller?.abort();clearTimeout(retryTimer);clearStall();video.pause();video.removeAttribute('src');video.load();video.remove();}
    void load();
    return {isInvidious:true,video,destroy,pauseVideo(){paused=true;clearStall();video.pause();},getCurrentTime:()=>video.currentTime,getVolume:()=>video.volume*100,getPlaybackRate:()=>video.playbackRate,isMuted:()=>video.muted};
  };
})();
