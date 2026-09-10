(() => {
  'use strict';
  class NativePlayer {
    constructor(id, options) {
      this.isNative=true; this.options=options; this.controller=new AbortController(); this.current=0;
      this.video=document.createElement('video'); this.video.playsInline=true; this.video.preload='auto';
      this.video.style.cssText='width:100%;height:100%;object-fit:contain';
      this.node=document.getElementById(id); this.node.replaceChildren(this.video);
      const emit=(name,data)=>{if(!this.controller.signal.aborted)options.events?.[name]?.({target:this,data});};
      this.video.addEventListener('playing',()=>emit('onStateChange',1));
      this.video.addEventListener('pause',()=>emit('onStateChange',2));
      this.video.addEventListener('ended',()=>emit('onStateChange',0));
      this.video.addEventListener('error',()=>emit('onError',900));
      this.video.addEventListener('loadedmetadata',()=>emit('onReady'),{once:true});
      this.prepare().catch(error=>{if(!this.controller.signal.aborted){this.failure=error.message;emit('onError',900);}});
    }
    wait(ms) {
      return new Promise((resolve,reject)=>{
        const signal=this.controller.signal;
        const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
        const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
        signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
      });
    }
    async json(path, options={}) {
      for(let attempt=0;;attempt++) {
        const res=await fetch(path,{...options,credentials:'same-origin',signal:this.controller.signal});
        const data=await res.json();
        if(res.ok)return data;
        if(res.status===429 && data.code==='busy' && attempt<20) {await this.wait(3000);continue;}
        throw new Error(data.error||'Native playback unavailable.');
      }
    }
    async prepare() {
      const id=encodeURIComponent(this.options.videoId);
      const payload=await this.json(`/api/nyxtube/native/formats/${id}`);
      this.qualities=(payload.formats||[]).map(f=>Number(f.height)).filter(h=>[360,480,720].includes(h));
      if(!this.qualities.length)throw new Error('No supported native stream.');
      this.quality=this.qualities.includes(this.options.quality)?this.options.quality:Math.max(...this.qualities);
      let result=await this.json(`/api/nyxtube/native/prepare/${id}/${this.quality}`,{method:'POST'});
      const deadline=Date.now()+13*60000;
      while(result.state==='preparing'&&Date.now()<deadline) {
        await this.wait(1500);
        result=await this.json(`/api/nyxtube/native/jobs/${id}/${this.quality}`);
      }
      if(result.state!=='ready'||!new RegExp(`^/api/nyxtube/native/media/${this.options.videoId}-(360|480|720)\\.mp4$`).test(result.url||''))throw new Error('The video could not be prepared.');
      this.video.src=result.url;
    }
    playVideo(){this.video.play().catch(()=>{if(!this.controller.signal.aborted)this.options.events?.onStateChange?.({target:this,data:2});});}
    pauseVideo(){this.video.pause();}
    getPlayerState(){return this.video.ended?0:this.video.paused?2:1;}
    getCurrentTime(){return this.video.currentTime||0;}
    getDuration(){return Number.isFinite(this.video.duration)?this.video.duration:this.options.expectedDuration||0;}
    getAvailablePlaybackRates(){return [.5,.75,1,1.25,1.5,2];}
    getPlaybackRate(){return this.video.playbackRate;}
    setPlaybackRate(rate){this.video.playbackRate=rate;}
    getVolume(){return this.video.volume*100;}
    setVolume(volume){this.video.volume=Math.max(0,Math.min(1,volume/100));}
    mute(){this.video.muted=true;}
    unMute(){this.video.muted=false;}
    isMuted(){return this.video.muted;}
    seekTo(time){this.video.currentTime=Math.max(0,Math.min(this.getDuration(),time));}
    destroy(){this.controller.abort();this.video.pause();this.video.removeAttribute('src');this.video.load();this.node.replaceChildren();}
  }
  window.NyxNativePlayer=Object.freeze({Player:NativePlayer,PlayerState:{ENDED:0,PLAYING:1,PAUSED:2}});
})();
