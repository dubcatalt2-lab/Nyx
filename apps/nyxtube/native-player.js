(() => {
  'use strict';
  class NativePlayer {
    constructor(id, options) {
      this.isNative=true; this.options=options; this.controller=new AbortController(); this.current=0; this.lastProgress=Date.now(); this.lastTime=0; this.recoveries=0;
      this.video=document.createElement('video'); this.video.playsInline=true; this.video.preload='auto';
      this.video.style.cssText='width:100%;height:100%;object-fit:contain';
      this.node=document.getElementById(id); this.node.replaceChildren(this.video);
      const emit=(name,data)=>{if(!this.controller.signal.aborted)options.events?.[name]?.({target:this,data});};
      this.video.addEventListener('playing',()=>emit('onStateChange',1));
      this.video.addEventListener('pause',()=>emit('onStateChange',2));
      this.video.addEventListener('ended',()=>emit('onStateChange',0));
      this.video.addEventListener('waiting',()=>this.setBuffering(true));
      this.video.addEventListener('playing',()=>{this.renewing=false;this.setBuffering(false);});
      this.video.addEventListener('canplay',()=>{this.renewing=false;this.setBuffering(false);});
      this.video.addEventListener('seeking',()=>{if(this.video.readyState<3)this.setBuffering(true);});
      this.video.addEventListener('stalled',()=>{if(!this.video.paused&&this.video.readyState<3)this.setBuffering(true);});
      this.video.addEventListener('emptied',()=>{if(this.renewing)this.setBuffering(true);});
      this.video.addEventListener('pause',()=>{if(!this.renewing)this.setBuffering(false);});
      this.video.addEventListener('ended',()=>this.setBuffering(false));
      this.video.addEventListener('error',()=>emit('onError',900));
      this.video.addEventListener('loadedmetadata',()=>emit('onReady'),{once:true});
      this.watchdog=setInterval(()=>this.checkProgress(),2000);
      this.video.addEventListener('timeupdate',()=>{if(this.captionsEnabled)void this.updateCaptions();});
      this.video.addEventListener('seeked',()=>{this.lastTime=this.video.currentTime;this.lastProgress=Date.now();if(this.captionsEnabled)void this.updateCaptions(true);});
      this.prepare().catch(error=>this.fail(error.message));
    }
    setBuffering(value) {
      if(this.controller.signal.aborted||this.buffering===value)return;
      this.buffering=value;
      this.options.events?.onBuffering?.({target:this,data:value});
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
      const deadline=Date.now()+60000;
      for(let attempt=0;;attempt++) {
        this.controller.signal.throwIfAborted();
        const request=new AbortController(),abort=()=>request.abort(),timer=setTimeout(abort,Math.max(1,Math.min(30000,deadline-Date.now())));
        this.controller.signal.addEventListener('abort',abort,{once:true});
        if(this.controller.signal.aborted)abort();
        let res,data;
        try {res=await fetch(path,{...options,credentials:'same-origin',signal:request.signal});data=await res.json();}
        finally {clearTimeout(timer);this.controller.signal.removeEventListener('abort',abort);}
        if(res.ok)return data;
        if(res.status===429 && data.code==='busy' && attempt<4&&Date.now()+3000<deadline) {await this.wait(3000);continue;}
        throw new Error(data.error||'Native playback unavailable.');
      }
    }
    async prepare() {
      const id=encodeURIComponent(this.options.videoId);
      const payload=await this.json(`/api/nyxtube/native/formats/${id}`);
      this.qualities=(payload.formats||[]).map(f=>Number(f.height)).filter(h=>[360,480,720].includes(h));
      if(!this.qualities.length)throw new Error('No supported native stream.');
      this.quality=this.qualities.includes(this.options.quality)?this.options.quality:Math.max(...this.qualities);
      let result=await this.json(`/api/nyxtube/native/prepare/${id}/${this.quality}?mode=hls`,{method:'POST'});
      const deadline=Date.now()+60000;
      while(result.state==='preparing'&&Date.now()<deadline) {
        await this.wait(1500);
        result=await this.json(`/api/nyxtube/native/jobs/${id}/${this.quality}`);
      }
      if(result.state==='ready'&&result.kind==='hls'&&/^\/api\/nyxtube\/native\/hls\/[a-f0-9]{32}\/master\.m3u8$/.test(result.url||''))return this.loadHls(result.url);
      if(result.state!=='ready'||!new RegExp(`^/api/nyxtube/native/media/${this.options.videoId}-(360|480|720)\\.mp4$`).test(result.url||''))throw new Error('The video could not be prepared.');
      this.video.src=result.url;
    }
    loadHls(url, position=this.options.startTime||0) {
      this.hlsUrl=url;this.lastProgress=Date.now();
      const Hls=window.Hls;
      if(Hls?.isSupported()) {
        this.hls?.destroy();
        const retry={maxNumRetry:2,retryDelayMs:1000,maxRetryDelayMs:8000,
          shouldRetry:(config,count,timeout,response,recommended)=>recommended||(response?.code===429&&count<config.maxNumRetry)};
        const policy={default:{maxTimeToFirstByteMs:65000,maxLoadTimeMs:70000,timeoutRetry:{...retry,maxNumRetry:1},errorRetry:retry}};
        const hls=this.hls=new Hls({startPosition:position,maxBufferLength:12,maxMaxBufferLength:24,maxBufferSize:8*1024*1024,
          backBufferLength:12,fragLoadPolicy:policy,manifestLoadPolicy:policy,playlistLoadPolicy:policy});
        hls.on(Hls.Events.ERROR,(_event,data)=>{
          if(this.controller.signal.aborted)return;
          if(!data.fatal){
            if(data.details===Hls.ErrorDetails?.BUFFER_STALLED_ERROR&&!this.video.paused)this.setBuffering(true);
            return;
          }
          if(data.response?.code===410&&(!this.renewedAt||Date.now()-this.renewedAt>60000)) {
            this.renewedAt=Date.now();
            const time=this.video.currentTime,paused=this.video.paused;
            this.renewing=true;this.setBuffering(true);
            hls.destroy();this.hls=null;
            this.json(`/api/nyxtube/native/prepare/${encodeURIComponent(this.options.videoId)}/${this.quality}?mode=hls`,{method:'POST'}).then(result=>{
              if(!/^\/api\/nyxtube\/native\/hls\/[a-f0-9]{32}\/master\.m3u8$/.test(result.url||''))throw new Error('The video session could not be renewed.');
              this.loadHls(result.url,time);if(!paused)this.playVideo();
            }).catch(error=>this.fail(error.message));
            return;
          }
          if(data.type===Hls.ErrorTypes.MEDIA_ERROR&&this.recoveries++<1){this.lastProgress=Date.now();hls.recoverMediaError();return;}
          this.fail(data.type===Hls.ErrorTypes.NETWORK_ERROR?'The video connection could not recover.':'This video could not be decoded.');
        });
        hls.loadSource(url);hls.attachMedia(this.video);
      } else if(this.video.canPlayType('application/vnd.apple.mpegurl'))this.video.src=url;
      else throw new Error('This browser does not support segmented video playback.');
    }
    checkProgress(){
      if(this.controller.signal.aborted||this.failed)return;
      const time=this.video.currentTime;
      if((!this.video.paused&&Math.abs(time-this.lastTime)>.1)||this.video.ended||(this.video.paused&&this.video.readyState>=2&&!this.renewing)){
        this.lastTime=time;this.lastProgress=Date.now();return;
      }
      if(Date.now()-this.lastProgress<90000)return;
      if(this.hls&&this.recoveries++<1){this.lastProgress=Date.now();this.hls.stopLoad();this.hls.startLoad(time);this.setBuffering(true);return;}
      this.fail('Video loading stopped making progress. Try a lower quality or the embedded player.');
    }
    fail(message){if(!this.controller.signal.aborted&&!this.failed){this.failed=true;this.failure=message;this.setBuffering(false);clearInterval(this.watchdog);this.hls?.stopLoad();this.options.events?.onError?.({target:this,data:900});}}
    async setCaptions(enabled){
      this.captionsEnabled=enabled;
      if(this.captionTrack)this.captionTrack.mode=enabled?'showing':'disabled';
      if(enabled)await this.updateCaptions(true);
    }
    async updateCaptions(force=false){
      const at=this.getCurrentTime();
      if(this.controller.signal.aborted||!this.captionsEnabled||this.captionLoading||(!force&&at>=this.captionStart&&at<this.captionUntil))return;
      this.captionLoading=true;
      try{
        const data=await this.json(`/api/nyxtube/captions/${encodeURIComponent(this.options.videoId)}?at=${Math.floor(at)}`);
        if(this.controller.signal.aborted)return;
        if(!data.available)throw new Error(data.message||'Captions are unavailable for this video.');
        if(!this.captionTrack)this.captionTrack=this.video.addTextTrack('captions',data.language||'Captions',data.languageCode||'');
        this.captionTrack.mode='hidden';
        for(const cue of Array.from(this.captionTrack.cues||[]))this.captionTrack.removeCue(cue);
        for(const line of (data.segments||[]).slice(0,1000)){
          const start=Number(line.startSeconds),end=start+Number(line.durationSeconds);
          if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
          const text=String(line.text||'').slice(0,500).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          this.captionTrack.addCue(new VTTCue(start,end,text));
        }
        this.captionStart=Number(data.start)||0;this.captionUntil=Number(data.until);
        if(!Number.isFinite(this.captionUntil)||this.captionUntil<=at)throw new Error('The caption timing response was invalid.');
        this.captionTrack.mode=this.captionsEnabled?'showing':'disabled';
      }catch(error){if(!this.controller.signal.aborted){this.captionsEnabled=false;if(this.captionTrack)this.captionTrack.mode='disabled';this.options.events?.onCaptionError?.({target:this,message:error.message});}}
      finally{this.captionLoading=false;if(this.captionsEnabled&&!this.controller.signal.aborted&&(this.getCurrentTime()<this.captionStart||this.getCurrentTime()>=this.captionUntil))void this.updateCaptions(true);}
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
    destroy(){clearInterval(this.watchdog);this.captionsEnabled=false;this.controller.abort();this.hls?.destroy();this.video.pause();this.video.removeAttribute('src');this.video.load();this.node.replaceChildren();}
  }
  window.NyxNativePlayer=Object.freeze({Player:NativePlayer,PlayerState:{ENDED:0,PLAYING:1,PAUSED:2}});
})();
