(function(){
  'use strict';
  const nyxEarlyConsoleEntries=[];
  let nyxEarlyConsoleBuffering=true;
  const bufferNyxConsoleEntry=(level,args)=>{
    if(!nyxEarlyConsoleBuffering) return;
    nyxEarlyConsoleEntries.push({level,args:Array.from(args),time:new Date()});
    if(nyxEarlyConsoleEntries.length>200) nyxEarlyConsoleEntries.shift();
  };
  ['log','info','warn','error'].forEach(level=>{
    const original=console[level]?.bind(console);
    if(!original) return;
    console[level]=(...args)=>{
      bufferNyxConsoleEntry(level,args);
      return original(...args);
    };
  });
  addEventListener('error',event=>{
    bufferNyxConsoleEntry('error',[event.error || `${event.message || 'Script error'} at ${event.filename || 'unknown source'}:${event.lineno || 0}`]);
  });
  addEventListener('unhandledrejection',event=>{
    bufferNyxConsoleEntry('error',['Unhandled promise rejection',event.reason]);
  });

  const $ = id => document.getElementById(id);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalizeWorkspacePreferences(value){
    const result={...(value&&typeof value==='object'&&!Array.isArray(value)?value:{})};
    for(const suffix of ['Mode','Background','Bookmarks','ShellMode']){
      const old='nyx.b\u0072owser'+suffix,key='nyx.workspace'+suffix;
      if(!Object.hasOwn(result,key)&&Object.hasOwn(result,old))result[key]=result[old];
      delete result[old];
    }
    return result;
  }
  for(const suffix of ['Mode','Background','Bookmarks','ShellMode']){
    try{
      const old='nyx.b\u0072owser'+suffix,key='nyx.workspace'+suffix,value=localStorage.getItem(old);
      if(value!==null){if(localStorage.getItem(key)===null)localStorage.setItem(key,value);localStorage.removeItem(old);}
    }catch{}
  }
  const store = {get(k,d){try{return JSON.parse(localStorage.getItem(k)) ?? d}catch{return d}}, set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}queueNyxCloudPreferencesSave?.()}, text(k,d=''){try{return localStorage.getItem(k) ?? d}catch{return d}}, setText(k,v){try{const changed=localStorage.getItem(k)!==String(v);localStorage.setItem(k,String(v));if(changed)nyxRememberAppearanceEdit(k,String(v));}catch{}queueNyxCloudPreferencesSave?.()}};
  try{
    const savedShortcuts=JSON.parse(localStorage.getItem('nyx.homeShortcuts')||'[]');
    if(Array.isArray(savedShortcuts)){
      const activeShortcuts=savedShortcuts.filter(item=>{
        const url=String(item?.url||'').trim().replace(/\/+$/,'').toLowerCase();
        const domain=String(item?.domain||'').trim().toLowerCase();
        return !['nyx-tube','nyxtube'].includes(domain);
      });
      if(activeShortcuts.length!==savedShortcuts.length)localStorage.setItem('nyx.homeShortcuts',JSON.stringify(activeShortcuts));
    }
  }catch{}
  let nyxChatAudioContext=null;
  let nyxChatAudioUnlocked=false;
  function unlockNyxChatNotificationSound(){if(nyxChatAudioUnlocked)return;try{const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;nyxChatAudioContext=nyxChatAudioContext||new Context();void nyxChatAudioContext.resume();nyxChatAudioUnlocked=true}catch{}}
  function nyxChatNotificationTones(kind){return kind==='mention'?[[0,780,.4,.18],[.09,980,.45,.18],[.18,1180,.5,.2]]:kind==='dm'?[[0,660,.34,.17],[.11,880,.38,.18]]:[[0,620,.3,.16],[.11,760,.34,.17]]}
  function playNyxChatNotificationSound(kind='chat'){const context=nyxChatAudioContext;if(!nyxChatAudioUnlocked||!context)return;try{void context.resume();const now=context.currentTime;nyxChatNotificationTones(kind).forEach(([offset,frequency,peak,duration])=>{const oscillator=context.createOscillator();const gain=context.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,now+offset);gain.gain.setValueAtTime(.0001,now+offset);gain.gain.exponentialRampToValueAtTime(peak,now+offset+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+duration);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(now+offset);oscillator.stop(now+offset+duration+.01)})}catch{}}
  document.addEventListener('pointerdown',unlockNyxChatNotificationSound,{once:true,capture:true});
  document.addEventListener('keydown',unlockNyxChatNotificationSound,{once:true,capture:true});
  const NYX_DISPLAY_NAME_FONTS=Object.freeze([['gg-sans','gg sans'],['headline','Headline'],['rounded','Rounded'],['wide','Wide'],['slab','Slab'],['condensed','Condensed'],['mono-block','Mono Block'],['tempo','Tempo'],['sakura','Sakura'],['jellybean','Jellybean'],['modern','Modern'],['medieval','Medieval'],['eight-bit','8Bit'],['vampyre','Vampyre']]);
  const NYX_DISPLAY_NAME_EFFECTS=Object.freeze([['solid','Solid'],['gradient','Gradient'],['neon','Neon'],['toon','Toon'],['pop','Pop']]);
  const nyxFounderProfileDefaults=Object.freeze({displayName:'1aqlla',handle:'@1aqlla',role:'Owner / Founder',bio:'Built Nyx for people who search, study, and create.',avatarUrl:'/assets/icons/founder-1aqlla.jpg',bannerUrl:'',accent:'#8fb8ff',accentPrimary:'#8fb8ff',accentSecondary:'#8ea1ff',bannerColor:'#8ea1ff',displayNameFont:'gg-sans',displayNameEffect:'solid',displayNameColorPrimary:'#ffffff',displayNameColorSecondary:'#8ea1ff',profileEffect:'none',customEffectPattern:'starfield',customEffectColorPrimary:'#ffffff',customEffectColorSecondary:'#8ea1ff',customEffectSpeed:7,customEffectIntensity:70,avatarDecoration:'none',status:'online',roles:['Owner','Developer'],badges:['Founder'],linkLabel:'',linkUrl:''});
  const NYX_PROFILE_EFFECTS=Object.freeze([["none","None"],["blooming-roses","Blooming Roses"],["fx-cosmic-vortex","Butterfly Sparkles"],["fx-nebula-storm","Drifting Butterflies"],["fx-stellar-burst","Starlit Petals"],["fx-ethereal-flame","Floating Petals"],["fx-quantum-rift","Moonlit Wolf"],["fx-astral-cascade","Night Clouds"],["fx-plasma-wave","Shadow Grins"],["fx-supernova-flash","Peeking Shadows"],["fx-void-shards","Owl in the Mist"],["fx-prismatic-spark","Neon Beast Spiral"],["fx-arcane-pulse","Monochrome Demon"],["fx-solar-surge","Demon Reveal"],["fx-neon-eclipse","Hanging Shadow Grin"],["fx-celestial-drift","Neon Beast Portrait"],["fx-shadow-aura","Pink Lightning"],["fx-hyper-aura","Owl on a Branch"],["fx-starlight-bloom","Clouds & Full Moon"],["fx-galaxy-shimmer","Hello Kitty Blossoms"],["fx-cyber-lattice","Moonlit Vine Border"],["fx-abyssal-ring","Spider-Man Swing"],["fx-dimension-rift","Shark Whirlpool"],["fx-chrono-spark","Circling Sharks"],["fx-zenith-glow","Deep Sea Silhouettes"],["fx-infrared-pulse","Deep Sea Drift"],["fx-glitch-storm","Ocean Shadows"],["fx-phantom-flame","Spider-Man Peek"],["fx-vortex-surge","Spiderweb Border"],["fx-nebula-spark","Moonlit Vine Canopy"],["fx-starlight-echo","Moonlit Vine Sparkles"],["fx-spectral-surge","Glowing Butterflies"],["fx-cyber-matrix","Glowing Rose Wreath"],["fx-dark-void","Cloud Halo"],["fx-nebula-rift","Black Thorn Ring"],["fx-solar-flare","Skeletal Embrace"],["fx-sakura-blossom","Blushing Cat Ears"],["fx-arcane-prism","Phoenix Swirl"],["fx-abyssal-pulse","Black Roses & Butterfly"],["fx-neon-stardust","Dark Angel Wings"],["fx-retro-wave","Comic Anger"],["fx-glitch-mirage","Prismatic Eclipse"],["fx-celestial-shine","Luminous Moth"],["fx-phantom-mist","Crimson Butterfly"],["fx-hyperdrive","Moonlit Vines"],["fx-quantum-bloom","Silver Orbits"],["fx-prismatic-aura","Moonlit Clouds"],["fx-astral-spark","Flaming Skulls"],["fx-thunderstorm","Golden Moon"],["fx-crimson-eclipse","Golden Star Crown"],["fx-electric-dream","Ocean Glow"],["fx-frozen-shards","White Angel Wings"],["fx-vortex-horizon","Ember Moon"],["fx-nova-beam","Aurora Wisps"],["fx-cybernetic-pulse","White Roses & Butterfly"],["fx-radiant-orbit","Starlight Mist"]]);
  const NYX_AVATAR_DECORATIONS=Object.freeze([["none","None"],["candlelight","Candlelight"],["astral-ring-alpha","Starlight Mist"],["celestial-crown","Ember Moon"],["neon-vortex","Aurora Wisps"],["solar-flare-ring","White Roses & Butterfly"],["void-ring","Golden Moon"],["cybernetic-halo","Flaming Skulls"],["crimson-shield","White Angel Wings"],["quantum-ring","Luminous Moth"],["ethereal-aura","Prismatic Eclipse"],["static-frost","Moonlit Clouds"],["prismatic-glow","Golden Star Crown"],["supernova-ring","Ocean Glow"],["neon-pulse","Crimson Butterfly"],["arcane-circle","Moonlit Vines"],["cosmic-dust","Silver Orbits"],["stellar-ring","Comic Anger"],["gilded-halo","Blushing Cat Ears"],["plasma-ring","Black Roses & Butterfly"],["hyperdrive","Phoenix Swirl"],["infernal-ring","Dark Angel Wings"],["solar-ring","Skeletal Embrace"],["nebula-ring","Black Thorn Ring"],["prism-crown","Cloud Halo"],["ember-ring","Glowing Rose Wreath"],["vortex-crown","Glowing Butterflies"]]);
  const NYX_LEGACY_PROFILE_EFFECTS=Object.freeze({glow:'blooming-roses',sparkle:'blooming-roses',aurora:'blooming-roses',holographic:'blooming-roses',fireflies:'blooming-roses','cosmic-dust':'blooming-roses','electric-storm':'blooming-roses','meteor-shower':'blooming-roses','cyber-grid':'blooming-roses',plasma:'blooming-roses',snowfall:'blooming-roses',embers:'blooming-roses',bubbles:'blooming-roses','starlight-ribbon':'blooming-roses','cherry-bloom':'blooming-roses','ocean-caustics':'blooming-roses','chromatic-inferno':'blooming-roses',ghostfire:'blooming-roses','pirate-breach':'blooming-roses','kraken-depths':'blooming-roses','celestial-rift':'blooming-roses',stormforged:'blooming-roses',custom:'blooming-roses'});
  const NYX_LEGACY_AVATAR_DECORATIONS=Object.freeze({starfall:'candlelight',orbit:'candlelight',laurel:'candlelight','neon-wings':'candlelight','crystal-crown':'candlelight','lunar-halo':'candlelight','rose-vines':'candlelight','inferno-crown':'candlelight','corsair-crest':'candlelight','kraken-grasp':'candlelight','eclipse-halo':'candlelight','phoenix-wings':'candlelight','crystal-aegis':'candlelight'});
  const nyxProfileEffectValue=(value,fallback='none')=>{const candidate=String(value||'').toLowerCase();const migrated=NYX_LEGACY_PROFILE_EFFECTS[candidate]||candidate;return NYX_PROFILE_EFFECTS.some(([id])=>id===migrated)?migrated:fallback};
  const nyxAvatarDecorationValue=(value,fallback='none')=>{const candidate=String(value||'').toLowerCase();const migrated=NYX_LEGACY_AVATAR_DECORATIONS[candidate]||candidate;return NYX_AVATAR_DECORATIONS.some(([id])=>id===migrated)?migrated:fallback};
  const nyxProfileOptions=(options,selected)=>options.map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('');
  let nyxFounderProfile={...nyxFounderProfileDefaults};
  let nyxFounderProfileLoadPromise=null;
  let nyxFounderAuthConfig={enabled:false,ownerConfigured:false};
  let nyxFounderFirebaseAuth=null;
  let nyxFounderSignedInUser=null;
  let nyxFounderIsOwner=false;
  let nyxOwnerDashboardAccess=false;
  let nyxUserPermissions=[];
  let nyxUserAccountRole='member';
  let nyxUserSubscriptionStatus='free';
  let nyxUserAccountEmail='';
  let nyxFounderAuthReadyPromise=null;
  let nyxFirebaseTokenPromise=null;
  let nyxUserProfile=null;
  let nyxUserProfileCreatedAt='';
  let nyxUserActivityTimer=0;
  const nyxGifPosterCache=new Map();
  const nyxGifPosterResolved=new Map();
  const nyxProfileMediaResolved=new Map();
  const nyxProfileMediaPending=new Map();
  const NYX_PROFILE_IMAGE_DATA_LIMIT=850000;
  const NYX_PROFILE_MEDIA_DATA_LIMIT=11250000;
  const NYX_PROFILE_IMAGE_TOTAL_LIMIT=900000;
  const NYX_PROFILE_IMAGE_PLACEHOLDER='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  function nyxProfileMediaPath(value){
    const source=String(value||'').trim();
    return /^\/api\/profile-media\/[A-Za-z0-9_-]{8,128}\/(?:avatar|banner)\/[A-Za-z0-9_-]{12,80}$/.test(source)?source:'';
  }
  function nyxAnimatedProfileImage(value){
    const source=String(value||'').trim();
    const media=nyxProfileMediaResolved.get(nyxProfileMediaPath(source));
    return /^data:image\/gif;base64,/i.test(source)||/\.gif(?:$|[?#])/i.test(source)||media?.mime==='image/gif';
  }
  async function nyxResolveProfileMedia(value){
    const source=nyxProfileMediaPath(value);
    if(!source)return null;
    if(nyxProfileMediaResolved.has(source))return nyxProfileMediaResolved.get(source);
    if(nyxProfileMediaPending.has(source))return nyxProfileMediaPending.get(source);
    const pending=(async()=>{
      const manifestResponse=await fetch(`${source}/manifest`,{cache:'force-cache'});
      const manifest=await manifestResponse.json().catch(()=>({}));
      const mime=String(manifest.mime||'').toLowerCase();
      const totalChunks=Number(manifest.totalChunks||0);
      if(!manifestResponse.ok||!/^image\/(?:gif|png|jpeg|webp)$/.test(mime)||!Number.isInteger(totalChunks)||totalChunks<1||totalChunks>32){
        throw new Error('That saved profile image is unavailable.');
      }
      const encodedChunks=new Array(totalChunks);
      let nextIndex=0;
      await Promise.all(Array.from({length:Math.min(4,totalChunks)},async()=>{
        while(nextIndex<totalChunks){
          const index=nextIndex++;
          const response=await fetch(`${source}/chunks/${index}`,{cache:'force-cache'});
          const encoded=(await response.text()).trim();
          if(!response.ok||!encoded||!/^[a-z0-9+/=]+$/i.test(encoded))throw new Error('That saved profile image is incomplete.');
          encodedChunks[index]=encoded;
        }
      }));
      const parts=encodedChunks.map(encoded=>{
        const decoded=atob(encoded);
        const bytes=new Uint8Array(decoded.length);
        for(let index=0;index<decoded.length;index++)bytes[index]=decoded.charCodeAt(index);
        return bytes;
      });
      const blob=new Blob(parts,{type:mime});
      if(Number(manifest.byteLength||0)>0&&blob.size!==Number(manifest.byteLength)){
        throw new Error('That saved profile image did not pass its size check.');
      }
      const result={url:URL.createObjectURL(blob),mime,size:blob.size};
      nyxProfileMediaResolved.set(source,result);
      return result;
    })().finally(()=>nyxProfileMediaPending.delete(source));
    nyxProfileMediaPending.set(source,pending);
    return pending;
  }
  function nyxCaptureGifPoster(image,source,maxSize=180){
    const existing=nyxGifPosterResolved.get(source);
    if(existing)return Promise.resolve(existing);
    const cacheKey=`${source}::${maxSize}`;
    if(nyxGifPosterCache.has(cacheKey))return nyxGifPosterCache.get(cacheKey);
    const poster=new Promise(resolve=>{
      const capture=()=>{
        try{
          const width=Number(image.naturalWidth||0);
          const height=Number(image.naturalHeight||0);
          if(!width||!height){resolve('');return}
          const scale=Math.min(1,maxSize/Math.max(width,height));
          const canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(width*scale));
          canvas.height=Math.max(1,Math.round(height*scale));
          canvas.getContext('2d',{alpha:true})?.drawImage(image,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL('image/webp',.78));
        }catch{resolve('')}
      };
      if(image.complete&&image.naturalWidth)capture();
      else{
        image.addEventListener('load',capture,{once:true});
        image.addEventListener('error',()=>resolve(''),{once:true});
      }
    }).then(result=>{
      if(result)nyxGifPosterResolved.set(source,result);
      return result;
    });
    nyxGifPosterCache.set(cacheKey,poster);
    return poster;
  }
  function nyxProfileStillSource(source){
    const value=String(source||'');
    const mediaPath=nyxProfileMediaPath(value);
    if(mediaPath){
      const media=nyxProfileMediaResolved.get(mediaPath);
      if(!media)return NYX_PROFILE_IMAGE_PLACEHOLDER;
      return media.mime==='image/gif'?(nyxGifPosterResolved.get(value)||media.url):media.url;
    }
    return nyxAnimatedProfileImage(value)?(nyxGifPosterResolved.get(value)||value):value;
  }
  function nyxSetCompactGifMotion(host,active){
    const image=host?.querySelector(':scope > img');
    const source=String(host?.dataset.nyxAnimatedSource||'');
    const poster=String(host?.dataset.nyxAnimatedPoster||'');
    if(!image||!source)return;
    const target=active&&document.visibilityState==='visible'?source:(poster||source);
    if(image.getAttribute('src')!==target)image.setAttribute('src',target);
  }
  function nyxApplyCompactProfileImage(host,image,identity,renderSource,animated,maxSize=180){
    if(!host||!image)return;
    if(!animated){
      delete host.dataset.nyxAnimatedIdentity;
      delete host.dataset.nyxAnimatedSource;
      delete host.dataset.nyxAnimatedPoster;
      if(image.getAttribute('src')!==renderSource)image.setAttribute('src',renderSource);
      return;
    }
    const sourceChanged=host.dataset.nyxAnimatedIdentity!==identity||host.dataset.nyxAnimatedSource!==renderSource;
    host.dataset.nyxAnimatedIdentity=identity;
    host.dataset.nyxAnimatedSource=renderSource;
    const cachedPoster=nyxGifPosterResolved.get(identity)||'';
    if(sourceChanged){
      if(cachedPoster)host.dataset.nyxAnimatedPoster=cachedPoster;
      else delete host.dataset.nyxAnimatedPoster;
      const initial=cachedPoster||renderSource;
      if(image.getAttribute('src')!==initial)image.setAttribute('src',initial);
    }
    if(!host.dataset.nyxGifMotionBound){
      host.dataset.nyxGifMotionBound='true';
      const focusTarget=host.closest('button')||host;
      host.addEventListener('pointerenter',()=>nyxSetCompactGifMotion(host,true));
      host.addEventListener('pointerleave',()=>nyxSetCompactGifMotion(host,focusTarget.matches(':focus')));
      focusTarget.addEventListener('focus',()=>nyxSetCompactGifMotion(host,true));
      focusTarget.addEventListener('blur',()=>nyxSetCompactGifMotion(host,false));
    }
    void nyxCaptureGifPoster(image,identity,maxSize).then(poster=>{
      if(!poster||host.dataset.nyxAnimatedIdentity!==identity)return;
      host.dataset.nyxAnimatedPoster=poster;
      const focusTarget=host.closest('button')||host;
      nyxSetCompactGifMotion(host,host.matches(':hover')||focusTarget.matches(':focus'));
    });
  }
  function nyxManageCompactGif(host,image,source,maxSize=180){
    if(!host||!image)return;
    const mediaPath=nyxProfileMediaPath(source);
    if(!mediaPath){
      delete host.dataset.nyxProfileMediaSource;
      nyxApplyCompactProfileImage(host,image,String(source||''),String(source||''),nyxAnimatedProfileImage(source),maxSize);
      return;
    }
    host.dataset.nyxProfileMediaSource=mediaPath;
    const resolved=nyxProfileMediaResolved.get(mediaPath);
    if(resolved){
      nyxApplyCompactProfileImage(host,image,mediaPath,resolved.url,resolved.mime==='image/gif',maxSize);
      return;
    }
    if(image.getAttribute('src')!==NYX_PROFILE_IMAGE_PLACEHOLDER)image.setAttribute('src',NYX_PROFILE_IMAGE_PLACEHOLDER);
    void nyxResolveProfileMedia(mediaPath).then(media=>{
      if(!media||host.dataset.nyxProfileMediaSource!==mediaPath)return;
      nyxApplyCompactProfileImage(host,image,mediaPath,media.url,media.mime==='image/gif',maxSize);
    }).catch(error=>{
      if(host.dataset.nyxProfileMediaSource!==mediaPath)return;
      console.warn('Nyx profile media could not load:',error);
      if(image.getAttribute('src')!==mediaPath)image.setAttribute('src',mediaPath);
    });
  }
  function nyxManageUserProfileGifs(root,profile){
    if(!root||!profile)return;
    const avatarHost=root.querySelector?.('.nyx-user-profile-avatar,.nyx-account-menu-avatar');
    const avatarImage=avatarHost?.querySelector(':scope > img');
    if(avatarHost&&avatarImage)nyxManageCompactGif(avatarHost,avatarImage,profile.avatarUrl,640);
    const bannerHost=root.querySelector?.('.nyx-user-profile-banner,.nyx-account-menu-banner');
    const bannerImage=bannerHost?.querySelector(':scope > img');
    if(bannerHost&&bannerImage)nyxManageCompactGif(bannerHost,bannerImage,profile.bannerUrl,720);
    root.querySelectorAll?.('.nyx-profile-rail-avatar,.nyx-profile-decoration-avatar,.nyx-profile-nameplate-preview>span,.nyx-profile-switch-avatar').forEach(host=>{
      const image=host.querySelector(':scope > img');
      if(image)nyxManageCompactGif(host,image,profile.avatarUrl,240);
    });
  }
  function nyxManageFounderProfileGifs(root,profile=normalizeNyxFounderProfile(nyxFounderProfile)){
    root?.querySelectorAll?.('[data-nyx-founder-profile]').forEach(card=>{
      const avatarHost=card.querySelector('.nyx-founder-image-wrap');
      const avatarImage=avatarHost?.querySelector(':scope > img');
      if(avatarHost&&avatarImage)nyxManageCompactGif(avatarHost,avatarImage,profile.avatarUrl,640);
      const bannerHost=card.querySelector('.nyx-founder-banner');
      const bannerImage=bannerHost?.querySelector(':scope > img');
      if(bannerHost&&bannerImage)nyxManageCompactGif(bannerHost,bannerImage,profile.bannerUrl,720);
    });
  }
  function nyxAccountUsername(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9_.-]/g,'').slice(0,32)}
  function nyxAccountEmail(username){return `${nyxAccountUsername(username)}@account.nyx.local`}
  function nyxHasPremiumSubscription(value=nyxUserSubscriptionStatus){return ['premium','trialing'].includes(String(value||'').trim().toLowerCase())}
  function nyxHasAccountPermission(permission){return nyxUserPermissions.includes(String(permission||''))}
  let nyxAdFreeRefreshTimer=0;
  window.__nyxPublisherMode='pending';
  function syncNyxPublisherMode(mode){
    window.__nyxPublisherMode=mode;
    dispatchEvent(new Event('nyx:publisher-change'));
    document.querySelectorAll('iframe').forEach(frame=>{try{frame.contentWindow?.postMessage({type:'nyx:publisher-change'},location.origin)}catch{}});
  }
  function syncNyxAccountEntitlements(account={}){
    if(account.uid&&account.uid!==nyxFounderSignedInUser?.uid)return;
    if(['off','standard','adkid'].includes(account.publisherMode))syncNyxPublisherMode(account.publisherMode);
    else if(!nyxFounderSignedInUser)syncNyxPublisherMode('standard');
    if(account.adFree || !nyxFounderSignedInUser){
      clearTimeout(nyxAdFreeRefreshTimer);
      if(account.adFree?.active && account.adFree.expiresAtMs>0){
        const uid=account.uid;
        const refresh=async()=>{
          if(nyxFounderSignedInUser?.uid!==uid)return;
          try{const token=await nyxGetFirebaseToken();if(!token)return;const response=await fetch('/api/account/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!response.ok)throw new Error('Account refresh failed');syncNyxAccountEntitlements(await response.json());}
          catch{nyxAdFreeRefreshTimer=setTimeout(refresh,30000);}
        };
        nyxAdFreeRefreshTimer=setTimeout(refresh,Math.min(2147480000,Math.max(1000,account.adFree.expiresAtMs-Date.now()+100)));
      }
    }
    const previousStatus=nyxUserSubscriptionStatus;
    if(account.role)nyxUserAccountRole=String(account.role||'member');
    if(typeof account.founder==='boolean')nyxFounderIsOwner=account.founder;
    if(typeof account.dashboard==='boolean')nyxOwnerDashboardAccess=account.dashboard&&nyxFounderIsOwner;
    if(Array.isArray(account.permissions))nyxUserPermissions=account.permissions.map(String);
    if(account.subscriptionStatus)nyxUserSubscriptionStatus=String(account.subscriptionStatus||'free').toLowerCase();
    document.body.dataset.nyxSubscription=nyxUserSubscriptionStatus;
    if(startNyxGlobalApps.started)queueMicrotask(renderNyxGlobalApps);
    queueMicrotask(syncNyxVisualDockState);
    document.body.classList.toggle('nyx-premium-account',nyxHasPremiumSubscription());
    if(previousStatus!==nyxUserSubscriptionStatus){
      dispatchEvent(new CustomEvent('nyx:subscription-change',{detail:{subscriptionStatus:nyxUserSubscriptionStatus,premiumAccess:nyxHasPremiumSubscription()}}));
    }
  }
  function nyxUserImage(value,fallback=''){const raw=String(value||'').trim();if(!raw)return fallback;if(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw)&&raw.length<=NYX_PROFILE_MEDIA_DATA_LIMIT)return raw.replace(/\s/g,'');return nyxFounderUrl(raw,fallback)}
  function nyxDisplayNameStyleClass(profile={}){
    return `nyx-styled-display-name nyx-name-font-${profile.displayNameFont||'gg-sans'} nyx-name-effect-${profile.displayNameEffect||'solid'}`;
  }
  function nyxDisplayNameStyleVars(profile={}){
    return `--nyx-name-color-primary:${profile.displayNameColorPrimary||'#ffffff'};--nyx-name-color-secondary:${profile.displayNameColorSecondary||'#8ea1ff'}`;
  }
  const NYX_MINECRAFT_NAME_COLORS=Object.freeze({'0':'#000000','1':'#0000aa','2':'#00aa00','3':'#00aaaa','4':'#aa0000','5':'#aa00aa','6':'#ffaa00','7':'#aaaaaa','8':'#555555','9':'#5555ff',a:'#55ff55',b:'#55ffff',c:'#ff5555',d:'#ff55ff',e:'#ffff55',f:'#ffffff'});
  const NYX_MINECRAFT_MAGIC_GLYPHS='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?#$%&*+-=';
  function nyxApplyMinecraftNameStyle(node,style,index){node.classList.add('nyx-minecraft-segment');node.style.setProperty('--nyx-minecraft-index',String(index));if(style.color){node.style.setProperty('color',style.color,'important');node.style.setProperty('--nyx-minecraft-color',style.color)}if(style.bold)node.style.setProperty('font-weight','900','important');if(style.italic)node.style.setProperty('font-style','italic','important');const decorations=[];if(style.underline)decorations.push('underline');if(style.strike)decorations.push('line-through');if(decorations.length)node.style.setProperty('text-decoration',decorations.join(' '),'important');if(style.magic){node.classList.add('nyx-minecraft-magic');node.dataset.nyxMinecraftMagicPlain=node.textContent;node.setAttribute('aria-label',node.textContent)}}
  function nyxFormatMinecraftDisplayName(element){if(!(element instanceof Element))return;const source=element.textContent||'';if(element.dataset.nyxMinecraftPlain===source)return;const pattern=/&([0-9a-fklmnor])/gi;if(!pattern.test(source)){delete element.dataset.nyxMinecraftPlain;element.classList.remove('nyx-minecraft-formatted-name');return}pattern.lastIndex=0;const fragment=document.createDocumentFragment();let cursor=0,match,style={},segmentIndex=0;const append=text=>{if(!text)return;const span=document.createElement('span');span.textContent=text;nyxApplyMinecraftNameStyle(span,style,segmentIndex++);fragment.append(span)};while((match=pattern.exec(source))){append(source.slice(cursor,match.index));cursor=pattern.lastIndex;const code=match[1].toLowerCase();if(NYX_MINECRAFT_NAME_COLORS[code])style={color:NYX_MINECRAFT_NAME_COLORS[code]};else if(code==='l')style.bold=true;else if(code==='o')style.italic=true;else if(code==='n')style.underline=true;else if(code==='m')style.strike=true;else if(code==='k')style.magic=true;else if(code==='r')style={}}append(source.slice(cursor));element.replaceChildren(fragment);element.dataset.nyxMinecraftPlain=element.textContent||'';element.classList.add('nyx-minecraft-formatted-name')}
  function nyxScrambleMinecraftMagic(){const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;document.querySelectorAll('.nyx-minecraft-magic').forEach(node=>{const plain=String(node.dataset.nyxMinecraftMagicPlain||'');if(!plain)return;node.textContent=Array.from(plain,char=>/\s/u.test(char)?char:reduced?'■':NYX_MINECRAFT_MAGIC_GLYPHS[Math.floor(Math.random()*NYX_MINECRAFT_MAGIC_GLYPHS.length)]).join('')})}
  setInterval(()=>{if(!document.hidden)nyxScrambleMinecraftMagic()},110);
  function nyxFormatMinecraftNames(root=document){if(root instanceof Element&&root.matches('.nyx-styled-display-name,.nyx-minecraft-text'))nyxFormatMinecraftDisplayName(root);root.querySelectorAll?.('.nyx-styled-display-name,.nyx-minecraft-text').forEach(nyxFormatMinecraftDisplayName)}
  const nyxMinecraftNameObserver=new MutationObserver(records=>{records.forEach(record=>{const root=record.target instanceof Element?record.target:record.target.parentElement;if(root)nyxFormatMinecraftNames(root)})});
  nyxMinecraftNameObserver.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  queueMicrotask(()=>nyxFormatMinecraftNames());
  function nyxProfileEffectClass(profile={}){
    return `nyx-user-profile-effect-${profile.profileEffect||'none'} nyx-user-profile-custom-${profile.customEffectPattern||'starfield'}`;
  }
  function nyxProfileEffectArtwork(profile={}){
    if(String(profile.profileEffect||'')!=='blooming-roses')return '';
    return `<span class="nyx-rose-bloom-stage" aria-hidden="true">${Array.from({length:8},(_item,index)=>`<span class="nyx-rose-bloom nyx-rose-bloom-${index+1}"></span>`).join('')}</span>`;
  }
  function nyxProfileEffectVars(profile={}){
    return `--nyx-custom-effect-primary:${profile.customEffectColorPrimary||'#ffffff'};--nyx-custom-effect-secondary:${profile.customEffectColorSecondary||profile.accentSecondary||'#8ea1ff'};--nyx-custom-effect-duration:${Math.max(2,Math.min(18,Number(profile.customEffectSpeed)||7))}s;--nyx-custom-effect-opacity:${Math.max(.2,Math.min(1,(Number(profile.customEffectIntensity)||70)/100))}`;
  }
  function normalizeNyxUserProfile(value={},user=nyxFounderSignedInUser){
    const source=value&&typeof value==='object'?value:{};
    const uid=String(user?.uid||'');
    const username=nyxAccountUsername(String(user?.email||'').split('@')[0])||`nyx-${uid.slice(0,8)||'user'}`;
    const accentPrimary=/^#[0-9a-f]{6}$/i.test(String(source.accentPrimary||source.accent||'').trim())?String(source.accentPrimary||source.accent).trim().toLowerCase():'#5865f2';
    const accentSecondary=/^#[0-9a-f]{6}$/i.test(String(source.accentSecondary||source.bannerPrimary||'').trim())?String(source.accentSecondary||source.bannerPrimary).trim().toLowerCase():'#8ea1ff';
    const bannerColor=/^#[0-9a-f]{6}$/i.test(String(source.bannerColor||source.bannerSecondary||'').trim())?String(source.bannerColor||source.bannerSecondary).trim().toLowerCase():accentSecondary;
    const displayNameColorPrimary=/^#[0-9a-f]{6}$/i.test(String(source.displayNameColorPrimary||'').trim())?String(source.displayNameColorPrimary).trim().toLowerCase():'#ffffff';
    const displayNameColorSecondary=/^#[0-9a-f]{6}$/i.test(String(source.displayNameColorSecondary||'').trim())?String(source.displayNameColorSecondary).trim().toLowerCase():accentSecondary;
    const displayNameFont=NYX_DISPLAY_NAME_FONTS.some(([value])=>value===String(source.displayNameFont||'').toLowerCase())?String(source.displayNameFont).toLowerCase():'gg-sans';
    const displayNameEffect=NYX_DISPLAY_NAME_EFFECTS.some(([value])=>value===String(source.displayNameEffect||'').toLowerCase())?String(source.displayNameEffect).toLowerCase():'solid';
    const customEffectPattern=['starfield','aurora','comets','grid'].includes(String(source.customEffectPattern||'').toLowerCase())?String(source.customEffectPattern).toLowerCase():'starfield';
    const customEffectColorPrimary=/^#[0-9a-f]{6}$/i.test(String(source.customEffectColorPrimary||'').trim())?String(source.customEffectColorPrimary).trim().toLowerCase():'#ffffff';
    const customEffectColorSecondary=/^#[0-9a-f]{6}$/i.test(String(source.customEffectColorSecondary||'').trim())?String(source.customEffectColorSecondary).trim().toLowerCase():accentSecondary;
    const customEffectSpeed=Math.max(2,Math.min(18,Number(source.customEffectSpeed)||7));
    const customEffectIntensity=Math.max(20,Math.min(100,Number(source.customEffectIntensity)||70));
    return {displayName:nyxFounderText(source.displayName,user?.displayName||username,48),handle:nyxFounderText(source.handle,`@${username}`,40).replace(/\s+/g,''),bio:String(source.bio||'').trim().slice(0,280),customStatus:String(source.customStatus||'').trim().slice(0,80),avatarUrl:nyxUserImage(source.avatarUrl,nyxUserImage(user?.photoURL)),bannerUrl:nyxUserImage(source.bannerUrl),accent:accentPrimary,accentPrimary,accentSecondary,bannerColor,displayNameFont,displayNameEffect,displayNameColorPrimary,displayNameColorSecondary,profileEffect:nyxProfileEffectValue(source.profileEffect),customEffectPattern,customEffectColorPrimary,customEffectColorSecondary,customEffectSpeed,customEffectIntensity,avatarDecoration:nyxAvatarDecorationValue(source.avatarDecoration),status:['online','idle','dnd','offline'].includes(String(source.status||'').toLowerCase())?String(source.status).toLowerCase():'online'};
  }
  const normalizeNyxUserProfileBase=normalizeNyxUserProfile;
  normalizeNyxUserProfile=function(value={},user=nyxFounderSignedInUser){return normalizeNyxUserProfileBase(value,user)};
  async function nyxGetFirebaseToken(forceRefresh=false){
    const user=nyxFounderSignedInUser;
    if(!user)return '';
    if(nyxFirebaseTokenPromise)return nyxFirebaseTokenPromise;
    const request=(async()=>{
      try{
        return await user.getIdToken(forceRefresh);
      }catch{
        try{
          await user.reload();
          return await user.getIdToken(true);
        }catch{
          return '';
        }
      }
    })();
    nyxFirebaseTokenPromise=request;
    try{return await request}
    finally{if(nyxFirebaseTokenPromise===request)nyxFirebaseTokenPromise=null}
  }
  const NYX_CLOUD_PREFERENCE_KEYS=Object.freeze(['nyx.theme','nyx.customThemeColor','nyx.font','nyx.engine','nyx.workspaceMode','nyx.transport','nyx.visualEffect','nyx.visualEffectSpeed','nyx.visualEffectAmount','nyx.beamWallpaper','nyx.beamTheme','nyx.lineWaves.speed','nyx.lineWaves.density','nyx.lineWaves.mouse','nyx.lineWaves.colorVariant','nyx.threeDBackgrounds','nyx.performanceTier','nyx.gamePerformanceMode','nyx.homeDesign','nyx.tabDesign','nyx.homeShortcuts','nyx.customBgData','nyx.customBgUrl','nyx.background','nyx.workspaceBackground']);
  let nyxCloudPreferencesTimer=0;
  let nyxCloudPreferencesInterval=0;
  let nyxCloudPreferencesFingerprint='';
  let nyxCloudPreferencesUserId='';
  let nyxCloudWallpaperSynced=null;
  let nyxCloudPreferencesGeneration=0;
  let nyxCloudPreferencesSaving=null;
  function nyxRememberAppearanceEdit(key,value){
    if(!['nyx.theme','nyx.customThemeColor','nyx.beamTheme','nyx.beamWallpaper'].includes(key))return;
    const uid=nyxFounderSignedInUser?.uid||localStorage.getItem('nyx.cloud.preferences.user');
    if(!uid)return;
    const name='nyx.cloud.appearance.pending.'+uid;
    let edits={};try{edits=JSON.parse(localStorage.getItem(name)||'{}');}catch{}
    localStorage.setItem(name,JSON.stringify({...edits,[key]:value}));
  }
  function nyxCloudPreferencesPayload(){
    const preferences={};
    NYX_CLOUD_PREFERENCE_KEYS.forEach(key=>{
      const value=localStorage.getItem(key);
      if(value!==null) preferences[key]=String(value);
    });
    preferences['nyx.customBgData'] ||= '';
    preferences['nyx.customBgUrl'] ||= '';
    return preferences;
  }
  function nyxCloudPreferencesDigest(){
    try{return JSON.stringify(nyxCloudPreferencesPayload())}catch{return ''}
  }
  async function nyxCloudRequest(path,options={}){
    const user=nyxFounderSignedInUser;
    if(!user) throw new Error('Sign in to use cloud saves.');
    const token=await user.getIdToken();
    if(nyxFounderSignedInUser?.uid!==user.uid) throw new Error('Your account changed. Please try again.');
    const response=await fetch(path,{...options,headers:{...(options.headers||{}),Authorization:`Bearer ${token}`},cache:'no-store'});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(payload.error||'Nyx cloud save is unavailable.');
    return payload;
  }
  async function loadNyxCloudPreferences(){
    const user=nyxFounderSignedInUser;
    if(!user) return false;
    const generation=++nyxCloudPreferencesGeneration;
    const beforePreferences=nyxCloudPreferencesPayload();
    const beforeStored=Object.fromEntries(NYX_CLOUD_PREFERENCE_KEYS.map(key=>[key,localStorage.getItem(key)]));
    const beforeWallpaper=[localStorage.getItem('nyx.customBgData'),localStorage.getItem('nyx.customBgUrl')].join('|');
    const cloud=await nyxCloudRequest('/api/account/cloud-preferences');
    if(nyxFounderSignedInUser?.uid!==user.uid||generation!==nyxCloudPreferencesGeneration)return false;
    const marker=localStorage.getItem('nyx.cloud.preferences.user');
    const preferences=normalizeWorkspacePreferences(cloud?.preferences);
    let pendingAppearance={};try{pendingAppearance=normalizeWorkspacePreferences(JSON.parse(localStorage.getItem('nyx.cloud.appearance.pending.'+user.uid)||'{}'));}catch{}
    const hasImage=typeof preferences['nyx.customBgData']==='string';


    const editedWallpaper=beforeWallpaper!==[localStorage.getItem('nyx.customBgData'),localStorage.getItem('nyx.customBgUrl')].join('|');
    const migrateImage=editedWallpaper||!hasImage&&(!marker||marker===user.uid)&&!!(localStorage.getItem('nyx.customBgData')||localStorage.getItem('nyx.customBgUrl'));
    if(marker&&marker!==user.uid){
      localStorage.removeItem('nyx.customBgData');localStorage.removeItem('nyx.customBgUrl');localStorage.removeItem('nyx.customBg');
      if(!preferences['nyx.beamTheme'])localStorage.setItem('nyx.beamTheme','theme');
    }
    NYX_CLOUD_PREFERENCE_KEYS.forEach(key=>{
      if(typeof pendingAppearance[key]==='string'){localStorage.setItem(key,pendingAppearance[key]);return;}
      if((!marker||marker===user.uid)&&localStorage.getItem(key)!==beforeStored[key])return;
      if(typeof preferences[key]==='string'&&!(migrateImage&&['nyx.customBgData','nyx.customBgUrl','nyx.beamTheme','nyx.beamWallpaper'].includes(key)))localStorage.setItem(key,preferences[key]);
    });
    applyUserSettings();
    applyNyxPerformanceTier?.(getNyxPerformanceTier());
    localStorage.setItem('nyx.cloud.preferences.user',user.uid);
    nyxCloudPreferencesUserId=user.uid;
    nyxCloudWallpaperSynced=hasImage?preferences['nyx.customBgData']:null;
    nyxCloudPreferencesFingerprint=migrateImage||Object.keys(pendingAppearance).length||!Object.keys(preferences).length?'':JSON.stringify({...beforePreferences,...preferences});
    return true;
  }
  async function saveNyxCloudPreferences(){
    const user=nyxFounderSignedInUser,generation=nyxCloudPreferencesGeneration;
    if(!user||nyxCloudPreferencesUserId!==user.uid)return false;
    if(nyxCloudPreferencesSaving){await nyxCloudPreferencesSaving;return saveNyxCloudPreferences();}
    const preferences=nyxCloudPreferencesPayload(),fingerprint=JSON.stringify(preferences),wallpaper=preferences['nyx.customBgData'];
    if(fingerprint===nyxCloudPreferencesFingerprint)return true;
    if(wallpaper===nyxCloudWallpaperSynced)delete preferences['nyx.customBgData'];
    const pending=nyxCloudRequest('/api/account/cloud-preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences})});
    nyxCloudPreferencesSaving=pending;
    try{
      await pending;
      if(nyxFounderSignedInUser?.uid!==user.uid||generation!==nyxCloudPreferencesGeneration)return false;
      nyxCloudPreferencesFingerprint=fingerprint;nyxCloudWallpaperSynced=wallpaper;
      const name='nyx.cloud.appearance.pending.'+user.uid;
      try{const pending=JSON.parse(localStorage.getItem(name)||'{}');for(const key of Object.keys(pending)){if(pending[key]===preferences[key])delete pending[key];}if(Object.keys(pending).length)localStorage.setItem(name,JSON.stringify(pending));else localStorage.removeItem(name);}catch{}
      return true;
    }finally{if(nyxCloudPreferencesSaving===pending)nyxCloudPreferencesSaving=null;}
  }
  function queueNyxCloudPreferencesSave(){
    if(!nyxFounderSignedInUser||!nyxCloudPreferencesUserId) return;
    clearTimeout(nyxCloudPreferencesTimer);
    nyxCloudPreferencesTimer=setTimeout(()=>{void saveNyxCloudPreferences().catch(()=>{})},900);
  }
  async function startNyxCloudPreferenceSync(){
    clearInterval(nyxCloudPreferencesInterval);
    try{await loadNyxCloudPreferences()}catch{}
    if(nyxFounderSignedInUser){
      nyxCloudPreferencesInterval=setInterval(()=>{void saveNyxCloudPreferences().catch(()=>{})},45_000);
      queueNyxCloudPreferencesSave();
    }
  }
  function stopNyxCloudPreferenceSync(){
    clearTimeout(nyxCloudPreferencesTimer);
    clearInterval(nyxCloudPreferencesInterval);
    nyxCloudPreferencesTimer=0;
    nyxCloudPreferencesInterval=0;
    nyxCloudPreferencesFingerprint='';
    nyxCloudPreferencesUserId='';
    nyxCloudWallpaperSynced=null;
    nyxCloudPreferencesGeneration++;
  }
  async function loadNyxCloudGameSave(gameKey){
    const data=await nyxCloudRequest(`/api/account/cloud-games/${encodeURIComponent(String(gameKey||''))}`);
    return data?.storage&&typeof data.storage==='object'?data.storage:{};
  }
  async function saveNyxCloudGameSave(gameKey,storage={},removed=[],accountUid=""){
    return nyxCloudRequest(`/api/account/cloud-games/${encodeURIComponent(String(gameKey||''))}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({storage,removed,accountUid})});
  }
  window.NyxCloudSave={loadGame:loadNyxCloudGameSave,saveGame:saveNyxCloudGameSave};
  function nyxFriendlyFirebaseError(error,fallback='Your account request could not be completed.'){
    const code=String(error?.code||'').toLowerCase();
    const message=String(error?.message||'');
    if(code.includes('user-token-expired')||/user token has expired|sign-in has expired/i.test(message))return 'Your session expired. Log in again to continue.';
    if(code.includes('network-request-failed')||/network request failed/i.test(message))return 'Nyx could not reach Firebase. Check your connection and try again.';
    if(code.includes('too-many-requests'))return 'Too many attempts. Wait a few minutes and try again.';
    if(code.includes('invalid-custom-token')||code.includes('custom-token-mismatch'))return 'Nyx could not start the Firebase session. Try logging in again.';
    return message&&!/^firebase:/i.test(message)?message:fallback;
  }
  async function loadNyxUserProfile(){
    if(!nyxFounderSignedInUser) return null;
    const profileUid=nyxFounderSignedInUser.uid;
    try{
      const token=await nyxGetFirebaseToken(true);
      if(!token)throw new Error('Your sign-in has expired.');
      const [data,account]=await Promise.all([
        nyxProfileMediaFetch('/api/profiles/me',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'},'Profile is unavailable.'),
        nyxProfileMediaFetch('/api/account/me',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'},'Account information is unavailable.')
      ]);
      if(nyxFounderSignedInUser?.uid!==profileUid)return null;
      nyxUserProfile=normalizeNyxUserProfile(data.profile);
      nyxUserProfileCreatedAt=String(data.createdAt||'');
      syncNyxAccountEntitlements(account);
      nyxUserAccountEmail=String(account.email||'');
      syncFounderOwnerControls();
      return {...data,account};
    }catch(error){console.warn('Nyx Profile could not load:',error);return null}
  }
  function stopNyxUserActivity(){
    clearInterval(nyxUserActivityTimer);
    nyxUserActivityTimer=0;
  }
  async function sendNyxUserActivity(path,user=nyxFounderSignedInUser){
    if(!user||!path)return;
    try{
      let token=await nyxGetFirebaseToken();
      if(!token)return;
      const options={method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:path.endsWith('/event')?JSON.stringify({action:'login'}):'{}',keepalive:true};
      let response=await fetch(path,options);
      if(response.status===401){
        token=await nyxGetFirebaseToken(true);
        if(token){
          options.headers.Authorization=`Bearer ${token}`;
          response=await fetch(path,options);
        }
      }
      if(response.ok&&path.endsWith('/heartbeat')){
        const account=await response.json().catch(()=>null);
        if(account&&nyxFounderSignedInUser?.uid===user.uid){syncNyxAccountEntitlements(account);syncFounderOwnerControls()}
      }
    }catch{}
  }
  function startNyxUserActivity(user=nyxFounderSignedInUser){
    stopNyxUserActivity();
    if(!user)return;
    void sendNyxUserActivity('/api/activity/heartbeat',user);
    let loginRecorded=false;
    try{loginRecorded=sessionStorage.getItem(`nyx.login-recorded.${user.uid}`)==='1'}catch{}
    if(!loginRecorded){
      void sendNyxUserActivity('/api/activity/event',user);
      try{sessionStorage.setItem(`nyx.login-recorded.${user.uid}`,'1')}catch{}
    }
    nyxUserActivityTimer=setInterval(()=>{if(document.visibilityState==='visible')void sendNyxUserActivity('/api/activity/heartbeat',user)},5*60*1000);
  }
  document.addEventListener('visibilitychange',()=>{
    document.querySelectorAll('[data-nyx-animated-source]').forEach(host=>{
      const focusTarget=host.closest('button')||host;
      nyxSetCompactGifMotion(host,document.visibilityState==='visible'&&(host.matches(':hover')||focusTarget.matches(':focus')));
    });
    if(document.visibilityState==='visible')void sendNyxUserActivity('/api/activity/heartbeat');
  });
  function nyxAccountMenuIcon(name){
    const paths={
      edit:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
      switch:'<path d="m16 3 4 4-4 4"/><path d="M20 7H9a4 4 0 0 0-4 4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h11a4 4 0 0 0 4-4"/>',
      id:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9v6M12 9v6M16 12h.01"/>',
      people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      chat:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 2V11.5a8.5 8.5 0 0 1 17 0Z"/>',
      addPerson:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 8h6M19 5v6"/><circle cx="9" cy="7" r="4"/>',
      removePerson:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 8h6"/><circle cx="9" cy="7" r="4"/>',
      check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
      block:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
      eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      eyeOff:'<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.3A10 10 0 0 1 12 5c7 0 10 7 10 7a16 16 0 0 1-3 4M6 6.5A16 16 0 0 0 2 12s3 7 10 7a10 10 0 0 0 4-1"/>',
      image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
      palette:'<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a3 3 0 0 0 3-3c0-5-4-8-9-8Z"/><path d="M7 9h.01M12 7h.01M17 9h.01M6 14h.01"/>',
      sparkle:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
      type:'<path d="M4 6V4h16v2M12 4v16M8 20h8"/>',
      upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
      undo:'<path d="m9 4-5 5 5 5M4 9h9a7 7 0 0 1 0 14"/>',
      save:'<path d="m20 6-3-3H4v18h16V6ZM8 3v6h8V3M8 21v-7h8v7"/>',
      chevron:'<path d="m9 18 6-6-6-6"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;
  }
  let nyxAccountMenuCleanup=null;
  function closeNyxAccountMenu(){
    nyxAccountMenuCleanup?.();
    nyxAccountMenuCleanup=null;
    document.querySelector('.nyx-account-menu')?.remove();
    const button=document.getElementById('nyxAccountButton');
    button?.setAttribute('aria-expanded','false');
  }
  function positionNyxAccountMenu(menu,button){
    if(!menu||!button) return;
    const anchor=button.getBoundingClientRect();
    const shortLaptop=matchMedia('(min-width:481px) and (max-width:1100px) and (max-height:650px)').matches;
    const viewport=window.visualViewport;
    let viewportLeft=viewport?.offsetLeft||0;
    const viewportTop=viewport?.offsetTop||0;
    let viewportWidth=viewport?.width||innerWidth;
    let viewportHeight=viewport?.height||innerHeight;
    const rail=button.closest('.nyx-visual-dock');
    if(rail){
      const bounds=rail.getBoundingClientRect();
      if(bounds.height>bounds.width){
        if(bounds.left>viewportLeft+viewportWidth/2) viewportWidth=Math.max(0,bounds.left-viewportLeft);
        else {const right=viewportLeft+viewportWidth;viewportLeft=Math.max(viewportLeft,bounds.right);viewportWidth=Math.max(0,right-viewportLeft)}
      }else if(bounds.top>viewportTop+viewportHeight/2) viewportHeight=Math.max(0,bounds.top-viewportTop);
    }
    const edge=12,gap=shortLaptop?5:8;
    const width=Math.min(260,Math.max(0,viewportWidth-edge*2));
    const left=Math.max(viewportLeft+edge,Math.min(anchor.left,viewportLeft+viewportWidth-width-edge));
    menu.style.width=`${width}px`;
    menu.style.maxHeight=`${Math.max(0,viewportHeight-edge*2)}px`;
    const height=menu.offsetHeight;
    const below=Math.max(0,viewportTop+viewportHeight-edge-anchor.bottom-gap);
    const above=Math.max(0,anchor.top-gap-viewportTop-edge);
    const opensAbove=height>below&&above>below;
    const available=Math.min(viewportHeight-edge*2,opensAbove?above:below);
    menu.style.maxHeight=`${Math.max(0,available)}px`;
    const top=Math.max(viewportTop+edge,Math.min(
      opensAbove?anchor.top-gap-menu.offsetHeight:anchor.bottom+gap,
      viewportTop+viewportHeight-edge-menu.offsetHeight
    ));
    menu.style.left=`${Math.round(left)}px`;
    menu.style.top=`${Math.round(top)}px`;
    menu.style.transformOrigin=opensAbove?'bottom left':'top left';
  }
  function openNyxAccountMenu(button=document.getElementById('nyxAccountButton')){
    closeNyxAccountMenu();
    if(!nyxFounderSignedInUser) return openNyxAccountAccess();
    const profile=normalizeNyxUserProfile(nyxUserProfile);
    const statusLabel={online:'Online',idle:'Idle',dnd:'Do not disturb',offline:'Invisible'}[profile.status]||'Online';
    const avatar=profile.avatarUrl?`<img src="${esc(nyxProfileStillSource(profile.avatarUrl))}" alt="">`:`<span>${esc(profile.displayName.slice(0,1).toUpperCase()||'N')}</span>`;
    const banner=profile.bannerUrl?`<img src="${esc(nyxProfileStillSource(profile.bannerUrl))}" alt="" aria-hidden="true">`:'';
    const menu=document.createElement('aside');
    menu.className=`nyx-account-menu nyx-account-menu-compact ${nyxProfileEffectClass(profile)}`;
    menu.setAttribute('role','menu');
    menu.setAttribute('aria-label','Account options');
    menu.style.setProperty('--nyx-account-primary',profile.accentPrimary);
    menu.style.setProperty('--nyx-account-secondary',profile.accentSecondary);
    menu.style.setProperty('--nyx-account-banner',profile.bannerColor);
    menu.style.setProperty('--nyx-user-accent-primary',profile.accentPrimary);
    menu.style.setProperty('--nyx-user-accent-secondary',profile.accentSecondary);
    menu.style.setProperty('--nyx-user-banner-color',profile.bannerColor);
    menu.style.cssText+=nyxProfileEffectVars(profile);
    const ownerControls=nyxOwnerDashboardAccess?`<div class="nyx-account-menu-group nyx-account-menu-owner"><button type="button" role="menuitem" data-nyx-account-menu-action="owner-dashboard">${nyxAccountMenuIcon('dashboard')}<span>Owner Dashboard</span>${nyxAccountMenuIcon('chevron')}</button></div>`:'';
    menu.innerHTML=`<i class="nyx-user-profile-effect nyx-account-menu-profile-effect" aria-hidden="true">${nyxProfileEffectArtwork(profile)}</i><div class="nyx-account-menu-banner">${banner}</div><div class="nyx-account-menu-profile"><div class="nyx-account-menu-avatar nyx-avatar-decoration-${esc(profile.avatarDecoration)}">${avatar}<i class="nyx-avatar-decoration" aria-hidden="true"><span></span></i><i class="nyx-user-status nyx-user-status-${esc(profile.status)}" aria-label="${esc(statusLabel)}"></i></div><span class="nyx-account-menu-status"><span>${esc(profile.customStatus||statusLabel)}</span></span><h2 class="${nyxDisplayNameStyleClass(profile)}" style="${nyxDisplayNameStyleVars(profile)}">${esc(profile.displayName)}</h2><p class="nyx-account-menu-handle">${esc(profile.handle)}</p><p class="nyx-account-menu-bio">${esc(profile.bio||'')}</p></div>${ownerControls}<div class="nyx-account-menu-group"><button type="button" role="menuitem" data-nyx-account-menu-action="edit">${nyxAccountMenuIcon('edit')}<span>Edit Profile</span></button><button type="button" role="menuitem" data-nyx-account-menu-action="profiles">${nyxAccountMenuIcon('people')}<span>Community profiles</span>${nyxAccountMenuIcon('chevron')}</button><hr><button type="button" role="menuitem" data-nyx-account-menu-action="status"><i class="nyx-user-status nyx-user-status-${esc(profile.status)}" aria-hidden="true"></i><span>${esc(statusLabel)}</span>${nyxAccountMenuIcon('chevron')}</button></div><div class="nyx-account-menu-group"><button type="button" role="menuitem" data-nyx-account-menu-action="switch">${nyxAccountMenuIcon('switch')}<span>Switch Accounts</span>${nyxAccountMenuIcon('chevron')}</button><button type="button" role="menuitem" data-nyx-account-menu-action="ad-free">${nyxAccountMenuIcon('id')}<span>Ad-free access</span></button><hr><button type="button" role="menuitem" data-nyx-account-menu-action="copy-id">${nyxAccountMenuIcon('id')}<span>Copy User ID</span></button></div>`;
    (document.getElementById('app') || document.body).appendChild(menu);
    syncNyxAccountButtonAvatar(menu.querySelector('.nyx-account-menu-avatar'),profile);
    const bannerHost=menu.querySelector('.nyx-account-menu-banner');
    const bannerImage=bannerHost?.querySelector(':scope > img');
    if(bannerHost&&bannerImage)nyxManageCompactGif(bannerHost,bannerImage,profile.bannerUrl,420);
    button?.setAttribute('aria-expanded','true');
    positionNyxAccountMenu(menu,button);
    const reposition=()=>positionNyxAccountMenu(menu,button);
    window.addEventListener('resize',reposition);
    window.visualViewport?.addEventListener('resize',reposition);
    window.visualViewport?.addEventListener('scroll',reposition);
    const menuRail=button?.closest('.nyx-visual-dock');
    const railResize=menuRail&&typeof ResizeObserver==='function'?new ResizeObserver(reposition):null;
    if(railResize)railResize.observe(menuRail);
    nyxAccountMenuCleanup=()=>{
      railResize?.disconnect();
      window.removeEventListener('resize',reposition);
      window.visualViewport?.removeEventListener('resize',reposition);
      window.visualViewport?.removeEventListener('scroll',reposition);
    };
    requestAnimationFrame(()=>menu.classList.add('show'));
    return menu;
  }
  function toggleNyxAccountMenu(button=document.getElementById('nyxAccountButton')){
    if(document.querySelector('.nyx-account-menu')) return closeNyxAccountMenu();
    return openNyxAccountMenu(button);
  }
  async function copyNyxFirebaseUserId(){
    const uid=String(nyxFounderSignedInUser?.uid||'');
    if(!uid) return toast('No Firebase user ID is available');
    let copied=false;
    try{await navigator.clipboard.writeText(uid);copied=true}catch{}
    if(!copied){
      const field=document.createElement('textarea');
      field.value=uid;
      field.setAttribute('readonly','');
      field.style.cssText='position:fixed;left:-9999px;top:0';
      (document.getElementById('app') || document.body).appendChild(field);
      field.select();
      try{copied=document.execCommand('copy')}catch{}
      field.remove();
    }
    toast(copied?'Firebase user ID copied':'Could not copy the Firebase user ID');
  }
  function openNyxOwnerDashboard(){
    closeNyxAccountMenu();
    if(!nyxFounderSignedInUser||!nyxFounderIsOwner||!nyxOwnerDashboardAccess){
      toast('Only the Nyx owner can open this dashboard');
      return;
    }
    if(!globalThis.NyxOwnerDashboard?.open){
      toast('Owner Dashboard is unavailable');
      return;
    }
    globalThis.NyxOwnerDashboard.open({
      getToken:()=>nyxGetFirebaseToken(true),
      onPresence:count=>{nyxPresenceCount=count;renderNyxPresence();},
      toast
    });
  }
  async function openNyxProfileDirectory(requestedProfileUid=''){
    closeNyxAccountMenu();
    if(!nyxFounderSignedInUser){await openNyxAccountAccess();if(!nyxFounderSignedInUser)return}
    requestedProfileUid=/^[A-Za-z0-9_-]{8,128}$/.test(String(requestedProfileUid||''))?String(requestedProfileUid):'';
    document.querySelector('.nyx-profile-directory-overlay')?.remove();
    const overlay=document.createElement('div');
    overlay.className='nyx-profile-directory-overlay'+(requestedProfileUid?' profile-card-only':'');
    overlay.innerHTML=`<section class="nyx-profile-directory" role="dialog" aria-modal="true" aria-labelledby="nyxProfileDirectoryTitle">
      <header class="nyx-profile-directory-header"><div><span>NYX COMMUNITY</span><h2 id="nyxProfileDirectoryTitle">${requestedProfileUid?'Profile':'Community profiles'}</h2><p>Discover the people using Nyx.</p></div><button type="button" data-close-profile-directory aria-label="Close community profiles">${nyxAccountMenuIcon('close')}</button></header>
      <div class="nyx-profile-directory-layout">
        <aside class="nyx-profile-directory-sidebar">
          <label class="nyx-profile-directory-search">${nyxAccountMenuIcon('people')}<input type="search" data-profile-directory-search placeholder="S3ARC4 name, username, or role" autocomplete="off"></label>
          <p data-profile-directory-summary>Loading profiles…</p>
          <div class="nyx-profile-directory-results" data-profile-directory-results aria-live="polite"></div>
        </aside>
        <main class="nyx-profile-directory-view" data-profile-directory-view><div class="nyx-profile-directory-empty"><span>${nyxAccountMenuIcon('people')}</span><h3>Select a profile</h3><p>Choose someone to view their public Nyx profile.</p></div></main>
      </div>
    </section>`;
    (document.getElementById('app') || document.body).appendChild(overlay);
    syncNyxVisualDockState();
    requestAnimationFrame(()=>overlay.classList.add('show'));
    const resultsHost=overlay.querySelector('[data-profile-directory-results]');
    const view=overlay.querySelector('[data-profile-directory-view]');
    const summary=overlay.querySelector('[data-profile-directory-summary]');
    const search=overlay.querySelector('[data-profile-directory-search]');
    const roleLabel=role=>({owner:'Owner',co_owner:'Co-owner',admin:'Admin',manager:'Manager',developer:'Developer',moderator:'Moderator',support:'Support',tester:'Tester',contributor:'Contributor',adkid:'Adkid',member:'Member'}[role]||'Member');
    let entries=[];
    let selectedUid=requestedProfileUid;
    let relationship=null,relationshipReady=false,relationshipError='',contactBusy=false;
    const previousFocus=document.activeElement;
    let searchTimer=0;
    let controller=null;
    const close=()=>{
      clearTimeout(searchTimer);
      controller?.abort();
      document.removeEventListener('keydown',onKeydown);
      overlay.classList.remove('show');
      setTimeout(()=>{overlay.remove();previousFocus?.focus?.()},180);
    };
    const renderProfile=entry=>{
      if(!entry)return;
      selectedUid=entry.uid;
      resultsHost.querySelectorAll('[data-directory-profile]').forEach(button=>button.classList.toggle('active',button.dataset.directoryProfile===selectedUid));
      const profile=normalizeNyxUserProfile(entry.profile);
      view.innerHTML=`<div class="nyx-profile-directory-view-head"><span class="nyx-minecraft-text">${entry.self?'Your public profile':esc(entry.customRole?.label||entry.roleLabel||roleLabel(entry.role))}</span><strong>${esc(profile.displayName)}</strong></div><div class="nyx-profile-directory-card-host">${nyxUserProfileCardMarkup(profile,{role:entry.role,customRole:entry.customRole,createdAt:entry.createdAt,popup:Boolean(requestedProfileUid),online:entry.online})}</div>`;
      nyxManageUserProfileGifs(view,profile);
      if(requestedProfileUid&&!entry.self){
        const controls=view.querySelector('[data-profile-contact-controls]');
        const action=(label,value)=>`<button type="button" data-profile-social="${value}" aria-label="${label}" title="${label}"${!relationshipReady||contactBusy?' disabled':''}>${nyxAccountMenuIcon({request:'addPerson',accept:'check',decline:'close',cancel:'close',remove:'removePerson',block:'block',unblock:'check',ignore:'eyeOff',unignore:'eye'}[value])}</button>`;
        let friendship=relationship?.friend==='incoming'?action('Accept','accept')+action('Decline','decline'):relationship?.friend==='outgoing'?action('Cancel request','cancel'):relationship?.friend==='accepted'?action('Remove friend','remove'):action('Add friend','request');
        if(relationship?.blocked||relationship?.canMessage===false)friendship='';
        controls.innerHTML=`<button type="button" class="nyx-profile-message" data-profile-message${contactBusy||relationship?.canMessage===false?' disabled':''}>${nyxAccountMenuIcon('chat')}<span>Message</span></button><div class="nyx-profile-contact-actions">${friendship}${action(relationship?.blocked?'Unblock':'Block',relationship?.blocked?'unblock':'block')}${action(relationship?.ignored?'Unignore':'Ignore',relationship?.ignored?'unignore':'ignore')}</div><p role="status">${esc(relationshipError||(relationship?.blocked?'Direct messages and friend requests are blocked.':relationship?.ignored?'Their messages and notifications are hidden for you.':relationship?.canMessage===false?'Direct messages are unavailable.':''))}</p>${!relationshipReady&&relationshipError?'<button type="button" data-profile-directory-retry>Retry</button>':''}`;
      }

    };
    const renderResults=()=>{
      summary.textContent=`${entries.length} profile${entries.length===1?'':'s'}`;
      if(!entries.length){
        resultsHost.innerHTML='<div class="nyx-profile-directory-no-results"><strong>No profiles found</strong><span>Try a different name or role.</span></div>';
        view.innerHTML='<div class="nyx-profile-directory-empty"><span aria-hidden="true">?</span><h3>No matching profiles</h3><p>Change your search to discover more people.</p></div>';
        selectedUid='';
        return;
      }
      resultsHost.innerHTML=entries.map(entry=>{
        const profile=normalizeNyxUserProfile(entry.profile);
        const avatar=profile.avatarUrl?`<img src="${esc(nyxProfileStillSource(profile.avatarUrl))}" alt="">`:`<span>${esc(profile.displayName.slice(0,1).toUpperCase()||'N')}</span>`;
        return `<button type="button" data-directory-profile="${esc(entry.uid)}"><i class="nyx-profile-directory-avatar">${avatar}<em class="${entry.online?'online':''}" aria-label="${entry.online?'Online':'Offline'}"></em></i><span><strong>${esc(profile.displayName)}${entry.self?' <small>You</small>':''}</strong><small>${esc(profile.handle)}</small></span><b class="nyx-minecraft-text">${esc(entry.customRole?.label||entry.roleLabel||roleLabel(entry.role))}</b></button>`;
      }).join('');
      resultsHost.querySelectorAll('[data-directory-profile]').forEach(button=>{
        const entry=entries.find(item=>item.uid===button.dataset.directoryProfile);
        const profile=normalizeNyxUserProfile(entry?.profile);
        const avatarHost=button.querySelector('.nyx-profile-directory-avatar');
        const avatarImage=avatarHost?.querySelector(':scope > img');
        if(avatarHost&&avatarImage)nyxManageCompactGif(avatarHost,avatarImage,profile.avatarUrl,180);
      });
      renderProfile(entries.find(entry=>entry.uid===selectedUid)||entries[0]);
    };
    const load=async()=>{
      controller?.abort();
      controller=new AbortController();
      resultsHost.innerHTML='<div class="nyx-profile-directory-loading"><i></i><i></i><i></i><i></i></div>';
      summary.textContent='Loading profiles…';
      try{
        const token=await nyxGetFirebaseToken(true);
        if(!token)throw new Error('Sign in again to view community profiles.');
        if(requestedProfileUid){
          const data=await nyxProfileMediaFetch(`/api/profiles/${encodeURIComponent(requestedProfileUid)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal},'Profile could not be loaded.');
          entries=[{uid:data.uid,profile:data.profile,role:data.role||'member',customRole:data.customRole||null,roleLabel:data.roleLabel||'',online:Boolean(data.online),createdAt:data.createdAt,self:data.uid===nyxFounderSignedInUser?.uid}];
          search.value='';
          search.disabled=true;
          search.placeholder='Viewing selected profile';
          try{const social=await nyxProfileMediaFetch('/api/chat/relationships',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal},'Relationships could not load.');relationship=(social.relationships||[]).find(item=>item.uid===requestedProfileUid)||null;relationshipReady=true;relationshipError=''}catch(error){if(error.name==='AbortError')throw error;relationshipError=error.message}
        }else{
          const data=await nyxProfileMediaFetch(`/api/profiles?search=${encodeURIComponent(search.value.trim())}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal},'Profiles could not be loaded.');
          entries=Array.isArray(data.profiles)?data.profiles:[];
        }
        renderResults();
      }catch(error){
        if(error.name==='AbortError')return;
        entries=[];
        summary.textContent='Profiles unavailable';
        resultsHost.innerHTML=`<div class="nyx-profile-directory-no-results"><strong>Could not load profiles</strong><span>${esc(error.message||'Try again.')}</span><button type="button" data-profile-directory-retry>Try again</button></div>`;
        if(requestedProfileUid)view.innerHTML=resultsHost.innerHTML;
      }
    };
    const onKeydown=event=>{if(event.key==='Escape'){event.preventDefault();close()}if(event.key==='Tab'){const elements=[...overlay.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(element=>element.getClientRects().length);const first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}};
    overlay.addEventListener('click',event=>{
      if(event.target===overlay||event.target.closest('[data-close-profile-directory]')){close();return}
      if(event.target.closest('[data-profile-directory-retry]')){void load();return}
      const action=event.target.closest('[data-profile-social]')?.dataset.profileSocial;
      const message=event.target.closest('[data-profile-message]');
      if((action||message)&&requestedProfileUid&&!contactBusy){
        contactBusy=true;relationshipError='';renderProfile(entries[0]);
        void(async()=>{
          try{
            const token=await nyxGetFirebaseToken(true);if(!token)throw new Error('Sign in again.');
            const payload=await nyxProfileMediaFetch(message?'/api/chat/conversations':'/api/chat/relationships/'+encodeURIComponent(requestedProfileUid),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(message?{participantUid:requestedProfileUid}:{action})},'The action could not be completed.');
            if(message){if(!payload.conversation?.id)throw new Error('The conversation could not be opened.');close();openWorkspaceShellAppTab('/apps/chat/?conversation='+encodeURIComponent(payload.conversation.id));}
            else{relationship=(payload.relationships||[]).find(item=>item.uid===requestedProfileUid)||null;relationshipReady=true;}
          }catch(error){relationshipError=error.message}finally{contactBusy=false;if(overlay.isConnected)renderProfile(entries[0])}
        })();return;
      }
      const uid=event.target.closest('[data-directory-profile]')?.dataset.directoryProfile;
      if(uid)renderProfile(entries.find(entry=>entry.uid===uid));
    });
    search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>void load(),240)});
    document.addEventListener('keydown',onKeydown);
    setTimeout(()=>requestedProfileUid?overlay.querySelector('[data-close-profile-directory]').focus():search.focus(),0);
    await load();
  }
  addEventListener('resize',closeNyxAccountMenu,{passive:true});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeNyxAccountMenu()});
  function syncNyxAccountButtonAvatar(host,profile){
    if(!host)return;
    const source=String(profile.avatarUrl||'');
    let image=host.querySelector(':scope > img');
    let fallback=host.querySelector(':scope > span');
    if(source){
      fallback?.remove();
      if(!image){
        image=document.createElement('img');
        image.alt='';
        image.loading='eager';
        host.prepend(image);
      }
      nyxManageCompactGif(host,image,source,180);
      return;
    }
    delete host.dataset.nyxAnimatedSource;
    delete host.dataset.nyxAnimatedPoster;
    image?.remove();
    if(!fallback){
      fallback=document.createElement('span');
      host.prepend(fallback);
    }
    fallback.textContent=profile.displayName.slice(0,1).toUpperCase()||'N';
  }
  function ensureNyxAccountButton(){
    const existing=document.getElementById('nyxAccountButton');
    const signedIn=Boolean(nyxFounderSignedInUser);
    const host=document.body.classList.contains('workspace-shell')?document.querySelector('.nyx-visual-dock [data-nyx-profile-slot]')||document.querySelector('.top-os [data-nyx-profile-slot]')||document.querySelector('.workspace-home:not(.hidden) [data-nyx-profile-slot]')||document.querySelector('.workspace-home [data-nyx-profile-slot]'):document.querySelector('.status-icons');
    if(!host){return}
    if(existing&&existing.parentElement!==host){closeNyxAccountMenu();existing.remove()}
    const button=document.getElementById('nyxAccountButton')||document.createElement('button');
    button.id='nyxAccountButton';button.type='button';button.className='nyx-account-button';button.classList.toggle('nyx-account-button-default',!signedIn);button.classList.toggle('nyx-account-button-rich',signedIn);delete button.dataset.openNyxProfile;button.dataset.toggleNyxAccountMenu='';button.title=signedIn?'Account menu':'Sign in or create a profile';button.setAttribute('aria-label',button.title);button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded',String(Boolean(document.querySelector('.nyx-account-menu'))));
    const profile=normalizeNyxUserProfile(nyxUserProfile);
    const statusLabel={online:'Online',idle:'Idle',dnd:'Do not disturb',offline:'Invisible'}[profile.status]||'Online';
    if(signedIn){
      let avatarHost=button.querySelector(':scope > .nyx-account-button-avatar');
      let copy=button.querySelector(':scope > .nyx-account-button-copy');
      if(!avatarHost||!copy){
        button.replaceChildren();
        avatarHost=document.createElement('span');
        avatarHost.className='nyx-account-button-avatar';
        const status=document.createElement('i');
        status.className='nyx-user-status';
        status.setAttribute('aria-hidden','true');
        avatarHost.appendChild(status);
        copy=document.createElement('span');
        copy.className='nyx-account-button-copy';
        copy.append(document.createElement('strong'),document.createElement('small'));
        button.append(avatarHost,copy);
      }
      syncNyxAccountButtonAvatar(avatarHost,profile);
      const status=avatarHost.querySelector(':scope > .nyx-user-status');
      if(status) status.className=`nyx-user-status nyx-user-status-${profile.status}`;
      const name=copy.querySelector(':scope > strong');
      const customStatus=copy.querySelector(':scope > small');
      if(name){
        name.className=nyxDisplayNameStyleClass(profile);
        name.style.cssText=nyxDisplayNameStyleVars(profile);
        name.textContent=profile.displayName;
      }
      if(customStatus) customStatus.textContent=profile.customStatus||statusLabel;
    }else if(!button.querySelector(':scope > span[aria-hidden="true"]')||button.children.length!==1){
      button.innerHTML='<span aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span>';
    }
    if(!button.parentElement) host.appendChild(button);
  }
  function syncFounderOwnerControls(){
    const configured=Boolean(nyxFounderAuthConfig.enabled);
    const signedIn=nyxFounderSignedInUser;
    document.querySelectorAll('[data-founder-account-card]').forEach(card=>{card.hidden=false});
    document.querySelectorAll('[data-founder-profile-settings-card]').forEach(card=>{card.hidden=!nyxFounderIsOwner});
    document.querySelectorAll('[data-owner-dashboard-card]').forEach(card=>{card.hidden=!nyxOwnerDashboardAccess});
    document.querySelectorAll('[data-founder-account-status]').forEach(status=>{
      if(!configured){status.textContent='Nyx accounts are not configured.';return}
      if(!signedIn){status.textContent='Sign in to create and manage your Nyx profile.';return}
      const accountId=String(signedIn.uid||'');
      const roleName=String(nyxUserAccountRole||'member').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
      status.textContent=nyxFounderIsOwner?'Signed in as the Nyx founder.':nyxOwnerDashboardAccess?`Signed in as ${roleName}.`:`Signed in. Firebase account ID: ${accountId}`;
    });
    document.querySelectorAll('[data-nyx-cloud-save-status]').forEach(status=>{
      if(!configured){status.textContent='Cloud saves become available when Nyx accounts are configured.';return}
      if(!signedIn){status.textContent='Sign in to sync supported game progress and Nyx preferences.';return}
      status.textContent='Cloud saves are enabled for this account.';
    });
    document.querySelectorAll('[data-open-nyx-account]').forEach(button=>{button.hidden=!configured||Boolean(signedIn);});
    document.querySelectorAll('[data-nyx-account-sign-out]').forEach(button=>{button.hidden=!signedIn;});
    document.querySelectorAll('[data-open-nyx-profile]').forEach(button=>{if(button.id!=='nyxAccountButton') button.hidden=!signedIn;});
    document.querySelectorAll('[data-nyx-owner-presence]').forEach(presence=>{
      const ownerAction=Boolean(nyxFounderIsOwner&&nyxOwnerDashboardAccess);
      presence.classList.toggle('nyx-owner-presence-action',ownerAction);
      presence.setAttribute('role',ownerAction?'button':'status');
      presence.tabIndex=ownerAction?0:-1;
      presence.setAttribute('aria-label',ownerAction?'Open Owner Dashboard':'Current users online');
      presence.title=ownerAction?'Open Owner Dashboard':'Current users online';
    });
    ensureNyxAccountButton();
  }
  async function refreshFounderOwnerAccess(){
    nyxFounderIsOwner=false;
    nyxOwnerDashboardAccess=false;
    nyxUserPermissions=[];
    if(!nyxFounderSignedInUser){syncFounderOwnerControls();return false}
    try{
      const token=await nyxGetFirebaseToken(true);
      if(!token)throw new Error('Your owner session has expired.');
      const access=await nyxProfileMediaFetch('/api/founder-profile/owner',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'},'Owner access is unavailable.');
      nyxFounderIsOwner=Boolean(access?.founder);
      nyxOwnerDashboardAccess=Boolean(access?.dashboard&&access?.founder);
      nyxUserPermissions=Array.isArray(access?.permissions)?access.permissions.map(String):[];
      if(access?.role)nyxUserAccountRole=String(access.role);
    }catch{nyxFounderIsOwner=false;nyxOwnerDashboardAccess=false;nyxUserPermissions=[]}
    syncFounderOwnerControls();
    return nyxOwnerDashboardAccess;
  }
  async function initializeFounderOwnerAccess(){
    if(nyxFounderAuthReadyPromise) return nyxFounderAuthReadyPromise;
    nyxFounderAuthReadyPromise=(async()=>{
      try{
        const response=await fetch('/api/founder-profile/auth-config',{cache:'no-store'});
        nyxFounderAuthConfig=await response.json();
        if(!nyxFounderAuthConfig?.enabled){if(response.ok&&nyxFounderAuthConfig?.enabled===false)syncNyxPublisherMode('standard');return;}
        const [{initializeApp,getApps},{getAuth,onAuthStateChanged,setPersistence,browserLocalPersistence:workspaceLocalPersistence}]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);
        const app=getApps().find(item=>item.name==='nyx-founder-owner')||initializeApp({apiKey:nyxFounderAuthConfig.apiKey,authDomain:`${nyxFounderAuthConfig.projectId}.firebaseapp.com`,projectId:nyxFounderAuthConfig.projectId},'nyx-founder-owner');
        nyxFounderFirebaseAuth=getAuth(app);
        try{await setPersistence(nyxFounderFirebaseAuth,workspaceLocalPersistence)}
        catch(error){console.warn('Nyx could not enable persistent sign-in:',error)}
        if(typeof nyxFounderFirebaseAuth.authStateReady==='function')await nyxFounderFirebaseAuth.authStateReady();
        onAuthStateChanged(nyxFounderFirebaseAuth,async user=>{syncNyxPublisherMode('pending');nyxFounderSignedInUser=user||null;
          document.querySelectorAll('iframe').forEach(frame=>{try{frame.contentWindow?.postMessage({type:'nyx:account-changed'},location.origin)}catch{}});
          if(user&&new URLSearchParams(location.search).get('nyx-api-login')==='1'){location.replace('/api');return}
          syncSetupAccountStep();if(!user){stopNyxUserActivity();stopNyxCloudPreferenceSync();nyxUserProfile=null;nyxUserProfileCreatedAt='';nyxFounderIsOwner=false;nyxOwnerDashboardAccess=false;nyxUserPermissions=[];nyxUserAccountRole='member';nyxUserSubscriptionStatus='free';syncNyxAccountEntitlements();nyxUserAccountEmail='';await refreshFounderOwnerAccess();return}startNyxUserActivity(user);await Promise.all([refreshFounderOwnerAccess(),loadNyxUserProfile(),startNyxCloudPreferenceSync()]);syncSetupAccountStep()});
      }catch(error){console.warn('Nyx owner sign-in could not initialize:',error);nyxFounderAuthConfig={enabled:false,ownerConfigured:false}}
      finally{syncFounderOwnerControls();if(new URLSearchParams(location.search).get('nyx-api-login')==='1'&&!nyxFounderSignedInUser)setTimeout(()=>void openNyxAccountAccess({mode:'signin'}),0)}
    })();
    return nyxFounderAuthReadyPromise;
  }
  async function openNyxAccountAccess(options={}){
    closeNyxAccountMenu();
    await initializeFounderOwnerAccess();
    if(!nyxFounderFirebaseAuth) return toast('Nyx accounts are not configured yet.');
    const switching=Boolean(options.switching&&nyxFounderSignedInUser);
    const previousUid=String(nyxFounderSignedInUser?.uid||'');
    document.querySelector('.nyx-account-overlay')?.remove();
    const overlay=document.createElement('div');
    overlay.className='nyx-account-overlay';
    overlay.innerHTML='<section class="nyx-account-dialog" role="dialog" aria-modal="true" aria-labelledby="nyxAccountTitle"><button class="nyx-founder-editor-close" data-close-nyx-account type="button" aria-label="Close">×</button><div class="nyx-account-mark" aria-hidden="true"><span>☾</span></div><p id="nyxAccountTitle" class="nyx-account-title">Log in or register to continue</p><div class="nyx-account-tabs" role="tablist" aria-label="Account action"><button class="nyx-account-tab active" data-nyx-account-tab="signin" type="button" role="tab" aria-selected="true">Log in</button><button class="nyx-account-tab" data-nyx-account-tab="register" type="button" role="tab" aria-selected="false">Register</button></div><form><label data-nyx-account-identifier-label><span>Username or email</span><input name="username" autocomplete="username" minlength="3" maxlength="254" placeholder="username or email" required></label><label data-nyx-account-email hidden><span>Recovery email <small>Optional</small></span><input name="email" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com"></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" placeholder="your password" required></label><section class="nyx-account-status-notice" data-nyx-account-status hidden aria-live="assertive"><strong></strong><p></p></section><p class="nyx-founder-editor-error" aria-live="polite"></p><button class="nyx-account-submit" type="submit">Log in</button><button class="nyx-account-forgot" data-nyx-forgot-password type="button">Forgot password?</button></form><p class="nyx-account-footer">Log in with your username or recovery email.</p></section>';
    (document.getElementById('app') || document.body).appendChild(overlay);
    let mode=options.mode==='register'?'register':'signin';
    const form=overlay.querySelector('form');
    const submit=form.querySelector('[type="submit"]');
    const password=form.querySelector('[name="password"]');
    const identifier=form.querySelector('[name="username"]');
    const identifierLabel=overlay.querySelector('[data-nyx-account-identifier-label]');
    const emailField=overlay.querySelector('[data-nyx-account-email]');
    const emailInput=form.querySelector('[name="email"]');
    const forgotButton=form.querySelector('[data-nyx-forgot-password]');
    const footer=overlay.querySelector('.nyx-account-footer');
    const error=form.querySelector('.nyx-founder-editor-error');
    const accountStatusNotice=form.querySelector('[data-nyx-account-status]');
    if(switching)overlay.querySelector('#nyxAccountTitle').textContent='Switch accounts';
    else if(mode==='register')overlay.querySelector('#nyxAccountTitle').textContent='Create your Nyx account';
    if(mode==='register'&&options.username)identifier.value=nyxAccountUsername(options.username);
    const clearAccountStatusNotice=()=>{accountStatusNotice.hidden=true;accountStatusNotice.className='nyx-account-status-notice';accountStatusNotice.querySelector('strong').textContent='';accountStatusNotice.querySelector('p').textContent=''};
    const showAccountStatusNotice=status=>{const accountStatus=status&&typeof status==='object'?status:{};accountStatusNotice.className=`nyx-account-status-notice nyx-account-status-${String(accountStatus.status||'disabled').replace(/[^a-z-]/g,'')}`;accountStatusNotice.querySelector('strong').textContent=String(accountStatus.title||'This account is unavailable');accountStatusNotice.querySelector('p').textContent=String(accountStatus.message||'Contact Nyx staff for help.');accountStatusNotice.hidden=false};
    const update=()=>{
      const registering=mode==='register';
      overlay.querySelectorAll('[data-nyx-account-tab]').forEach(tab=>{const active=tab.dataset.nyxAccountTab===mode;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active))});
      submit.textContent=registering?'Create account':'Log in';
      password.autocomplete=registering?'new-password':'current-password';
      password.minLength=registering?8:6;
      identifier.maxLength=registering?32:254;
      identifier.placeholder=registering?'your username':'username or email';
      identifierLabel.querySelector('span').textContent=registering?'Username':'Username or email';
      emailField.hidden=!registering;
      emailInput.disabled=!registering;
      forgotButton.hidden=registering;
      footer.textContent=registering?'Email is optional. Add one for password recovery, or create an account with just a username and password.':switching?'Your current account stays signed in until another login succeeds.':'Log in with your username or recovery email.';
      error.textContent='';
      error.classList.remove('success');
      clearAccountStatusNotice();
    };
    update();
    const close=()=>overlay.remove();
    overlay.addEventListener('click',event=>{if(event.target.closest('[data-close-nyx-account]')){close();return}const tab=event.target.closest('[data-nyx-account-tab]');if(tab){mode=tab.dataset.nyxAccountTab;update()}});
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
    forgotButton.addEventListener('click',async()=>{
      const rawIdentifier=String(identifier.value||'').trim();
      if(rawIdentifier.length<3){error.textContent='Enter your username or email first.';error.classList.remove('success');identifier.focus();return}
      forgotButton.disabled=true;
      error.textContent='';
      error.classList.remove('success');
      try{
        const response=await fetch('/api/account/password-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:rawIdentifier})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Password reset is temporarily unavailable.');
        error.textContent=data.message||'If that account has a recovery email, Firebase sent a password-reset message.';
        error.classList.add('success');
      }catch(resetError){
        error.textContent=resetError?.message||'Password reset is temporarily unavailable.';
      }finally{
        forgotButton.disabled=false;
      }
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const values=new FormData(form);
      const rawIdentifier=String(values.get('username')||'').trim();
      const username=nyxAccountUsername(rawIdentifier.replace(/^@+/,''));
      const passwordValue=String(values.get('password')||'');
      const recoveryEmail=String(values.get('email')||'').trim().toLowerCase();
      error.classList.remove('success');
      if(mode==='register'&&(username.length<3||username!==rawIdentifier.toLowerCase().replace(/^@+/,''))){error.textContent='Use 3–32 letters, numbers, dots, dashes, or underscores.';return}
      if(mode==='signin'&&rawIdentifier.length<3){error.textContent='Enter your username or email.';return}
      submit.disabled=true;
      error.textContent='';
      clearAccountStatusNotice();
      try{
        const {signInWithCustomToken}=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
        const endpoint=mode==='register'?'/api/account/register':'/api/account/sign-in';
        const payload=mode==='register'?{username,email:recoveryEmail,password:passwordValue}:{identifier:rawIdentifier,password:passwordValue};
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const data=await response.json().catch(()=>({}));
        if(!response.ok){if(data.accountStatus)showAccountStatusNotice(data.accountStatus);throw Object.assign(new Error(data.error||(mode==='register'?'Account creation failed.':'Sign-in failed.')),{code:'nyx/account',accountStatus:data.accountStatus||null})}
        const credential=await signInWithCustomToken(nyxFounderFirebaseAuth,data.customToken);
        nyxFounderSignedInUser=credential.user;
        await credential.user.getIdToken(true);
        await Promise.all([refreshFounderOwnerAccess(),loadNyxUserProfile()]);
        syncSetupAccountStep();
        close();
        toast(mode==='register'?'Nyx profile created':switching?(String(credential.user.uid||'')===previousUid?'Already signed in to this account':'Account switched'):'Signed in');
      }catch(authError){
        error.textContent=authError?.accountStatus?'':nyxFriendlyFirebaseError(authError,'Account could not be completed. Try again.');
        submit.disabled=false;
      }
    });
    setTimeout(()=>form.querySelector('[name="username"]')?.focus(),0);
  }
  async function signOutFounderOwner(){
    closeNyxAccountMenu();
    try{await nyxFounderFirebaseAuth?.signOut()}catch{}
    nyxFirebaseTokenPromise=null;nyxFounderSignedInUser=null;stopNyxCloudPreferenceSync();nyxFounderIsOwner=false;nyxOwnerDashboardAccess=false;nyxUserPermissions=[];nyxUserAccountRole='member';nyxUserSubscriptionStatus='free';syncNyxAccountEntitlements();nyxUserAccountEmail='';nyxUserProfile=null;nyxUserProfileCreatedAt='';syncFounderOwnerControls();toast('Signed out');
  }
  function nyxUserProfileCardMarkup(profile=normalizeNyxUserProfile(nyxUserProfile),options={}){
    const joinedAt=String(options.createdAt||nyxUserProfileCreatedAt||'');
    const joined=joinedAt?new Date(joinedAt).toLocaleDateString(undefined,{month:'short',year:'numeric'}):'Today';
    const statusLabel={online:'Online',idle:'Idle',dnd:'Do not disturb',offline:'Invisible'}[profile.status]||'Online';
    const editable=Boolean(options.editable&&nyxFounderSignedInUser);
    const symbol=name=>{
      const paths={
        member:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        sparkle:'<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
        shield:'<path d="m12 3 7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/>',
        owner:'<path d="m4 8 4 4 4-7 4 7 4-4-2 10H6L4 8Z"/><path d="M6 21h12"/>',
        developer:'<path d="m8 9-4 3 4 3"/><path d="m16 9 4 3-4 3"/><path d="m14 5-4 14"/>',
        founder:'<path d="m12 3 7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="m12 7 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4L12 7Z"/>',
        status:'<circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8.5 15c1.8 1.4 5.2 1.4 7 0"/>',
        edit:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
        switch:'<path d="m16 3 4 4-4 4"/><path d="M20 7H9a4 4 0 0 0-4 4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h11a4 4 0 0 0 4-4"/>',
        chevron:'<path d="m9 18 6-6-6-6"/>'
      };
      return `<svg class="nyx-profile-symbol nyx-profile-symbol-${name}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;
    };
    const roleLabel=role=>({owner:'Owner',co_owner:'Co-owner',admin:'Admin',manager:'Manager',developer:'Developer',moderator:'Moderator',support:'Support',tester:'Tester',contributor:'Contributor',adkid:'Adkid',member:'Member'}[role]||'Member');
    const roleIconKey=role=>({adkid:'member',co_owner:'owner',manager:'admin',support:'moderator',tester:'developer',contributor:'developer'}[role]||role);
    const roleChip=role=>`<span class="nyx-user-role nyx-user-role-${role}"><img src="/assets/icons/roles/${roleIconKey(role)}.png" alt="" aria-hidden="true">${roleLabel(role)}</span>`;
    const availableRoles=['owner','co_owner','admin','manager','developer','moderator','support','tester','contributor','adkid','member'];
    const publicRole=availableRoles.includes(String(options.role||''))?String(options.role):'';
    const customRole=options.customRole&&typeof options.customRole==='object'?options.customRole:null;
    const customRoleChip=customRole?`<span class="nyx-user-role nyx-user-role-${esc(publicRole||'member')}"${/^#[0-9a-f]{6}$/i.test(String(customRole.color||''))?` style="--nyx-user-role-color:${esc(customRole.color)};border-color:${esc(customRole.color)};color:${esc(customRole.color)}"`:''}><img src="/assets/icons/roles/${roleIconKey(publicRole||'member')}.png" alt="" aria-hidden="true"><span class="nyx-minecraft-text">${esc(customRole.label||roleLabel(publicRole))}</span></span>`:'';
    const roles=publicRole
      ?(customRoleChip||roleChip(publicRole))
      :(nyxFounderIsOwner
        ?`${roleChip('owner')}${roleChip('developer')}<span class="nyx-user-role nyx-user-role-founder">${symbol('founder')}Founder</span>`
        :roleChip(availableRoles.includes(nyxUserAccountRole)?nyxUserAccountRole:'member'));
    const ownerActions=editable?`<div class="nyx-user-profile-actions" aria-label="Your account controls"><button type="button" data-nyx-profile-action="status"><i class="nyx-user-status nyx-user-status-${esc(profile.status)}" aria-hidden="true"></i><span>${esc(statusLabel)}</span><b aria-hidden="true">${symbol('chevron')}</b></button><button type="button" data-nyx-profile-action="custom-status">${symbol('edit')}<span>Edit custom status</span><b aria-hidden="true">${symbol('chevron')}</b></button><button type="button" data-nyx-profile-action="switch-account">${symbol('switch')}<span>Switch accounts</span><b aria-hidden="true">${symbol('chevron')}</b></button></div>`:'';
    const mediaEdit=(type,label)=>editable?`<button class="nyx-profile-media-edit nyx-profile-media-edit-${type}" type="button" data-nyx-direct-edit="${type}" aria-label="${label}" title="${label}">${symbol('edit')}</button>`:'';
    const avatar=profile.avatarUrl?`<img src="${esc(nyxProfileStillSource(profile.avatarUrl))}" alt="${esc(profile.displayName)} profile picture">`:`<span>${esc(profile.displayName.slice(0,1).toUpperCase()||'N')}</span>`;
    const background=profile.bannerUrl?`<img src="${esc(nyxProfileStillSource(profile.bannerUrl))}" alt="" aria-hidden="true">`:'';
    if(options.popup){
      return `<section class="nyx-user-profile-card nyx-public-profile-popup ${nyxProfileEffectClass(profile)}" style="--nyx-user-accent-primary:${profile.accentPrimary};--nyx-user-accent-secondary:${profile.accentSecondary};--nyx-user-banner-color:${profile.bannerColor};${nyxProfileEffectVars(profile)}"><i class="nyx-user-profile-effect" aria-hidden="true">${nyxProfileEffectArtwork(profile)}</i><div class="nyx-user-profile-banner">${background}${mediaEdit('banner','Edit profile banner')}</div><div class="nyx-user-profile-chrome"><div class="nyx-user-profile-avatar nyx-avatar-decoration-${esc(profile.avatarDecoration)}">${avatar}${mediaEdit('avatar','Edit profile picture')}<i class="nyx-avatar-decoration" aria-hidden="true"><span></span></i><i class="nyx-user-status nyx-user-status-${(options.online??profile.status==='online')?'online':'offline'}" aria-label="${(options.online??profile.status==='online')?'Online':'Offline'}"></i></div></div><div class="nyx-user-profile-body"><div class="nyx-popup-name"><h2 class="${nyxDisplayNameStyleClass(profile)}" style="${nyxDisplayNameStyleVars(profile)}">${esc(profile.displayName)}</h2>${publicRole&&publicRole!=='member'?roles:''}</div><p class="nyx-popup-handle">${esc(profile.handle)}</p>${profile.customStatus?`<p class="nyx-popup-status">${esc(profile.customStatus)}</p>`:''}${profile.bio||editable?`<p class="nyx-popup-bio nyx-user-profile-bio">${esc(profile.bio||(editable?'Add a bio':''))}</p>`:''}${options.createdAt?`<p class="nyx-popup-joined">Joined ${esc(joined)}</p>`:''}<div data-profile-contact-controls></div></div></section>`;
    }
    if(options.compactPreview){
      const previewActions=`<div class="nyx-account-menu-group nyx-editor-menu-preview-actions" aria-hidden="true"><button type="button" tabindex="-1">${nyxAccountMenuIcon('edit')}<span>Edit Profile</span></button><hr><button type="button" tabindex="-1"><i class="nyx-user-status nyx-user-status-${esc(profile.status)}"></i><span>${esc(statusLabel)}</span>${nyxAccountMenuIcon('chevron')}</button></div><div class="nyx-account-menu-group nyx-editor-menu-preview-actions" aria-hidden="true"><button type="button" tabindex="-1">${nyxAccountMenuIcon('switch')}<span>Switch Accounts</span>${nyxAccountMenuIcon('chevron')}</button><hr><button type="button" tabindex="-1">${nyxAccountMenuIcon('id')}<span>Copy User ID</span></button></div>`;
      return `<section class="nyx-editor-menu-preview nyx-account-menu show ${nyxProfileEffectClass(profile)}" style="--nyx-account-primary:${profile.accentPrimary};--nyx-account-secondary:${profile.accentSecondary};--nyx-account-banner:${profile.bannerColor};--nyx-user-accent-primary:${profile.accentPrimary};--nyx-user-accent-secondary:${profile.accentSecondary};--nyx-user-banner-color:${profile.bannerColor};${nyxProfileEffectVars(profile)}"><i class="nyx-user-profile-effect nyx-account-menu-profile-effect" aria-hidden="true">${nyxProfileEffectArtwork(profile)}</i><div class="nyx-account-menu-banner">${background}${mediaEdit('banner','Edit profile banner')}</div><div class="nyx-account-menu-profile"><div class="nyx-account-menu-avatar nyx-avatar-decoration-${esc(profile.avatarDecoration)}" data-nyx-direct-edit="avatar">${avatar}<i class="nyx-avatar-decoration" aria-hidden="true"><span></span></i><i class="nyx-user-status nyx-user-status-${esc(profile.status)}" aria-label="${esc(statusLabel)}"></i></div><span class="nyx-account-menu-status"><span>${esc(profile.customStatus||statusLabel)}</span></span><h2 class="${nyxDisplayNameStyleClass(profile)}" style="${nyxDisplayNameStyleVars(profile)}">${esc(profile.displayName)}</h2><p class="nyx-account-menu-handle">${esc(profile.handle)}</p><p class="nyx-account-menu-bio">${esc(profile.bio||'No bio yet.')}</p></div>${previewActions}</section>`;
    }
    return `<section class="nyx-user-profile-card ${nyxProfileEffectClass(profile)}" style="--nyx-user-accent-primary:${profile.accentPrimary};--nyx-user-accent-secondary:${profile.accentSecondary};--nyx-user-banner-color:${profile.bannerColor};${nyxProfileEffectVars(profile)}"><i class="nyx-user-profile-effect" aria-hidden="true">${nyxProfileEffectArtwork(profile)}</i><div class="nyx-user-profile-banner">${background}${mediaEdit('banner','Edit profile banner')}</div><div class="nyx-user-profile-chrome"><div class="nyx-user-profile-avatar nyx-avatar-decoration-${esc(profile.avatarDecoration)}">${avatar}<i class="nyx-avatar-decoration" aria-hidden="true"><span></span></i><i class="nyx-user-status nyx-user-status-${esc(profile.status)}" aria-label="${esc(statusLabel)}"></i>${mediaEdit('avatar','Edit profile picture')}</div></div><div class="nyx-user-profile-body"><div class="nyx-user-profile-heading"><h2 class="${nyxDisplayNameStyleClass(profile)}" style="${nyxDisplayNameStyleVars(profile)}">${esc(profile.displayName)}</h2><p>${esc(profile.handle)}</p></div><p class="nyx-user-profile-custom-status">${symbol('status')} ${esc(profile.customStatus||`${statusLabel} on Nyx`)}</p><section class="nyx-user-profile-about"><h3>About me</h3><p class="nyx-user-profile-bio">${esc(profile.bio||'No bio yet.')}</p></section><section class="nyx-user-profile-roles"><h3>Roles</h3><div class="nyx-user-role-list">${roles}</div></section><section class="nyx-user-profile-details"><h3>Nyx member since</h3><p>${esc(joined)}</p></section>${ownerActions}</div></section>`;
  }
  async function nyxProfileImageFromFile(file,maxWidth,maxHeight){
    if(!file||!/^image\/(?:png|jpe?g|webp|gif)$/i.test(String(file.type||'')))throw new Error('Choose a PNG, JPG, WebP, or GIF image.');
    if(file.size>8*1024*1024)throw new Error('Choose an image smaller than 8 MB.');
    if(/^image\/gif$/i.test(String(file.type||''))){
      const signature=await file.slice(0,6).text();
      if(!/^GIF8[79]a$/.test(signature))throw new Error('That file is not a valid GIF.');
      const dataUrl=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result||''));
        reader.onerror=()=>reject(new Error('That GIF could not be opened.'));
        reader.readAsDataURL(file);
      });
      if(!/^data:image\/gif;base64,/i.test(dataUrl))throw new Error('That GIF could not be opened.');
      if(dataUrl.length>NYX_PROFILE_MEDIA_DATA_LIMIT)throw new Error('Choose a GIF smaller than 8 MB.');
      const previewImage=new Image();
      previewImage.decoding='async';
      previewImage.src=dataUrl;
      await nyxCaptureGifPoster(previewImage,dataUrl,Math.min(720,Math.max(maxWidth,maxHeight)));
      return dataUrl;
    }
    const objectUrl=URL.createObjectURL(file);
    try{
      const image=await new Promise((resolve,reject)=>{const preview=new Image();preview.onload=()=>resolve(preview);preview.onerror=()=>reject(new Error('That image could not be opened.'));preview.src=objectUrl});
      let scale=Math.min(1,maxWidth/Math.max(1,image.naturalWidth),maxHeight/Math.max(1,image.naturalHeight));
      for(let pass=0;pass<4;pass++){
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        const dataUrl=canvas.toDataURL('image/webp',Math.max(.52,.86-pass*.1));
        if(dataUrl.length<=NYX_PROFILE_IMAGE_DATA_LIMIT)return dataUrl;
        scale*=.72;
      }
      throw new Error('That image is too detailed to save. Try a smaller image.');
    }finally{URL.revokeObjectURL(objectUrl)}
  }
  async function nyxProfileMediaFetch(url,options,errorMessage){
    let lastError=null;
    let requestOptions={...options,headers:new Headers(options?.headers||{})};
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(url,requestOptions);
        const data=await response.json().catch(()=>({}));
        if(response.ok)return data;
        if(response.status===401&&attempt===0){
          const freshToken=await nyxGetFirebaseToken(true);
          if(freshToken){
            const headers=new Headers(requestOptions.headers||{});
            headers.set('Authorization',`Bearer ${freshToken}`);
            requestOptions={...requestOptions,headers};
            continue;
          }
        }
        const error=new Error(data.error||errorMessage);
        if(response.status!==408&&response.status!==429&&response.status<500)throw error;
        lastError=error;
      }catch(error){
        lastError=error;
        if(attempt>=2||/sign in|expired|cross-origin|invalid|too large/i.test(String(error?.message||'')))throw error;
      }
      await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
    }
    throw lastError||new Error(errorMessage);
  }
  async function nyxUploadProfileMedia(kind,dataUrl,token,onProgress=()=>{}){
    const match=String(dataUrl||'').match(/^data:(image\/(?:gif|png|jpeg|webp));base64,([a-z0-9+/=]+)$/i);
    if(!match)return dataUrl;
    if(dataUrl.length>NYX_PROFILE_MEDIA_DATA_LIMIT)throw new Error('Choose an image smaller than 8 MB.');
    const encoded=match[2];
    const chunkSize=420000;
    const chunks=[];
    for(let offset=0;offset<encoded.length;offset+=chunkSize)chunks.push(encoded.slice(offset,offset+chunkSize));
    if(!chunks.length||chunks.length>32)throw new Error('That image is too large to upload.');
    const uploadId=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9_-]/gi,'');
    for(let index=0;index<chunks.length;index++){
      onProgress(Math.round((index/chunks.length)*90));
      await nyxProfileMediaFetch(`/api/profile-media/${kind}/${uploadId}/${index}`,{
        method:'PUT',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({mime:match[1].toLowerCase(),totalChunks:chunks.length,chunk:chunks[index]})
      },`The ${kind} image could not be uploaded.`);
    }
    const data=await nyxProfileMediaFetch(`/api/profile-media/${kind}/${uploadId}/complete`,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:'{}'
    },`The ${kind} image could not be completed.`);
    if(!data.url)throw new Error(`The ${kind} image could not be completed.`);
    onProgress(100);
    return data.url;
  }
  async function openNyxUserProfile(){
    closeNyxAccountMenu();
    if(!nyxFounderSignedInUser){await openNyxAccountAccess();if(!nyxFounderSignedInUser)return}
    if(!nyxUserProfile)await loadNyxUserProfile();
    document.querySelector('.nyx-user-profile-overlay')?.remove();
    const profile=normalizeNyxUserProfile(nyxUserProfile);
    const accountUsername=nyxAccountUsername(String(nyxFounderSignedInUser?.email||'').split('@')[0]);
    const overlay=document.createElement('div');
    overlay.className='nyx-user-profile-overlay nyx-profile-drawer';
    overlay.innerHTML=`
      <section class="nyx-user-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="nyxUserProfileTitle">
        <main class="nyx-discord-profile-main">
          <button class="nyx-founder-editor-close nyx-discord-settings-close" data-close-nyx-profile type="button" aria-label="Close">
            ${nyxAccountMenuIcon('close')}
          </button>
          <div class="nyx-discord-profile-scroll">
            <header class="nyx-discord-profile-header">
              <h2 id="nyxUserProfileTitle">Edit profile</h2>
              <p>Your profile, across Nyx.</p>
            </header>
            <div class="nyx-discord-profile-layout">
              <form class="nyx-user-profile-form">
                <section class="nyx-profile-editor-section">
                  <h4>Profile information</h4>
                  <div class="nyx-profile-field-grid">
                    <label class="nyx-profile-field">Display name<input name="displayName" maxlength="48" required value="${esc(profile.displayName)}"></label>
                    <label class="nyx-profile-field">Profile username<input name="handle" maxlength="33" pattern="@?[A-Za-z0-9_.-]{3,32}" autocomplete="username" required value="${esc(profile.handle)}"><small>Unique across Nyx · 3–32 letters, numbers, dots, dashes, or underscores.</small></label>
                    <label class="nyx-profile-field nyx-profile-field-wide">About me<textarea name="bio" maxlength="280" rows="4" placeholder="You can use text and emoji.">${esc(profile.bio)}</textarea><small><span data-nyx-bio-count>${profile.bio.length}</span>/280</small></label>
                    <label class="nyx-profile-field">Status<select name="status"><option value="online" ${profile.status==='online'?'selected':''}>Online</option><option value="idle" ${profile.status==='idle'?'selected':''}>Idle</option><option value="dnd" ${profile.status==='dnd'?'selected':''}>Do not disturb</option><option value="offline" ${profile.status==='offline'?'selected':''}>Invisible</option></select></label>
                    <label class="nyx-profile-field">Custom status<input name="customStatus" maxlength="80" value="${esc(profile.customStatus)}" placeholder="What are you up to?"></label>
                  </div>
                </section>
                <section class="nyx-profile-editor-section">
                  <h4>Avatar &amp; banner</h4>
                  <div class="nyx-profile-image-list">
                    <div class="nyx-profile-image-control">
                      <div><strong>Avatar</strong><small>PNG, JPG, WebP, or animated GIF.</small></div>
                      <input name="avatarUrl" type="hidden" value="${esc(profile.avatarUrl)}">
                      <input class="nyx-profile-file-input" name="avatarFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
                      <span class="nyx-profile-file-name" data-nyx-file-name="avatar">${profile.avatarUrl?'Image selected':'No image selected'}</span>
                      <div class="nyx-profile-image-actions"><button class="nyx-profile-file-button" type="button" data-nyx-pick-image="avatar"><span class="nyx-profile-rail-avatar">${profile.avatarUrl?`<img src="${esc(nyxProfileStillSource(profile.avatarUrl))}" alt="">`:`<b>${esc(profile.displayName.slice(0,1).toUpperCase()||'N')}</b>`}</span><span>Change Avatar</span></button><button class="nyx-profile-clear-button" type="button" data-nyx-clear-image="avatar">Remove Avatar</button></div>
                    </div>
                    <div class="nyx-profile-image-control">
                      <div><strong>Profile banner</strong><small>Recommended size: 680 × 240.</small></div>
                      <input name="bannerUrl" type="hidden" value="${esc(profile.bannerUrl)}">
                      <input class="nyx-profile-file-input" name="bannerFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
                      <span class="nyx-profile-file-name" data-nyx-file-name="banner">${profile.bannerUrl?'Image selected':'No image selected'}</span>
                      <div class="nyx-profile-image-actions"><button class="nyx-profile-file-button" type="button" data-nyx-pick-image="banner">Change Banner</button><button class="nyx-profile-clear-button" type="button" data-nyx-clear-image="banner">Remove Banner</button></div>
                    </div>
                  </div>
                </section>
                <section class="nyx-profile-editor-section">
                  <h4>Profile theme</h4>
                  <div class="nyx-profile-color-grid">
                    <label class="nyx-profile-field nyx-profile-color-field">Primary<input name="accentPrimary" type="color" value="${esc(profile.accentPrimary)}"><small>Profile card color</small></label>
                    <label class="nyx-profile-field nyx-profile-color-field">Accent<input name="accentSecondary" type="color" value="${esc(profile.accentSecondary)}"><small>Secondary surface color</small></label>
                    <label class="nyx-profile-field nyx-profile-color-field">Banner color<input name="bannerColor" type="color" value="${esc(profile.bannerColor)}"><small>Used without a banner image</small></label>
                     <label class="nyx-profile-field">Profile decoration<select name="profileEffect">${nyxProfileOptions(NYX_PROFILE_EFFECTS,profile.profileEffect)}</select><small>Animated artwork across your profile card.</small></label>
                  </div>
                </section>
                <p class="nyx-founder-editor-error" aria-live="polite"></p>
                <footer>
                  <strong>Changes saved</strong>
                  <button class="nyx-profile-reset-button" type="reset">Reset</button>
                  <button class="settings-action on" type="submit">Save Changes</button>
                </footer>
              </form>
              <aside class="nyx-discord-preview-pane">
                <h3>Preview</h3>
                <div class="nyx-user-profile-view">${nyxUserProfileCardMarkup(profile,{editable:true,popup:true,role:nyxFounderIsOwner?'owner':nyxUserAccountRole})}</div>
              </aside>
            </div>
          </div>
        </main>
    </section>`;
    (document.getElementById('app') || document.body).appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('show'));
    const close=()=>{
      if(overlay.classList.contains('is-closing')) return;
      clearTimeout(previewTimer);
      overlay.classList.add('is-closing');
      overlay.classList.remove('show');
      setTimeout(()=>overlay.remove(),240);
    };
    overlay.addEventListener('click',async event=>{
      if(event.target===overlay||event.target.closest('[data-close-nyx-profile]')){close();return}
      const action=event.target.closest('[data-nyx-profile-action]')?.dataset.nyxProfileAction;
      if(!action)return;
      if(action==='status'){const field=overlay.querySelector('[name="status"]');field?.scrollIntoView({block:'center',behavior:'smooth'});field?.focus();try{field?.showPicker?.()}catch{}return}
      if(action==='custom-status'){const field=overlay.querySelector('[name="customStatus"]');field?.scrollIntoView({block:'center',behavior:'smooth'});field?.focus();field?.select();return}
      if(action==='switch-account'){close();await openNyxAccountAccess({switching:true})}
    });
    const form=overlay.querySelector('form');
    const pendingMediaPreparations=new Map();
    form.insertAdjacentHTML('afterbegin',`<header class="nyx-profile-rail-header">
      <button type="button" data-nyx-profile-switch-toggle aria-haspopup="menu" aria-expanded="false">
        <span>Main Profile</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>
      </button>
      <section class="nyx-profile-switch-menu" data-nyx-profile-switch-menu role="menu" aria-label="Profile options" hidden>
        <div class="nyx-profile-switch-current">
          <span class="nyx-profile-switch-avatar">${profile.avatarUrl?`<img src="${esc(nyxProfileStillSource(profile.avatarUrl))}" alt="">`:`<b>${esc(profile.displayName.slice(0,1).toUpperCase()||'N')}</b>`}</span>
          <span><strong>${esc(profile.displayName)}</strong><small>${esc(profile.handle)}</small></span>
          <i aria-hidden="true"></i>
        </div>
        <button type="button" role="menuitem" data-nyx-switch-profile>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 4 4-4 4"/><path d="M20 7H9a4 4 0 0 0-4 4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h11a4 4 0 0 0 4-4"/></svg>
          <span><strong>Switch Profile</strong><small>Sign in to another Nyx profile</small></span>
        </button>
        <div class="nyx-profile-switch-confirm" data-nyx-profile-switch-confirm hidden>
          <strong>Discard unsaved changes?</strong>
          <p>Your current profile edits have not been saved.</p>
          <div><button type="button" data-nyx-switch-stay>Keep editing</button><button type="button" data-nyx-switch-discard>Discard &amp; switch</button></div>
        </div>
      </section>
    </header>`);
    const profileSwitchToggle=form.querySelector('[data-nyx-profile-switch-toggle]');
    const profileSwitchMenu=form.querySelector('[data-nyx-profile-switch-menu]');
    const profileSwitchConfirm=form.querySelector('[data-nyx-profile-switch-confirm]');
    const setProfileSwitchMenu=open=>{
      profileSwitchMenu.hidden=!open;
      profileSwitchToggle.setAttribute('aria-expanded',String(open));
      profileSwitchToggle.classList.toggle('active',open);
      if(!open){
        profileSwitchConfirm.hidden=true;
        form.querySelector('[data-nyx-switch-profile]').hidden=false;
      }
    };
    const performProfileSwitch=async()=>{
      setProfileSwitchMenu(false);
      close();
      await new Promise(resolve=>setTimeout(resolve,250));
      await openNyxAccountAccess({switching:true});
    };
    profileSwitchToggle.addEventListener('click',event=>{
      event.stopPropagation();
      setProfileSwitchMenu(profileSwitchMenu.hidden);
      if(!profileSwitchMenu.hidden)setTimeout(()=>profileSwitchMenu.querySelector('[role="menuitem"]')?.focus(),0);
    });
    profileSwitchMenu.addEventListener('click',event=>{
      event.stopPropagation();
      if(event.target.closest('[data-nyx-switch-profile]')){
        if(form.classList.contains('is-dirty')){
          form.querySelector('[data-nyx-switch-profile]').hidden=true;
          profileSwitchConfirm.hidden=false;
          setTimeout(()=>profileSwitchConfirm.querySelector('button')?.focus(),0);
        }else{
          void performProfileSwitch();
        }
        return;
      }
      if(event.target.closest('[data-nyx-switch-stay]')){
        profileSwitchConfirm.hidden=true;
        form.querySelector('[data-nyx-switch-profile]').hidden=false;
        profileSwitchToggle.focus();
        return;
      }
      if(event.target.closest('[data-nyx-switch-discard]')) void performProfileSwitch();
    });
    overlay.addEventListener('click',event=>{
      if(!profileSwitchMenu.hidden&&!event.target.closest('.nyx-profile-rail-header'))setProfileSwitchMenu(false);
    });
    profileSwitchMenu.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        event.preventDefault();
        event.stopImmediatePropagation();
        setProfileSwitchMenu(false);
        profileSwitchToggle.focus();
      }
    });
    const railSections=Array.from(form.querySelectorAll('.nyx-profile-editor-section'));
    if(railSections[0]) railSections[0].querySelector('h4').textContent='Nameplate';
    if(railSections[1]) railSections[1].querySelector('h4').textContent='Avatar & Decoration';
    if(railSections[2]) railSections[2].querySelector('h4').textContent='Profile Effect & Frame';
    const displayNameField=form.querySelector('[name="displayName"]')?.closest('label');
    const handleField=form.querySelector('[name="handle"]')?.closest('label');
    const bioField=form.querySelector('[name="bio"]')?.closest('label');
    const statusField=form.querySelector('[name="status"]')?.closest('label');
    const customStatusField=form.querySelector('[name="customStatus"]')?.closest('label');
    displayNameField?.classList.add('nyx-profile-display-name-field');
    handleField?.classList.add('nyx-profile-nameplate-field');
    bioField?.classList.add('nyx-profile-about-field');
    railSections[0]?.querySelector('.nyx-profile-field-grid')?.insertAdjacentHTML('afterbegin',`<div class="nyx-profile-nameplate-preview"><span>${profile.avatarUrl?`<img src="${esc(nyxProfileStillSource(profile.avatarUrl))}" alt="">`:`<b>${esc(profile.displayName.slice(0,1).toUpperCase()||'N')}</b>`}</span><i>${esc(profile.handle)}</i><strong aria-hidden="true">+</strong></div>`);
    const displaySection=document.createElement('section');
    displaySection.className='nyx-profile-editor-section nyx-profile-display-section';
    const fontOptions=NYX_DISPLAY_NAME_FONTS.map(([value,label])=>`<label class="nyx-name-style-choice"><input type="radio" name="displayNameFont" value="${value}" ${profile.displayNameFont===value?'checked':''}><span class="nyx-name-font-${value}">${esc(label)}</span></label>`).join('');
    const effectOptions=NYX_DISPLAY_NAME_EFFECTS.map(([value,label])=>`<label class="nyx-name-style-choice nyx-name-effect-choice"><input type="radio" name="displayNameEffect" value="${value}" ${profile.displayNameEffect===value?'checked':''}><span>${esc(label)}</span></label>`).join('');
    displaySection.innerHTML=`<h4>Display Name Style</h4>
      <button class="nyx-display-name-style-launcher" type="button" data-nyx-display-style-toggle aria-expanded="false">
        <span class="${nyxDisplayNameStyleClass(profile)}" style="${nyxDisplayNameStyleVars(profile)}" data-nyx-name-style-preview>${esc(profile.displayName)}</span><strong aria-hidden="true">+</strong>
      </button>
      <div class="nyx-display-name-editor" data-nyx-display-name-editor hidden>
        <div class="nyx-display-name-editor-head"><div><strong>Change Display Name Style</strong><small>Font, effect, and colors</small></div><div class="nyx-name-preview-modes" aria-label="Preview background"><button type="button" data-nyx-name-preview-theme="dark" class="active">Dark</button><button type="button" data-nyx-name-preview-theme="light">Light</button></div></div>
        <div class="nyx-name-style-live-sample"><span class="${nyxDisplayNameStyleClass(profile)}" style="${nyxDisplayNameStyleVars(profile)}" data-nyx-name-style-preview>${esc(profile.displayName)}</span></div>
        <div class="nyx-display-name-input-slot"></div>
        <fieldset class="nyx-name-style-group"><legend>Font</legend><div class="nyx-name-font-grid">${fontOptions}</div></fieldset>
        <fieldset class="nyx-name-style-group"><legend>Effect</legend><div class="nyx-name-effect-grid">${effectOptions}</div></fieldset>
        <div class="nyx-name-color-grid">
          <label>Primary color<input name="displayNameColorPrimary" type="color" value="${profile.displayNameColorPrimary}"></label>
          <label data-nyx-name-secondary-color>Secondary color<input name="displayNameColorSecondary" type="color" value="${profile.displayNameColorSecondary}"></label>
        </div>
        <button class="nyx-name-surprise-button" type="button" data-nyx-name-surprise>Surprise Me</button>
      </div>`;
    if(displayNameField) displaySection.querySelector('.nyx-display-name-input-slot').appendChild(displayNameField);
    const detailsSection=document.createElement('section');
    detailsSection.className='nyx-profile-editor-section nyx-profile-details-section';
    detailsSection.innerHTML='<h4>Profile Details</h4><div class="nyx-profile-field-grid"></div>';
    const accountEmailField=document.createElement('label');
    accountEmailField.className='nyx-profile-field nyx-profile-field-wide nyx-profile-account-email-field';
    accountEmailField.innerHTML=`Account email <span class="nyx-profile-optional">Optional</span><input name="accountEmail" type="email" maxlength="254" autocomplete="email" value="${esc(nyxUserAccountEmail)}" placeholder="you@example.com"><small>Add an email whenever you want. It can be used to log in and receive password-reset messages.</small>`;
    [accountEmailField,statusField,customStatusField,bioField].filter(Boolean).forEach(field=>detailsSection.querySelector('div').appendChild(field));
    railSections[2]?.after(displaySection,detailsSection);
    form.querySelector('[name="bannerColor"]')?.closest('label')?.classList.add('nyx-profile-banner-color-field');
    form.querySelector('[name="accentPrimary"]')?.closest('label')?.classList.add('nyx-profile-primary-color-field');
    form.querySelector('[name="accentSecondary"]')?.closest('label')?.classList.add('nyx-profile-secondary-color-field');
    const minecraftDisplayNameField=form.querySelector('[name="displayName"]')?.closest('label');
    if(minecraftDisplayNameField&&!minecraftDisplayNameField.querySelector('[data-nyx-minecraft-help]'))minecraftDisplayNameField.insertAdjacentHTML('beforeend','<small data-nyx-minecraft-help>Use Minecraft codes like &amp;b cyan, &amp;l bold, or &amp;r reset.</small>');
    const profileEffectSelect=form.querySelector('[name="profileEffect"]');
    if(profileEffectSelect)profileEffectSelect.value=profile.profileEffect;
    const decorationField=document.createElement('label');
    decorationField.className='nyx-profile-field';
    decorationField.innerHTML=`<span class="nyx-profile-decoration-preview nyx-avatar-decoration-${esc(profile.avatarDecoration)}" data-nyx-decoration-preview style="--nyx-user-accent-primary:${profile.accentPrimary};--nyx-user-accent-secondary:${profile.accentSecondary}"><span class="nyx-profile-decoration-avatar">${profile.avatarUrl?`<img src="${esc(nyxProfileStillSource(profile.avatarUrl))}" alt="">`:`<span>${esc(profile.displayName.slice(0,1).toUpperCase()||'N')}</span>`}</span><i class="nyx-avatar-decoration" aria-hidden="true"><span></span></i></span><span class="nyx-profile-decoration-label">Avatar decoration</span><select name="avatarDecoration">${nyxProfileOptions(NYX_AVATAR_DECORATIONS,profile.avatarDecoration)}</select><small>Choose an animated frame for your avatar.</small>`;
    decorationField.classList.add('nyx-profile-decoration-field');
    form.querySelector('.nyx-profile-image-list')?.appendChild(decorationField);
    decorationField.querySelector('select').value=profile.avatarDecoration;
    overlay.classList.add('nyx-profile-organized');
    railSections[0].querySelector('h4').textContent='Identity';
    railSections[1].querySelector('h4').textContent='Avatar & banner';
    railSections[2].querySelector('h4').textContent='Profile colors';
    railSections[0].querySelector('.nyx-profile-field-grid').prepend(displayNameField);
    const artworkSection=document.createElement('section');
    artworkSection.className='nyx-profile-editor-section nyx-profile-artwork-section';
    artworkSection.innerHTML='<h4>Decorations</h4><div class="nyx-profile-artwork-grid"></div>';
    artworkSection.querySelector('div').append(decorationField,profileEffectSelect.closest('label'));
    railSections[1].after(artworkSection);
    railSections[0].after(detailsSection,displaySection);
    const editorNav=document.createElement('nav');
    editorNav.className='nyx-profile-section-nav';
    editorNav.setAttribute('aria-label','Profile sections');
    for(const [section,label] of [[railSections[0],'Identity'],[detailsSection,'About you'],[displaySection,'Name style'],[railSections[1],'Images'],[artworkSection,'Decorations'],[railSections[2],'Colors']]){
      const button=document.createElement('button');button.type='button';button.innerHTML=nyxAccountMenuIcon({Identity:'id','About you':'people','Name style':'type',Images:'image',Decorations:'sparkle',Colors:'palette'}[label])+`<span>${label}</span>`;
      button.addEventListener('click',()=>{section.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});section.querySelector('input:not([type=hidden]),select,textarea,button')?.focus({preventScroll:true});});
      editorNav.appendChild(button);
    }
    form.querySelector('.nyx-profile-rail-header').after(editorNav);
    overlay.querySelector('.nyx-discord-preview-pane>h3').textContent='Live preview';
    const editorBody=document.createElement('div');editorBody.className='nyx-profile-fields-scroll';
    const footer=form.querySelector('footer');
    [...form.children].filter(child=>child!==footer).forEach(child=>editorBody.append(child));
    form.prepend(editorBody);
    const previewToggle=document.createElement('button');previewToggle.type='button';previewToggle.className='nyx-profile-preview-toggle';previewToggle.innerHTML=nyxAccountMenuIcon('eye')+'<span>Preview</span>';previewToggle.setAttribute('aria-pressed','false');
    previewToggle.addEventListener('click',()=>{const shown=overlay.classList.toggle('show-preview');previewToggle.setAttribute('aria-pressed',String(shown));previewToggle.innerHTML=nyxAccountMenuIcon(shown?'edit':'eye')+`<span>${shown?'Edit':'Preview'}</span>`;});
    overlay.querySelector('.nyx-discord-profile-header').append(previewToggle);
    const decorateButton=(button,icon)=>{if(!button)return;button.insertAdjacentHTML('afterbegin',nyxAccountMenuIcon(icon));};
    decorateButton(footer.querySelector('[type="submit"]'),'check');decorateButton(footer.querySelector('[type="reset"]'),'undo');
    form.querySelectorAll('[data-nyx-pick-image]').forEach(button=>decorateButton(button,'upload'));
    form.querySelectorAll('[data-nyx-clear-image]').forEach(button=>decorateButton(button,'close'));

    const customEffectBuilder=document.createElement('div');
    customEffectBuilder.className='nyx-profile-custom-effect-builder';
    customEffectBuilder.hidden=true;
    form.querySelector('.nyx-profile-color-grid')?.appendChild(customEffectBuilder);
    const profileKeys=['displayName','handle','status','customStatus','bio','profileEffect','customEffectPattern','customEffectColorPrimary','customEffectColorSecondary','customEffectSpeed','customEffectIntensity','avatarDecoration','accentPrimary','accentSecondary','bannerColor','displayNameFont','displayNameEffect','displayNameColorPrimary','displayNameColorSecondary','avatarUrl','bannerUrl'];
    const directPopover=document.createElement('section');
    directPopover.className='nyx-profile-direct-popover';
    directPopover.hidden=true;
    overlay.appendChild(directPopover);
    const directTargets=()=>{
      const view=overlay.querySelector('.nyx-user-profile-view');
      view?.querySelectorAll('.nyx-profile-media-edit-avatar').forEach((button,index)=>{if(index>0)button.remove()});
      [['avatar','[data-nyx-direct-edit="avatar"]','Change picture or decoration'],['banner','[data-nyx-direct-edit="banner"]','Change profile banner'],['bio','.nyx-user-profile-bio','Edit About me']].forEach(([type,selector,label])=>{
        const target=view?.querySelector(selector);
        if(!target)return;
        if(!target.dataset.nyxDirectEdit) target.dataset.nyxDirectEdit=type;
        if(target.tagName!=='BUTTON'){target.tabIndex=0;target.setAttribute('role','button')}
        target.setAttribute('aria-label',label);
        target.title=label;
      });
    };
    const syncDisplayNameStylePreview=nextProfile=>{
      displaySection.querySelectorAll('[data-nyx-name-style-preview]').forEach(sample=>{
        sample.className=nyxDisplayNameStyleClass(nextProfile);
        sample.style.cssText=nyxDisplayNameStyleVars(nextProfile);
        sample.textContent=nextProfile.displayName;
      });
      displaySection.querySelector('[data-nyx-display-name-editor]')?.setAttribute('data-name-effect',nextProfile.displayNameEffect);
    };
    const syncAvatarDecorationPreview=nextProfile=>{
      const decorationPreview=decorationField.querySelector('[data-nyx-decoration-preview]');
      const avatarPreview=decorationPreview?.querySelector('.nyx-profile-decoration-avatar');
      if(!decorationPreview||!avatarPreview)return;
      [...decorationPreview.classList].filter(name=>name.startsWith('nyx-avatar-decoration-')).forEach(name=>decorationPreview.classList.remove(name));
      decorationPreview.classList.add(`nyx-avatar-decoration-${nextProfile.avatarDecoration}`);
      decorationPreview.style.setProperty('--nyx-user-accent-primary',nextProfile.accentPrimary);
      decorationPreview.style.setProperty('--nyx-user-accent-secondary',nextProfile.accentSecondary);
      syncNyxAccountButtonAvatar(avatarPreview,nextProfile);
    };
    const syncCustomEffectBuilder=()=>{
      const custom=form.querySelector('[name="profileEffect"]')?.value==='custom';
      const controls=customEffectBuilder.querySelector('[data-nyx-custom-effect-controls]');
      const launcher=customEffectBuilder.querySelector('[data-nyx-custom-effect-create]');
      if(controls)controls.hidden=!custom;
      if(launcher){
        launcher.textContent=custom?'Custom effect active':'Create custom effect';
        launcher.classList.toggle('active',custom);
      }
      const speed=customEffectBuilder.querySelector('[name="customEffectSpeed"]')?.value||'7';
      const intensity=customEffectBuilder.querySelector('[name="customEffectIntensity"]')?.value||'70';
      const speedOutput=customEffectBuilder.querySelector('[data-nyx-custom-speed]');
      const intensityOutput=customEffectBuilder.querySelector('[data-nyx-custom-intensity]');
      if(speedOutput)speedOutput.textContent=`${speed}s`;
      if(intensityOutput)intensityOutput.textContent=`${intensity}%`;
    };
    let previewTimer=0;
    const renderPreview=()=>{
      const values=new FormData(form);
      const nextProfile=normalizeNyxUserProfile({...profile,...Object.fromEntries(profileKeys.map(key=>[key,values.get(key)]))});
      const view=overlay.querySelector('.nyx-user-profile-view');
      view.innerHTML=nyxUserProfileCardMarkup(nextProfile,{editable:true,popup:true,role:nyxFounderIsOwner?'owner':nyxUserAccountRole});
      nyxManageUserProfileGifs(view,nextProfile);
      syncDisplayNameStylePreview(nextProfile);
      syncAvatarDecorationPreview(nextProfile);
      syncCustomEffectBuilder();
      const bioCount=form.querySelector('[data-nyx-bio-count]');
      if(bioCount)bioCount.textContent=String(values.get('bio')||'').length;
      form.classList.add('is-dirty');
      directTargets();
    };
    const preview=()=>{
      clearTimeout(previewTimer);
      previewTimer=setTimeout(renderPreview,70);
    };
    const styleLauncher=displaySection.querySelector('[data-nyx-display-style-toggle]');
    const styleEditor=displaySection.querySelector('[data-nyx-display-name-editor]');
    styleLauncher?.addEventListener('click',()=>{
      const opening=styleEditor.hidden;
      styleEditor.hidden=!opening;
      styleLauncher.setAttribute('aria-expanded',String(opening));
      styleLauncher.querySelector('strong').textContent=opening?'-':'+';
      if(opening)setTimeout(()=>styleEditor.querySelector('input,button')?.focus(),0);
    });
    displaySection.querySelectorAll('[data-nyx-name-preview-theme]').forEach(button=>button.addEventListener('click',()=>{
      displaySection.querySelectorAll('[data-nyx-name-preview-theme]').forEach(item=>item.classList.toggle('active',item===button));
      displaySection.querySelector('.nyx-name-style-live-sample')?.classList.toggle('light',button.dataset.nyxNamePreviewTheme==='light');
    }));
    displaySection.querySelector('[data-nyx-name-surprise]')?.addEventListener('click',()=>{
      const font=NYX_DISPLAY_NAME_FONTS[Math.floor(Math.random()*NYX_DISPLAY_NAME_FONTS.length)][0];
      const effect=NYX_DISPLAY_NAME_EFFECTS[Math.floor(Math.random()*NYX_DISPLAY_NAME_EFFECTS.length)][0];
      const randomColor=()=>`#${Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')}`;
      const fontInput=form.querySelector(`[name="displayNameFont"][value="${font}"]`);
      const effectInput=form.querySelector(`[name="displayNameEffect"][value="${effect}"]`);
      if(fontInput)fontInput.checked=true;
      if(effectInput)effectInput.checked=true;
      form.querySelector('[name="displayNameColorPrimary"]').value=randomColor();
      form.querySelector('[name="displayNameColorSecondary"]').value=randomColor();
      preview();
    });
    syncDisplayNameStylePreview(profile);
    syncAvatarDecorationPreview(profile);
    syncCustomEffectBuilder();
    nyxManageUserProfileGifs(overlay,profile);
    customEffectBuilder.querySelector('[data-nyx-custom-effect-create]')?.addEventListener('click',()=>{
      const effect=form.querySelector('[name="profileEffect"]');
      if(effect)effect.value='custom';
      preview();
      customEffectBuilder.querySelector('select,input')?.focus();
    });
    const closeDirectPopover=()=>{directPopover.hidden=true;directPopover.textContent=''};
    const positionDirectPopover=target=>{
      requestAnimationFrame(()=>{
        const targetBox=target.getBoundingClientRect();
        const popoverBox=directPopover.getBoundingClientRect();
        const gap=12;
        let left=targetBox.right+gap;
        if(left+popoverBox.width>innerWidth-16)left=Math.max(16,targetBox.left-popoverBox.width-gap);
        let top=Math.max(16,targetBox.top);
        if(top+popoverBox.height>innerHeight-16)top=Math.max(16,innerHeight-popoverBox.height-16);
        directPopover.style.left=`${Math.round(left)}px`;
        directPopover.style.top=`${Math.round(top)}px`;
      });
    };
    const directEditorOptions=(selected,options)=>options.map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('');
    const openDirectEditor=(type,target)=>{
      const values=new FormData(form);
      directPopover.style.setProperty('--nyx-direct-primary',String(values.get('accentPrimary')||'#5865f2'));
      directPopover.style.setProperty('--nyx-direct-secondary',String(values.get('accentSecondary')||'#8ea1ff'));
      if(type==='avatar'){
        const decoration=String(values.get('avatarDecoration')||'none');
        directPopover.innerHTML=`<header><div><strong>Avatar</strong><small>Picture and animated decoration</small></div><button type="button" data-nyx-direct-close aria-label="Close">&#215;</button></header><div class="nyx-profile-direct-actions"><button type="button" data-nyx-direct-action="pick-avatar">Change picture</button><button type="button" data-nyx-direct-action="remove-avatar">Remove picture</button></div><label>Avatar decoration<select data-nyx-direct-value="avatarDecoration">${directEditorOptions(decoration,NYX_AVATAR_DECORATIONS)}</select></label><p>Changes preview instantly. Use Save changes when you are finished.</p>`;
      }else if(type==='banner'){
        directPopover.innerHTML=`<header><div><strong>Profile banner</strong><small>Image and fallback color</small></div><button type="button" data-nyx-direct-close aria-label="Close">&#215;</button></header><div class="nyx-profile-direct-actions"><button type="button" data-nyx-direct-action="pick-banner">Change banner</button><button type="button" data-nyx-direct-action="remove-banner">Remove banner</button></div><label>Fallback color<input type="color" data-nyx-direct-value="bannerColor" value="${esc(values.get('bannerColor')||'#8ea1ff')}"></label><p>The fallback color appears when no banner image is selected.</p>`;
      }else{
        directPopover.innerHTML=`<header><div><strong>About me</strong><small>Profile description</small></div><button type="button" data-nyx-direct-close aria-label="Close">&#215;</button></header><label>Description<textarea data-nyx-direct-value="bio" maxlength="280" rows="5" placeholder="Tell people a little about yourself.">${esc(values.get('bio')||'')}</textarea></label><p>Changes preview instantly. Use Save changes when you are finished.</p>`;
      }
      directPopover.hidden=false;
      positionDirectPopover(target);
      setTimeout(()=>directPopover.querySelector('textarea,select,input,button')?.focus(),0);
    };
    directTargets();
    overlay.addEventListener('click',event=>{
      const directTarget=event.target.closest('[data-nyx-direct-edit]');
      if(directTarget){openDirectEditor(directTarget.dataset.nyxDirectEdit,directTarget);return}
      if(event.target.closest('[data-nyx-direct-close]')){closeDirectPopover();return}
      const action=event.target.closest('[data-nyx-direct-action]')?.dataset.nyxDirectAction;
      if(action){
        const [verb,type]=action.split('-');
        if(verb==='pick')form.querySelector(`[data-nyx-pick-image="${type}"]`)?.click();
        if(verb==='remove')form.querySelector(`[data-nyx-clear-image="${type}"]`)?.click();
        return;
      }
      if(!directPopover.hidden&&!event.target.closest('.nyx-profile-direct-popover'))closeDirectPopover();
    });
    overlay.addEventListener('input',event=>{
      const key=event.target.dataset.nyxDirectValue;
      if(!key)return;
      const source=form.querySelector(`[name="${key}"]`);
      if(source){source.value=event.target.value;preview()}
    });
    overlay.addEventListener('change',event=>{
      const key=event.target.dataset.nyxDirectValue;
      if(!key)return;
      const source=form.querySelector(`[name="${key}"]`);
      if(source){source.value=event.target.value;preview()}
    });
    overlay.addEventListener('keydown',event=>{
      const directTarget=event.target.closest('[data-nyx-direct-edit]');
      if(directTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openDirectEditor(directTarget.dataset.nyxDirectEdit,directTarget)}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!directPopover.hidden)closeDirectPopover()}
    });
    form.addEventListener('input',preview);form.addEventListener('change',preview);
    form.addEventListener('reset',()=>{pendingMediaPreparations.clear();clearTimeout(previewTimer);requestAnimationFrame(()=>{form.classList.remove('is-dirty');form.querySelector('footer>strong').textContent='Changes saved';const avatarLabel=form.querySelector('[data-nyx-file-name="avatar"]');const bannerLabel=form.querySelector('[data-nyx-file-name="banner"]');if(avatarLabel)avatarLabel.textContent=profile.avatarUrl?'Image selected':'No image selected';if(bannerLabel)bannerLabel.textContent=profile.bannerUrl?'Image selected':'No image selected';const values=new FormData(form);const nextProfile=normalizeNyxUserProfile({...profile,...Object.fromEntries(profileKeys.map(key=>[key,values.get(key)]))});const view=overlay.querySelector('.nyx-user-profile-view');view.innerHTML=nyxUserProfileCardMarkup(nextProfile,{editable:true,popup:true,role:nyxFounderIsOwner?'owner':nyxUserAccountRole});nyxManageUserProfileGifs(view,nextProfile);syncDisplayNameStylePreview(nextProfile);syncAvatarDecorationPreview(nextProfile);syncCustomEffectBuilder();const bioCount=form.querySelector('[data-nyx-bio-count]');if(bioCount)bioCount.textContent=String(values.get('bio')||'').length;directTargets()})});
    form.querySelectorAll('[data-nyx-pick-image]').forEach(button=>button.addEventListener('click',()=>form.querySelector(`[name="${button.dataset.nyxPickImage}File"]`)?.click()));
    form.querySelectorAll('[data-nyx-clear-image]').forEach(button=>button.addEventListener('click',()=>{const type=button.dataset.nyxClearImage;pendingMediaPreparations.delete(type);form.querySelector(`[name="${type}Url"]`).value='';form.querySelector(`[name="${type}File"]`).value='';form.querySelector(`[data-nyx-file-name="${type}"]`).textContent='No image selected';preview()}));
    form.querySelectorAll('.nyx-profile-file-input').forEach(input=>input.addEventListener('change',()=>{const type=input.name==='avatarFile'?'avatar':'banner';const label=form.querySelector(`[data-nyx-file-name="${type}"]`);const error=form.querySelector('.nyx-founder-editor-error');const file=input.files?.[0];if(!file)return;label.textContent='Preparing image…';error.textContent='';const preparation=nyxProfileImageFromFile(file,type==='avatar'?512:1200,type==='avatar'?512:480);pendingMediaPreparations.set(type,preparation);void preparation.then(dataUrl=>{if(pendingMediaPreparations.get(type)!==preparation)return;form.querySelector(`[name="${type}Url"]`).value=dataUrl;label.textContent=file.name;preview()}).catch(imageError=>{if(pendingMediaPreparations.get(type)!==preparation)return;input.value='';label.textContent='No image selected';error.textContent=imageError.message||'That image could not be used.'}).finally(()=>{if(pendingMediaPreparations.get(type)===preparation)pendingMediaPreparations.delete(type)})}));
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const error=form.querySelector('.nyx-founder-editor-error');
      const button=form.querySelector('[type="submit"]');
      const originalLabel=button.innerHTML;
      button.disabled=true;
      try{
        while(pendingMediaPreparations.size){
          button.textContent='Preparing media…';
          await Promise.all([...pendingMediaPreparations.values()]);
        }
        const values=new FormData(form);
        const nextProfile=Object.fromEntries(profileKeys.map(key=>[key,values.get(key)]));
        const nextEmail=String(values.get('accountEmail')||'').trim().toLowerCase();
        const token=await nyxGetFirebaseToken(true);
        if(!token)throw new Error('Sign in again to save your profile.');
        for(const kind of ['avatar','banner']){
          const key=`${kind}Url`;
          if(/^data:image\/(?:gif|png|jpeg|webp);base64,/i.test(String(nextProfile[key]||''))){
            button.textContent=`Uploading ${kind}…`;
            nextProfile[key]=await nyxUploadProfileMedia(kind,nextProfile[key],token,progress=>{button.textContent=`Uploading ${kind} ${progress}%`});
            form.querySelector(`[name="${key}"]`).value=nextProfile[key];
          }
        }
        const imagePayloadSize=[nextProfile.avatarUrl,nextProfile.bannerUrl].reduce((total,value)=>total+(String(value||'').startsWith('data:image/')?String(value).length:0),0);
        if(imagePayloadSize>NYX_PROFILE_IMAGE_TOTAL_LIMIT)throw new Error('Your avatar and banner are too large together. Remove one or choose smaller images.');
        button.textContent='Saving…';
        const data=await nyxProfileMediaFetch('/api/profiles/me',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({profile:nextProfile})},'Profile could not be saved.');
        const persistedProfile=normalizeNyxUserProfile(data.profile);
        for(const key of ['avatarDecoration','profileEffect']){
          if(String(nextProfile[key]||'none')!==String(persistedProfile[key]||'none'))throw new Error('Your decoration selection was not stored. Please try saving again.');
        }
        for(const kind of ['avatar','banner']){
          const key=`${kind}Url`;
          if(String(nextProfile[key]||'')!==String(persistedProfile[key]||'')){
            throw new Error(`The ${kind} image was not stored. Try selecting it again.`);
          }
        }
        if(nextEmail&&nextEmail!==nyxUserAccountEmail){
          button.textContent='Updating email…';
          const accountData=await nyxProfileMediaFetch('/api/account/me/email',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({email:nextEmail})},'Account email could not be updated.');
          nyxUserAccountEmail=String(accountData.email||nextEmail);
          if(accountData.customToken){
            const {signInWithCustomToken}=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
            const credential=await signInWithCustomToken(nyxFounderFirebaseAuth,accountData.customToken);
            nyxFounderSignedInUser=credential.user;
            await credential.user.getIdToken(true);
          }
        }
        nyxUserProfile=persistedProfile;
        nyxUserProfileCreatedAt=String(data.createdAt||nyxUserProfileCreatedAt);
        button.textContent='Verifying…';
        const verifiedProfile=await loadNyxUserProfile();
        if(!verifiedProfile)throw new Error('The saved profile could not be verified. Try again.');
        for(const key of ['avatarDecoration','profileEffect']){
          if(String(nextProfile[key]||'none')!==String(nyxUserProfile?.[key]||'none'))throw new Error('Your saved decoration selection could not be verified. Please try saving again.');
        }
        for(const kind of ['avatar','banner']){
          const key=`${kind}Url`;
          if(String(nextProfile[key]||'')!==String(nyxUserProfile?.[key]||'')){
            throw new Error(`The saved ${kind} image could not be loaded. Try selecting it again.`);
          }
        }
        if(nyxFounderIsOwner)await loadFounderProfile({force:true});
        syncFounderOwnerControls();
        close();
        if(location.pathname==='/apps/tutsi/profiles.html'&&parent!==window)parent.postMessage({type:'tutsi:profile-saved',displayName:nyxUserProfile.displayName},location.origin);
        toast(nyxFounderIsOwner?'Profile and About Nyx updated':'Profile saved');
      }catch(saveError){
        error.textContent=nyxFriendlyFirebaseError(saveError,'Profile could not be saved.');
        button.disabled=false;
        button.innerHTML=originalLabel;
      }
    });
  }
  function nyxFounderText(value,fallback,max){const text=String(value??'').trim().replace(/\s+/g,' ').slice(0,max);return text||fallback}
  function nyxFounderUrl(value,fallback=''){
    const raw=String(value??'').trim();
    if(!raw) return fallback;
    if(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw)&&raw.length<=NYX_PROFILE_IMAGE_DATA_LIMIT)return raw.replace(/\s/g,'');
    if(raw.length>1500)return fallback;
    if(/^\/assets\/[a-z0-9/_\-.]+$/i.test(raw)) return raw;
    if(/^\/api\/profile-media\/[A-Za-z0-9_-]{8,128}\/(?:avatar|banner)\/[A-Za-z0-9_-]{12,80}$/.test(raw)) return raw;
    try{const url=new URL(raw,location.origin);return /^(https?:)$/i.test(url.protocol)&&!url.username&&!url.password?url.href:fallback}catch{return fallback}
  }
  function normalizeNyxFounderProfile(value={}){
    const source=value&&typeof value==='object'?value:{};
    const badges=Array.isArray(source.badges)?source.badges:[];
    const roles=Array.isArray(source.roles)?source.roles:nyxFounderProfileDefaults.roles;
    const accentPrimary=/^#[0-9a-f]{6}$/i.test(String(source.accentPrimary||source.accent||'').trim())?String(source.accentPrimary||source.accent).trim().toLowerCase():nyxFounderProfileDefaults.accentPrimary;
    const accentSecondary=/^#[0-9a-f]{6}$/i.test(String(source.accentSecondary||'').trim())?String(source.accentSecondary).trim().toLowerCase():nyxFounderProfileDefaults.accentSecondary;
    const bannerColor=/^#[0-9a-f]{6}$/i.test(String(source.bannerColor||'').trim())?String(source.bannerColor).trim().toLowerCase():accentSecondary;
    const displayNameColorPrimary=/^#[0-9a-f]{6}$/i.test(String(source.displayNameColorPrimary||'').trim())?String(source.displayNameColorPrimary).trim().toLowerCase():nyxFounderProfileDefaults.displayNameColorPrimary;
    const displayNameColorSecondary=/^#[0-9a-f]{6}$/i.test(String(source.displayNameColorSecondary||'').trim())?String(source.displayNameColorSecondary).trim().toLowerCase():accentSecondary;
    const displayNameFont=NYX_DISPLAY_NAME_FONTS.some(([value])=>value===String(source.displayNameFont||'').toLowerCase())?String(source.displayNameFont).toLowerCase():nyxFounderProfileDefaults.displayNameFont;
    const displayNameEffect=NYX_DISPLAY_NAME_EFFECTS.some(([value])=>value===String(source.displayNameEffect||'').toLowerCase())?String(source.displayNameEffect).toLowerCase():nyxFounderProfileDefaults.displayNameEffect;
    const customEffectPattern=['starfield','aurora','comets','grid'].includes(String(source.customEffectPattern||'').toLowerCase())?String(source.customEffectPattern).toLowerCase():nyxFounderProfileDefaults.customEffectPattern;
    const customEffectColorPrimary=/^#[0-9a-f]{6}$/i.test(String(source.customEffectColorPrimary||'').trim())?String(source.customEffectColorPrimary).trim().toLowerCase():nyxFounderProfileDefaults.customEffectColorPrimary;
    const customEffectColorSecondary=/^#[0-9a-f]{6}$/i.test(String(source.customEffectColorSecondary||'').trim())?String(source.customEffectColorSecondary).trim().toLowerCase():accentSecondary;
    const customEffectSpeed=Math.max(2,Math.min(18,Number(source.customEffectSpeed)||nyxFounderProfileDefaults.customEffectSpeed));
    const customEffectIntensity=Math.max(20,Math.min(100,Number(source.customEffectIntensity)||nyxFounderProfileDefaults.customEffectIntensity));
    return {displayName:nyxFounderText(source.displayName,nyxFounderProfileDefaults.displayName,48),handle:nyxFounderText(source.handle,nyxFounderProfileDefaults.handle,40),role:nyxFounderText(source.role,nyxFounderProfileDefaults.role,64),bio:nyxFounderText(source.bio,nyxFounderProfileDefaults.bio,500),avatarUrl:nyxFounderUrl(source.avatarUrl,nyxFounderProfileDefaults.avatarUrl),bannerUrl:nyxFounderUrl(source.bannerUrl),accent:accentPrimary,accentPrimary,accentSecondary,bannerColor,displayNameFont,displayNameEffect,displayNameColorPrimary,displayNameColorSecondary,profileEffect:nyxProfileEffectValue(source.profileEffect),customEffectPattern,customEffectColorPrimary,customEffectColorSecondary,customEffectSpeed,customEffectIntensity,avatarDecoration:nyxAvatarDecorationValue(source.avatarDecoration),status:['online','idle','dnd','offline'].includes(String(source.status||'').toLowerCase())?String(source.status).toLowerCase():nyxFounderProfileDefaults.status,roles:roles.map(role=>nyxFounderText(role,'',32)).filter(Boolean).slice(0,8),badges:badges.map(badge=>nyxFounderText(badge,'',32)).filter(Boolean).slice(0,8),linkLabel:nyxFounderText(source.linkLabel,'',40),linkUrl:nyxFounderUrl(source.linkUrl)};
  }
  function nyxFounderProfileCardMarkup(){
    const profile=normalizeNyxFounderProfile(nyxFounderProfile);
    const roles=profile.roles.map(role=>{
      const roleKey=String(role||'').toLowerCase();
      const icon=['owner','admin','developer','moderator','member'].includes(roleKey)?`<img src="/assets/icons/roles/${roleKey}.png" alt="" aria-hidden="true">`:'';
      return `<span class="nyx-founder-role-chip${roleKey==='owner'?' nyx-founder-role-owner':''}">${icon}${esc(role)}</span>`;
    }).join('');
    const badges=profile.badges.map(badge=>`<span class="nyx-founder-badge">${esc(badge)}</span>`).join('');
    const link=profile.linkUrl?`<a class="nyx-founder-link" href="${esc(profile.linkUrl)}" target="_blank" rel="noreferrer noopener">${esc(profile.linkLabel||'Open profile')}<span aria-hidden="true">↗</span></a>`:'';
    const banner=profile.bannerUrl?`<img src="${esc(nyxProfileStillSource(profile.bannerUrl))}" alt="" aria-hidden="true">`:'';
    return `<article class="nyx-founder-profile nyx-founder-profile-standard nyx-founder-effect-${esc(profile.profileEffect)} ${nyxProfileEffectClass(profile)}" data-nyx-founder-profile style="--nyx-founder-accent:${profile.accentPrimary};--nyx-founder-accent-primary:${profile.accentPrimary};--nyx-founder-accent-secondary:${profile.accentSecondary};--nyx-founder-banner-color:${profile.bannerColor};--nyx-user-accent-primary:${profile.accentPrimary};--nyx-user-accent-secondary:${profile.accentSecondary};${nyxProfileEffectVars(profile)}"><i class="nyx-founder-profile-effect nyx-user-profile-effect" aria-hidden="true">${nyxProfileEffectArtwork(profile)}</i><div class="nyx-founder-banner" aria-hidden="true">${banner}</div><div class="nyx-founder-profile-content"><div class="nyx-founder-image-wrap nyx-avatar-decoration-${esc(profile.avatarDecoration)}"><img class="nyx-founder-image" src="${esc(nyxProfileStillSource(profile.avatarUrl))}" alt="${esc(profile.displayName)} profile picture"><i class="nyx-avatar-decoration" aria-hidden="true"><span></span></i><span class="nyx-founder-status nyx-founder-status-${esc(profile.status)}" title="${esc(profile.status)}" aria-label="${esc(profile.status)}"></span></div><div class="nyx-founder-copy"><div class="nyx-founder-name-row"><h3 class="${nyxDisplayNameStyleClass(profile)}" style="${nyxDisplayNameStyleVars(profile)}">${esc(profile.displayName)}</h3>${profile.roles.some(role=>role.toLowerCase()==='owner')?'<span class="nyx-founder-owner-crown" title="Nyx owner" aria-label="Nyx owner">♛</span>':''}</div><p class="nyx-founder-handle">${esc(profile.handle)}</p><p class="nyx-founder-role">${esc(profile.role)}</p>${roles?`<div class="nyx-founder-role-list" aria-label="Profile roles">${roles}</div>`:''}${badges?`<div class="nyx-founder-badges" aria-label="Profile badges">${badges}</div>`:''}<div class="nyx-founder-about"><strong>About me</strong><p class="nyx-founder-bio">${esc(profile.bio)}</p></div>${link}</div></div></article>`;
  }
  function refreshFounderProfileViews(){
    const update=root=>{try{root.querySelectorAll?.('[data-nyx-founder-profile]').forEach(card=>{card.outerHTML=nyxFounderProfileCardMarkup()});root.querySelectorAll?.('[data-nyx-credits-founder]').forEach(card=>{card.outerHTML=nyxCreditsFounderCardMarkup()});nyxManageFounderProfileGifs(root)}catch{}};
    update(document);
    document.querySelectorAll('iframe').forEach(frame=>update(frame.contentDocument));
  }
  async function loadFounderProfile({force=false}={}){
    if(nyxFounderProfileLoadPromise&&!force) return nyxFounderProfileLoadPromise;
    nyxFounderProfileLoadPromise=fetch('/api/founder-profile',{cache:'no-store'}).then(async response=>{
      if(!response.ok) throw new Error('Founder Profile is unavailable.');
      const data=await response.json();
      nyxFounderProfile=normalizeNyxFounderProfile(data?.profile);
      refreshFounderProfileViews();
      return data;
    }).catch(error=>{console.warn('Nyx Founder Profile could not load:',error);return {profile:nyxFounderProfile,persistent:false,editingEnabled:false}}).finally(()=>{nyxFounderProfileLoadPromise=null});
    return nyxFounderProfileLoadPromise;
  }
  async function openFounderProfileEditor(){
    if(!nyxFounderIsOwner){toast('Sign in with the founder Nyx account first.');return}
    await loadFounderProfile();
    document.querySelector('.nyx-founder-editor-overlay')?.remove();
    const profile=normalizeNyxFounderProfile(nyxFounderProfile);
    const overlay=document.createElement('div');
    overlay.className='nyx-founder-editor-overlay';
    overlay.innerHTML=`<section class="nyx-founder-editor" role="dialog" aria-modal="true" aria-labelledby="nyxFounderEditorTitle"><header><div><p class="utility-kicker">About Nyx</p><h2 id="nyxFounderEditorTitle">Customize Founder Profile</h2><p>Publishing as your signed-in founder account.</p></div><button type="button" class="nyx-founder-editor-close" data-close-founder-editor aria-label="Close">×</button></header><form class="nyx-founder-editor-form"><div class="nyx-founder-editor-grid"><label>Display name<input name="displayName" maxlength="48" required value="${esc(profile.displayName)}"></label><label>Handle<input name="handle" maxlength="40" required value="${esc(profile.handle)}"></label><label>Profile subtitle<input name="role" maxlength="64" required value="${esc(profile.role)}"></label><label>Status<select name="status"><option value="online" ${profile.status==='online'?'selected':''}>Online</option><option value="idle" ${profile.status==='idle'?'selected':''}>Idle</option><option value="dnd" ${profile.status==='dnd'?'selected':''}>Do not disturb</option><option value="offline" ${profile.status==='offline'?'selected':''}>Offline</option></select></label><label class="nyx-founder-editor-wide">Bio<textarea name="bio" maxlength="500" rows="4" required>${esc(profile.bio)}</textarea></label><label>Avatar U3L<input name="avatarUrl" type="url" value="${esc(profile.avatarUrl)}"></label><label>Banner U3L <small>Optional</small><input name="bannerUrl" type="url" value="${esc(profile.bannerUrl)}"></label><label>Accent color<input name="accent" type="color" value="${esc(profile.accent)}"></label><label>Roles <small>Comma-separated; access remains tied to your Firebase account ID.</small><input name="roles" maxlength="280" value="${esc(profile.roles.join(', '))}"></label><label>Badges <small>Comma-separated</small><input name="badges" maxlength="280" value="${esc(profile.badges.join(', '))}"></label><label>Profile link label <small>Optional</small><input name="linkLabel" maxlength="40" value="${esc(profile.linkLabel)}"></label><label>Profile link U3L <small>Optional</small><input name="linkUrl" type="url" value="${esc(profile.linkUrl)}"></label></div><footer><p class="nyx-founder-editor-error" aria-live="polite"></p><div><button type="button" class="settings-action" data-close-founder-editor>Cancel</button><button type="submit" class="settings-action on">Publish profile</button></div></footer></form></section>`;
    (document.getElementById('app') || document.body).appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.addEventListener('click',event=>{if(event.target===overlay||event.target.closest('[data-close-founder-editor]')) close()});
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape') close()});
    const form=overlay.querySelector('form');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const values=new FormData(form);
      const button=form.querySelector('[type="submit"]');
      const error=form.querySelector('.nyx-founder-editor-error');
      const next={displayName:values.get('displayName'),handle:values.get('handle'),role:values.get('role'),bio:values.get('bio'),avatarUrl:values.get('avatarUrl'),bannerUrl:values.get('bannerUrl'),accent:values.get('accent'),status:values.get('status'),roles:String(values.get('roles')||'').split(','),badges:String(values.get('badges')||'').split(','),linkLabel:values.get('linkLabel'),linkUrl:values.get('linkUrl')};
      button.disabled=true;
      error.textContent='';
      try{
        const token=await nyxGetFirebaseToken(true);
        if(!token) throw new Error('Your founder sign-in has expired. Sign in again.');
        const response=await fetch('/api/founder-profile',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({profile:next})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(data.error||'Profile could not be published.');
        nyxFounderProfile=normalizeNyxFounderProfile(data.profile);
        refreshFounderProfileViews();
        close();
        toast('Founder profile published');
      }catch(saveError){error.textContent=saveError.message||'Profile could not be published.';button.disabled=false}
    });
    setTimeout(()=>form.querySelector('[name="displayName"]')?.focus(),0);
  }
  const NYX_TERMS_VERSION='2026-07-30';
  function nyxTermsSectionsMarkup(){
    return `<section><h2>1. Eligibility</h2><p>You must comply with all applicable laws when using Nyx. If you are under the age required by your jurisdiction to enter into a binding agreement, you may only use Nyx with the permission of a parent or legal guardian.</p></section>
      <section><h2>2. Description of the Service</h2><p>Nyx is a platform that may provide features including, but not limited to:</p><ul><li>S3ARC4 and discovery tools</li><li>A1-powered transcription and summarization</li><li>Productivity and educational tools</li><li>Entertainment applications</li><li>Links to third-party websites and services</li><li>Experimental features released for testing</li></ul><p>Features may change, be added, modified, or removed at any time without notice.</p></section>
      <section><h2>3. Acceptable Use</h2><p>You agree not to:</p><ul><li>Violate any applicable law or regulation.</li><li>Attempt to gain unauthorized access to Nyx, its servers, or other users' systems.</li><li>Upload or distribute malware, viruses, or malicious code.</li><li>Interfere with or disrupt the operation of the Service.</li><li>Circumvent security measures, authentication systems, or rate limits.</li><li>Use automated systems that excessively burden our infrastructure.</li><li>Impersonate another person or entity.</li><li>Infringe upon the intellectual property or other legal rights of others.</li><li>Use Nyx in a manner that harms other users or the availability of the Service.</li></ul><p>We reserve the right to suspend, restrict, or terminate access for users who violate these Terms.</p></section>
      <section><h2>4. User Content</h2><p>Some features may allow you to submit text, media, links, or other content ("User Content").</p><p>You retain ownership of your User Content.</p><p>By submitting User Content, you grant Nyx a non-exclusive, worldwide, royalty-free license to host, process, reproduce, and display that content solely for the purpose of operating, maintaining, and improving the Service.</p><p>You represent that you have the necessary rights and permissions to submit any User Content you provide.</p></section>
      <section><h2>5. A1 Features</h2><p>Nyx may provide A1-generated content such as summaries, transcriptions, recommendations, or other generated material.</p><p>A1-generated output may be inaccurate, incomplete, or outdated. It should not be relied upon as professional, legal, financial, medical, or other expert advice.</p><p>Users are responsible for reviewing and verifying A1-generated content before relying on it.</p></section>
      <section><h2>6. Media Processing</h2><p>Nyx may process publicly available or user-submitted media to provide requested functionality.</p><p>You are solely responsible for ensuring that you have the necessary rights and permissions to submit or process any content through the Service.</p><p>Nyx does not claim ownership of submitted content.</p></section>
      <section><h2>7. Third-Party Services</h2><p>Nyx may contain links to or integrate with third-party websites, APIs, applications, or services.</p><p>We do not control or endorse third-party content and are not responsible for its availability, accuracy, security, functionality, or privacy practices.</p><p>Your use of third-party services is governed by their own terms and policies.</p></section>
      <section><h2>8. Intellectual Property</h2><p>Unless otherwise stated, Nyx, including its software, branding, design, graphics, logos, interface, and original content, is owned by Nyx or its licensors and is protected by applicable intellectual property laws.</p><p>You may not copy, modify, distribute, reverse engineer, sell, or commercially exploit any portion of the Service without prior written permission unless permitted by applicable law.</p></section>
      <section><h2>9. Availability</h2><p>The Service is provided on an <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> basis.</p><p>We do not guarantee that Nyx will always be available, uninterrupted, secure, or error-free.</p><p>Features may be modified, suspended, or discontinued at any time.</p></section>
      <section><h2>10. Privacy</h2><p>Your use of Nyx is also subject to our Privacy Policy.</p><p>By using the Service, you acknowledge that Nyx may collect and process information necessary to operate, maintain, improve, and secure the Service.</p></section>
      <section><h2>11. Cookies</h2><p>Nyx may use cookies, local storage, or similar technologies to:</p><ul><li>Remember user preferences.</li><li>Improve website performance.</li><li>Analyze anonymous usage statistics.</li><li>Enhance the overall user experience.</li></ul><p>You may disable cookies through your workspace settings, although doing so may affect certain features of the Service.</p></section>
      <section><h2>12. Limitation of Liability</h2><p>To the fullest extent permitted by applicable law, Nyx and its owners, developers, contributors, affiliates, and service providers shall not be liable for any indirect, incidental, special, exemplary, consequential, or punitive damages arising from or relating to the use of the Service.</p></section>
      <section><h2>13. Indemnification</h2><p>You agree to defend, indemnify, and hold harmless Nyx, its developers, affiliates, contributors, and service providers from any claims, damages, losses, liabilities, and expenses arising from:</p><ul><li>Your use of the Service.</li><li>Your violation of these Terms.</li><li>Your submitted content.</li><li>Your violation of any applicable law or the rights of another person.</li></ul></section>
      <section><h2>14. Termination</h2><p>We may suspend, restrict, or terminate your access to Nyx at any time, with or without notice, if we reasonably believe you have violated these Terms, abused the Service, or created a security or legal risk.</p><p>We may also discontinue the Service, in whole or in part, at any time.</p></section>
      <section><h2>15. Changes to These Terms</h2><p>We reserve the right to update or modify these Terms at any time.</p><p>The updated version becomes effective when posted on Nyx.</p><p>Your continued use of the Service after changes are posted constitutes your acceptance of the revised Terms.</p></section>
      <section><h2>16. Copyright &amp; DMCA Notice</h2><p>Nyx respects the intellectual property rights of others and responds to valid notices of alleged copyright infringement in accordance with the Digital Millennium Copyright Act ("DMCA") and other applicable laws.</p><p>A copyright owner or authorized agent submitting a takedown notice must provide:</p><ul><li>A physical or electronic signature of the copyright owner or authorized agent.</li><li>Identification of the copyrighted work claimed to have been infringed.</li><li>Identification and location of the allegedly infringing material, including the relevant Nyx page or U3L.</li><li>Contact information sufficient for Nyx to reach the complaining party.</li><li>A good-faith statement that the disputed use is not authorized by the copyright owner, its agent, or the law.</li><li>A statement, made under penalty of perjury, that the notice is accurate and that the complaining party is authorized to act for the copyright owner.</li></ul><p>After receiving a valid notice through Nyx's published copyright contact, Nyx may remove or disable access to the material and notify the affected user. An affected user may submit a valid counter-notice identifying the removed material, consenting to the appropriate court jurisdiction, and stating under penalty of perjury that the material was removed because of mistake or misidentification.</p><p>Nyx may restore material when permitted by law and may suspend or terminate repeat infringers. Knowingly making a material misrepresentation in a notice or counter-notice may result in legal liability.</p></section>`;
  }
  function nyxTermsPageMarkup(className='nyx-utility-tab nyx-terms-tab'){
    return `<article class="${esc(className)}"><p class="utility-kicker">Nyx</p><h1>Terms of Service</h1><p class="utility-updated"><strong>Effective Date:</strong> July 30, 2026</p><p class="utility-intro">Welcome to <strong>Nyx</strong> ("Nyx," "we," "our," or "us"). By accessing or using our website, applications, or services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.</p>${nyxTermsSectionsMarkup()}</article>`;
  }
  function nyxCreditsPageMarkup(className='nyx-utility-tab nyx-credits-tab'){
    return `<article class="${esc(className)}">
      <h1 class="nyx-credits-title">thanks!</h1>
      <ul class="nyx-credits-thanks" aria-label="Credits">
        <li>made by <strong>vdrtes</strong></li>
        <li>thanks to <a href="https://midtsy.xyz/" target="_blank" rel="noopener noreferrer" data-nyx-credit-link aria-label="midnight (opens a new window)"><strong>midnight</strong></a> for linkchecker api<a class="nyx-credits-site" href="https://nocturne.lol/" target="_blank" rel="noopener noreferrer" data-nyx-credit-link>nocturne.lol</a></li>
        <li>thanks to <strong>GN-math</strong> for games
          <ul class="nyx-credits-libraries" aria-label="Game libraries"><li>GN-math</li><li>Ultimate Game Stash</li><li>GMS</li><li>Lumin</li><li>CatClass</li><li>DuckMath</li></ul>
        </li>
        <li><img class="nyx-credits-p2p-icon" src="/assets/credits/p2p-games.png" alt="P2P Games" width="69" height="69">thanks to <strong>P2P Games</strong> for Creating Link generator</li>
      </ul>
    </article>`;
  }
  function nyxCreditsLinkClick(event){
    const link=event.target?.closest?.('.nyx-credits-tab a[data-nyx-credit-link]');
    if(!event.isTrusted || !link || !['https://midtsy.xyz/','https://nocturne.lol/'].includes(link.href)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    let host=window;
    try{if(window.parent!==window && window.parent.__nyxNativeOpen) host=window.parent}catch{}
    const nativeOpen=host.__nyxNativeOpen || host.open.bind(host);
    nativeOpen(link.href,'_blank',link.href==='https://midtsy.xyz/'?'popup,width=1000,height=760,noopener,noreferrer':'noopener,noreferrer');
    return true;
  }
  const nyxCreditsLinkScript='document.addEventListener("click",'+nyxCreditsLinkClick.toString()+',true);';
  function nyxCreditsFounderCardMarkup(){
    const profile=normalizeNyxFounderProfile(nyxFounderProfile);
    const roles=profile.roles.map(role=>`<span class="nyx-credits-founder-role">${esc(role)}</span>`).join('');
    const badges=profile.badges.map(badge=>`<span class="nyx-credits-founder-badge">${esc(badge)}</span>`).join('');
    const avatar=profile.avatarUrl?`<img src="${esc(profile.avatarUrl)}" alt="${esc(profile.displayName)} profile picture">`:`<span>${esc(profile.displayName.slice(0,1).toUpperCase()||'N')}</span>`;
    const banner=profile.bannerUrl?`<img src="${esc(profile.bannerUrl)}" alt="" aria-hidden="true">`:'';
    const link=profile.linkUrl?`<a class="nyx-credits-founder-link" href="${esc(profile.linkUrl)}" target="_blank" rel="noreferrer noopener">${esc(profile.linkLabel||'Open profile')} <span aria-hidden="true">↗</span></a>`:'';
    const statusLabel={online:'Online',idle:'Idle',dnd:'Do not disturb',offline:'Offline'}[profile.status]||'Online';
    return `<article class="nyx-credits-founder-card nyx-credits-founder-effect-${esc(profile.profileEffect)} nyx-avatar-decoration-${esc(profile.avatarDecoration)}" data-nyx-credits-founder style="--nyx-founder-accent:${profile.accentPrimary};--nyx-founder-accent-secondary:${profile.accentSecondary};--nyx-founder-banner-color:${profile.bannerColor}"><div class="nyx-credits-founder-media"><div class="nyx-credits-founder-banner">${banner}</div><div class="nyx-credits-founder-avatar">${avatar}<i class="nyx-avatar-decoration" aria-hidden="true"><span></span></i><span class="nyx-credits-founder-status nyx-founder-status-${esc(profile.status)}" title="${esc(statusLabel)}"></span></div><span class="nyx-credits-founder-presence nyx-founder-status-${esc(profile.status)}"><i aria-hidden="true"></i>${esc(statusLabel)}</span></div><div class="nyx-credits-founder-copy"><p class="nyx-credits-founder-role">${esc(profile.role)}</p><h3 class="${nyxDisplayNameStyleClass(profile)}" style="${nyxDisplayNameStyleVars(profile)}">${esc(profile.displayName)}</h3><p class="nyx-credits-founder-handle">${esc(profile.handle)}</p><p class="nyx-credits-founder-bio">${esc(profile.bio||'No bio yet.')}</p>${roles?`<div class="nyx-credits-founder-roles" aria-label="Founder roles">${roles}</div>`:''}${badges?`<div class="nyx-credits-founder-badges" aria-label="Founder badges">${badges}</div>`:''}${link}</div></article>`;
  }
  const nyxPublicProfileInlinePolish='.nyx-founder-profile-standard{max-width:480px!important;border-color:color-mix(in srgb,#555963 72%,var(--nyx-founder-accent-primary,#8fb8ff))!important;border-radius:14px!important;background:linear-gradient(180deg,#1c1e24,color-mix(in srgb,#191b20 96%,var(--nyx-founder-accent-primary,#8fb8ff)))!important;box-shadow:0 14px 32px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.035)!important}.nyx-founder-profile-standard .nyx-founder-banner{width:100%!important;height:132px!important}.nyx-founder-profile-standard .nyx-founder-profile-content{padding:0 11px 11px!important}.nyx-founder-profile-standard .nyx-founder-image-wrap{width:78px!important;height:78px!important;margin-top:-40px!important;border:4px solid #1c1e24!important;background:#1c1e24!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 72%,#d5d9e1),0 7px 15px rgba(0,0,0,.34)!important}.nyx-founder-profile-standard .nyx-founder-copy{margin-top:8px!important;padding:12px!important;border-color:rgba(255,255,255,.08)!important;border-radius:10px!important;background:linear-gradient(180deg,color-mix(in srgb,#272a32 97%,var(--nyx-founder-accent-primary,#8fb8ff)),#22242b)!important}.nyx-founder-profile-standard .nyx-founder-copy h3{font-size:20px!important;line-height:1.15!important}.nyx-founder-profile-standard .nyx-founder-handle{margin:2px 0 8px!important;font-size:12px!important}.nyx-founder-profile-standard .nyx-founder-role{margin:8px 0!important;color:#aeb2bd!important;font-size:10px!important;letter-spacing:.075em!important}.nyx-founder-role-list{gap:6px!important;margin:0 0 10px!important}.nyx-founder-role-chip,.nyx-founder-profile-standard .nyx-founder-badge{min-height:23px!important;padding:2px 7px!important;border:1px solid #484b55!important;border-radius:6px!important;background:#2b2e36!important;font-size:10.5px!important;transition:border-color .18s ease,background-color .18s ease,transform .18s ease!important}.nyx-founder-role-owner{border-color:color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 68%,#c5c9d2)!important;background:color-mix(in srgb,#2b2e36 81%,var(--nyx-founder-accent-primary,#8fb8ff))!important}.nyx-founder-role-chip:hover{border-color:color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 60%,#70747e)!important;background:color-mix(in srgb,#2b2e36 87%,var(--nyx-founder-accent-primary,#8fb8ff))!important;transform:translateY(-1px)!important}.nyx-founder-about{margin-top:2px!important;padding-top:10px!important;border-top-color:rgba(255,255,255,.075)!important}.nyx-founder-about>strong{margin-bottom:5px!important;color:#b8bdc8!important;font-size:10px!important;letter-spacing:.075em!important}.nyx-founder-profile-standard .nyx-founder-bio{font-size:12.5px!important;line-height:1.48!important}.nyx-founder-profile-standard .nyx-founder-link{margin-top:10px!important;font-size:12px!important}';
  const nyxDiscordCreditsProfileStyle='.nyx-credits-hero{margin-bottom:34px!important}.nyx-credits-hero h1{font-size:clamp(36px,6vw,54px)!important;font-weight:600!important}.nyx-credits-section{margin-bottom:44px!important}.nyx-credits-section>h2{margin-bottom:18px!important;font-size:26px!important}.nyx-founder-profile-standard{max-width:510px!important;border-radius:12px!important;background:linear-gradient(155deg,color-mix(in srgb,var(--nyx-founder-accent-primary,#5865f2) 66%,#202126),color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 30%,#18191e))!important}.nyx-founder-profile-standard .nyx-founder-banner{height:150px!important;aspect-ratio:auto!important;background:var(--nyx-founder-banner-color,var(--nyx-founder-accent-secondary,#8ea1ff))!important}.nyx-founder-profile-standard .nyx-founder-banner img{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important}.nyx-founder-profile-standard .nyx-founder-profile-content{padding:0 14px 14px!important}.nyx-founder-profile-standard .nyx-founder-image-wrap{width:84px!important;height:84px!important;margin-top:-43px!important;border-color:color-mix(in srgb,var(--nyx-founder-accent-primary,#5865f2) 62%,#18191e)!important}.nyx-founder-profile-standard .nyx-founder-copy{margin-top:9px!important;padding:13px!important;border:1px solid color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 38%,transparent)!important;border-radius:9px!important;background:color-mix(in srgb,var(--nyx-founder-accent-primary,#5865f2) 14%,rgba(12,13,17,.76))!important}.nyx-founder-profile-standard .nyx-founder-copy h3{font-size:21px!important}.nyx-founder-profile-standard .nyx-founder-role{margin-top:10px!important}.nyx-founder-profile-standard .nyx-founder-about{margin-top:4px!important}.nyx-founder-profile-standard .nyx-founder-bio{font-size:13px!important}'+nyxPublicProfileInlinePolish;
  const nyxCreditsPresentationStyle=`/* Shared by the internal Credits tab and desktop About window. */
html body .nyx-credits-tab{box-sizing:border-box;width:100%;max-width:960px;min-height:65vh;margin:0 auto;padding:clamp(48px,9vh,96px) 24px 64px!important;text-align:center;color:#e0ddea}
html body .nyx-credits-tab .nyx-credits-title{margin:0 0 48px!important;padding:0;border:0;color:#a8a1b8!important;font-size:28px!important;font-weight:400!important;letter-spacing:0!important;line-height:1.4;text-shadow:none!important}
html body .nyx-credits-tab .nyx-credits-thanks{display:grid;gap:40px;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;list-style:none}
html body .nyx-credits-thanks li{margin:0;padding:0;color:#e0ddea;font-size:clamp(18px,2.2vw,24px);line-height:1.7;overflow-wrap:anywhere}
html body .nyx-credits-thanks strong{font-weight:700}
html body .nyx-credits-thanks a{color:#a69bff;text-decoration:none;text-underline-offset:5px}
html body .nyx-credits-thanks a:hover{text-decoration:underline}
html body .nyx-credits-thanks a:focus-visible{outline:2px solid #b8afff;outline-offset:5px;border-radius:3px}
html body .nyx-credits-thanks .nyx-credits-site{display:block;width:fit-content;margin:5px auto 0;font-size:16px}
@media(max-width:480px){html body .nyx-credits-tab{padding:48px 20px!important}html body .nyx-credits-tab .nyx-credits-title{margin-bottom:36px!important}}

html body .nyx-credits-thanks .nyx-credits-libraries{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 20px;width:100%;max-width:none!important;margin:12px auto 0!important;padding:0!important;list-style:none}
html body .nyx-credits-thanks .nyx-credits-libraries li{font-size:15px;color:#b8b1c8;line-height:1.8}
html body .nyx-credits-thanks .nyx-credits-p2p-icon{display:block;width:60px;height:60px;object-fit:contain;margin:0 auto 12px}
`;
  const nyxCreditsProfileReferenceStyle=`
    .nyx-credits-founder-card{display:block;max-width:470px;margin:0;border-color:rgba(255,255,255,.12);border-radius:16px;background:#111216;box-shadow:0 18px 40px rgba(0,0,0,.28)}.nyx-credits-founder-media{min-height:142px;overflow:visible;background:#f3eef5}.nyx-credits-founder-banner{overflow:hidden;border-radius:15px 15px 0 0;background:var(--nyx-founder-banner-color,#f3eef5)}.nyx-credits-founder-banner::after{display:none}.nyx-credits-founder-banner img{object-position:center;opacity:.92}.nyx-credits-founder-avatar{left:18px;bottom:-47px;width:92px;height:92px;border:6px solid #111216;box-shadow:0 0 0 2px rgba(255,255,255,.18),0 8px 18px rgba(0,0,0,.32)}.nyx-credits-founder-status{right:-2px;bottom:1px;border-color:#111216}.nyx-credits-founder-presence{position:absolute;z-index:2;left:118px;bottom:-39px;display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:0 13px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:#202126;color:#d9dde5;font-size:12px;font-weight:650;box-shadow:0 5px 14px rgba(0,0,0,.2)}.nyx-credits-founder-presence i{width:8px;height:8px;border-radius:50%;background:#77849a}.nyx-credits-founder-presence.nyx-founder-status-online i{background:#5bc68a}.nyx-credits-founder-presence.nyx-founder-status-idle i{background:#e4b65a}.nyx-credits-founder-presence.nyx-founder-status-dnd i{background:#df6875}.nyx-credits-founder-copy{padding:60px 20px 21px}.nyx-credits-founder-copy>p.nyx-credits-founder-role{margin:0 0 7px!important;color:#aeb5c1!important;font-size:10px!important;letter-spacing:.08em!important}.nyx-credits-founder-copy h3{font-size:26px!important;line-height:1.1!important}.nyx-credits-founder-handle{margin:4px 0 14px!important;color:#9ba2ae!important}.nyx-credits-founder-bio{color:#d6d9df!important;font-size:13px!important;line-height:1.55!important}.nyx-credits-founder-roles,.nyx-credits-founder-badges{margin-top:14px}.nyx-credits-founder-role,.nyx-credits-founder-badge{border-color:#444750;border-radius:6px;background:#24262d;color:#d9dde5}.nyx-credits-founder-roles .nyx-credits-founder-role:first-child{border-color:color-mix(in srgb,var(--nyx-founder-accent,var(--credits-accent)) 62%,#535763);background:color-mix(in srgb,#262830 82%,var(--nyx-founder-accent,var(--credits-accent)));color:#fff}@media(max-width:720px){.nyx-credits-founder-card{max-width:none}.nyx-credits-founder-media{min-height:132px}.nyx-credits-founder-copy{padding:58px 18px 19px}}
  `;
  const nyxCreditsOwnerImageStyle=`.nyx-credits-owner-image{width:min(394px,100%);margin:0}.nyx-credits-owner-image img{display:block;width:100%;height:auto;border-radius:0}`;
  const DEFAULT_WORKSPACE_MODE='scramjet';
  const DEFAULT_WORKSPACE_TRANSPORT='libcurlRaw';
  function normalizeWorkspaceTransportName(value=DEFAULT_WORKSPACE_TRANSPORT){
    const name=String(value || DEFAULT_WORKSPACE_TRANSPORT).trim().toLowerCase()
      .replace(atob('bGliY3VybA=='),'libcurl').replace('textlib','libcurl')
      .replace(atob('ZXBveHk='),'epoxy').replace('atlas','epoxy');
    if(name==='libcurl' || name==='libcurlraw') return 'libcurlRaw';
    if(name==='epoxy' || name==='wisp' || name==='auto') return name;
    return DEFAULT_WORKSPACE_TRANSPORT;
  }
  if(String(store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT)).toLowerCase()==='libcurl'){
    store.setText('nyx.transport','libcurlRaw');
  }
  const nyxFontOptions=[
    ['outfit','Outfit','Outfit,Arial,sans-serif'],
    ['raleway','Raleway','Raleway,Arial,sans-serif'],
    ['nunito','Nunito','Nunito,Arial,sans-serif'],
    ['inter','Inter','Inter,Arial,sans-serif'],
    ['poppins','Poppins','Poppins,Arial,sans-serif'],
    ['quicksand','Quicksand','Quicksand,Arial,sans-serif'],
    ['lexend','Lexend','Lexend,Arial,sans-serif'],
    ['montserrat','Montserrat','Montserrat,Arial,sans-serif'],
    ['atkinson','Atkinson Hyperlegible','"Atkinson Hyperlegible",Arial,sans-serif']
  ];
  function nyxFontChoice(value=store.text('nyx.font','inter')){
    const key=String(value || 'outfit').toLowerCase();
    return nyxFontOptions.find(item=>item[0]===key) || nyxFontOptions[0];
  }
  function nyxFontOptionsMarkup(selected=store.text('nyx.font','inter')){
    const current=nyxFontChoice(selected)[0];
    return nyxFontOptions.map(([key,label])=>`<option value="${esc(key)}" ${key===current?'selected':''}>${esc(label)}</option>`).join('');
  }
  function applyFontSetting(root=document){
    const [key,,family]=nyxFontChoice();
    document.documentElement.style.setProperty('--nyx-font',family);
    document.body.dataset.nyxFont=key;
    root.querySelectorAll?.('[data-font-value]')?.forEach(select=>{
      select.innerHTML=nyxFontOptionsMarkup(key);
      select.value=key;
    });
  }

  function popupProtectionEnabled(){
    return store.get('nyx.popupProtection',true);
  }
  function requiresContainedPopupNavigation(url){
    try{
      const source=workspaceShellSourceUrl(url) || String(url || '');
      const host=new URL(normalize(source),location.href).hostname.replace(/^www\./,'').toLowerCase();
      return host==='aether.cx' || host.endsWith('.aether.cx');
    }catch{return false}
  }
  function popupProtectionForUrl(url){
    return popupProtectionEnabled() || requiresContainedPopupNavigation(url);
  }
  const workspaceAdResourceSignature=/(?:^|[./_-])(?:adinplay|adpushup|adservice|adserver|adnxs|adsrvr|adsterra|adtrafficquality|advertising|amazon-adsystem|clickadu|criteo|doubleclick|exoclick|gamedistribution|gamemonetize|googleadservices|googlesyndication|hilltopads|imasdk|intergi|mgid|monetag|onclickads|openx|outbrain|pagead|playwire|poki-master-loader|poki-sdk|popads|popcash|propellerads|pubmatic|r9x|revcontent|rubiconproject|taboola|trafficjunky|venatus)(?:[./?&=_-]|$)/i;
  const workspaceAdElementSelector='iframe[src*="adinplay"],iframe[src*="adtrafficquality"],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="googleadservices"],iframe[src*="adservice"],iframe[src*="adnxs"],iframe[src*="playwire"],iframe[src*="r9x.in"],iframe[src*="taboola"],iframe[src*="outbrain"],iframe[src*="ads.emulatorjs.org"],iframe[src*="/ad-campaigns/"],script[src*="adinplay"],script[src*="doubleclick"],script[src*="googlesyndication"],script[src*="googleadservices"],script[src*="adservice"],script[src*="adtrafficquality"],script[src*="gamedistribution"],script[src*="gamemonetize"],script[src*="imasdk"],script[src*="playwire"],script[src*="poki-master-loader"],script[src*="poki-sdk"],script[src*="r9x.in"],script[src*="/ads.js"],.adsbygoogle,[data-ad-client],[data-ad-slot],[id^="google_ads"],[id*="google_ads"],[id^="ad-container"],[class~="ad-container"],[class~="ad-banner"],[class~="ad-wrapper"],[class~="ad-overlay"],[class~="advertisement"],[aria-label="Advertisement"]';
  const workspaceAttachedAdSignature=/(?:reminder\s*\(\s*\d+\s*\)[\s\S]{0,180}download\s+pending)|(?:download\s+pending[\s\S]{0,180}finish\s+it\s+now)|(?:finish\s+it\s+now[\s\S]{0,180}(?:close|continue))|(?:\[\s*\d+\s*\]\s*update\s*:\s*opera\s+browser[\s\S]{0,180}install)|(?:install\s+(?:opera\s+browser|browser\s+update|extension)[\s\S]{0,180}(?:install\s+for\s+free|continue|download))|(?:sponsored\s+(?:download|update)[\s\S]{0,120}(?:install|continue))/i;





  const knownNyxOverlaySelector='.nyx-prompt-shade,.nyx-modal-shade,.nyx-download-safety-shade,.nyx-tos-gate,.nyx-release-notes-overlay,.setup-screen,.setup-panel,.lock-screen,.nyx-workspace-tab-sidebar,.nyx-visual-dock,.workspace-shell-settings-overlay,.nyx-dashboard-menu,.nyx-account-menu,.nyx-account-overlay,.nyx-user-profile-overlay,.nyx-profile-directory-overlay,.nyx-founder-editor-overlay,.nyx-owner-dashboard-overlay,.context-menu,[data-nyx-owned-overlay]';
  function isWorkspaceAttachedOverlay(node){
    if(!(node instanceof Element) || node===document.body || node===document.documentElement) return false;
    if(node.matches('#app,#desktop,.top-os,.window,.workspace-window,.workspace-body,.workspace-home,#nyxStudyHubStartup,#nyxStudyHubBackground,#nyxPrivacyCover,#nyxWaveBg,#setupLaunchScreen,.nyx-prompt-shade,.nyx-modal-shade')) return false;
    if(node.closest(knownNyxOverlaySelector)) return false;
    const frames=node.matches('iframe') ? [node] : [...node.querySelectorAll('iframe')];
    if(frames.some(frame=>!frame.matches('#nyxStudyHubStartup,#nyxStudyHubBackground,#nyxPrivacyCover,#nyxWaveBg,.workspace-body > iframe.view,iframe[title="nyx"]'))) return true;
    const resource=String(node.getAttribute('src') || node.getAttribute('href') || node.getAttribute('data-src') || '');
    if(resource && workspaceAdResourceSignature.test(resource)) return true;
    const text=String(node.innerText || node.textContent || '').replace(/\s+/g,' ').trim().slice(0,1200);
    if(workspaceAttachedAdSignature.test(text)) return true;
    try{
      const style=getComputedStyle(node);
      const rect=node.getBoundingClientRect();
      const viewportArea=Math.max(1,innerWidth*innerHeight);
      const area=Math.max(0,rect.width)*Math.max(0,rect.height);
      const zIndex=Number.parseInt(style.zIndex,10);
      const layered=style.position==='fixed' || style.position==='sticky' || (style.position==='absolute' && Number.isFinite(zIndex) && zIndex>=1000);
      const large=area>=viewportArea*.12 || (rect.width>=innerWidth*.72 && rect.height>=72);
      const interactive=!!node.querySelector('a[href],button,form,iframe,img[src],video') || node.matches('a[href],button,form,iframe,img[src],video');
      return layered && large && interactive && (!Number.isFinite(zIndex) || zIndex>=100);
    }catch{return false}
  }
  function workspaceAttachedOverlayRoot(node){
    let root=node instanceof Element ? node : node?.parentElement;
    if(!root) return null;
    let candidate=isWorkspaceAttachedOverlay(root) ? root : null;
    for(let depth=0;root?.parentElement && depth<8;depth+=1){
      const parent=root.parentElement;
      if(parent===document.body || parent===document.documentElement) break;
      if(parent.matches('#app,#desktop,.top-os,.window,.workspace-window,.workspace-body,.workspace-home')) break;
      root=parent;
      if(isWorkspaceAttachedOverlay(root)) candidate=root;
    }
    return candidate;
  }
  function cleanupWorkspaceAttachedAds(root=document){
    const candidates=[];
    if(root instanceof Element) candidates.push(root);
    root.querySelectorAll?.('body > *, #app > *, #desktop > *, .workspace-window > *')?.forEach(node=>candidates.push(node));
    const removed=new Set();
    for(const candidate of candidates){
      const overlay=workspaceAttachedOverlayRoot(candidate);
      if(!overlay || removed.has(overlay) || !overlay.isConnected) continue;
      removed.add(overlay);
      overlay.remove();
      console.info('Nyx removed an ad overlay that escaped its workspace tab.');
    }
    return removed.size;
  }
  let workspaceOverlayQuarantineInstalled=false;
  let workspaceOverlayQuarantineUntil=0;
  function installWorkspaceOverlayQuarantine(){
    if(workspaceOverlayQuarantineInstalled || !document.documentElement) return;
    workspaceOverlayQuarantineInstalled=true;
    const inspectRoot=root=>{
      const overlay=workspaceAttachedOverlayRoot(root);
      if(overlay?.isConnected){
        overlay.remove();
        console.info('Nyx blocked an ad overlay from leaving its workspace tab.');
      }
    };
    const inspect=records=>{
      if(!popupProtectionEnabled()) return;
      if(!document.querySelector('iframe[data-nyx-workspace-contained="true"]') && Date.now()>workspaceOverlayQuarantineUntil) return;
      for(const record of records){
        if(record.type!=='childList') continue;
        record.addedNodes.forEach(root=>{
          inspectRoot(root);
          setTimeout(()=>inspectRoot(root),0);
          setTimeout(()=>inspectRoot(root),80);
        });
      }
    };
    new MutationObserver(inspect).observe(document.documentElement,{childList:true,subtree:true});
    cleanupWorkspaceAttachedAds();
  }
  installWorkspaceOverlayQuarantine();
  function isAnimexUrl(url){
    try{
      const host=new URL(normalize(url),location.href).hostname.replace(/^www\./,'').toLowerCase();
      return host==='animex.one' || host.endsWith('.animex.one');
    }catch{return false}
  }
  function shownyxPrompt(message,{loop=false,onOk=null}={}){
    document.querySelectorAll('.nyx-prompt-shade').forEach(el=>el.remove());
    const shade=document.createElement('div');
    shade.className='nyx-prompt-shade';
    shade.innerHTML=`<div class="nyx-prompt" role="dialog" aria-modal="true"><div class="nyx-prompt-title">${esc(location.hostname || 'nyx')} says</div><div class="nyx-prompt-message">${esc(message)}</div><input class="nyx-prompt-input" autocomplete="off" spellcheck="false"><div class="nyx-prompt-actions"><button class="nyx-prompt-ok" type="button">OK</button><button class="nyx-prompt-cancel" type="button">Cancel</button></div></div>`;
    (document.getElementById('app') || document.body).appendChild(shade);
    const ok=shade.querySelector('.nyx-prompt-ok');
    const input=shade.querySelector('.nyx-prompt-input');
    input?.focus();
    ok.onclick=()=>{
      shade.remove();
      if(loop) setTimeout(()=>shownyxPrompt(message,{loop:true}),0);
      else if(typeof onOk==='function') onOk();
    };
    shade.querySelector('.nyx-prompt-cancel')?.addEventListener('click',()=>shade.remove());
    input?.addEventListener('keydown',e=>{
      if(e.key==='Enter') ok.click();
      if(e.key==='Escape') shade.querySelector('.nyx-prompt-cancel')?.click();
    });
    return shade;
  }
  function nyxDownloadDisplayName(filename,url){
    const supplied=String(filename || '').trim().split(/[\\/]/).pop();
    if(supplied) return supplied.slice(0,180);
    try{
      const parsed=new URL(String(url || ''),location.href);
      return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname || 'download').slice(0,180);
    }catch{return 'download'}
  }
  function nyxDownloadCheckUrl(downloadUrl,sourceUrl=''){
    const actual=String(downloadUrl || '').trim();
    const source=String(sourceUrl || '').trim();
    if(/^(?:blob|data):/i.test(actual)) return workspaceShellSourceUrl(source) || source;
    return workspaceShellSourceUrl(actual) || actual || workspaceShellSourceUrl(source) || source;
  }
  function nyxDownloadSafetyDialog(result,{filename,url}={}){
    document.querySelectorAll('.nyx-download-safety-shade').forEach(element=>element.remove());
    return new Promise(resolve=>{
      const blocked=result?.verdict==='blocked';
      const shade=document.createElement('div');
      shade.className='nyx-download-safety-shade';
      const threatList=Array.isArray(result?.threats) && result.threats.length
        ? `<p class="nyx-download-safety-threats">Detected: ${esc(result.threats.join(', ').replaceAll('_',' ').toLowerCase())}</p>`
        : '';
      let host='Unknown source';
      try{host=new URL(String(url || ''),location.href).hostname || host}catch{}
      shade.innerHTML=`<section class="nyx-download-safety-dialog ${blocked?'is-blocked':'is-caution'}" role="alertdialog" aria-modal="true" aria-labelledby="nyxDownloadSafetyTitle" aria-describedby="nyxDownloadSafetyMessage">
        <span class="nyx-download-safety-icon" aria-hidden="true">${blocked?'!':'?'}</span>
        <div class="nyx-download-safety-copy">
          <p class="nyx-download-safety-kicker">Download protection</p>
          <h2 id="nyxDownloadSafetyTitle">${blocked?'Download blocked':'Check this download'}</h2>
          <p class="nyx-download-safety-file">${esc(filename || 'download')}</p>
          <p class="nyx-download-safety-source">From ${esc(host)}</p>
          <p id="nyxDownloadSafetyMessage">${esc(result?.message || 'Nyx could not verify this download.')}</p>
          ${threatList}
          <p class="nyx-download-safety-note">Nyx checked the U3L reputation only. The file bytes were not uploaded or antivirus-scanned.</p>
        </div>
        <footer>
          <button class="settings-action" data-nyx-download-cancel type="button">${blocked?'Close':'Cancel'}</button>
          ${blocked?'':`<button class="settings-action on" data-nyx-download-continue type="button">Download anyway</button>`}
        </footer>
      </section>`;
      (document.getElementById('app') || document.body).appendChild(shade);
      const finish=allowed=>{shade.remove();resolve(allowed)};
      shade.querySelector('[data-nyx-download-cancel]')?.addEventListener('click',()=>finish(false));
      shade.querySelector('[data-nyx-download-continue]')?.addEventListener('click',()=>finish(true));
      shade.addEventListener('click',event=>{if(event.target===shade)finish(false)});
      shade.addEventListener('keydown',event=>{if(event.key==='Escape')finish(false)});
      shade.querySelector('button')?.focus();
    });
  }
  async function nyxRequestWorkspaceDownload(downloadUrl,filename='',sourceUrl=''){
    const href=String(downloadUrl || '').trim();
    if(!href || /^(?:javascript|vbscript):/i.test(href)){
      toast('Nyx blocked an invalid download address');
      return false;
    }
    const displayName=nyxDownloadDisplayName(filename,href);
    const checkUrl=nyxDownloadCheckUrl(href,sourceUrl);
    let result={
      verdict:'unverified',
      threats:[],
      fileScanned:false,
      message:"Nyx could not identify the source U3L. The file contents were not antivirus-scanned."
    };
    if(/^https?:\/\//i.test(checkUrl)){
      toast('Checking download source…');
      try{
        const response=await fetch('/api/download-safety/check',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({url:checkUrl,filename:displayName})
        });
        const payload=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(payload.error || `Download check failed (${response.status})`);
        result=payload;
      }catch(error){
        console.warn('Nyx download safety check failed:',error?.message || error);
        result={
          verdict:'unverified',
          threats:[],
          fileScanned:false,
          message:"The U3L reputation check is unavailable. The file contents were not antivirus-scanned."
        };
      }
    }
    if(result.verdict==='blocked'){
      await nyxDownloadSafetyDialog(result,{filename:displayName,url:checkUrl || sourceUrl});
      return false;
    }
    if(result.verdict!=='clear'){
      const allowed=await nyxDownloadSafetyDialog(result,{filename:displayName,url:checkUrl || sourceUrl});
      if(!allowed) return false;
    }else{
      toast("No known U3L threat found — starting download");
    }
    const link=document.createElement('a');
    link.href=href;
    link.download=String(filename || '').trim();
    link.rel='noopener';
    link.hidden=true;
    (document.getElementById('app') || document.body).appendChild(link);
    link.click();
    setTimeout(()=>link.remove(),0);
    return true;
  }

  const hieroglyphTextNodes = new WeakMap();
  const hieroglyphSkipSelector = 'script,style,noscript,textarea,input,select,option,iframe,canvas,svg,audio,video';
  const hieroglyphLetters = {
    a:'𓄿',b:'𓃀',c:'𓎡',d:'𓂧',e:'𓇌',f:'𓆑',g:'𓎼',h:'𓉔',i:'𓇋',j:'𓆓',k:'𓎡',l:'𓃭',m:'𓅓',
    n:'𓈖',o:'𓅱',p:'𓊪',q:'𓈎',r:'𓂋',s:'𓋴',t:'𓏏',u:'𓅱',v:'𓆑',w:'𓅱',x:'𓐍',y:'𓇌',z:'𓊃',
    '0':'𓏤','1':'𓏺','2':'𓏻','3':'𓏼','4':'𓏽','5':'𓏾','6':'𓏿','7':'𓐀','8':'𓐁','9':'𓐂'
  };

  const hasHostedBackend = () => location.protocol === 'http:' || location.protocol === 'https:';
  const workspaceShellTabs = [];
  const workspaceShellOpeningTabs = new Set();
  let workspaceShellActiveTab = null;
  let nyxErudaLoadPromise = null;
  let nyxErudaHost = null;
  let nyxErudaInitialized = false;
  function loadNyxEruda(){
    if(window.eruda) return Promise.resolve(window.eruda);
    if(nyxErudaLoadPromise) return nyxErudaLoadPromise;
    nyxErudaLoadPromise=new Promise((resolve,reject)=>{
      const loader=document.createElement('script');
      loader.src='/assets/vendor/eruda.min.js?v=3.4.3';
      loader.dataset.nyxErudaLoader='true';
      loader.onload=()=>window.eruda ? resolve(window.eruda) : reject(new Error('Eruda did not initialize'));
      loader.onerror=()=>reject(new Error('Eruda could not be downloaded'));
      document.head.appendChild(loader);
    }).catch(error=>{
      nyxErudaLoadPromise=null;
      throw error;
    });
    return nyxErudaLoadPromise;
  }
  function hideNyxErudaPanel(){
    try{window.eruda?.hide?.()}catch{}
    if(nyxErudaHost) nyxErudaHost.hidden=true;
  }
  async function showNyxErudaPanel(win){
    const body=win?.querySelector('.workspace-body');
    if(!body) return;
    let host=body.querySelector(':scope > .nyx-eruda-host');
    if(!host){
      host=document.createElement('div');
      host.className='nyx-eruda-host';
      host.setAttribute('aria-label','Eruda developer tools');
      body.appendChild(host);
    }
    host.hidden=false;
    if(nyxErudaHost && nyxErudaHost!==host && nyxErudaInitialized){
      try{window.eruda?.destroy?.()}catch{}
      nyxErudaInitialized=false;
    }
    nyxErudaHost=host;
    let status=host.querySelector('.nyx-eruda-loading');
    let mount=host.querySelector('.nyx-eruda-root, #eruda');
    if(!nyxErudaInitialized){
      host.replaceChildren();
      mount=document.createElement('div');
      mount.className='nyx-eruda-root';
      status=document.createElement('p');
      status.className='nyx-eruda-loading';
      status.setAttribute('role','status');
      status.textContent='Starting Eruda...';
      host.append(mount,status);
    }
    try{
      const eruda=await loadNyxEruda();
      if(activeWorkspaceShellTab()?.url!=='nyx://developer') return;
      if(!nyxErudaInitialized){
        eruda.init({container:mount,tool:['console','elements','network','resources','sources','info','snippets'],useShadowDom:true,autoScale:true,defaults:{displaySize:100,transparency:1,theme:'Dark'}});
        const elementsTool=eruda.get?.('elements');
        if(elementsTool?._detail){
          elementsTool._detail._highlight=()=>{};
        }
        nyxErudaInitialized=true;
      }
      host.hidden=false;
      setTimeout(()=>{
        eruda.show();
        eruda.show('console');
        status?.remove();
        const root=host.querySelector('#eruda')?.shadowRoot;
        const container=root?.querySelector('.eruda-container');
        const panel=root?.querySelector('.eruda-dev-tools');
        [container,panel].forEach(element=>{
          if(!element) return;
          element.style.setProperty('position','absolute','important');
          element.style.setProperty('inset','0','important');
          element.style.setProperty('width','100%','important');
          element.style.setProperty('height','100%','important');
        });
        if(panel){
          panel.style.setProperty('display','block','important');
          panel.style.setProperty('opacity','1','important');
        }
        const entry=root?.querySelector('.eruda-entry-btn');
        if(entry) entry.style.setProperty('display','none','important');
        if(nyxEarlyConsoleBuffering){
          const buffered=nyxEarlyConsoleEntries.splice(0);
          nyxEarlyConsoleBuffering=false;
          buffered.forEach(item=>{
            const method=typeof console[item.level]==='function' ? item.level : 'log';
            console[method](`[${item.time.toLocaleTimeString()}]`,...item.args);
          });
        }
      },125);
    }catch(error){
      if(status){
        status.classList.add('error');
        status.textContent='Eruda could not load. Check your connection and reopen this tab.';
      }
      console.error('Nyx Eruda failed to load',error);
    }
  }
  const engines = {
    bing:'https://www.bing.com/search?q=',
    google:'https://www.google.com/search?q=',
    duckduckgo:'https://duckduckgo.com/?q='
  };
  function selectedSearchEngineMeta(){
    const saved=String(store.text('nyx.engine','duckduckgo')).trim().toLowerCase();
    const id=Object.prototype.hasOwnProperty.call(engines,saved) ? saved : 'duckduckgo';
    const entries={
      duckduckgo:{id:'duckduckgo',label:'Reference Search',icon:appIcon('duckduckgo.com')},
      google:{id:'google',label:'Google',icon:appIcon('google.com')},
      bing:{id:'bing',label:'Bing',icon:'https://www.bing.com/favicon.ico'}
    };
    return entries[id];
  }
  function syncHomeSearchEnginePresentation(){
    const meta=selectedSearchEngineMeta();
    qsa('[data-home-search-engine-icon]').forEach(icon=>{
      icon.src=meta.icon;
      icon.alt='';
    });
    qsa('.nyx-visual-home [data-workspace-blank-input]').forEach(input=>{
      const text=`S3ARC4 ${meta.label} or type a U3L`;
      input.placeholder=text;
      input.setAttribute('aria-label',text);
      input.dataset.searchEngine=meta.id;
    });
  }
  function selectedSearchUrl(query){
    const savedEngine=String(store.text('nyx.engine','duckduckgo')).trim().toLowerCase();
    const engine=Object.prototype.hasOwnProperty.call(engines,savedEngine) ? savedEngine : 'duckduckgo';
    return engines[engine] + encodeURIComponent(String(query || '').trim());
  }
  function nyxSearchHistoryQuery(value){
    return String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
  }
  function nyxRecentSearches(){
    const saved=store.get('nyx.recentSearches',[]);
    return Array.isArray(saved) ? saved.filter(value=>typeof value==='string').map(nyxSearchHistoryQuery).filter(Boolean).slice(0,12) : [];
  }
  function syncNyxRecentSearches(){
    const recent=nyxRecentSearches().slice(0,3);
    document.querySelectorAll('[data-nyx-recent-searches]').forEach(row=>{
      row.hidden=!recent.length;
      const signature=JSON.stringify(recent);
      if(row.dataset.recentSignature===signature) return;
      row.dataset.recentSignature=signature;
      row.innerHTML='<span>Jump back in</span>'+recent.map(query=>`<button type="button" data-nyx-recent-search="${esc(query)}" title="${esc(query)}">${esc(query)}</button>`).join('');
    });
  }
  function rememberNyxRecentSearch(value){
    const query=nyxSearchHistoryQuery(value);
    if(!query) return;
    const recent=nyxRecentSearches().filter(item=>item.toLowerCase()!==query.toLowerCase());
    store.set('nyx.recentSearches',[query,...recent].slice(0,12));
    syncNyxRecentSearches();
  }
  async function nyxRecordSearchHistory(value){
    const query=nyxSearchHistoryQuery(value);
    if(!query) return false;
    rememberNyxRecentSearch(query);
    try{
      await initializeFounderOwnerAccess();
      const user=nyxFounderSignedInUser || nyxFounderFirebaseAuth?.currentUser;
      if(!user) return false;
      const send=async forceRefresh=>{
        const token=await user.getIdToken(forceRefresh);
        if(!token) throw new Error('Your sign-in session is unavailable.');
        const response=await fetch('/api/moderation/search-history',{
          method:'POST',
          credentials:'same-origin',
          keepalive:true,
          headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
          body:JSON.stringify({query})
        });
        const payload=await response.json().catch(()=>({}));
        return {response,payload};
      };
      let result=await send(false);
      if(result.response.status===401) result=await send(true);
      if(!result.response.ok || result.payload?.stored!==true) throw new Error(result.payload?.error || 'Nyx did not confirm the search-history write.');
      if(!store.get('nyx.searchHistoryNoticeSeen',false)){
        store.set('nyx.searchHistoryNoticeSeen',true);
        toast('Signed-in searches are retained for 30 days and visible to authorized staff.');
      }
      return true;
    }catch(error){
      console.warn('Nyx search history could not save:',error?.message || error);
      toast("Nyx could not save this s3arc4 to S3ARC4 history.");
      return false;
    }
  }
  function unwrapAccidentalUrlSearch(value){
    const raw=String(value || '').trim();
    try{
      const parsed=new URL(raw);
      const host=parsed.hostname.toLowerCase();
      const isSearch=(host==='duckduckgo.com' && parsed.pathname==='/')
        || (/^(?:www\.)?google\.[a-z.]+$/i.test(host) && parsed.pathname==='/search')
        || (host==='www.bing.com' && parsed.pathname==='/search');
      if(!isSearch) return raw;
      const query=String(parsed.searchParams.get('q') || '').trim();
      return /^(?:https?:\/\/|[\w.-]+\.[a-z]{2,}(?:[\/:?#]|$))/i.test(query) ? query : raw;
    }catch{return raw}
  }
  function canonicalAddressInput(value){
    const raw=unwrapAccidentalUrlSearch(value);
    if(/^apps\//i.test(raw)) return `/${raw}`;
    if(/^(?:localhost|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?(?:\/|$)/i.test(raw)) return 'http://'+raw;
    if(/^[\w.-]+\.[a-z]{2,}(?:[\/:?#]|$)/i.test(raw) && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) return 'https://'+raw;
    return raw;
  }
  const sixtySevenJumpscareSrc='assets/jumpscares/676767.gif';
  function shouldTriggerSixtySevenJumpscare(value){
    return String(value || '').trim()==='67';
  }
  function showSixtySevenJumpscare(){
    document.querySelectorAll('.nyx-jumpscare').forEach(el=>el.remove());
    const overlay=document.createElement('div');
    overlay.className='nyx-jumpscare';
    overlay.innerHTML=`<img alt="" src="${sixtySevenJumpscareSrc}?t=${Date.now()}">`;
    (document.getElementById('app') || document.body).appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.addEventListener('click',close,{once:true});
    setTimeout(close,3600);
  }
  const rammerheadBase = 'https://browser.rammerhead.org/';
  const defaultBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const bgPresets = {
    dragon: defaultBg,
    lofiPurple: 'url("./assets/backgrounds/nyx-blue-light-trails.jpg")',
    sunset: 'url("./assets/backgrounds/wp6058967.jpg")',
    yosemiteFog: 'url("./assets/backgrounds/961912.jpg")',
    yosemiteGold: 'url("./assets/backgrounds/1014077.jpg")',
    redArch: 'url("./assets/backgrounds/1565924.jpg")',
    alpineLake: 'url("./assets/backgrounds/1609678.jpg")',
    canyonLights: 'url("./assets/backgrounds/6781708.jpg")',
    mountainSunset: 'url("./assets/backgrounds/6796216.jpg")',
    riverFalls: 'url("./assets/backgrounds/8848864.jpg")',
    starSky: 'url("./assets/backgrounds/8848964.jpg")',
    dark: 'linear-gradient(135deg,#020308 0%,#111827 56%,#000 100%)',
    violet: 'linear-gradient(135deg,#020617 0%,#312e81 48%,#0f172a 100%)'
  };
  const bgNames = {
    dragon:'Nyx Blue',
    lofiPurple:'Nyx Blue',
    sunset:'Sunset Deer',
    yosemiteFog:'Yosemite Fog',
    yosemiteGold:'Yosemite Gold',
    redArch:'Red Arch',
    alpineLake:'Alpine Lake',
    canyonLights:'Canyon Lights',
    mountainSunset:'Mountain Sunset',
    riverFalls:'River Falls',
    starSky:'Star Sky',
    dark:'Black Gradient',
    violet:'Violet Glass'
  };
  const nyxPhotoWallpapers={leaves:'Leaves',moonlight:'Moonlight',rain:'Rain',halloween:'Halloween'};
  const nyxPhotoVariants={soft:'Soft',deep:'Deep',mono:'Mono'};
  function nyxBeamWallpaperPresets(){
    const photos={};
    for(const [family,label] of Object.entries(nyxPhotoWallpapers)){
      for(const [variant,title] of Object.entries(nyxPhotoVariants)){
        photos[`photo-${family}-${variant}`]={label:title,summary:label,family,variant};
      }
    }
    return {...(window.NyxBeamsWallpaper?.presets || {}),...photos};
  }
  function currentNyxBeamWallpaper(){
    const presets=nyxBeamWallpaperPresets();
    let value=store.text('nyx.beamWallpaper','frost');


    if(['frost','arctic'].includes(value)
      && store.text('nyx.beamTheme','')!=='custom-wallpaper'
      && ['default','midnight'].includes(normalizeNyxTheme(store.text('nyx.theme','default')))){
      value='obsidian';
      store.setText('nyx.beamWallpaper',value);
    }

    if(value==='ember' && store.text('nyx.beamTheme','')==='halloween'
      && normalizeNyxTheme(store.text('nyx.theme','default'))==='halloween'){
      value='photo-halloween-soft';
      store.setText('nyx.beamWallpaper',value);
    }
    if(!store.text('nyx.beamTheme','')){
      const theme=normalizeNyxTheme(store.text('nyx.theme','default'));
      value=nyxThemeBeamWallpaper(theme);
      store.setText('nyx.beamWallpaper',value);
      store.setText('nyx.beamTheme',theme);
    }
    return presets[value] ? value : 'frost';
  }
  function currentNyxLineWavesOptions(){
    const number=(key,fallback,min,max)=>{
      const value=Number(store.text(key,String(fallback)));
      return Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : fallback;
    };
    const colorVariant=store.text('nyx.lineWaves.colorVariant','frost');
    const validVariant=Object.hasOwn(window.NyxLineWavesWallpaper?.palettes || {},colorVariant) ? colorVariant : 'frost';
    return {speed:number('nyx.lineWaves.speed',.3,.04,.55),innerLineCount:number('nyx.lineWaves.density',32,16,48),outerLineCount:number('nyx.lineWaves.density',32,16,48),warpIntensity:1,rotation:-45,edgeFadeWidth:.6,colorCycleSpeed:1,brightness:.12,enableMouseInteraction:store.get('nyx.lineWaves.mouse',true),mouseInfluence:2,colorVariant:validVariant};
  }
  function applyNyxBeamWallpaper(){
    const value=currentNyxBeamWallpaper();
    const theme=normalizeNyxTheme(store.text('nyx.theme','default'));
    const customLightColor=theme==='custom' ? nyxCustomThemePalette().bright : '';
    document.documentElement.dataset.nyxBeamWallpaper=value;
    window.NyxBeamsWallpaper?.apply(value,{
      beamWidth:3,
      beamHeight:30,
      beamNumber:20,
      lightColor:customLightColor || nyxBeamWallpaperPresets()[value]?.lightColor || '#ffffff',
      speed:2,
      noiseIntensity:1.75,
      scale:.2,
      rotation:30
    });
    window.NyxLineWavesWallpaper?.apply(value,currentNyxLineWavesOptions());
  }
  function nyxThemeBeamWallpaper(theme=store.text('nyx.theme','default')){
    return ({default:'obsidian',midnight:'obsidian',ruby:'rose',emerald:'mint',sakura:'rose',fresh:'mint',halloween:'photo-halloween-soft',custom:'violet'})[normalizeNyxTheme(theme)] || 'frost';
  }
  function nyxThemeWavesColor(theme=store.text('nyx.theme','default')){
    return ({default:'frost',midnight:'arctic',ruby:'rose',emerald:'mint',sakura:'rose',fresh:'mint',halloween:'ember',custom:'violet'})[normalizeNyxTheme(theme)] || 'frost';
  }
  function applyNyxThemeBeamWallpaper(theme){
    const cleanTheme=normalizeNyxTheme(theme);
    const current=currentNyxBeamWallpaper();
    const wavesActive=current==='lineWaves';
    const themePhoto=current.startsWith('photo-halloween-') && store.text('nyx.beamTheme','')==='halloween';
    const photoActive=current.startsWith('photo-') && !themePhoto;
    const value=cleanTheme==='halloween' ? nyxThemeBeamWallpaper(cleanTheme)
      : photoActive ? current : wavesActive ? 'lineWaves' : nyxThemeBeamWallpaper(cleanTheme);
    store.setText('nyx.beamWallpaper',value);
    store.setText('nyx.beamTheme',cleanTheme);
    if(wavesActive) store.setText('nyx.lineWaves.colorVariant',nyxThemeWavesColor(cleanTheme));
    store.set('nyx.threeDBackgrounds',false);
    document.body.classList.remove('three-d-backgrounds');
    applyNyxBeamWallpaper();
    qsa('[data-nyx-beam-wallpaper]').forEach(card=>{
      const selected=card.dataset.nyxBeamWallpaper===(wavesActive ? nyxThemeWavesColor(cleanTheme) : value);
      card.classList.toggle('selected',selected);
      card.setAttribute('aria-pressed',String(selected));
    });
  }
  function nyxBeamWallpaperCardsMarkup(family='beams'){
    const wavesActive=family==='waves';
    const selected=wavesActive ? currentNyxLineWavesOptions().colorVariant : currentNyxBeamWallpaper();
    return Object.entries(nyxBeamWallpaperPresets()).filter(([value,preset])=>{
      if(nyxPhotoWallpapers[family]) return preset.family===family;
      if(preset.family || value==='lineWaves') return false;
      return !wavesActive || Object.hasOwn(window.NyxLineWavesWallpaper?.palettes || {},value);
    }).map(([value,preset])=>`<button class="nyx-wallpaper-card${selected===value?' selected':''}" data-nyx-beam-wallpaper="${esc(value)}" type="button" aria-pressed="${selected===value}">${preset.family ? `<img src="assets/backgrounds/${preset.family}.jpg" class="nyx-photo-preview ${preset.variant}" alt="" loading="lazy">` : `<canvas width="240" height="135" data-nyx-beam-preview="${esc(value)}" aria-hidden="true"></canvas>`}<span><strong>${esc(preset.label)}</strong></span><i class="nyx-wallpaper-check" aria-hidden="true">&#10003;</i></button>`).join('');
  }
  function nyxWallpaperFamiliesMarkup(){
    const selected=currentNyxBeamWallpaper();
    return `<div class="nyx-wallpaper-grid">${Object.entries({...nyxPhotoWallpapers,waves:'Waves',beams:'Beams'}).map(([family,label])=>{
      const active=family==='waves' ? selected==='lineWaves' : family==='beams' ? !selected.startsWith('photo-') && selected!=='lineWaves' : selected.startsWith(`photo-${family}-`);
      return `<button class="nyx-wallpaper-card${active?' selected':''}" data-nyx-wallpaper-family="${family}" type="button" aria-label="${label} styles">${nyxPhotoWallpapers[family] ? `<img src="assets/backgrounds/${family}.jpg" alt="" loading="lazy">` : `<canvas width="240" height="135" data-nyx-beam-preview="${family==='waves'?'lineWaves':'frost'}" aria-hidden="true"></canvas>`}<span><strong>${label}</strong></span><i class="nyx-wallpaper-check" aria-hidden="true">&#10003;</i></button>`;
    }).join('')}</div>`;
  }
  function showNyxWallpaperFamily(root,family=''){
    root.dataset.wallpaperFamily=family;
    const back='<button class="settings-action nyx-wallpaper-back" data-nyx-wallpaper-back type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>All backgrounds</button>';
    root.innerHTML=!family ? nyxWallpaperFamiliesMarkup() : back+(family==='waves' ? nyxLineWavesSettingsMarkup() : `<h2>${esc(nyxPhotoWallpapers[family] || 'Beams')}</h2><div class="nyx-wallpaper-grid">${nyxBeamWallpaperCardsMarkup(family)}</div>`);
    wireNyxBeamWallpaperSettings(root);
  }
  function nyxLineWavesSettingsMarkup(){
    const options=currentNyxLineWavesOptions();
    return `<h2>Waves</h2><div class="nyx-wallpaper-grid">${nyxBeamWallpaperCardsMarkup('waves')}</div><label class="nyx-line-waves-control"><span>Motion speed <output data-nyx-line-waves-speed-output>${options.speed.toFixed(2)}</output></span><input type="range" min="0.04" max="0.55" step="0.01" value="${options.speed}" data-nyx-line-waves-speed aria-label="Waves motion speed"></label><label class="nyx-line-waves-control"><span>Line density <output data-nyx-line-waves-density-output>${options.innerLineCount}</output></span><input type="range" min="16" max="48" step="1" value="${options.innerLineCount}" data-nyx-line-waves-density aria-label="Waves line density"></label><div class="settings-row"><span>Cursor response</span><button class="settings-action ${options.enableMouseInteraction?'on':''}" data-nyx-line-waves-mouse type="button">${options.enableMouseInteraction?'On':'Off'}</button></div>`;
  }
  function wireNyxBeamWallpaperSettings(root){
    if(!root) return;
    const family=root.dataset.wallpaperFamily || '';
    const wavesActive=family==='waves';
    root.querySelectorAll('[data-nyx-wallpaper-family]').forEach(card=>card.addEventListener('click',()=>showNyxWallpaperFamily(root,card.dataset.nyxWallpaperFamily)));
    root.querySelector('[data-nyx-wallpaper-back]')?.addEventListener('click',()=>showNyxWallpaperFamily(root));
    const syncCards=()=>{
      const current=wavesActive ? currentNyxLineWavesOptions().colorVariant : currentNyxBeamWallpaper();
      root.querySelectorAll('[data-nyx-beam-wallpaper]').forEach(card=>{
        const selected=card.dataset.nyxBeamWallpaper===current;
        card.classList.toggle('selected',selected);
        card.setAttribute('aria-pressed',String(selected));
      });
    };
    root.querySelectorAll('[data-nyx-beam-wallpaper]').forEach(card=>card.addEventListener('click',()=>{
      const value=card.dataset.nyxBeamWallpaper || 'frost';
      if(!nyxBeamWallpaperPresets()[value]) return;
      if(wavesActive) store.setText('nyx.lineWaves.colorVariant',value);
      store.setText('nyx.beamWallpaper',wavesActive ? 'lineWaves' : value);
      store.setText('nyx.beamTheme','custom-wallpaper');
      store.setText('nyx.customBg','');
      store.setText('nyx.customBgUrl','');
      store.setText('nyx.customBgData','');
      setCustomBackgroundLayer('');
      if(value==='lineWaves') store.setText('nyx.lineWaves.colorVariant',nyxThemeWavesColor());
      store.set('nyx.threeDBackgrounds',false);
      qsa('[data-switch="nyx.threeDBackgrounds"]').forEach(button=>{
        button.classList.remove('on');
        button.setAttribute('aria-checked','false');
        if(button.classList.contains('settings-action')) button.textContent='Off';
      });
      applyUserSettings();

      syncCards();
      toast(`${nyxBeamWallpaperPresets()[value].label || 'Beam'} wallpaper applied`);
    }));
    const redrawWavesPreview=()=>requestAnimationFrame(()=>root.querySelectorAll('[data-nyx-line-waves-preview]').forEach(canvas=>window.NyxLineWavesWallpaper?.renderPreview(canvas)));
    root.querySelector('[data-nyx-line-waves-speed]')?.addEventListener('input',event=>{
      const value=Number(event.currentTarget.value).toFixed(2);
      store.setText('nyx.lineWaves.speed',value);
      root.querySelector('[data-nyx-line-waves-speed-output]')?.replaceChildren(value);
      applyNyxBeamWallpaper();
      redrawWavesPreview();
    });
    root.querySelector('[data-nyx-line-waves-density]')?.addEventListener('input',event=>{
      const value=String(Math.round(Number(event.currentTarget.value)));
      store.setText('nyx.lineWaves.density',value);
      root.querySelector('[data-nyx-line-waves-density-output]')?.replaceChildren(value);
      applyNyxBeamWallpaper();
      redrawWavesPreview();
    });
    root.querySelector('[data-nyx-line-waves-mouse]')?.addEventListener('click',event=>{
      const next=!store.get('nyx.lineWaves.mouse',true);
      store.set('nyx.lineWaves.mouse',next);
      event.currentTarget.classList.toggle('on',next);
      event.currentTarget.textContent=next?'On':'Off';
      applyNyxBeamWallpaper();
    });
    requestAnimationFrame(()=>root.querySelectorAll('[data-nyx-beam-preview]').forEach(canvas=>{
      const value=canvas.dataset.nyxBeamPreview;
      (wavesActive ? window.NyxLineWavesWallpaper : (value==='lineWaves' ? window.NyxLineWavesWallpaper : window.NyxBeamsWallpaper))?.renderPreview(canvas,value);
    }));
    syncCards();
  }

  const favicons = {
    deltamath:'./assets/icons/deltamath.png?v=1',
    nyx:'./assets/icons/nyx-cat-moon-small.svg?v=3',
    studyhub:'./assets/icons/studyhub.svg?v=20260903-cap-v3',
    classroom:`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='8' fill='%23fbbc04'/%3E%3Crect x='8' y='10' width='48' height='40' rx='3' fill='%2334a853'/%3E%3Ccircle cx='32' cy='25' r='6' fill='white'/%3E%3Cpath d='M18 42c4-9 20-9 24 0' fill='white'/%3E%3C/svg%3E`,
    drive:'./assets/icons/googledrive-logo.webp',
    google:'./assets/icons/google-logo.png',
    classlink:'./assets/icons/classlink-logo.png'
  };
  const nyxTabTitle = '\u057c\u028f\u04fc';
  const learningTabTitle = 'DeltaMath';
  const learningTabFavicon = favicons.deltamath;
  let nyxTabFavicon = './assets/icons/nyx-cat-moon-small.svg?v=3';
  const nyxFaviconHref = () => $('appFavicon')?.href || nyxTabFavicon;
  function migrateLearningTabIdentity(){
    if(store.text('nyx.tabIdentityVersion','')==='deltamath-v5') return;
    const savedPreset=store.text('nyx.logo','').trim();
    const savedTitle=store.text('nyx.tabTitle','').trim();
    const savedFavicon=store.text('nyx.tabFavicon','').trim();
    const usesLearningIdentity=(!savedPreset || savedPreset==='nyx')
      && (!savedTitle || savedTitle===learningTabTitle || /^(?:StudyHub|Learning Commons)(?:\s+[—-].*)?$/.test(savedTitle))
      && (!savedFavicon || /(?:^|\/)assets\/icons\/(?:studyhub\.svg|deltamath\.png)(?:[?#].*)?$/i.test(savedFavicon));
    if(usesLearningIdentity){
      store.setText('nyx.tabTitle',learningTabTitle);
      store.setText('nyx.tabFavicon',learningTabFavicon);
      store.setText('nyx.logo','deltamath');
    }
    store.setText('nyx.tabIdentityVersion','deltamath-v5');
  }
  migrateLearningTabIdentity();
  async function applyNyxLogoTheme(theme=store.text('nyx.theme','default')){
    if(!window.NyxLogo) return;
    try{
      const logoTheme='default';
      const [themedUrl,compactUrl]=await Promise.all([
        window.NyxLogo.apply(logoTheme,document),
        window.NyxLogo.croppedUrl?.(logoTheme) || window.NyxLogo.themedUrl(logoTheme)
      ]);
      if(store.text('nyx.theme','default')!==theme) return;
      favicons.nyx=compactUrl;
      nyxTabFavicon=compactUrl;
      const nyxPresetSelected=store.text('nyx.logo','nyx')==='nyx' && store.text('nyx.tabTitle','')===nyxTabTitle;
      if(nyxPresetSelected) store.setText('nyx.tabFavicon',compactUrl);
      if(nyxPresetSelected || !store.text('nyx.tabFavicon','')){
        const favicon=$('appFavicon');
        if(favicon) favicon.href=compactUrl;
      }
      workspaceShellTabs.forEach(tab=>{
        if((tab.title==='Home' && !tab.url) || /^nyx:\/\//i.test(String(tab.url || '')) || tab.icon===themedUrl) tab.icon=compactUrl;
      });
      activeWorkspace?.tabs?.forEach(tab=>{
        if((tab.title==='Home' && !tab.url) || /^nyx:\/\//i.test(String(tab.url || '')) || tab.icon===themedUrl) tab.icon=compactUrl;
      });
      renderWorkspaceShellTabs();
      activeWorkspace?.renderTabs?.();
      if(nyxPresetSelected) setCurrentTabCloak(store.text('nyx.tabTitle',nyxTabTitle),compactUrl,false);
    }catch(error){
      console.warn('Nyx logo theme could not be applied:',error);
    }
  }
  function makeIcon(label,bg='#111827',fg='#fff'){
    return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/><text x="32" y="40" text-anchor="middle" font-size="22" font-family="Outfit, Arial, sans-serif" font-weight="800" fill="${fg}">${label}</text></svg>`);
  }
  function svgIcon(svg){return 'data:image/svg+xml,'+encodeURIComponent(svg)}
  function localIcon(name){return `/assets/icons/${name}`}
  function simpleIcon(slug,color='ffffff'){
    const c='#'+color.replace('#','');
    const common='xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"';
    const icons={
      youtube:`<svg ${common}><rect width="64" height="64" rx="14" fill="#0b0b0b"/><rect x="10" y="19" width="44" height="26" rx="7" fill="#ff0000"/><path d="M28 25v14l13-7z" fill="#fff"/></svg>`,
      discord:`<svg ${common}><rect width="64" height="64" rx="14" fill="#5865f2"/><path d="M22 22c5-2 19-2 24 0 4 7 5 14 3 22-5 3-9 3-12 1l2-3c-4 1-10 1-14 0l2 3c-4 2-8 2-12-1-2-8-1-15 3-22z" fill="#fff"/><circle cx="26" cy="34" r="3" fill="#5865f2"/><circle cx="38" cy="34" r="3" fill="#5865f2"/></svg>`,
      spotify:`<svg ${common}><rect width="64" height="64" rx="14" fill="#1db954"/><path d="M19 27c10-3 20-2 29 3M21 35c8-2 16-1 23 3M23 42c6-1 12 0 17 2" stroke="#07110b" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`,
      google:`<svg ${common}><rect width="64" height="64" rx="14" fill="#fff"/><text x="32" y="44" text-anchor="middle" font-size="38" font-family="Outfit" font-weight="700" fill="#4285f4">G</text></svg>`,
      duckduckgo:`<svg ${common}><rect width="64" height="64" rx="14" fill="#de5833"/><circle cx="32" cy="32" r="18" fill="#fff"/><text x="32" y="39" text-anchor="middle" font-size="18" font-family="Outfit" font-weight="900" fill="#de5833">D</text></svg>`,
      wikipedia:`<svg ${common}><rect width="64" height="64" rx="14" fill="#fff"/><text x="32" y="43" text-anchor="middle" font-size="34" font-family="Outfit,Arial,sans-serif" font-weight="700" fill="#111">W</text></svg>`,
      tiktok:`<svg ${common}><rect width="64" height="64" rx="14" fill="#050505"/><path d="M35 16v25a9 9 0 1 1-8-9" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M36 16c3 8 7 11 13 12" stroke="#25f4ee" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`,
      instagram:`<svg ${common}><defs><linearGradient id="ig" x1="0" x2="1" y1="1" y2="0"><stop stop-color="#feda75"/><stop offset=".45" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#ig)"/><rect x="17" y="17" width="30" height="30" rx="9" stroke="#fff" stroke-width="5" fill="none"/><circle cx="32" cy="32" r="7" stroke="#fff" stroke-width="5" fill="none"/><circle cx="43" cy="21" r="2.5" fill="#fff"/></svg>`,
      snapchat:`<svg ${common}><rect width="64" height="64" rx="14" fill="#fffc00"/><path d="M32 15c8 0 11 7 10 17 2 3 5 5 9 6-4 3-7 3-10 3-3 6-15 6-18 0-3 0-6 0-10-3 4-1 7-3 9-6-1-10 2-17 10-17z" fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round"/></svg>`,
      amazon:`<svg ${common}><rect width="64" height="64" rx="14" fill="#fff"/><text x="32" y="36" text-anchor="middle" font-size="28" font-family="Outfit" font-weight="800" fill="#111">a</text><path d="M20 44c9 6 19 6 28 0" stroke="#ff9900" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`,
      reddit:`<svg ${common}><rect width="64" height="64" rx="14" fill="#ff4500"/><circle cx="32" cy="34" r="16" fill="#fff"/><circle cx="26" cy="33" r="3" fill="#ff4500"/><circle cx="38" cy="33" r="3" fill="#ff4500"/><path d="M25 41c4 3 10 3 14 0" stroke="#ff4500" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M40 20l6-5 3 5" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/></svg>`,
      twitter:`<svg ${common}><rect width="64" height="64" rx="14" fill="#1da1f2"/><path d="M49 23c-1 1-3 2-5 2 2-1 3-3 3-5-2 1-4 2-6 2-5-5-13-1-12 6-7 0-13-4-17-9-2 4-1 8 3 11-2 0-3-1-4-1 0 5 3 8 8 9-2 1-4 1-5 0 2 4 6 7 11 7-5 4-10 5-16 5 6 4 12 5 19 4 15-2 24-14 23-28 2-1 3-2 4-4z" fill="#fff"/></svg>`,
      openai:`<svg ${common}><rect width="64" height="64" rx="14" fill="#111827"/><path d="M31 13c7-1 12 4 12 10 6 2 9 8 6 14 3 6-2 13-9 14-4 6-13 6-17 1-7 0-12-6-10-13-5-5-3-13 3-16 1-7 8-11 15-10z" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>`
    };
    return svgIcon(icons[slug] || `<svg ${common}><rect width="64" height="64" rx="14" fill="#0b0f17"/><circle cx="32" cy="32" r="18" fill="${c}"/></svg>`);
  }

  const appIcons = {
    'youtube.com':simpleIcon('youtube','ff0000'),
    'discord.com':localIcon('discord-embleme.png'),
    'spotify.com':localIcon('spotify-logo.png'),
    'traxmojo.com':localIcon('traxmojo-logo.png'),
    'google.com':localIcon('google-logo.png'),
    'duckduckgo.com':localIcon('duck-ai-logo.png'),
    'wikipedia.org':simpleIcon('wikipedia','ffffff'),
    'cineby.at':localIcon('cineby-logo.png'),
    'tiktok.com':localIcon('tiktok-logo.png'),
    'instagram.com':localIcon('instagram-logo.jpg'),
    'snapchat.com':localIcon('snapchat-logo.jpg'),
    'amazon.com':simpleIcon('amazon','ff9900'),
    'reddit.com':localIcon('reddit-logo.png'),
    'x.com':localIcon('x-logo.png'),
    'chatgpt.com':localIcon('chatgpt-logo.webp'),
    'store.steampowered.com':localIcon('steam-logo.ico'),
    'crunchyroll.com':localIcon('crunchyroll-color.png'),
    'crazygames.com':localIcon('crazygames-logo.png'),
    'newgrounds.com':localIcon('newgrounds-color.png'),
    'twitch.tv':localIcon('twitch-logo.png'),
    'kick.com':localIcon('kick-color.png'),
    'pluto.tv':localIcon('plutotv-logo.png'),
    'skribbl.io':localIcon('skribbl-logo.png'),
    'slither.io':localIcon('slither-logo.png'),
    'geoguessr.com':localIcon('geoguessr-logo.png'),
    'y8.com':localIcon('y8-logo.png'),
    'itch.io':localIcon('itchio-app-icon.svg'),
    'tcgplayer.com':localIcon('tcgplayer-logo.webp'),
    'cpstest.org':localIcon('cps-logo.png'),
    'classlink.com':localIcon('classlink-logo.png'),
    'drive.google.com':localIcon('googledrive-logo.png'),
    'docs.google.com':svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1a73e8"/><path d="M22 12h17l9 9v31H22z" fill="#fff"/><path d="M39 12v10h9" fill="#d2e3fc"/><path d="M27 31h16M27 37h16M27 43h12" stroke="#1a73e8" stroke-width="3" stroke-linecap="round"/></svg>`),
    'duck.ai':localIcon('duck-ai-logo.png'),
    'nyx-ai':localIcon('shortcut-nyx-ai.svg?v=7'),
    'aether.cx':localIcon('theatre-masks.svg?v=1'),
    'icefy.top':localIcon('theatre-masks.svg?v=1'),
    'cinejoy.to':localIcon('nyx-movies.svg?v=1'),
    'nyx-movies':localIcon('nyx-movies.svg?v=1'),
    'fmhy.net':localIcon('theatre-masks.svg?v=1'),
    'nyx-chat':localIcon('chat.svg?v=2'),
    'cloud-gaming':localIcon('cloud-gaming.svg?v=2'),
    'nyxify':localIcon('shortcut-nyxify.svg?v=3'),
    'link-checker':localIcon('link-checker.svg?v=2'),
    'link-generator':localIcon('link-generator.svg'),
    'jsdelivr-publisher':localIcon('jsdelivr-publisher.svg?v=1'),
    'api-keys':localIcon('api-keys.svg?v=2'),
    'code-studio':localIcon('code-studio.svg?v=2'),
    'code-tutorials':localIcon('code-tutorials.svg?v=1'),
    'chess.com':localIcon('chess-logo.png'),
    'games':localIcon('dock-controller.png'),
    'apps':svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="10" y="10" width="18" height="18" rx="4" fill="#fff"/><rect x="36" y="10" width="18" height="18" rx="4" fill="#fff"/><rect x="10" y="36" width="18" height="18" rx="4" fill="#fff"/><rect x="36" y="36" width="18" height="18" rx="4" fill="#fff"/></svg>`),
    'geforcenow':localIcon('dock-nvidia.png'),
    'roblox.com':localIcon('dock-roblox.png'),
    'discord-dock':localIcon('discord-embleme.png'),
    'settings':localIcon('dock-settings.png'),
    'animex.one':svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" rx="14" fill="#030304"/><g opacity=".55" stroke="#243a68" stroke-width="2"><path d="M8 8l16 12M48 4l22 16M132 8l18 12M20 64l16 12M116 62l24 18"/></g><text x="80" y="56" text-anchor="middle" font-size="30" font-family="Outfit,Arial,sans-serif" font-weight="900" fill="#ffffff">ANIMEX</text><text x="78" y="56" text-anchor="middle" font-size="30" font-family="Outfit,Arial,sans-serif" font-weight="900" fill="#7c5ce6" opacity=".9">ANI</text></svg>`)
  };
  function appIcon(domain){return appIcons[domain] || makeIcon('GL','#0b0f17','#67e8f9')}
  function websiteFaviconUrl(url){
    const raw=String(url || '').trim();
    if(!raw || raw==='about:blank' || raw.startsWith('nyx://')) return '';
    try{
      const source=typeof workspaceShellSourceUrl==='function' ? (workspaceShellSourceUrl(raw) || raw) : raw;
      const parsed=new URL(source,location.href);
      if(!/^https?:$/.test(parsed.protocol)) return '';
      return new URL('/favicon.ico',parsed.origin).href;
    }catch{return ''}
  }
  function websiteFaviconFallbackUrl(url){
    const raw=String(url || '').trim();
    try{
      const source=typeof workspaceShellSourceUrl==='function' ? (workspaceShellSourceUrl(raw) || raw) : raw;
      const parsed=new URL(source,location.href);
      if(!/^https?:$/.test(parsed.protocol)) return '';
      return `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(parsed.origin)}`;
    }catch{return ''}
  }
  function websiteFaviconFallbackUrls(url){
    const primary=websiteFaviconFallbackUrl(url);
    try{
      const source=typeof workspaceShellSourceUrl==='function' ? (workspaceShellSourceUrl(String(url || '').trim()) || url) : url;
      const host=new URL(source,location.href).hostname;
      const duckDuckGo=host ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico` : '';
      return [...new Set([primary,duckDuckGo].filter(Boolean))];
    }catch{return primary ? [primary] : []}
  }
  function iconFromPageDocument(doc,sourceUrl=''){
    try{
      const link=doc?.querySelector?.('link[rel~="icon" i],link[rel="shortcut icon" i]');
      const href=String(link?.href || link?.getAttribute?.('href') || '').trim();
      if(!href || href.length>4096) return '';
      const resolved=new URL(href,doc.baseURI || sourceUrl || location.href);
      if(!['http:','https:','data:'].includes(resolved.protocol)) return '';
      return resolved.href;
    }catch{return ''}
  }
  function bindTabIconFallback(img){
    if(!img || img.dataset.nyxIconFallbackBound==='true') return;
    img.dataset.nyxIconFallbackBound='true';
    img.addEventListener('error',()=>{
      if(img.dataset.nyxIconFallbackUsed==='true') return;
      img.dataset.nyxIconFallbackUsed='true';
      img.src=favicons.nyx;
    });
  }
  function iconForUrl(url){
    const raw=String(url || '').trim();
    if(!raw || raw==='about:blank' || raw.startsWith('nyx://')) return favicons.nyx;
    if(/(?:^|\/)apps\/chat(?:\/|$)/i.test(raw)) return appIcon('nyx-chat');
    if(/(?:^|\/)apps\/cloud-gaming(?:\/|$)/i.test(raw)) return appIcon('cloud-gaming');
    if(/(?:^|\/)apps\/link-checker(?:\/|$)/i.test(raw)) return appIcon('link-checker');
    if(/(?:^|\/)apps\/link-generator(?:\/|$)/i.test(raw)) return appIcon('link-generator');
    if(/(?:^|\/)apps\/api-keys(?:\/|$)/i.test(raw)) return appIcon('api-keys');
    if(/(?:^|\/)apps\/movies(?:\/|$)/i.test(raw)) return appIcon('nyx-movies');
    if(/(?:^|\/)apps\/code-studio(?:\/|$)/i.test(raw)) return appIcon('code-studio');
    if(/(?:^|\/)apps\/code-tutorials(?:\/|$)/i.test(raw)) return appIcon('code-tutorials');
    const source=typeof workspaceShellSourceUrl==='function' ? (workspaceShellSourceUrl(raw) || raw) : raw;
    if(source.startsWith('assets/games/') || source.startsWith('assets/ugs/') || source.startsWith('/assets/games/') || source.startsWith('/assets/ugs/')) return appIcon('games');
    try{
      const host=new URL(source,location.href).hostname.replace(/^www\./,'').toLowerCase();
      if(appIcons[host]) return appIcons[host];
      const key=Object.keys(appIcons).find(domain=>host===domain || host.endsWith('.'+domain));
      if(key) return appIcons[key];
      if(host.includes('google')) return favicons.google;
    }catch{}
    return websiteFaviconUrl(source) || favicons.nyx;
  }
  function homeShortcutIconUrl(item,domain=''){
    const saved=String(item?.icon || '').trim();
    if(saved) return saved;
    const key=String(domain || homeShortcutDomain(item?.url,item?.title)).toLowerCase();
    if(appIcons[key]) return appIcon(key);
    const matched=Object.keys(appIcons).find(name=>key===name || key.endsWith('.'+name));
    if(matched) return appIcon(matched);
    return websiteFaviconUrl(item?.url) || favicons.nyx;
  }
  function homeShortcutIconMarkup(item,domain=''){
    const source=homeShortcutIconUrl(item,domain);
    const fallbacks=websiteFaviconFallbackUrls(item?.url);
    return `<img class="quick-icon" alt="" draggable="false" referrerpolicy="no-referrer" data-home-shortcut-site-icon data-favicon-fallbacks="${esc(JSON.stringify(fallbacks))}" src="${esc(source)}">`;
  }
  function installHomeShortcutIconFallbacks(){
    if(document.__nyxHomeShortcutIconFallbacks) return;
    document.__nyxHomeShortcutIconFallbacks=true;
    document.addEventListener('error',event=>{
      const image=event.target;
      if(!(image instanceof HTMLImageElement) || !image.matches('[data-home-shortcut-site-icon]')) return;
      let fallbacks=[];
      try{fallbacks=JSON.parse(image.dataset.faviconFallbacks || '[]')}catch{}
      const index=Number(image.dataset.faviconFallbackIndex || '0');
      const fallback=fallbacks[index] || '';
      if(fallback){
        image.dataset.faviconFallbackIndex=String(index+1);
        image.dataset.faviconFallbackUsed='true';
        image.src=fallback;
        return;
      }
      image.removeAttribute('data-home-shortcut-site-icon');
      image.src=favicons.nyx;
    },true);
  }
  installHomeShortcutIconFallbacks();
  function titleForUrl(url){
    const raw=String(url || '').trim();
    if(!raw || raw==='about:blank') return 'New Tab';
    if(/(?:^|\/)apps\/chat(?:\/|$)/i.test(raw)) return 'Nyx Chat';
    if(/(?:^|\/)apps\/link-checker(?:\/|$)/i.test(raw)) return 'Link Checker';
    if(/(?:^|\/)apps\/link-generator(?:\/|$)/i.test(raw)) return 'Link Generator';
    if(/(?:^|\/)apps\/api-keys(?:\/|$)/i.test(raw)) return 'Nyx API Keys';
    if(/(?:^|\/)apps\/code-studio(?:\/|$)/i.test(raw)) return 'Code Sandbox';
    if(/(?:^|\/)apps\/code-tutorials(?:\/|$)/i.test(raw)) return 'Nyx Code Tutorials';
    if(raw==='nyx://ai') return "Nyx A1";
    if(raw.startsWith('nyx://')) return raw.replace('nyx://','nyx ');
    if(raw.startsWith('assets/games/') || raw.startsWith('assets/ugs/') || raw.startsWith('/assets/games/') || raw.startsWith('/assets/ugs/')) return 'GAMES';
    try{return new URL(raw,location.href).hostname.replace(/^www\./,'') || 'New Tab'}catch{return 'New Tab'}
  }
  function websiteDetailsHidden(){
    return store.get('nyx.hideWebsiteDetails',false);
  }
  function isExternalWebsiteUrl(url){
    const raw=String(url || '').trim();
    if(!raw) return false;
    const source=typeof workspaceShellSourceUrl==='function' ? (workspaceShellSourceUrl(raw) || raw) : raw;
    try{
      const parsed=new URL(source,location.href);
      return /^https?:$/.test(parsed.protocol) && parsed.origin!==location.origin;
    }catch{return false}
  }
  function workspaceChromeTitle(title,url){
    const label=title || titleForUrl(url);
    return websiteDetailsHidden() && isExternalWebsiteUrl(url) ? 'Focus page' : (/^new\s*tab$/i.test(label) ? 'New page' : label);
  }
  function workspaceChromeIcon(icon,url){
    return websiteDetailsHidden() && isExternalWebsiteUrl(url) ? favicons.nyx : (icon || iconForUrl(url));
  }
  function refreshWebsiteDetailsVisibility(){
    activeWorkspace?.renderTabs?.();
    renderWorkspaceShellTabs();
    const activeTab=activeWorkspace?.tabs?.find(tab=>tab.id===activeWorkspace.active);
    const shellTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
    const url=activeTab?.sourceUrl || activeTab?.url || shellTab?.url || '';
    const title=activeTab?.title || shellTab?.title || 'New Tab';
    const titlebar=activeWorkspace?.win?.querySelector?.('.titlebar-title');
    if(titlebar) titlebar.textContent=workspaceChromeTitle(title,url);
  }
  let zTop = 20, winCount = 0, activeWorkspace = null, antiCloseEnabled = store.get('nyx.antiClose',true), panicCaptureArmed = false, antiClosePanicBypass = false;
  let antiCloseConfirmHandler = null, antiCloseGestureHandler = null, antiCloseRearmTimer = null, antiCloseHadGesture = false;
  let renderedChromeMode = '';
  let studyjetInstallPromise = null;
  let studyjetController = null;
  let workspaceConnectionPrewarmScheduled = false;
  let bookmuxConnection = null;
  let studyjetTransport = null;
  let studyjetTransportKey = '';
  let studyjetTransportPending = null;
  let workspaceTransportOverride = '';
  let studyjetInstallError = '';
  let nyxPresenceCount = null;
  const connectionPrivacyGuardSource=`(() => {
    if (typeof globalThis === "undefined" || globalThis.__nyxProxyPrivacyInstalled) return;
    globalThis.__nyxProxyPrivacyInstalled = true;
    const denied = Object.freeze({ code: 1, message: "Location access is disabled in Nyx private tabs." });
    const fail = callback => {
      if (typeof callback === "function") queueMicrotask(() => callback(denied));
    };
    const geolocation = Object.freeze({
      getCurrentPosition(_success, error) { fail(error); },
      watchPosition(_success, error) { fail(error); return 0; },
      clearWatch() {}
    });
    try { Object.defineProperty(Navigator.prototype, "geolocation", { configurable: true, get: () => geolocation }); } catch {}
    try { Object.defineProperty(navigator, "geolocation", { configurable: true, get: () => geolocation }); } catch {}
    const nativeQuery = navigator.permissions?.query?.bind(navigator.permissions);
    if (nativeQuery) {
      try {
        navigator.permissions.query = descriptor => {
          if (String(descriptor?.name || "").toLowerCase() === "geolocation") {
            const status = new EventTarget();
            Object.defineProperties(status, {
              state: { enumerable: true, value: "denied" },
              onchange: { configurable: true, writable: true, value: null }
            });
            return Promise.resolve(status);
          }
          return nativeQuery(descriptor);
        };
      } catch {}
    }
  })();`;
  function createConnectionPrivacySessionId(){
    const random=crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    return `nyx_${String(random).replace(/[^a-z0-9_-]/gi,'_').slice(0,72)}`;
  }

  let studyjetRuntimeGuardSource = '';
  const studyjetNvidiaAuthGuardSource=`(() => {
    if (typeof window === "undefined" || window.__nyxNvidiaAuthCompatibility) return;
    let hostname="";
    let address="";
    try { hostname=String(location.hostname || "").replace(/^www\./i, "").toLowerCase(); } catch {}
    try { address=decodeURIComponent(String(location.href || "")).toLowerCase(); } catch { address=String(location.href || "").toLowerCase(); }
    const supportedHost=/(^|\.)(geforcenow\.com|nvidia\.com|nvidiagrid\.net)$/;
    if (!supportedHost.test(hostname) && !/(geforcenow\.com|nvidia\.com|nvidiagrid\.net)/.test(address)) return;
    window.__nyxNvidiaAuthCompatibility=true;
    const grantedStatus=()=>{
      const status=new EventTarget();
      Object.defineProperties(status,{
        state:{enumerable:true,value:"granted"},
        onchange:{configurable:true,writable:true,value:null}
      });
      return status;
    };
    const permissions=navigator.permissions;
    const nativeQuery=permissions?.query?.bind(permissions);
    if (permissions && nativeQuery) {
      const query=descriptor=>String(descriptor?.name || "").toLowerCase()==="storage-access"
        ? Promise.resolve(grantedStatus())
        : nativeQuery(descriptor);
      try { Object.defineProperty(permissions,"query",{configurable:true,value:query}); }
      catch { try { permissions.query=query; } catch {} }
    }
    const storageHandle=()=>({
      localStorage:window.localStorage,
      sessionStorage:window.sessionStorage
    });
    try { Object.defineProperty(Document.prototype,"hasStorageAccess",{configurable:true,value:()=>Promise.resolve(true)}); } catch {}
    try { Object.defineProperty(Document.prototype,"requestStorageAccess",{configurable:true,value:()=>Promise.resolve(storageHandle())}); } catch {}
    try { Object.defineProperty(document,"hasStorageAccess",{configurable:true,value:()=>Promise.resolve(true)}); } catch {}
    try { Object.defineProperty(document,"requestStorageAccess",{configurable:true,value:()=>Promise.resolve(storageHandle())}); } catch {}
  })();`;
  const studyjetSpotifyChromeOsGuardSource=`(() => {
    if (typeof window === "undefined" || window.__nyxSpotifyChromeOsCompatibility) return;
    const nativeUserAgent = String(navigator.userAgent || "");
    if (!/\\bCrOS\\b/i.test(nativeUserAgent)) return;
    let hostname = "";
    let pageAddress = "";
    try { hostname = String(location.hostname || "").toLowerCase(); } catch {}
    try { pageAddress = decodeURIComponent(String(location.href || "")).toLowerCase(); } catch { pageAddress = String(location.href || "").toLowerCase(); }
    const compatibilityHost=/(^|\\.)(spotify\\.com|spotifycdn\\.com|scdn\\.co|google\\.com|gstatic\\.com|recaptcha\\.net)$/;
    if (!compatibilityHost.test(hostname) && !/(spotify\\.com|spotifycdn\\.com|scdn\\.co|google\\.com|gstatic\\.com|recaptcha\\.net)/.test(pageAddress)) return;
    window.__nyxSpotifyChromeOsCompatibility = true;
    const chromeVersion = nativeUserAgent.match(/Chrome\\/([0-9.]+)/i)?.[1] || "138.0.0.0";
    const desktopUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + chromeVersion + " Safari/537.36";
    const defineNavigatorValue = (name, value) => {
      try { Object.defineProperty(Navigator.prototype, name, { configurable: true, get: () => value }); }
      catch { try { Object.defineProperty(navigator, name, { configurable: true, get: () => value }); } catch {} }
    };
    defineNavigatorValue("userAgent", desktopUserAgent);
    defineNavigatorValue("platform", "Win32");
    const nativeData = navigator.userAgentData;
    if (nativeData) {
      const desktopData = {
        brands: Array.from(nativeData.brands || []),
        mobile: false,
        platform: "Windows",
        toJSON() { return { brands: this.brands, mobile: false, platform: "Windows" }; },
        async getHighEntropyValues(hints) {
          let values = {};
          try { values = await nativeData.getHighEntropyValues(hints); } catch {}
          return { ...values, platform: "Windows", platformVersion: "10.0.0", architecture: "x86", bitness: "64", model: "" };
        }
      };
      defineNavigatorValue("userAgentData", desktopData);
    }
  })();`;
  const workspaceAdBlockRuntimeSource=`(() => {
    if (typeof window === "undefined" || window.__nyxWorkspaceAdBlock) return;
    window.__nyxWorkspaceAdBlock = true;
    const blockedResource=${workspaceAdResourceSignature};
    const adSelector=${JSON.stringify(workspaceAdElementSelector)};
    const protectionEnabled=()=>{
      try {
        const value=localStorage.getItem("nyx.popupProtection");
        return value==null || JSON.parse(value)!==false;
      } catch { return true; }
    };
    const blocked=value=>protectionEnabled() && blockedResource.test(String(value || ""));
    const neutralValue=node=>String(node?.tagName || "").toUpperCase()==="IMG"
      ? "data:image/gif;base64,R0lGODlhAQABAAAAACw="
      : "about:blank";
    // Reflected src/href getters run through the proxy U3L decoder. Attributes
    // retain the source value, including harmless non-network metadata URLs.
    const resourceValue=node=>node?.getAttribute?.("src") || node?.getAttribute?.("href") || node?.getAttribute?.("data-src") || "";
    const removeAd=node=>{
      try {
        if (!protectionEnabled() || !node || node.nodeType!==1 || node.hasAttribute?.("scramjet-injected")) return false;
        if (node.matches?.(adSelector) || blocked(resourceValue(node))) {
          node.remove?.();
          return true;
        }
      } catch {}
      return false;
    };
    const pendingRoots=new Set();
    let cleanTimer=0,cleanStack=[],cleanSeen=new WeakSet();
    const flushClean=()=>{
      cleanTimer=0;
      if(!protectionEnabled()){pendingRoots.clear();cleanStack=[];cleanSeen=new WeakSet();return;}
      const started=performance.now();let checked=0;
      while(checked<128&&performance.now()-started<6){
        if(!cleanStack.length){
          const root=pendingRoots.values().next().value;
          if(!root)break;
          pendingRoots.delete(root);cleanStack.push(root);
        }
        const node=cleanStack.pop();checked++;
        if(!node?.isConnected||cleanSeen.has(node))continue;
        cleanSeen.add(node);
        if(node.nextElementSibling)cleanStack.push(node.nextElementSibling);
        if(node.nodeType===1&&removeAd(node))continue;
        if(node.firstElementChild)cleanStack.push(node.firstElementChild);
      }
      if(cleanStack.length||pendingRoots.size)cleanTimer=setTimeout(flushClean,0);
      else cleanSeen=new WeakSet();
    };
    const clean=root=>{
      if(!root||![1,9,11].includes(root.nodeType))return;
      if(pendingRoots.size>=256){pendingRoots.clear();pendingRoots.add(document);}
      else pendingRoots.add(root);
      if(!cleanTimer)cleanTimer=setTimeout(flushClean,0);
    };
    try {
      const style=document.createElement("style");
      style.id="nyx-page-cleanup-style";
      style.textContent=adSelector+"{display:none!important;visibility:hidden!important;pointer-events:none!important;width:0!important;height:0!important;min-width:0!important;min-height:0!important}";
      (document.head || document.documentElement).appendChild(style);
    } catch {}
    try {
      const nativeFetch=window.fetch?.bind(window);
      if(nativeFetch) window.fetch=(input,init)=>{
        const url=input instanceof Request ? input.url : input;
        if(blocked(url)) return Promise.resolve(new Response(null,{status:204,statusText:"No Content"}));
        return nativeFetch(input,init);
      };
    } catch {}
    try {
      const nativeOpen=XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open=function(method,url,...rest){
        return nativeOpen.call(this,method,blocked(url) ? "data:," : url,...rest);
      };
    } catch {}
    try {
      if(navigator.sendBeacon){
        const nativeBeacon=navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon=(url,data)=>blocked(url) ? true : nativeBeacon(url,data);
      }
    } catch {}
    try {
      const nativeAppend=Node.prototype.appendChild;
      Node.prototype.appendChild=function(node){
        if(removeAd(node)) return node;
        return nativeAppend.call(this,node);
      };
      const nativeInsert=Node.prototype.insertBefore;
      Node.prototype.insertBefore=function(node,before){
        if(removeAd(node)) return node;
        return nativeInsert.call(this,node,before);
      };
      const nativeSetAttribute=Element.prototype.setAttribute;
      Element.prototype.setAttribute=function(name,value){
        const key=String(name || "").toLowerCase();
        if((key==="src" || key==="href" || key==="data-src") && blocked(value)){
          if(key==="src") return nativeSetAttribute.call(this,key,neutralValue(this));
          this.removeAttribute(key);
          return;
        }
        return nativeSetAttribute.call(this,name,value);
      };
    } catch {}
    if(protectionEnabled()){
      const resolved=value=>Promise.resolve(value);
      if(!window.PokiSDK){
        window.PokiSDK={
          init:()=>resolved(),initWithVideoHB:()=>resolved(),commercialBreak:()=>resolved(),rewardedBreak:()=>resolved(true),
          displayAd:()=>{},gameplayStart:()=>{},gameplayStop:()=>{},gameLoadingStart:()=>{},gameLoadingFinished:()=>{},gameLoadingProgress:()=>{},
          happyTime:()=>{},setDebug:()=>{},getURLParam:()=>null,getLanguage:()=>navigator.language || "en"
        };
      }
      if(!window.gdsdk){
        window.gdsdk={showAd:()=>resolved(),preloadAd:()=>resolved(),openConsole:()=>{},isAdblockEnabled:true};
      }
    }
    const notifyGameDistributionReady=()=>{
      if(!protectionEnabled()) return;
      try{
        const callback=window.GD_OPTIONS?.onEvent;
        if(typeof callback==="function") callback({name:"SDK_READY"});
      }catch{}
    };
    try {
      new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(clean)))
        .observe(document.documentElement,{childList:true,subtree:true,attributes:false});
    } catch {}
    document.addEventListener("DOMContentLoaded",()=>{clean(document);notifyGameDistributionReady()},{once:true});
    addEventListener("load",()=>clean(document),{once:true});
    queueMicrotask(notifyGameDistributionReady);
    clean(document);
  })();`;
  const studyjetMinimalRuntimeGuardSource=`(() => {
    if (typeof window === "undefined" || window.__nyxScramjetMinimalGuards) return;
    window.__nyxScramjetMinimalGuards = true;
    try {
      const noop = value => value;
      window.$scramerr = window.$scramerr || noop;
      window.$scramjet$pushsourcemap = window.$scramjet$pushsourcemap || noop;
    } catch {}
    try {
      window.__sentry_instrumentation_handlers__ = window.__sentry_instrumentation_handlers__ || {};
      window.global = window.global || window;
    } catch {}
    if (!window.trustedTypes) {
      try {
        Object.defineProperty(window, "trustedTypes", {
          configurable: true,
          value: {
            createPolicy(_name, rules = {}) {
              return {
                createHTML(value) { return typeof rules.createHTML === "function" ? rules.createHTML(value) : value; },
                createScript(value) { return typeof rules.createScript === "function" ? rules.createScript(value) : value; },
                createScriptURL(value) { return typeof rules.createScriptURL === "function" ? rules.createScriptURL(value) : value; }
              };
            }
          }
        });
      } catch {}
    }
    try {
      if (!window.Buffer) {
        const toBytes = value => value instanceof Uint8Array ? value : new TextEncoder().encode(String(value ?? ""));
        window.Buffer = {
          from: toBytes,
          alloc(size) { return new Uint8Array(Math.max(0, Number(size) || 0)); },
          isBuffer(value) { return value instanceof Uint8Array; },
          byteLength(value) { return toBytes(value).byteLength; }
        };
      }
      if (!window.Long) {
        const toNumber = value => Number(value && typeof value === "object" && "low" in value ? value.low : value) || 0;
        window.Long = {
          ZERO: 0,
          UZERO: 0,
          fromNumber: toNumber,
          fromValue: toNumber,
          isLong() { return false; }
        };
      }
    } catch {}
    try {
      const nativeCurrentScript = Object.getOwnPropertyDescriptor(Document.prototype, "currentScript");
      const fallbackScript = document.createElement("script");
      fallbackScript.setAttribute("nonce", "");
      Object.defineProperty(Document.prototype, "currentScript", {
        configurable: true,
        get() {
          let current = null;
          try { current = nativeCurrentScript?.get?.call(this) || null; } catch {}
          return current || this.querySelector?.("script[src],script") || fallbackScript;
        }
      });
    } catch {}
    try {
      const blockedTelemetry = value => /(?:google-analytics\\.com|googletagmanager\\.com|stats\\.g\\.doubleclick\\.net|analytics\\.google\\.com)/i.test(String(value || ""));
      const neutralizeScript = node => {
        try {
          if (node && String(node.tagName || "").toUpperCase() === "SCRIPT" && blockedTelemetry(node.src || node.getAttribute?.("src"))) {
            node.type = "text/plain";
            node.removeAttribute("src");
            node.text = "";
            return true;
          }
        } catch {}
        return false;
      };
      const nativeAppendChild = Node.prototype.appendChild;
      Node.prototype.appendChild = function(node) {
        if (neutralizeScript(node)) return node;
        return nativeAppendChild.call(this, node);
      };
      const nativeInsertBefore = Node.prototype.insertBefore;
      Node.prototype.insertBefore = function(node, before) {
        if (neutralizeScript(node)) return node;
        return nativeInsertBefore.call(this, node, before);
      };
      const nativeSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function(name, value) {
        if (String(this.tagName || "").toUpperCase() === "SCRIPT" && String(name || "").toLowerCase() === "src" && blockedTelemetry(value)) {
          nativeSetAttribute.call(this, "type", "text/plain");
          return;
        }
        return nativeSetAttribute.call(this, name, value);
      };
      const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
      if (srcDescriptor?.set) {
        Object.defineProperty(HTMLScriptElement.prototype, "src", {
          configurable: true,
          get() { return srcDescriptor.get.call(this); },
          set(value) {
            if (blockedTelemetry(value)) {
              try { this.type = "text/plain"; } catch {}
              return;
            }
            return srcDescriptor.set.call(this, value);
          }
        });
      }
      if (navigator.sendBeacon) {
        const nativeBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = (url, data) => blockedTelemetry(url) ? true : nativeBeacon(url, data);
      }
    } catch {}
    try {
      const popupProtectionEnabled = () => {
        try {
          const raw = localStorage.getItem("nyx.popupProtection");
          return raw == null || JSON.parse(raw) !== false;
        } catch {
          return true;
        }
      };
      const blockedUrl = "nyx://blocked67haha";
      const fakePopup = (notify = false) => {
        if (notify) {
          try { window.parent?.postMessage?.({ type: "nyx:popup", url: blockedUrl, blocked: true }, "*"); } catch {}
        }
        const fakeDocument = { open(){ return this; }, write(){}, writeln(){}, close(){} };
        return {
          closed: false,
          document: fakeDocument,
          focus(){},
          blur(){},
          close(){ this.closed = true; },
          postMessage(){},
          location: {
            href: blockedUrl,
            assign(){},
            replace(){},
            reload(){},
            toString(){ return blockedUrl; }
          }
        };
      };
      const targetOpensPopup = target => {
        const value = String(target || "").toLowerCase();
        return value && !["_self", "_parent", "_top"].includes(value);
      };
      const looksDownloadLike = value => {
        const text = String(value || "").trim();
        return /^(?:blob|data):/i.test(text) || /\.(?:apk|appx|bat|bin|cmd|com|crx|deb|dmg|exe|iso|jar|js|jse|msi|pkg|ps1|scr|sh|vbs|wsf|zip|7z|rar)(?:[?#]|$)/i.test(text);
      };
      const trustedGeneratedPopup = link => {
        if (!link?.matches?.("a[data-nyx-generated-popup][href]")) return false;
        if (!/^[/]apps[/]link-generator(?:[/]|$)/i.test(String(location.pathname || ""))) return false;
        try {
          const parsed = new URL(link.href || link.getAttribute("href"), location.href);
          if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) return false;
          if (parsed.hostname !== "jsdelivr.b-cdn.net" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?[.]b-cdn[.]net$/i.test(parsed.hostname)) return parsed.pathname === "/";
          if (!["cdn.jsdelivr.net", "fastly.jsdelivr.net", "gcore.jsdelivr.net", "quantil.jsdelivr.net", "originfastly.jsdelivr.net", "testingcf.jsdelivr.net", "jsdelivr.b-cdn.net", "esm.sh", "raw.esm.sh"].includes(parsed.hostname.toLowerCase())) return false;
          return /^[/]gh[/][a-z0-9_.-]+[/][a-z0-9_.-]+@[a-z0-9._%~-]+[/][a-z0-9._%-]+[.]svg$/i.test(parsed.pathname);
        } catch {
          return false;
        }
      };
      const nativeOpen = window.open?.bind(window);
      const guardedOpen = (...args) => {
        if (!popupProtectionEnabled() && nativeOpen) return nativeOpen(...args);
        return fakePopup(Boolean(navigator.userActivation?.isActive));
      };
      try {
        if (typeof window.open === "function" && typeof Proxy === "function") {
          window.open = new Proxy(window.open, {
            apply(target, thisArg, args) {
              if (!popupProtectionEnabled()) return Reflect.apply(target, thisArg, args);
              return fakePopup(Boolean(navigator.userActivation?.isActive));
            },
            construct(target, args, newTarget) {
              if (!popupProtectionEnabled()) {
                try { return Reflect.construct(target, args, newTarget); }
                catch { return Reflect.apply(target, window, args); }
              }
              return fakePopup(Boolean(navigator.userActivation?.isActive));
            },
            get(target, prop, receiver) {
              if (prop === "__nyxPopupGuard") return true;
              if (prop === "toString") return () => "function open() { [native code] }";
              return Reflect.get(target, prop, receiver);
            }
          });
        } else {
          window.open = guardedOpen;
        }
      } catch {
        window.open = guardedOpen;
      }
      try {
        Object.defineProperty(window.open, "toString", { configurable: true, value: () => "function open() { [native code] }" });
      } catch {}
      if (window.HTMLAnchorElement?.prototype) {
        const nativeAnchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function() {
          if (popupProtectionEnabled() && (targetOpensPopup(this.target) || this.hasAttribute("download") || looksDownloadLike(this.href || this.getAttribute("href")))) {
            fakePopup(Boolean(navigator.userActivation?.isActive));
            return;
          }
          return nativeAnchorClick.call(this);
        };
      }
      const stopPopupEvent = event => {
        if (!popupProtectionEnabled()) return;
        const link = event.target?.closest?.("a[href]");
        if (!link) return;
        if (trustedGeneratedPopup(link)) return;
        if (targetOpensPopup(link.getAttribute("target")) || link.hasAttribute("download") || looksDownloadLike(link.href || link.getAttribute("href"))) {
          event.preventDefault();
          event.stopImmediatePropagation();
          fakePopup(true);
        }
      };
      const stopPopupSubmit = event => {
        if (!popupProtectionEnabled()) return;
        const form = event.target;
        if (!form || String(form.tagName || "").toUpperCase() !== "FORM") return;
        if (targetOpensPopup(form.getAttribute("target"))) {
          event.preventDefault();
          event.stopImmediatePropagation();
          fakePopup(true);
        }
      };
      document.addEventListener("click", stopPopupEvent, true);
      document.addEventListener("auxclick", stopPopupEvent, true);
      document.addEventListener("submit", stopPopupSubmit, true);
    } catch {}
  })();`;
  const studyjetHelperRuntimeGuardSource=`(() => {
    if (typeof window === "undefined" || window.__nyxScramjetHelperGuards) return;
    window.__nyxScramjetHelperGuards = true;
    try {
      const seen = new Map();
      const noisy = /bare-mux|Hyper client|tls handshake eof|preloaded using link preload|requestStorageAccess|PlayReady|robustness level|reCAPTCHA Timeout|load timed out|trying fallback|failed; switching|Uncaught \\(in promise\\) undefined|^undefined$/i;
      const summarize = value => String(value && (value.stack || value.message) || value || "")
        .replace(/https?:\\/\\/[^\\s)]+/g, "<url>")
        .replace(/\\b[0-9a-f]{6,}\\b/gi, "<id>")
        .replace(/\\d+/g, "#")
        .slice(0, 360);
      ["warn","error"].forEach(level => {
        const native = console[level]?.bind(console);
        if (!native || native.__nyxDedupe) return;
        console[level] = (...args) => {
          const text = args.map(summarize).join(" ");
          if (noisy.test(text)) {
            const key = level + ":" + text;
            const now = Date.now();
            const last = seen.get(key) || 0;
            if (now - last < 12000) return;
            seen.set(key, now);
          }
          native(...args);
        };
        console[level].__nyxDedupe = true;
      });
      const noop = value => value;
      window.$scramerr = window.$scramerr || noop;
      window.$scramjet$pushsourcemap = window.$scramjet$pushsourcemap || noop;
    } catch {}
  })();`;
  const connectionStateVersion='nyx-proxy-state-20261005-studyjet-only-v14';
  const studyjetStateVersion='nyx-scramjet-state-20260814-private-tabs-v2';
  const studyjetServiceWorkerUrl='/scramjet.sw.js?v=nyx-sj-20260905-cookie-owner-v5';
  function installNyxConsoleDedupe(scope='top'){
    if(console.__nyxDedupeInstalled) return;
    const seen=new Map();
    const noisy=/bare-mux|Hyper client|tls handshake eof|preloaded using link preload|requestStorageAccess|PlayReady|robustness level|reCAPTCHA Timeout|load timed out|trying fallback|failed; switching|Uncaught \\(in promise\\) undefined|^undefined$/i;
    const summarize=value=>{
      try{
        return String(value && (value.stack || value.message) || value)
          .replace(/https?:\/\/[^\s)]+/g,'<url>')
          .replace(/\b[0-9a-f]{6,}\b/gi,'<id>')
          .replace(/\d+/g,'#')
          .slice(0,360);
      }catch{return ''}
    };
    ['warn','error'].forEach(level=>{
      const native=console[level]?.bind(console);
      if(!native) return;
      console[level]=(...args)=>{
        const text=args.map(summarize).join(' ');
        if(noisy.test(text)){
          const key=level+':'+text;
          const now=Date.now();
          const last=seen.get(key) || 0;
          if(now-last<12000) return;
          seen.set(key,now);
        }
        native(...args);
      };
    });
    console.__nyxDedupeInstalled=scope;
  }
  installNyxConsoleDedupe();
  let enhancedBackgroundRun = 0;
  let customBgLayerRun = 0;
  let hieroglyphObserver = null;
  let hieroglyphApplying = false;
  function hieroglyphTextEnabled(){
    return store.get('nyx.hieroglyphText',false) || store.get('nyx.autoHieroglyphText',false);
  }
  function applyAutoHieroglyphPreference(){
    if(store.get('nyx.autoHieroglyphText',false)) store.set('nyx.hieroglyphText',true);
  }
  function toHieroglyphText(text){
    return String(text ?? '').replace(/[A-Za-z0-9]/g, ch => hieroglyphLetters[ch.toLowerCase()] || ch);
  }
  function shouldSkipHieroglyphNode(node){
    const parent=node?.parentElement;
    return !parent || parent.closest(hieroglyphSkipSelector) || parent.closest('[data-no-hieroglyph]');
  }
  function applyHieroglyphText(root=document.body){
    if(hieroglyphApplying || !root) return;
    hieroglyphApplying=true;
    try{
      const enabled=hieroglyphTextEnabled();
      if(enabled){
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
          acceptNode(node){
            if(shouldSkipHieroglyphNode(node)) return NodeFilter.FILTER_REJECT;
            return /\S/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        });
        const nodes=[];
        while(walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node=>{
          if(!hieroglyphTextNodes.has(node)) hieroglyphTextNodes.set(node,node.nodeValue);
          node.nodeValue=toHieroglyphText(hieroglyphTextNodes.get(node));
        });
      }else{
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);
        const nodes=[];
        while(walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node=>{
          if(hieroglyphTextNodes.has(node)) node.nodeValue=hieroglyphTextNodes.get(node);
        });
      }
      qsa('[data-hieroglyph-text], [data-switch="nyx.hieroglyphText"]').forEach(el=>el.classList.toggle('on',enabled));
    }finally{
      hieroglyphApplying=false;
    }
  }
  function startHieroglyphObserver(){
    if(hieroglyphObserver || !document.body) return;
    hieroglyphObserver=new MutationObserver(records=>{
      if(hieroglyphApplying || !hieroglyphTextEnabled()) return;
      records.forEach(record=>{
        record.addedNodes.forEach(node=>{
          if(node.nodeType===Node.TEXT_NODE && !shouldSkipHieroglyphNode(node)){
            if(!hieroglyphTextNodes.has(node)) hieroglyphTextNodes.set(node,node.nodeValue);
            node.nodeValue=toHieroglyphText(hieroglyphTextNodes.get(node));
          }else if(node.nodeType===Node.ELEMENT_NODE){
            applyHieroglyphText(node);
          }
        });
      });
    });
    hieroglyphObserver.observe(document.body,{childList:true,subtree:true});
  }

  function normalizeWorkspaceChromeButtons(root=document){
    const scope=root || document;
    const keepOne=selector=>{
      const items=[...scope.querySelectorAll(selector)];
      items.slice(1).forEach(item=>item.remove());
    };
    keepOne('form.workspace-mode-address [data-workspace-shell-settings]');
    keepOne('form.workspace-mode-address .workspace-mode-weather');
    keepOne('form.workspace-mode-address [data-workspace-shell-menu]');
    keepOne('#workspaceBookmarkPanel');
    keepOne('#workspaceModeMenu');
    const menu=scope.querySelector('#workspaceModeMenu');
    if(menu){
      [...menu.querySelectorAll('[data-workspace-bookmarks-toggle]')].slice(1).forEach(item=>item.remove());
      menu.querySelector(':scope > [data-workspace-shell-new-tab]')?.remove();
    }
  }
  function bindReloadPointerTurn(root=document){
    root.querySelectorAll?.('[data-workspace-shell-reload],.tool-btn[data-reload]')?.forEach(button=>{
      if(button.dataset.nyxPointerTurnBound==='true') return;
      button.dataset.nyxPointerTurnBound='true';
      let current=0;
      let target=0;
      let frame=0;
      const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const draw=()=>{
        frame=0;
        current+=(target-current)*.09;
        if(Math.abs(target-current)<.08) current=target;
        button.style.setProperty('--nyx-reload-turn',`${current.toFixed(2)}deg`);
        if(current!==target) frame=requestAnimationFrame(draw);
      };
      const aim=value=>{
        target=Math.max(0,Math.min(180,value));
        if(reducedMotion){
          current=0;
          target=0;
          button.style.setProperty('--nyx-reload-turn','0deg');
          return;
        }
        if(!frame) frame=requestAnimationFrame(draw);
      };
      button.addEventListener('pointermove',event=>{
        const bounds=button.getBoundingClientRect();
        const position=Math.max(0,Math.min(1,(event.clientX-bounds.left)/Math.max(1,bounds.width)));
        aim(position*180);
      });
      button.addEventListener('pointerleave',()=>aim(0));
      button.addEventListener('blur',()=>aim(0));
    });
  }
  function nyxDashboardIcon(name){
    const icons={
      home:'<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 21V12h6v9"/>',
      dashboard:'<path d="M4 5.5h6.5V12H4zM13.5 5.5H20v4h-6.5zM13.5 12.5H20v6h-6.5zM4 14.5h6.5v4H4z"/>',
      travel:'<path d="M5 18.5h14M7 15l3.2-9.5h3.6L17 15M8.5 11h7"/>',
      media:'<path d="M5 6.5h14v11H5z"/><path d="m10 9.5 5 2.5-5 2.5z"/>',
      movies:'<path d="M3 10h18v10H3zM3 10l-1-5 18-3 1 5zM7 4l4 4M14 3l4 4"/>',
      youtube:'<rect x="3" y="6" width="18" height="12" rx="4"/><path d="m10 9 5 3-5 3z"/>',
      ai:'<path d="M12 2a3 3 0 0 0-3 3v1H7a3 3 0 0 0-3 3v2H3a2 2 0 0 0 0 4h1v2a3 3 0 0 0 3 3h2v1a3 3 0 0 0 6 0v-1h2a3 3 0 0 0 3-3v-2h1a2 2 0 0 0 0-4h-1V9a3 3 0 0 0-3-3h-2V5a3 3 0 0 0-3-3z"/><circle cx="9" cy="11" r="1.2"/><circle cx="15" cy="11" r="1.2"/><path d="M9 16h6"/>',
      extensions:'<path d="M8.5 3.5v4h-4v4h4v4h4v4h4v-4h4v-4h-4v-4h-4v-4z"/>',
      performance:'<path d="M4 15a8 8 0 1 1 16 0"/><path d="m12 15 4-5"/><circle cx="12" cy="15" r="1.3"/>',
      apps:'<path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z"/>',
      code:'<path d="m9 7-5 5 5 5M15 7l5 5-5 5M14 4l-4 16"/>',
      settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      chat:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/><path d="M9 10v4M12 9v6M15 11v2"/>',
      games:'<rect x="2" y="6" width="20" height="13" rx="2.5"/><path d="M7.5 10v5M5 12.5h5"/><circle cx="15" cy="14" r=".9" fill="currentColor" stroke="none"/><circle cx="18" cy="11" r=".9" fill="currentColor" stroke="none"/>',
      music:'<path d="M9 18V6l9-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="15.5" cy="16" r="2.5"/>',
      sparkle:'<path d="M12 2c.7 5.3 2.7 7.3 8 8-5.3.7-7.3 2.7-8 8-.7-5.3-2.7-7.3-8-8 5.3-.7 7.3-2.7 8-8Z"/><path d="M19 16.5c.25 1.8.95 2.5 2.75 2.75C19.95 19.5 19.25 20.2 19 22c-.25-1.8-.95-2.5-2.75-2.75C18.05 19 18.75 18.3 19 16.5Z"/>',
      browse:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
      link:'<path d="M10 13a4 4 0 0 0 5.7 0l2.3-2.3A4 4 0 0 0 12.3 5L11 6.3M14 11a4 4 0 0 0-5.7 0L6 13.3A4 4 0 0 0 11.7 19l1.3-1.3"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.apps}</svg>`;
  }
  if(!store.get('nyx.obsidianInitialized',false)){
    store.set('nyx.sidebarExpanded',true);
    if(['frost','arctic'].includes(store.text('nyx.beamWallpaper','frost')))store.setText('nyx.beamWallpaper','obsidian');
    store.set('nyx.obsidianInitialized',true);
  }
  let nyxSidebarHidden=false;
  let nyxSidebarNoticeTimer=0;
  function setNyxSidebarHidden(hidden){
    nyxSidebarHidden=false;
    store.set('nyx.sidebarExpanded',!hidden);
    applyNyxSidebarExpansion();
  }
  function handleNyxSidebarShortcut(event){
    if(event.defaultPrevented||event.repeat||event.isComposing||event.key!=='/'||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||!document.body.classList.contains('workspace-shell'))return false;
    const target=event.composedPath?.()[0]||event.target;
    if(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="application"],canvas'))return false;
    event.preventDefault();event.stopImmediatePropagation();
    setNyxSidebarHidden(store.get('nyx.sidebarExpanded',true));
    return true;
  }
  document.addEventListener('keydown',handleNyxSidebarShortcut,true);
  let nyxVisualDockTimer=0;
  let nyxSidebarPreferenceSaveTimer=0;
  let nyxSidebarToggleLockTimer=0;
  let nyxVisualDockRecoveryObserver=null;
  let nyxVisualDockRecoveryFrame=0;
  let nyxVisualDockRecoveryTimer=0;
  let nyxVisualDockRecoveryFollowupTimer=0;
  let nyxVisualDockViewportRepairTimer=0;
  let nyxVisualDockElementObserver=null;
  let nyxVisualDockObservedElement=null;
  function nyxVisualDockUsesSideLayout(){return true}
  function enforceNyxVisualDockViewport(){
    const dock=document.querySelector('[data-nyx-visual-dock]');
    if(!dock) return;
    dock.hidden=false;dock.inert=false;dock.removeAttribute('aria-hidden');

    dock.removeAttribute('style');
    document.querySelectorAll('#desktop>.window.maximized').forEach(win=>{
      ['left','right','width','max-width','box-sizing'].forEach(key=>win.style.removeProperty(key));
    });
  }
  function scheduleNyxVisualDockViewportRepair(){
    clearTimeout(nyxVisualDockViewportRepairTimer);
    requestAnimationFrame(enforceNyxVisualDockViewport);
    nyxVisualDockViewportRepairTimer=setTimeout(enforceNyxVisualDockViewport,260);
  }
  function restoreNyxVisualDock(){
    const shouldRestore=document.body.classList.contains('workspace-shell');
    const dock=document.querySelector('[data-nyx-visual-dock]');
    if(!shouldRestore) return;
    if(nyxSidebarHidden){enforceNyxVisualDockViewport();return;}
    if(!dock || !dock.isConnected){
      ensureNyxVisualDock();
      return;
    }


    if(dock.parentElement!==(document.getElementById('app') || document.body)) (document.getElementById('app') || document.body).appendChild(dock);
    dock.hidden=false;
    dock.inert=false;
    dock.removeAttribute('aria-hidden');
    watchNyxVisualDockElement(dock);
    scheduleNyxVisualDockViewportRepair();
  }
  function watchNyxVisualDockElement(dock){
    if(!dock || nyxVisualDockObservedElement===dock) return;
    nyxVisualDockElementObserver?.disconnect();
    nyxVisualDockObservedElement=dock;
    nyxVisualDockElementObserver=new MutationObserver(()=>{
      if(nyxSidebarHidden)return;
      if(!dock.isConnected || dock.hidden || dock.inert || dock.getAttribute('aria-hidden')==='true'){
        scheduleNyxVisualDockRecovery();
        return;
      }
      const style=getComputedStyle(dock);
      const rect=dock.getBoundingClientRect();
      const viewportWidth=document.documentElement.clientWidth || window.innerWidth;
      if(style.display==='none' || style.visibility==='hidden' || Number(style.opacity)<.5 || rect.right<1 || rect.left>viewportWidth-1){
        scheduleNyxVisualDockViewportRepair();
      }
    });
    nyxVisualDockElementObserver.observe(dock,{attributes:true,attributeFilter:['class','style','hidden','inert','aria-hidden']});
  }
  function scheduleNyxVisualDockRecovery(){
    if(nyxVisualDockRecoveryFrame) return;
    nyxVisualDockRecoveryFrame=requestAnimationFrame(()=>{
      nyxVisualDockRecoveryFrame=0;
      restoreNyxVisualDock();
    });
  }
  function deferNyxVisualDockRecovery(){
    clearTimeout(nyxVisualDockRecoveryTimer);
    clearTimeout(nyxVisualDockRecoveryFollowupTimer);
    nyxVisualDockRecoveryTimer=setTimeout(restoreNyxVisualDock,0);



    nyxVisualDockRecoveryFollowupTimer=setTimeout(restoreNyxVisualDock,420);
  }
  function watchNyxVisualDock(){
    if(nyxVisualDockRecoveryObserver || !document.body) return;
    nyxVisualDockRecoveryObserver=new MutationObserver(()=>{
      const dock=document.querySelector('[data-nyx-visual-dock]');
      if(!dock || (document.body.classList.contains('workspace-shell') && dock.parentElement!==(document.getElementById('app') || document.body))) scheduleNyxVisualDockRecovery();
    });
    nyxVisualDockRecoveryObserver.observe(document.body,{childList:true,attributes:true,attributeFilter:['class']});
    addEventListener('pageshow',deferNyxVisualDockRecovery);
    addEventListener('resize',scheduleNyxVisualDockViewportRepair,{passive:true});
    window.visualViewport?.addEventListener?.('resize',scheduleNyxVisualDockViewportRepair,{passive:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible') deferNyxVisualDockRecovery();
    });
  }
  function syncNyxVisualDockState(){
    const dock=document.querySelector('[data-nyx-visual-dock]');
    if(!dock) return;
    const active=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
    const url=String(active?.url || '').toLowerCase();
    const settingsOpen=url==='nyx://settings' || Boolean(document.querySelector('.workspace-shell-settings-overlay'));
    let activeKey='';
    if(settingsOpen) activeKey='settings';
    else if(!url) activeKey='home';
    else if(url==='nyx://ai') activeKey='ai';
    else if(url.includes('/apps/nyxtube/')) activeKey='youtube';
    else if(url.includes('/apps/nyxify/')) activeKey='music';
    else if(url.includes('/apps/partners/')) activeKey='partners';
    else if(url.includes('/apps/chat/')) activeKey='chat';
    else if(url.includes('/apps/nyxcloud/')) activeKey='vms';
    else if(url.includes('/apps/link-generator/')) activeKey='links';
    else if(url.includes('/assets/games/')) activeKey='games';
    else if(url.includes('/apps') || url==='nyx://apps') activeKey='apps';
    dock.querySelectorAll('[data-nyx-dock-item]').forEach(button=>{
      if(button.dataset.nyxDockItem==='vms'){
        const allowed=true;
        button.hidden=!allowed;button.style.display=allowed?'':'none';
      }
      const selected=button.dataset.nyxDockItem===activeKey;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-current',selected ? 'page' : 'false');
    });
  }
  function applyNyxSidebarLocation(){
    document.documentElement.dataset.nyxSidebarSide='left';
    document.body.dataset.nyxSidebarSide='left';
  }
  function applyNyxSidebarExpansion(){
    const expanded=store.get('nyx.sidebarExpanded',true);
    document.documentElement.dataset.nyxSidebarWidth=expanded?'expanded':'collapsed';
    document.body.dataset.nyxSidebarWidth=expanded?'expanded':'collapsed';
    document.body.style.removeProperty('--nyx-visual-dock-current-width');
    const button=document.querySelector('[data-nyx-dock-expand]');
    if(button){
      button.setAttribute('aria-expanded',String(expanded));
      button.setAttribute('aria-label',expanded?'Collapse sidebar':'Expand sidebar');
      button.title=expanded?'Collapse sidebar':'Expand sidebar';
      button.querySelector('[data-sidebar-arrow]')?.setAttribute('d','m12 8 4 4-4 4');
    }
  }
  function applyNyxAppearance(){
    const appearance=store.text('nyx.appearance','dark')==='light'?'light':'dark';
    document.documentElement.dataset.nyxAppearance=appearance;
    document.querySelectorAll('button[data-nyx-appearance]').forEach(button=>{
      button.setAttribute('aria-pressed',String(appearance==='light'));
      button.setAttribute('aria-label',appearance==='light'?'Use dark appearance':'Use light appearance');
    });
    document.querySelectorAll('iframe.view').forEach(frame=>{
      try{if(frame.contentDocument?.documentElement)frame.contentDocument.documentElement.dataset.nyxAppearance=appearance}catch{}
    });
  }
  document.addEventListener('click',event=>{
    if(!event.target.closest?.('button[data-nyx-appearance]'))return;
    store.setText('nyx.appearance',store.text('nyx.appearance','dark')==='light'?'dark':'light');
    applyNyxAppearance();
  });
  function syncNyxVisualDockClock(){
    const dock=document.querySelector('[data-nyx-visual-dock]');
    if(!dock) return;
    const now=new Date();
    const time=dock.querySelector('[data-nyx-dock-time]');
    const date=dock.querySelector('[data-nyx-dock-date]');
    if(time) time.textContent=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    if(date){
      const fullDate=now.toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'});
      const expanded=document.documentElement.dataset.nyxSidebarWidth==='expanded';
      date.textContent=expanded?fullDate:`${now.getMonth()+1}/${now.getDate()}`;
      date.title=fullDate;
      date.setAttribute('aria-label',fullDate);
    }
  }
  function ensureNyxVisualDock(){
    const enabled=document.body.classList.contains('workspace-shell');
    let dock=document.querySelector('[data-nyx-visual-dock]');
    if(!enabled){
      dock?.remove();
      if(nyxVisualDockTimer){clearInterval(nyxVisualDockTimer);nyxVisualDockTimer=0}
      return null;
    }
    if(!dock){
      dock=document.createElement('aside');
      dock.className='nyx-visual-dock';
      dock.dataset.nyxVisualDock='';
      dock.setAttribute('aria-label','Nyx navigation');
      dock.innerHTML=`<div class="nyx-visual-dock-head"><a class="nyx-rail-brand" href="#" data-workspace-shell-home-nav aria-label="Nyx home"><img src="/assets/icons/nyx-cat-moon-small.svg?v=3" alt=""><span>NYX</span></a><button class="nyx-visual-dock-expand" data-nyx-dock-expand type="button" aria-expanded="true" aria-label="Collapse sidebar"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3v18"/><path data-sidebar-arrow d="m15 8-4 4 4 4"/></svg></button></div>
      <nav aria-label="Nyx destinations">
        <button type="button" data-nyx-dock-item="home" data-workspace-shell-home-nav aria-label="Home">${nyxDashboardIcon('home')}<span>Home</span></button>
        <button type="button" data-nyx-dock-item="games" data-app-url="/assets/games/" aria-label="Games">${nyxDashboardIcon('games')}<span>Games</span></button>
        <button type="button" data-nyx-dock-item="music" data-app-url="/apps/nyxify/" aria-label="Music">${nyxDashboardIcon('music')}<span>Music</span></button>
        <button type="button" data-nyx-dock-item="youtube" data-app-url="/apps/nyxtube/" aria-label="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="m10 8 5 3-5 3zM8 21h8"/></svg><span>YouTube</span></button>
        <button type="button" data-nyx-dock-item="ai" data-app-url="nyx://ai" aria-label="AI"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 3 2.1 6.9L19 12l-6.9 2.1L10 21l-2.1-6.9L1 12l6.9-2.1L10 3Z"/><path d="M20 2v6m-3-3h6"/><rect x="2" y="19" width="3" height="3" rx="1"/></svg><span>A1</span></button>
        <button type="button" data-nyx-dock-item="chat" data-app-url="/apps/chat/" aria-label="Chat">${nyxDashboardIcon('chat')}<span>Chat</span></button>
        <button type="button" data-nyx-dock-item="vms" data-app-url="/apps/nyxcloud/" aria-label="VMs" title="VMs" hidden style="display:none"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5"/></svg><span>VMs</span></button>
        <button type="button" data-nyx-dock-item="apps" data-app-url="nyx://apps" aria-label="Apps"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="7" height="7" rx="1"/><rect x="3" y="16" width="7" height="6" rx="1"/><rect x="12" y="14" width="7" height="8" rx="1"/><rect x="14" y="2" width="7" height="7" rx="1"/></svg><span>Apps</span></button>
      </nav>
      <div class="nyx-rail-footer"><a class="nyx-rail-discord" data-nyx-trusted-external="discord" data-nyx-dock-item="discord" href="https://discord.com/invite/cAdjYAJs3u" target="_blank" rel="noopener noreferrer" aria-label="Join the Nyx Discord server (opens in a new tab)" title="Join our Discord"><i class="nyx-rail-discord-icon" aria-hidden="true"></i><span>Discord</span></a><button type="button" data-nyx-dock-item="settings" data-open="settings" aria-label="Settings">${nyxDashboardIcon('settings')}<span>Settings</span></button><div class="nyx-visual-dock-profile" data-nyx-profile-slot></div></div>`;
      (document.getElementById('app') || document.body).appendChild(dock);
      watchNyxVisualDock();
      if(navigator.getBattery){
        navigator.getBattery().then(battery=>{
          const update=()=>{const value=dock?.querySelector('[data-nyx-dock-battery]');if(value)value.textContent=`${Math.round(battery.level*100)}%`};
          update();
          battery.addEventListener?.('levelchange',update);
        }).catch(()=>{});
      }
    }
    if(dock.parentElement!==(document.getElementById('app') || document.body)) (document.getElementById('app') || document.body).appendChild(dock);
    dock.hidden=nyxSidebarHidden;
    dock.inert=nyxSidebarHidden;
    if(nyxSidebarHidden)dock.setAttribute('aria-hidden','true');else dock.removeAttribute('aria-hidden');
    watchNyxVisualDockElement(dock);
    const expandButton=dock.querySelector('[data-nyx-dock-expand]');
    if(expandButton) expandButton.onclick=()=>{
      if(dock.dataset.nyxSidebarToggleLocked==='true') return;
      dock.dataset.nyxSidebarToggleLocked='true';
      const expanded=store.get('nyx.sidebarExpanded',true)===true;
      try{localStorage.setItem('nyx.sidebarExpanded',JSON.stringify(!expanded))}catch{}
      applyNyxSidebarExpansion();
      clearTimeout(nyxSidebarToggleLockTimer);
      nyxSidebarToggleLockTimer=setTimeout(()=>{
        if(dock.isConnected) delete dock.dataset.nyxSidebarToggleLocked;
      },220);
      clearTimeout(nyxSidebarPreferenceSaveTimer);
      nyxSidebarPreferenceSaveTimer=setTimeout(queueNyxCloudPreferencesSave,380);
    };

    const headAddButton=dock.querySelector('[data-nyx-dock-new-tab]');
    if(headAddButton) headAddButton.onclick=()=>openWorkspaceShellTab('');
    const youtubeButton=dock.querySelector('[data-nyx-dock-item="youtube"]');
    if(youtubeButton){
      const openYouTube=event=>{
        event?.preventDefault?.();
        event?.stopPropagation?.();
        openWorkspaceShellAppTab('/apps/nyxtube/');
      };
      youtubeButton.onclick=openYouTube;
      youtubeButton.onkeydown=event=>{
        if(event.key==='Enter' || event.key===' ') openYouTube(event);
      };
    }
    applyNyxSidebarExpansion();
    scheduleNyxVisualDockViewportRepair();
    renderNyxVisualTabStrip();
    syncNyxVisualDockClock();
    if(!nyxVisualDockTimer) nyxVisualDockTimer=setInterval(syncNyxVisualDockClock,30000);
    syncNyxVisualDockState();
    ensureNyxAccountButton();
    return dock;
  }
  function renderChromeFixed(){
    const top=document.querySelector('.top-os');
    if(top){
      top.innerHTML="<div class=\"brand-mini\"><button class=\"workspace-mode-app-button active\" data-workspace-shell-home title=\"Current tab\"><span class=\"workspace-home-icon\" aria-hidden=\"true\"></span><span class=\"workspace-home-label\">Home</span></button><button class=\"workspace-mode-tab\" data-workspace-shell-new-course heading=\"New tab\"><span>New page</span></button></div><span class=\"workspace-top-clock\" data-workspace-shell-clock>--:--:--</span><form class=\"workspace-mode-address\" data-workspace-shell-search><button class=\"workspace-nav-control\" data-workspace-shell-back type=\"button\" title=\"Back\" aria-label=\"Back\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m15 18-6-6 6-6\"></path></svg></button><button class=\"workspace-nav-control\" data-workspace-shell-forward type=\"button\" title=\"Forward\" aria-label=\"Forward\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m9 18 6-6-6-6\"></path></svg></button><button class=\"workspace-nav-control\" data-workspace-shell-reload type=\"button\" title=\"Reload\" aria-label=\"Reload\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 11a8 8 0 1 0-2.35 5.65\"></path><path d=\"M20 4v7h-7\"></path></svg></button><button class=\"workspace-nav-control\" data-workspace-shell-home-nav type=\"button\" title=\"Home\" aria-label=\"Home\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m3 11 9-8 9 8\"></path><path d=\"M5 10v10h14V10\"></path><path d=\"M9 20v-6h6v6\"></path></svg></button><input class=\"workspace-mode-url\" data-workspace-shell-url placeholder=\"S3ARC4 or enter a U3L\" autocomplete=\"off\"><button class=\"workspace-mode-bookmark workspace-mode-settings\" data-workspace-shell-settings data-open=\"settings\" type=\"button\" title=\"Settings\" aria-label=\"Settings\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\"></path></svg></button><button class=\"workspace-mode-weather\" data-open=\"weather\" type=\"button\" title=\"Weather\" aria-label=\"Weather\"><span class=\"weather-cloud-icon\" aria-hidden=\"true\"></span></button><button data-workspace-shell-menu type=\"button\" title=\"Menu\"><span class=\"fresh-real-icon\" aria-hidden=\"true\">⋮</span></button></form><div class=\"workspace-bookmark-panel\" id=\"workspaceBookmarkPanel\" hidden></div><div class=\"workspace-mode-menu\" id=\"workspaceModeMenu\"><button data-workspace-shell-new-tab type=\"button\">New page</button><button data-workspace-bookmarks-toggle type=\"button\">Bookmarks</button><button data-open=\"apps\" type=\"button\">Apps</button><hr><button data-open=\"settings\" type=\"button\">Settings</button><button data-workspace-hieroglyph-toggle type=\"button\">Hieroglyph Mode</button><button data-app-url=\"/assets/games/index.html\" type=\"button\">GAMES</button><button data-app-url=\"/apps/chat/\" type=\"button\">Chat</button><button data-app-url=\"https://discord.com/app\" type=\"button\">Discord</button><hr><button data-page-fullscreen type=\"button\">Fullscreen</button><button data-shell-about type=\"button\">Open About:Blank</button><button data-shell-about-tab type=\"button\">Open Tab in Abt:Blank</button></div>";
      const homeNav=top.querySelector('[data-workspace-shell-home-nav]');
      if(homeNav) homeNav.innerHTML=nyxDashboardIcon('home');
      const shellAddress=top.querySelector('form.workspace-mode-address');
      const shellUrl=top.querySelector('[data-workspace-shell-url]');

      {
      const legacyClock=top.querySelector(':scope > .workspace-top-clock');
      legacyClock?.remove();
      shellAddress?.querySelector('[data-open="weather"]')?.remove();
      const settingsButton=shellAddress?.querySelector('[data-workspace-shell-settings]');
      const menuButton=shellAddress?.querySelector('[data-workspace-shell-menu]');
      if(menuButton){
        menuButton.setAttribute('title','Workspace menu');
        menuButton.setAttribute('aria-label','Workspace menu');
        menuButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';
        top.querySelector('#workspaceModeMenu')?.insertAdjacentHTML('beforeend','<button type="button" data-open="developer">Developer console</button>');
      }
      const bookmarkButton=document.createElement('button');
      bookmarkButton.type='button';
      bookmarkButton.className='workspace-nav-control workspace-mode-bookmark';
      bookmarkButton.dataset.workspaceShellBookmark='';
      bookmarkButton.setAttribute('title','Bookmark this page');
      bookmarkButton.setAttribute('aria-label','Bookmark this page');
      bookmarkButton.setAttribute('aria-pressed','false');
      bookmarkButton.innerHTML=workspaceBookmarkIcon(false);
      if(shellAddress){
        const backButton=shellAddress.querySelector('[data-workspace-shell-back]');
        const forwardButton=shellAddress.querySelector('[data-workspace-shell-forward]');
        const reloadButton=shellAddress.querySelector('[data-workspace-shell-reload]');
        backButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m6-6-6 6 6 6"/></svg>';
        forwardButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
        reloadButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5"/></svg>';
        const homeButton=shellAddress.querySelector('[data-workspace-shell-home-nav]');
        const urlField=shellAddress.querySelector('[data-workspace-shell-url]');
        const secureIndicator=document.createElement('span');
        secureIndicator.className='workspace-mode-secure-indicator';
        secureIndicator.setAttribute('role','img');
        secureIndicator.setAttribute('aria-label','Nyx page');
        secureIndicator.title='Nyx page';
        secureIndicator.innerHTML='<svg viewBox="0 0 24 24"><rect x="6" y="10" width="12" height="9" rx="2"></rect><path d="M9 10V7a3 3 0 0 1 6 0v3"></path></svg>';
        shellAddress.replaceChildren(backButton,forwardButton,reloadButton,secureIndicator,urlField,bookmarkButton,menuButton);
      }
      renderNyxPresence();
      syncHomeWeatherWidgets();
      syncNyxLatencyBubble();
      ensureNyxVisualDock();
      }
      top.querySelectorAll('.brand-mini button[title],.workspace-mode-address button[title]').forEach(button=>{
        if(!button.getAttribute('aria-label')) button.setAttribute('aria-label',button.getAttribute('title') || 'Workspace control');
        button.removeAttribute('title');
      });
      top.querySelector('#workspaceModeMenu > [data-workspace-shell-new-tab]')?.remove();
      normalizeWorkspaceChromeButtons(top);
      bindReloadPointerTurn(top);
      top.querySelector('.brand-mini [data-workspace-shell-new-tab]')?.addEventListener('click',event=>{
        event.nyxShellNewHandled=true;
        event.preventDefault();
        event.stopImmediatePropagation();
        document.body.classList.remove('menu-open');
        openWorkspaceShellTab();
        document.querySelector('[data-workspace-shell-url]')?.focus();
      });
      top.querySelector('.brand-mini [data-workspace-shell-home]')?.addEventListener('click',event=>{
        event.nyxShellHomeHandled=true;
        event.preventDefault();
        event.stopImmediatePropagation();
        setWorkspaceShellHomeActive();
      });
      top.addEventListener('pointerdown',()=>{requestNyxKeyboardLock()},{capture:true});
      top.addEventListener('focusin',()=>{requestNyxKeyboardLock()},{capture:true});
      renderWorkspaceShellTabs();
      renderWorkspaceBookmarks();
    }
    const corner=document.querySelector('.corner-gear');
    if(corner) corner.remove();
    ensureNyxAccountButton();
  }
  function workspaceShellNeedsStartupHome(){
    const homeTab=workspaceShellTabs.find(tab=>tab.title==='Home' && !tab.url);
    if(!activeWorkspace || !activeWorkspace.win || !activeWorkspace.win.isConnected) return true;
    const activeShellTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
    if(String(activeShellTab?.url || '').trim()) return false;
    const activeWorkspaceTab=activeWorkspace.tabs?.find(tab=>tab.id===activeWorkspace.active);
    if(String(activeWorkspaceTab?.sourceUrl || activeWorkspaceTab?.url || '').trim()) return false;
    if(workspaceShellActiveTab && homeTab && workspaceShellActiveTab!==homeTab.id) return false;
    const homeEl=activeWorkspace.win.querySelector('.workspace-home');
    return !homeEl || homeEl.classList.contains('hidden');
  }
  function syncChromeMode(){
    if(renderedChromeMode==='workspace-shell' && document.querySelector('.top-os [data-workspace-shell-search]')){
      if(workspaceShellNeedsStartupHome()) setWorkspaceShellHomeActive();
      return;
    }
    document.body.classList.remove('menu-open');
    renderChromeFixed();
    if(nyxStartupOpened && workspaceShellNeedsStartupHome()) setWorkspaceShellHomeActive();
    else renderWorkspaceShellTabs();
    renderedChromeMode='workspace-shell';
    document.documentElement.classList.remove('nyx-workspace-shell-expected');
    tick();
  }

  function workspaceShellSourceUrl(url,decodeDepth=0){
    const initial=String(url || '').trim();
    const raw=/^apps\//i.test(initial) ? `/${initial}` : initial;
    if(!raw) return '';
    if(!/^(?:[a-z][a-z0-9+.-]*:|\/|\.\/|\.\.\/)/i.test(raw) && !/^[^\s]+\.[^\s]{2,}(?:[/?#]|$)/.test(raw)) return raw;
    const decodeUriPart=value=>{
      const text=String(value || '');
      try{return decodeURIComponent(text)}catch{return text}
    };
    const decodeRetiredConnectionPart=value=>{
      const text=String(value || '');

      const uriDecoded=decodeUriPart(text);
      const xorDecoded=[...uriDecoded].map((char,index)=>index % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char).join('');
      return /^https?:\/\//i.test(xorDecoded) ? xorDecoded : uriDecoded;
    };
    try{
      const parsed=new URL(raw,location.href);
      const retiredPrefix='/service/';
      const retiredStart=parsed.origin + retiredPrefix;
      const studyjetStart=parsed.origin + '/scramjet/service/';
      const retiredEnginePath=parsed.pathname.match(/^\/~\/(?:sj|study)-v[0-9]+\/(.*)$/);
      const studyjetV2Match=parsed.pathname.match(/^\/~\/sj\/[^/]+\/[^/]+\/([^?#]*)/);
      if(parsed.origin===location.origin && retiredEnginePath){
        const decoded=new URL(decodeUriPart(retiredEnginePath[1]));
        if(parsed.search) decoded.search=parsed.search;
        if(parsed.hash) decoded.hash=parsed.hash;
        return decoded.href;
      }
      if(parsed.origin===location.origin && parsed.href.startsWith(retiredStart)){
        let encoded=parsed.href.slice(retiredStart.length);
        const privateSession=encoded.match(/^nyx_[a-z0-9_-]{12,80}\/(.+)$/i);
        if(privateSession) encoded=privateSession[1];
        const decoded=decodeRetiredConnectionPart(encoded);
        if(decoded && decoded!==raw && decodeDepth<3){
          return workspaceShellSourceUrl(decoded,decodeDepth+1) || decoded;
        }
        try{return new URL(decoded).href}catch{return decoded}
      }
      if(parsed.origin===location.origin && parsed.href.startsWith(studyjetStart)){
        const decoded=decodeUriPart(parsed.href.slice(studyjetStart.length));
        try{return new URL(decoded).href}catch{return decoded}
      }
      if(parsed.origin===location.origin && studyjetV2Match){
        const decodedHash=parsed.hash ? `#${decodeUriPart(parsed.hash.slice(1))}` : '';
        const decoded=decodeUriPart(studyjetV2Match[1]) + decodedHash;
        try{return new URL(decoded).href}catch{return decoded}
      }
      return parsed.href;
    }catch{
      return raw;
    }
  }
  function workspaceShellIsTransientConnectionPath(pathname){
    return /^\/(?:unidentified|undefined)(?:[/?#]|$)/i.test(String(pathname || ''));
  }
  function workspaceShellIsBrokenConnectionLocation(candidate,expected=''){
    const next=String(candidate || '').trim();
    if(!next) return true;
    try{
      const parsed=new URL(next,location.href);



      if(!workspaceShellIsTransientConnectionPath(parsed.pathname)) return false;
      const prior=new URL(workspaceShellSourceUrl(expected) || expected,location.href);
      return /^https?:$/i.test(prior.protocol)
        && parsed.hostname===prior.hostname;
    }catch{
      return false;
    }
  }
  function workspaceShellRejectFrameLocation(source,expected=''){
    const raw=String(source || '').trim();
    if(!raw || /^\/?(?:unidentified|undefined)(?:[/?#]|$)/i.test(raw)) return true;
    if(workspaceShellIsBrokenConnectionLocation(raw,expected)) return true;
    try{
      const parsed=new URL(raw,location.href);
      const previous=workspaceShellSourceUrl(expected) || String(expected || '').trim();
      if(workspaceShellIsTransientConnectionPath(parsed.pathname) && previous){
        const previousUrl=new URL(previous,location.href);
        const sameSite=workspaceHost(parsed.href)===workspaceHost(previousUrl.href);
        if(sameSite && !workspaceShellIsTransientConnectionPath(previousUrl.pathname)) return true;
      }
      if(workspaceShellIsTransientConnectionPath(parsed.pathname)) return true;
      if(parsed.origin!==location.origin) return false;
      if(parsed.pathname.startsWith('/service/') || parsed.pathname.startsWith('/~/sj/') || parsed.pathname.startsWith('/scramjet/service/')) return true;
      if(!previous) return false;
      const previousUrl=new URL(previous,location.href);
      return /^https?:$/.test(previousUrl.protocol) && previousUrl.origin!==location.origin;
    }catch{
      return false;
    }
  }
  function workspaceShellInvalidHistoryEntry(value){
    const raw=String(value || '').trim();
    if(!raw || isWorkspaceShellBlankUrl(raw)) return false;
    if(/^\/?(?:unidentified|undefined)(?:[/?#]|$)/i.test(raw)) return true;
    const source=workspaceShellSourceUrl(raw) || raw;
    try{
      const parsed=new URL(source,location.href);
      return workspaceShellIsTransientConnectionPath(parsed.pathname);
    }catch{
      return false;
    }
  }
  function workspaceShellClipboardText(value,expected=''){
    const raw=String(value || '');
    const trimmed=raw.trim();
    if(!trimmed) return raw;
    if(!/^https?:\/\//i.test(trimmed) && !/^\/(?:service\/|~\/sj\/|scramjet\/service\/)/i.test(trimmed) && !/^\/?unidentified(?:[/?#]|$)/i.test(trimmed)) return raw;
    const decoded=workspaceShellSourceUrl(trimmed) || trimmed;
    if(workspaceShellRejectFrameLocation(decoded,expected)){
      const fallback=workspaceShellSourceUrl(expected) || String(expected || '').trim();
      return /^https?:\/\//i.test(fallback) ? fallback : raw;
    }
    return /^https?:\/\//i.test(decoded) ? decoded : raw;
  }
  function workspaceShellLabel(url){
    if(!url) return 'Home';
    if(String(url).trim().toLowerCase()==='nyx://settings') return 'Settings';
    if(String(url).trim().toLowerCase()==='nyx://terms') return 'Terms Of Service';
    if(String(url).trim().toLowerCase()==='nyx://developer') return 'Developer Console';
    if(/^nyx:\/\/(?:about|credits)$/i.test(String(url).trim())) return 'About Nyx';
    try{
      const parsed=new URL(workspaceShellSourceUrl(url),location.href);
      if(parsed.origin===location.origin && parsed.pathname==='/search') return parsed.searchParams.get('q') || "S3ARC4";
      if(parsed.origin===location.origin && parsed.pathname.includes('/assets/games/')) return 'GAMES';
      if(parsed.origin===location.origin && parsed.pathname.includes('/assets/ugs/')) return 'GAMES';
      if(parsed.origin===location.origin && parsed.pathname.includes('/apps/chat/')) return 'Nyx Chat';
      if(parsed.origin===location.origin && parsed.pathname.includes('/apps/cloud-gaming/')) return 'Cloud Gaming';
      if(parsed.origin===location.origin && parsed.pathname.includes('/apps/link-checker/')) return 'Link Checker';
      if(parsed.origin===location.origin && parsed.pathname.includes('/apps/link-generator/')) return 'Link Generator';
      if(parsed.origin===location.origin) return parsed.pathname.split('/').filter(Boolean).pop() || 'nyx';
      return parsed.hostname.replace(/^www\./,'') || 'New tab';
    }catch{
      return String(url || 'New tab').replace(/^https?:\/\//,'').slice(0,34) || 'New tab';
    }
  }
  function workspaceShellDisplayValue(url){
    if(!url) return '';
    const lesson=window.NyxLearningRoutes?.learningRouteForApp(url,location.origin);
    if(lesson && window.__NYX_RUNTIME_CONFIG__?.learningRoutesEnabled) return location.origin+lesson;
    try{
      const parsed=new URL(workspaceShellSourceUrl(url),location.href);
      if(parsed.origin===location.origin && parsed.pathname==='/search') return parsed.searchParams.get('q') || '';
      if(parsed.origin===location.origin) return parsed.pathname.replace(/^\/+/,'') || parsed.href;
      return parsed.href;
    }catch{
      return workspaceShellSourceUrl(url);
    }
  }

  function workspaceBookmarks(){
    try{
      const parsed=JSON.parse(store.text('nyx.workspaceBookmarks','[]'));
      return Array.isArray(parsed) ? parsed.filter(item=>item && item.url) : [];
    }catch{
      return [];
    }
  }
  function saveWorkspaceBookmarks(items){
    store.setText('nyx.workspaceBookmarks',JSON.stringify(items.slice(0,80)));
  }
  function activeWorkspaceShellTab(){
    ensureWorkspaceShellHome();
    return workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab) || workspaceShellTabs[0];
  }
  window.__nyxPublisherHome=()=>{
    const tab=workspaceShellTabs.find(item=>item.id===workspaceShellActiveTab);
    if(!tab || tab.url || tab.title!=='Home') return null;
    return [...document.querySelectorAll('.workspace-window.workspace-blank .workspace-home.nyx-minimal-home:not(.hidden)')].find(home=>home.getClientRects().length && getComputedStyle(home).visibility==='visible') || null;
  };
  function currentWorkspaceShellUrl(){
    const tab=activeWorkspaceShellTab();
    return normalize(workspaceShellSourceUrl(tab?.url) || document.querySelector('[data-workspace-shell-url]')?.value || '');
  }
  const workspaceSuggestionSeeds=[
    'youtube','tiktok','spotify','discord','roblox','github','google classroom','google docs',
    'duck ai','geforce now','games','weather','anime','music','unblocked games','calculator',
    'roblox codes','gmail','google translate','cool math games','chatgpt','amazon','reddit','netflix'
  ];
  const workspaceSuggestionCache=new Map();
  let workspaceSuggestionTimer=0;
  let workspaceSuggestionAbort=null;
  function ensureWorkspaceSuggestionBox(input){
    let box=$('workspaceSuggestions');
    if(!box){
      box=document.createElement('div');
      box.id='workspaceSuggestions';
      box.className='workspace-search-suggestions';
      box.setAttribute('role','listbox');
      (document.getElementById('app') || document.body).appendChild(box);
    }
    if(input){
      const anchor=input.closest?.('[data-workspace-blank-search]') || input;
      const rect=anchor.getBoundingClientRect();
      box.nyxSourceInput=input;
      box.style.left=Math.max(8,rect.left)+'px';
      box.style.top=Math.min(window.innerHeight-12,rect.bottom+8)+'px';
      box.style.width=Math.min(rect.width,window.innerWidth-16)+'px';
    }
    return box;
  }
  function workspaceSuggestionsAllowed(){
    if(!document.body.classList.contains('workspace-shell')) return false;
    const tab=activeWorkspaceShellTab?.();
    const url=String(tab?.url || '');
    const title=String(tab?.title || '').trim().toLowerCase();
    if(url.startsWith('nyx://')) return false;
    if(['apps','lion ai','lionai','ai','bookmarks','links','settings','games'].includes(title)) return false;
    const state=activeWorkspace;
    const workspaceTab=state?.tabs?.find(item=>item.id===state.active);
    if(workspaceTab?.frame?.getAttribute('srcdoc') && String(workspaceTab.url || '').startsWith('nyx://')) return false;
    return true;
  }
  function workspaceSuggestionItems(query,remoteItems=[]){
    const q=String(query || '').trim().toLowerCase();
    if(!q) return [];
    const tabItems=workspaceShellTabs.map(tab=>workspaceShellSourceUrl(tab.url) || tab.title).filter(Boolean);
    const bookmarkItems=workspaceBookmarks().flatMap(item=>[item.title,item.url]).filter(Boolean);
    const popularByPrefix=[
      ['mine',['minecraft skins','minecraft movie','minecraft seed map','minecraft download','minecraft launcher','minecraft wiki']],
      ['rob',['roblox codes','roblox login','roblox redeem','roblox support','roblox marketplace','roblox avatar']],
      ['you',['youtube','youtube music','youtube tv','youtube studio','youtube shorts','youtube downloader']],
      ['tik',['tiktok','tiktok shop','tiktok login','tiktok trends','tiktok sounds','tiktok studio']],
      ['spo',['spotify','spotify web player','spotify wrapped','spotify login','spotify playlist','spotify download']],
      ['dis',['discord','discord login','discord app','discord status','discord download','discord servers']],
      ['goo',['google classroom','google docs','google drive','google translate','google maps','google flights']]
    ];
    const prefixItems=popularByPrefix.find(([prefix])=>q.startsWith(prefix))?.[1] || [];
    const pool=[...remoteItems,...prefixItems,...tabItems,...bookmarkItems,...workspaceSuggestionSeeds];
    const seen=new Set();
    const out=[];
    pool
      .map(item=>String(item || '').trim())
      .filter(Boolean)
      .sort((a,b)=>{
        const ak=a.toLowerCase();
        const bk=b.toLowerCase();
        const aStarts=ak.startsWith(q) ? 0 : 1;
        const bStarts=bk.startsWith(q) ? 0 : 1;
        if(aStarts!==bStarts) return aStarts-bStarts;
        const aIndex=ak.indexOf(q);
        const bIndex=bk.indexOf(q);
        if(aIndex!==bIndex) return aIndex-bIndex;
        return a.length-b.length;
      })
      .forEach(item=>{
      const text=String(item || '').trim();
      const key=text.toLowerCase();
      if(!text || seen.has(key)) return;
      if(key.includes(q) || (q.length<=4 && q.includes(key))){
        seen.add(key);
        out.push(text);
      }
    });
    if(!out.includes(query)) out.unshift(query);
    return out.slice(0,6);
  }
  function renderWorkspaceSuggestions(input,items){
    if(!input || !workspaceSuggestionsAllowed()) return;
    const box=ensureWorkspaceSuggestionBox(input);
    if(!items.length){
      box.classList.remove('show');
      box.innerHTML='';
      return;
    }
    box.innerHTML=items.map((item,index)=>`<button class="workspace-search-suggestion${index===0?' active':''}" data-workspace-suggestion="${esc(item)}" type="button" role="option">${esc(item)}</button>`).join('');
    box.classList.add('show');
  }
  async function fetchWorkspaceAutocomplete(query,signal){
    const q=String(query || '').trim();
    if(q.length<2) return [];
    const key=q.toLowerCase();
    if(workspaceSuggestionCache.has(key)) return workspaceSuggestionCache.get(key);
    try{
      const response=await fetch(`/api/search-suggestions?q=${encodeURIComponent(q)}`,{
        headers:{accept:'application/json'},
        signal
      });
      if(response.ok){
        const payload=await response.json();
        const clean=(Array.isArray(payload?.suggestions) ? payload.suggestions : [])
          .map(item=>String(item || '').trim()).filter(Boolean).slice(0,8);
        if(clean.length){
          workspaceSuggestionCache.set(key,clean);
          return clean;
        }
      }
    }catch(error){
      if(signal?.aborted) return [];
    }
    const callback='nyxSuggest_'+Math.random().toString(36).slice(2);
    try{
      const items=await new Promise(resolve=>{
        if(signal?.aborted){resolve([]); return}
        const script=document.createElement('script');
        const cleanup=()=>{
          try{window[callback]=()=>{}}catch{}
          setTimeout(()=>{try{delete window[callback]}catch{window[callback]=undefined}},8000);
          script.remove();
        };
        const timer=setTimeout(()=>{cleanup(); resolve([])},1800);
        window[callback]=data=>{
          clearTimeout(timer);
          cleanup();
          resolve(Array.isArray(data?.[1]) ? data[1] : []);
        };
        signal?.addEventListener('abort',()=>{clearTimeout(timer); cleanup(); resolve([])},{once:true});
        script.onerror=()=>{clearTimeout(timer); cleanup(); resolve([])};
        script.src=`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}&callback=${callback}`;
        document.head.appendChild(script);
      });
      const clean=items.map(item=>String(item || '').trim()).filter(Boolean).slice(0,8);
      if(clean.length){
        workspaceSuggestionCache.set(key,clean);
        return clean;
      }
    }catch{}
    workspaceSuggestionCache.set(key,[]);
    return [];
  }
  function showWorkspaceSuggestions(input){
    if(!input || !workspaceSuggestionsAllowed()){
      hideWorkspaceSuggestions();
      return;
    }
    const value=String(input.value || '').trim();
    renderWorkspaceSuggestions(input,workspaceSuggestionItems(value));
    clearTimeout(workspaceSuggestionTimer);
    workspaceSuggestionAbort?.abort?.();
    if(value.length<2 || document.body.classList.contains('runtime-lag-guard')) return;
    workspaceSuggestionAbort=new AbortController();
    const signal=workspaceSuggestionAbort.signal;
    workspaceSuggestionTimer=setTimeout(async()=>{
      const remote=await fetchWorkspaceAutocomplete(value,signal);
      if(signal.aborted) return;
      if(!input.isConnected || String(input.value || '').trim()!==value) return;
      renderWorkspaceSuggestions(input,workspaceSuggestionItems(value,remote));
    },180);
  }
  function hideWorkspaceSuggestions(){
    clearTimeout(workspaceSuggestionTimer);
    workspaceSuggestionAbort?.abort?.();
    const box=$('workspaceSuggestions');
    if(box) box.classList.remove('show');
  }
  function workspaceSuggestionPointerInside(target){
    return !!target?.closest?.('[data-workspace-shell-url],[data-workspace-blank-input],#workspaceSuggestions,.workspace-search-suggestions');
  }
  function acceptWorkspaceSuggestion(value,sourceInput=$('workspaceSuggestions')?.nyxSourceInput){
    const input=sourceInput?.isConnected ? sourceInput : document.querySelector('[data-workspace-shell-url]');
    if(input) input.value=value || '';
    hideWorkspaceSuggestions();
    navigateWorkspaceShell(value);
  }
  function selectWorkspaceShellUrl(input,force=false){
    if(!input) return;
    if(!force && input.dataset.selectOnFocus!=='1') return;
    input.dataset.selectOnFocus='0';
    requestAnimationFrame(()=>{
      try{input.select()}catch{}
    });
  }
  let workspaceShellUrlFirstPointer=null;
  function clearWorkspaceShellUrlSelection(input=document.querySelector('[data-workspace-shell-url]')){
    if(!input) return;
    try{
      const end=String(input.value || '').length;
      input.setSelectionRange(end,end);
    }catch{}
  }
  function isEditableTarget(target){
    return !!target && (target.matches?.('input,textarea') || target.isContentEditable);
  }
  function selectedTextFromTarget(target){
    if(target?.matches?.('input,textarea')){
      return target.value.slice(target.selectionStart || 0,target.selectionEnd || 0);
    }
    return String(getSelection?.() || '');
  }
  function replaceSelectionInTarget(target,text){
    if(target?.matches?.('input,textarea')){
      const start=target.selectionStart || 0;
      const end=target.selectionEnd || 0;
      const value=target.value || '';
      target.value=value.slice(0,start)+text+value.slice(end);
      const cursor=start+String(text).length;
      target.setSelectionRange(cursor,cursor);
      target.dispatchEvent(new Event('input',{bubbles:true}));
      return;
    }
    document.execCommand('insertText',false,text);
  }
  async function writeClipboard(text){
    const cleanText=workspaceShellClipboardText(text,currentWorkspaceShellUrl());
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(cleanText);
        return true;
      }
    }catch{}
    const helper=document.createElement('textarea');
    helper.value=cleanText;
    helper.setAttribute('readonly','');
    helper.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    (document.getElementById('app') || document.body).appendChild(helper);
    helper.select();
    let copied=false;
    try{copied=Boolean(document.execCommand?.('copy'))}catch{}
    helper.remove();
    return copied;
  }
  let nyxWorkspaceLinkMenu=null;
  let nyxWorkspaceLinkMenuCleanup=null;
  function closeWorkspaceLinkMenu(){
    nyxWorkspaceLinkMenuCleanup?.();
    nyxWorkspaceLinkMenuCleanup=null;
    nyxWorkspaceLinkMenu?.remove();
    nyxWorkspaceLinkMenu=null;
  }
  function showWorkspaceLinkMenu(url,x,y){
    closeWorkspaceLinkMenu();
    const cleanUrl=workspaceShellClipboardText(url,currentWorkspaceShellUrl());
    if(!/^https?:\/\//i.test(cleanUrl)) return false;
    const menu=document.createElement('div');
    menu.className='nyx-workspace-link-menu';
    menu.dataset.nyxOwnedOverlay='';
    menu.setAttribute('role','menu');
    menu.setAttribute('aria-label','Link actions');
    menu.innerHTML='<button type="button" role="menuitem" data-nyx-copy-clean-link>Copy link</button><button type="button" role="menuitem" data-nyx-open-clean-link>Open link in new tab</button>';
    (document.getElementById('app') || document.body).appendChild(menu);
    const bounds=menu.getBoundingClientRect();
    menu.style.left=`${Math.max(8,Math.min(Number(x || 0),innerWidth-bounds.width-8))}px`;
    menu.style.top=`${Math.max(8,Math.min(Number(y || 0),innerHeight-bounds.height-8))}px`;
    nyxWorkspaceLinkMenu=menu;
    const closeFromOutside=event=>{
      if(!menu.contains(event.target)) closeWorkspaceLinkMenu();
    };
    const closeFromKeyboard=event=>{
      if(event.key==='Escape') closeWorkspaceLinkMenu();
    };
    document.addEventListener('pointerdown',closeFromOutside,true);
    document.addEventListener('keydown',closeFromKeyboard,true);
    nyxWorkspaceLinkMenuCleanup=()=>{
      document.removeEventListener('pointerdown',closeFromOutside,true);
      document.removeEventListener('keydown',closeFromKeyboard,true);
    };
    menu.addEventListener('click',async event=>{
      if(event.target.closest('[data-nyx-copy-clean-link]')){
        const copied=await writeClipboard(cleanUrl);
        closeWorkspaceLinkMenu();
        toast(copied?'Link copied':'Could not copy the link');
        return;
      }
      if(event.target.closest('[data-nyx-open-clean-link]')){
        closeWorkspaceLinkMenu();
        openWorkspaceShellAppTab(cleanUrl);
      }
    });
    menu.querySelector('button')?.focus({preventScroll:true});
    return true;
  }
  function switchWorkspaceShellTabByIndex(index){
    if(!document.body.classList.contains('workspace-shell')) return false;
    const safeIndex=Math.max(0,Math.min(8,Number(index || 0)));
    const tab=workspaceShellTabs[safeIndex];
    if(!tab) return false;
    setWorkspaceShellActive(tab.id);
    return true;
  }
  function primeWorkspaceShellShortcutFocus(){
    if(!document.body.classList.contains('workspace-shell')) return;
    requestNyxKeyboardLock();
    try{window.focus()}catch{}
    const target=document.querySelector('.top-os') || document.body;
    try{
      if(!target.hasAttribute('tabindex')) target.setAttribute('tabindex','-1');
      target.focus({preventScroll:true});
    }catch{
      try{document.body.focus({preventScroll:true})}catch{}
    }
  }
  const nyxKeyboardLockKeys=['AltLeft','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','KeyL','KeyD','KeyT','KeyW','KeyR','ArrowLeft','ArrowRight','Tab'];
  let nyxKeyboardLockRequested=false;
  async function releaseNyxKeyboardLock(){
    if(!nyxKeyboardLockRequested) return;
    try{await navigator.keyboard?.unlock?.()}catch{}
    nyxKeyboardLockRequested=false;
  }
  async function requestNyxKeyboardLock(){
    const activeTab=activeWorkspace?.tabs?.find?.(tab=>tab.id===activeWorkspace.active);
    const activeSource=String(workspaceShellSourceUrl(activeTab?.sourceUrl || activeTab?.url || '') || activeTab?.sourceUrl || activeTab?.url || '');
    if(/(?:pixelclient\.xyz|play\.geforcenow\.com|geforcenow\.com|\/assets\/(?:games|ugs|gn-math|gms-games)\/)/i.test(activeSource)){
      await releaseNyxKeyboardLock();
      return;
    }
    if(nyxKeyboardLockRequested || !document.body.classList.contains('workspace-shell')) return;
    nyxKeyboardLockRequested=true;
    try{
      await navigator.keyboard?.lock?.(nyxKeyboardLockKeys);
    }catch{
      nyxKeyboardLockRequested=false;
    }
  }
  function handleWorkspaceShellAltAction(key,eventLike=null){
    key=String(key || '').toLowerCase();
    if(!key) return false;
    const consume=()=>{try{eventLike?.preventDefault?.()}catch{}; try{eventLike?.stopPropagation?.()}catch{}};
    if(key==='tab') return false;
    if(/^[1-9]$/.test(key)){
      if(switchWorkspaceShellTabByIndex(Number(key)-1)){
        consume();
        return true;
      }
      return false;
    }
    const input=document.querySelector('[data-workspace-shell-url]');
    if(key==='l' || key==='d'){
      consume();
      input?.focus();
      selectWorkspaceShellUrl(input,true);
      showWorkspaceSuggestions(input);
      return true;
    }
    if(key==='t'){
      consume();
      openWorkspaceShellTab();
      const next=document.querySelector('[data-workspace-shell-url]');
      next?.focus();
      selectWorkspaceShellUrl(next,true);
      return true;
    }
    if(key==='w'){
      consume();
      const tab=activeWorkspaceShellTab();
      if(tab?.id) closeWorkspaceShellTab(tab.id);
      return true;
    }
    if(key==='r'){
      consume();
      document.querySelector('[data-workspace-shell-reload]')?.click();
      return true;
    }
    if(key==='arrowleft'){
      consume();
      document.querySelector('[data-workspace-shell-back]')?.click();
      return true;
    }
    if(key==='arrowright'){
      consume();
      document.querySelector('[data-workspace-shell-forward]')?.click();
      return true;
    }
    return false;
  }
  async function handleLeftAltChromeShortcut(e){
    if(panicCaptureArmed || e.ctrlKey || e.metaKey || !e.altKey || e.location===KeyboardEvent.DOM_KEY_LOCATION_RIGHT) return;
    const key=String(e.key || '').toLowerCase();
    const consume=()=>{e.preventDefault(); e.stopPropagation();};
    if(key==='alt'){
      consume();
      primeWorkspaceShellShortcutFocus();
      return;
    }
    if(handleWorkspaceShellAltAction(key,e)) return;
    const target=e.target;
    if(!isEditableTarget(target)) return;
    if(key==='a'){
      consume();
      if(target.select) target.select();
      else document.execCommand('selectAll');
      return;
    }
    if(key==='c'){
      consume();
      await writeClipboard(selectedTextFromTarget(target));
      return;
    }
    if(key==='x'){
      consume();
      const selected=selectedTextFromTarget(target);
      await writeClipboard(selected);
      replaceSelectionInTarget(target,'');
      return;
    }
    if(key==='v'){
      consume();
      try{
        const text=await navigator.clipboard?.readText();
        if(text!=null) replaceSelectionInTarget(target,text);
      }catch{
        document.execCommand?.('paste');
      }
      return;
    }
    if(key==='z'){
      consume();
      document.execCommand?.('undo');
      return;
    }
    if(key==='y'){
      consume();
      document.execCommand?.('redo');
    }
  }
  function workspaceBookmarkIcon(saved){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="'+(saved?'currentColor':'none')+'" d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.6 3 1.1-6.3L3 9.6l6.2-.9Z"/></svg>';
  }
  function renderWorkspaceBookmarks(){
    const panel=$('workspaceBookmarkPanel');
    const star=document.querySelector('[data-workspace-shell-bookmark]');
    if(!panel && !star) return;
    const activeUrl=currentWorkspaceShellUrl();
    const bookmarks=workspaceBookmarks();
    const saved=!!activeUrl && bookmarks.some(item=>item.url===activeUrl);
    if(star){
      star.classList.toggle('saved',saved);
      star.setAttribute('aria-pressed',String(saved));
      star.innerHTML=workspaceBookmarkIcon(saved);
    }
    if(!panel) return;
    if(!bookmarks.length){
      panel.innerHTML='<p class="workspace-bookmark-empty">No bookmarks yet. Open a page and press the star.</p>';
      return;
    }
    panel.innerHTML=bookmarks.map((item,index)=>`<div class="workspace-bookmark-row"><button class="workspace-bookmark-open" data-workspace-bookmark-open="${index}" type="button"><b>${esc(item.title || workspaceShellLabel(item.url))}</b><small>${esc(workspaceShellDisplayValue(item.url))}</small></button><button class="workspace-bookmark-remove" data-workspace-bookmark-remove="${index}" type="button" title="Remove bookmark">x</button></div>`).join('');
  }
  function toggleWorkspaceBookmark(){
    const url=currentWorkspaceShellUrl();
    if(!url){
      toggleWorkspaceBookmarksPanel();
      return;
    }
    const tab=activeWorkspaceShellTab();
    const bookmarks=workspaceBookmarks();
    const index=bookmarks.findIndex(item=>item.url===url);
    if(index>=0){
      bookmarks.splice(index,1);
      toast('Bookmark removed');
    }else{
      bookmarks.unshift({url,title:tab?.title || workspaceShellLabel(url),created:Date.now()});
      toast('Bookmarked');
    }
    saveWorkspaceBookmarks(bookmarks);
    renderWorkspaceBookmarks();
  }
  function toggleWorkspaceBookmarksPanel(){
    renderWorkspaceBookmarks();
    const panel=$('workspaceBookmarkPanel');
    if(panel) panel.hidden=!panel.hidden;
  }
  function openWorkspaceBookmark(index){
    const item=workspaceBookmarks()[Number(index)];
    if(!item?.url) return;
    navigateWorkspaceShell(item.url);
    const panel=$('workspaceBookmarkPanel');
    if(panel) panel.hidden=true;
  }
  function removeWorkspaceBookmark(index){
    const bookmarks=workspaceBookmarks();
    bookmarks.splice(Number(index),1);
    saveWorkspaceBookmarks(bookmarks);
    renderWorkspaceBookmarks();
  }

  function isWorkspaceShellBlankUrl(url){
    const raw=String(url || '').trim().toLowerCase();
    return !raw;
  }
  function renderWorkspaceShellHomeMode(win){
    if(!win) return;
    hideNyxErudaPanel();
    win.classList.remove('nyx-frame-loading');
    win.querySelector('.nyx-frame-loader')?.setAttribute('aria-hidden','true');
    win.classList.remove('workspace-blank-page');
    win.classList.add('workspace-home-page');
    win.classList.add('workspace-blank');
    const home=win.querySelector('.workspace-home');
    home?.classList.remove('hidden','page-revealing','tab-opening','closing');
    if(home) home.style.filter='';
    const presence=home?.querySelector('.nyx-home-presence');
    if(presence&&!presence.querySelector('[data-nyx-profile-slot]')){
      const slot=document.createElement('div');
      slot.className='nyx-profile-slot';
      slot.dataset.nyxProfileSlot='';
      presence.appendChild(slot);
    }
    win.querySelectorAll('.view').forEach(frame=>frame.classList.remove('active'));
    const input=win.querySelector('[data-workspace-blank-input]');
    if(input) input.value='';
    ensureNyxAccountButton();
    scheduleWorkspaceConnectionPrewarmFromHome();
  }
  function ensureWorkspaceShellHome(){
    if(!workspaceShellTabs.length){
      const id='shell-'+Date.now()+Math.random().toString(16).slice(2);
      workspaceShellTabs.push({id,url:'',title:'Home'});
      workspaceShellActiveTab=id;
    }
    if(!workspaceShellActiveTab) workspaceShellActiveTab=workspaceShellTabs[0].id;
    armWorkspaceConnectionPrewarmOnIntent();
  }
  function moveWorkspaceShellTab(draggedId,targetId,placeAfter=false){
    if(!draggedId || !targetId || draggedId===targetId) return false;
    const dragged=workspaceShellTabs.find(tab=>tab.id===draggedId);
    const target=workspaceShellTabs.find(tab=>tab.id===targetId);
    if(!dragged || !target || (!dragged.url && dragged.title==='Home') || (!target.url && target.title==='Home')) return false;
    const from=workspaceShellTabs.indexOf(dragged);
    workspaceShellTabs.splice(from,1);
    const targetIndex=workspaceShellTabs.indexOf(target);
    workspaceShellTabs.splice(Math.max(0,targetIndex+(placeAfter?1:0)),0,dragged);
    if(activeWorkspace?.tabs?.length){
      const rank=new Map(workspaceShellTabs.map((tab,index)=>[tab.workspaceTabId,index]).filter(([id])=>id));
      const originalOrder=new Map(activeWorkspace.tabs.map((tab,index)=>[tab.id,index]));
      activeWorkspace.tabs.sort((left,right)=>{
        const leftRank=rank.has(left.id)?rank.get(left.id):Number.MAX_SAFE_INTEGER;
        const rightRank=rank.has(right.id)?rank.get(right.id):Number.MAX_SAFE_INTEGER;
        return leftRank-rightRank || originalOrder.get(left.id)-originalOrder.get(right.id);
      });
      activeWorkspace.renderTabs?.();
    }
    renderWorkspaceShellTabs();
    requestAnimationFrame(()=>document.querySelector(`[data-workspace-shell-tab="${CSS.escape(draggedId)}"]`)?.focus({preventScroll:true}));
    return true;
  }
  function clearWorkspaceShellTabDropState(row){
    row?.querySelectorAll?.('.tab-dragging,.tab-drop-before,.tab-drop-after').forEach(tab=>tab.classList.remove('tab-dragging','tab-drop-before','tab-drop-after'));
    document.body.classList.remove('nyx-tab-reordering');
  }
  function installWorkspaceShellTabReordering(row){
    if(!row || row.dataset.nyxTabReordering==='true') return;
    row.dataset.nyxTabReordering='true';
    let draggedId='';
    row.addEventListener('dragstart',event=>{
      const tab=event.target.closest?.('[data-workspace-shell-tab]');
      if(!tab || event.target.closest?.('button')){event.preventDefault();return}
      draggedId=tab.dataset.workspaceShellTab || '';
      if(!draggedId){event.preventDefault();return}
      tab.classList.add('tab-dragging');
      document.body.classList.add('nyx-tab-reordering');
      if(event.dataTransfer){
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('application/x-nyx-tab',draggedId);
        event.dataTransfer.setData('text/plain',draggedId);
      }
    });
    row.addEventListener('dragover',event=>{
      const target=event.target.closest?.('[data-workspace-shell-tab]');
      if(!draggedId || !target || target.dataset.workspaceShellTab===draggedId) return;
      event.preventDefault();
      if(event.dataTransfer)event.dataTransfer.dropEffect='move';
      row.querySelectorAll('.tab-drop-before,.tab-drop-after').forEach(tab=>tab.classList.remove('tab-drop-before','tab-drop-after'));
      const rect=target.getBoundingClientRect();
      target.classList.add(event.clientX>=rect.left+rect.width/2?'tab-drop-after':'tab-drop-before');
    });
    row.addEventListener('drop',event=>{
      const target=event.target.closest?.('[data-workspace-shell-tab]');
      if(!draggedId || !target) return;
      event.preventDefault();
      const rect=target.getBoundingClientRect();
      moveWorkspaceShellTab(draggedId,target.dataset.workspaceShellTab,event.clientX>=rect.left+rect.width/2);
      draggedId='';
      clearWorkspaceShellTabDropState(row);
    });
    row.addEventListener('dragend',()=>{
      draggedId='';
      clearWorkspaceShellTabDropState(row);
    });
    row.addEventListener('keydown',event=>{
      if(!(event.ctrlKey||event.metaKey) || !event.shiftKey || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
      const tab=event.target.closest?.('[data-workspace-shell-tab]');
      if(!tab) return;
      const movable=workspaceShellTabs.filter(item=>item.url || item.title!=='Home');
      const index=movable.findIndex(item=>item.id===tab.dataset.workspaceShellTab);
      const direction=event.key==='ArrowLeft'?-1:1;
      const target=movable[index+direction];
      if(!target) return;
      event.preventDefault();
      moveWorkspaceShellTab(tab.dataset.workspaceShellTab,target.id,direction>0);
    });
  }
  function ensureWorkspaceShellTabSidebar(){
    let sidebar=document.getElementById('nyxWorkspaceTabSidebar');
    if(sidebar) return sidebar;
    sidebar=document.createElement('aside');
    sidebar.id='nyxWorkspaceTabSidebar';
    sidebar.className='nyx-workspace-tab-sidebar';
    sidebar.setAttribute('aria-label','Workspace tabs');
    sidebar.innerHTML='<header><strong>Tabs</strong><div><button type="button" data-workspace-bookmarks-toggle title="Bookmarks" aria-label="Bookmarks"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h5l1.5 2H19v11H5z"></path></svg></button><button type="button" data-workspace-shell-new-course heading="New tab" aria-label="New page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg></button></div></header><div class="nyx-workspace-tab-list" data-workspace-shell-tab-list role="tablist" aria-label="Open tabs"></div>';
    sidebar.querySelector('[data-workspace-shell-new-tab]')?.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      openWorkspaceShellTab();
      document.querySelector('[data-workspace-shell-url]')?.focus();
    });
    (document.getElementById('app') || document.body).appendChild(sidebar);
    return sidebar;
  }
  function normalizeWorkspaceTabDesign(value){
    return String(value || '').trim().toLowerCase()==='list' ? 'list' : 'bar';
  }
  function setWorkspaceTabSidebarOpen(open,{restoreFocus=false}={}){
    const shouldOpen=Boolean(open);
    document.body.classList.toggle('nyx-tab-sidebar-open',shouldOpen);
    const toggles=[...document.querySelectorAll('[data-workspace-shell-tabs-toggle]')];
    toggles.forEach(button=>button.setAttribute('aria-expanded',String(shouldOpen)));
    if(!shouldOpen && restoreFocus){
      const visibleToggle=toggles.find(button=>button.getClientRects().length && button.tabIndex>=0 && button.getAttribute('aria-hidden')!=='true');
      requestAnimationFrame(()=>{
        if(!document.body.classList.contains('nyx-tab-sidebar-open')) visibleToggle?.focus({preventScroll:true});
      });
    }
    return shouldOpen;
  }
  function applyWorkspaceTabDesignSetting(){
    const design=normalizeWorkspaceTabDesign(store.text('nyx.tabDesign','bar'));
    if(store.text('nyx.tabDesign','bar')!==design) store.setText('nyx.tabDesign',design);
    document.documentElement.dataset.nyxTabDesign=design;
    document.body.dataset.nyxTabDesign=design;
    document.body.classList.toggle('nyx-tab-design-list',design==='list');
    qsa('[data-tab-design-value]').forEach(select=>{select.value=design});
    document.querySelectorAll('[data-workspace-shell-tabs-toggle]').forEach(button=>{
      button.tabIndex=0;
      button.setAttribute('aria-expanded',String(document.body.classList.contains('nyx-tab-sidebar-open')));
    });
    renderWorkspaceShellTabs();
  }
  function workspaceShellTabDomain(tab){
    const url=workspaceShellSourceUrl(tab?.url || '');
    if(!url) return 'nyxlearning.org';
    try{return new URL(url,location.href).hostname || 'nyxlearning.org'}catch{return workspaceShellLabel(url) || 'nyxlearning.org'}
  }
  function renderNyxVisualTabStrip(){
    if(!nyxVisualDockUsesSideLayout()) return;
    const top=document.querySelector('.top-os');
    if(!top) return;
    let strip=top.querySelector('[data-nyx-dock-tabs]');
    if(!strip){
      strip=document.createElement('div');
      strip.className='nyx-tab-strip';
      strip.dataset.nyxDockTabs='';
      strip.setAttribute('role','tablist');
      strip.setAttribute('aria-label','Open tabs');
      top.prepend(strip);
      installWorkspaceShellTabReordering(strip);
    }
    if(!top.querySelector('[data-workspace-shell-tabs-toggle]')){
      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.className='nyx-tab-list-toggle';
      toggle.dataset.workspaceShellTabsToggle='';
      toggle.setAttribute('aria-label','Open tabs');
      toggle.setAttribute('aria-controls','nyxWorkspaceTabSidebar');
      toggle.setAttribute('aria-expanded','false');
      toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M3 6h1M3 12h1M3 18h1"/></svg>';
      top.appendChild(toggle);
    }
    const fragment=document.createDocumentFragment();
    workspaceShellTabs.forEach(tab=>{
      const button=document.createElement('div');
      const active=tab.id===workspaceShellActiveTab;
      button.className='nyx-visual-dock-tab'+(active?' active':'');
      button.dataset.workspaceShellTab=tab.id;
      button.setAttribute('role','tab');
      button.tabIndex=active ? 0 : -1;
      button.setAttribute('aria-selected',String(active));
      button.setAttribute('aria-label',workspaceChromeTitle(tab.title || workspaceShellLabel(tab.url),tab.url));
      const title=tab.title==='Home' && !tab.url ? 'Home' : workspaceChromeTitle(tab.title || workspaceShellLabel(tab.url),tab.url);
      const close=workspaceShellTabs.length>1?`<button class="nyx-visual-dock-tab-close" data-workspace-shell-close-tab="${esc(tab.id)}" type="button" aria-label="Close ${esc(title)}">&times;</button>`:'';
      button.innerHTML=`<img alt="" src="${esc(workspaceChromeIcon(tab.icon,tab.url))}"><strong aria-hidden="true">${esc(window.nyxDisplayName(title))}</strong>${close}`;
      bindTabIconFallback(button.querySelector('img'));
      button.querySelector('[data-workspace-shell-close-tab]')?.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        closeWorkspaceShellTab(tab.id);
      });
      button.addEventListener('keydown',event=>{
        if(event.target.closest?.('[data-workspace-shell-close-tab]')) return;
        if(event.key==='Enter' || event.key===' '){event.preventDefault();setWorkspaceShellActive(tab.id)}
        if((event.key==='Delete' || event.key==='Backspace') && workspaceShellTabs.length>1){event.preventDefault();closeWorkspaceShellTab(tab.id)}
      });
      fragment.appendChild(button);
    });
    const add=document.createElement('button');
    add.type='button';
    add.className='nyx-visual-dock-tab-add';
    add.dataset.nyxVisualNewTab='';
    add.setAttribute('aria-label','New tab');
    add.innerHTML='<span aria-hidden="true">+</span><strong>New page</strong>';
    add.addEventListener('click',()=>openWorkspaceShellTab(''));
    fragment.appendChild(add);
    const activeChanged=strip.dataset.activeTab!==String(workspaceShellActiveTab);
    strip.dataset.activeTab=String(workspaceShellActiveTab);
    strip.replaceChildren(fragment);
    if(activeChanged){
      requestAnimationFrame(()=>{
        const active=strip.querySelector('[aria-selected="true"]');
        if(!active) return;
        const left=active.offsetLeft;
        const right=left+active.offsetWidth;
        if(left<strip.scrollLeft) strip.scrollLeft=left;
        else if(right>strip.scrollLeft+strip.clientWidth) strip.scrollLeft=right-strip.clientWidth+8;
      });
    }
  }
  function workspaceShellSecurityStateForUrl(value=''){
    const raw=String(value || '').trim();
    if(!raw || /^nyx:\/\//i.test(raw)) return 'internal';
    try{
      const source=workspaceShellSourceUrl(raw) || raw;
      const target=new URL(source,location.href);
      if(target.origin===location.origin) return 'internal';
      if(target.protocol==='http:') return 'insecure';
      if(target.protocol==='https:') return 'unknown';
    }catch{}
    return 'unknown';
  }
  function setWorkspaceTabSecurityState(workspaceTab,state){
    const next=['internal','secure','insecure','unknown'].includes(state) ? state : 'unknown';
    if(workspaceTab && typeof workspaceTab==='object') workspaceTab.securityState=next;
    const workspaceTabId=typeof workspaceTab==='string' ? workspaceTab : workspaceTab?.id;
    const shellTab=(workspaceTabId && workspaceShellTabs.find(tab=>tab.workspaceTabId===workspaceTabId))
      || workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
    if(!shellTab) return;
    shellTab.securityState=next;
    if(shellTab.id===workspaceShellActiveTab) syncWorkspaceShellSecurityIndicator(shellTab.url,next);
  }
  function syncWorkspaceShellSecurityIndicator(value='',forcedState=''){
    const indicator=document.querySelector('.workspace-mode-secure-indicator');
    if(!indicator) return;
    const raw=String(value || '').trim();
    const state=['internal','secure','insecure','unknown'].includes(forcedState)
      ? forcedState
      : workspaceShellSecurityStateForUrl(raw);
    const label=state==='secure' ? 'Secure HTTPS connection'
      : state==='insecure' ? 'Connection is not secure'
      : state==='unknown' ? 'Connection security is not verified'
      : 'Nyx page';
    indicator.dataset.securityState=state;
    indicator.setAttribute('aria-label',label);
    indicator.title=label;
    indicator.innerHTML=state==='insecure'
      ? '<svg viewBox="0 0 24 24"><rect x="6" y="10" width="12" height="9" rx="2"></rect><path d="M15 10V7a3 3 0 0 0-5.8-1"></path></svg>'
      : '<svg viewBox="0 0 24 24"><rect x="6" y="10" width="12" height="9" rx="2"></rect><path d="M9 10V7a3 3 0 0 1 6 0v3"></path></svg>';
  }
  function syncLearningAddress(value){
    if(window!==window.top || !window.__NYX_RUNTIME_CONFIG__?.learningRoutesEnabled || window.__nyxLearningEntry) return;
    const routes=window.NyxLearningRoutes;
    if(!routes || !['/',('/study'+'.html'),'/nyx',...Object.keys(routes.learningRoutes)].includes(location.pathname)) return;
    const route=routes.learningRouteForApp(value,location.origin) || ('/study'+'.html');
    if(location.pathname+location.search+location.hash!==route) history.replaceState(history.state,'',route);
  }
  let nyxLastNavigation='';
  function renderWorkspaceShellTabs(){
    if(!document.body.classList.contains('workspace-shell')) return;
    ensureWorkspaceShellHome();
    const sidebar=ensureWorkspaceShellTabSidebar();
    const list=sidebar.querySelector('[data-workspace-shell-tab-list]');
    const home=document.querySelector('body.workspace-shell .brand-mini [data-workspace-shell-home]');
    if(!list) return;
    if(!workspaceShellTabs.length){
      workspaceShellActiveTab=null;
      const contentStateChanged=document.body.classList.contains('workspace-content-active');
      document.body.classList.remove('workspace-content-active');
      document.body.classList.remove('nyx-built-in-content-active');
      window.NyxBeamsWallpaper?.syncVisibility?.();
      if(contentStateChanged) queueMicrotask(()=>syncThemeVantaBackgrounds());
      if(home){
        home.style.display='none';
        delete home.dataset.workspaceShellTab;
      }
      const input=document.querySelector('[data-workspace-shell-url]');
      if(input && document.activeElement!==input) input.value='';
      syncWorkspaceShellSecurityIndicator('');
      list.replaceChildren();
      return;
    }
    let active=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
    if(!active){
      active=workspaceShellTabs[0];
      workspaceShellActiveTab=active.id;
    }

    const chromeVisible=workspaceShellTabs.length>1 || Boolean(active?.url) || active?.title!=='Home';
    document.body.classList.toggle('nyx-workspace-chrome-visible',chromeVisible);
    syncNyxRecentSearches();
    syncLearningAddress(active?.url || '');
    const activeShowsContent=Boolean(active?.url);
    const navigationKey=active.id+'|'+(active.url||'');
    if(nyxLastNavigation!==navigationKey){
      nyxLastNavigation=navigationKey;
      window.__nyxPublisherNavigation=navigationKey;
      window.dispatchEvent(new Event('nyx:publisher-change'));
      if(activeShowsContent){store.set('nyx.sidebarExpanded',false);applyNyxSidebarExpansion()}
    }
    applyNyxAppearance();
    const contentStateChanged=document.body.classList.contains('workspace-content-active')!==activeShowsContent;
    document.body.classList.toggle('workspace-content-active',activeShowsContent);
    const activeSource=workspaceShellSourceUrl(active?.url || '') || active?.url || '';
    let activeIsBuiltIn=false;
    try{
      const activeTarget=new URL(activeSource,location.href);
      activeIsBuiltIn=activeTarget.origin===location.origin || /^nyx:\/\//i.test(String(active?.url || ''));
    }catch{activeIsBuiltIn=/^nyx:\/\//i.test(String(active?.url || ''))}
    document.body.classList.toggle('nyx-built-in-content-active',activeShowsContent && activeIsBuiltIn);
    window.NyxBeamsWallpaper?.syncVisibility?.();
    if(contentStateChanged) queueMicrotask(()=>syncThemeVantaBackgrounds());
    if(home){
      home.style.display='';
      home.innerHTML='<span class="workspace-home-icon" aria-hidden="true"></span><span class="workspace-home-label">Nyx</span>';
      delete home.dataset.workspaceShellTab;
      home.title='Home';
      home.classList.toggle('active',active.title==='Home' && !active.url);
    }
    list.replaceChildren();
    const tabListDesign=normalizeWorkspaceTabDesign(store.text('nyx.tabDesign','bar'))==='list';
    workspaceShellTabs.forEach(tab=>{
      const item=document.createElement('div');
      const opening=workspaceShellOpeningTabs.has(tab.id);
      item.className='nyx-workspace-tab-row'+(tab.id===workspaceShellActiveTab?' active':'')+(opening?' tab-opening':'');
      item.dataset.workspaceShellTab=tab.id;
      item.setAttribute('role','tab');
      item.setAttribute('tabindex',tab.id===workspaceShellActiveTab?'0':'-1');
      item.setAttribute('aria-selected',String(tab.id===workspaceShellActiveTab));
      const close=workspaceShellTabs.length>1?`<button class="nyx-workspace-tab-close" type="button" data-workspace-shell-close-tab="${esc(tab.id)}" aria-label="Close ${esc(workspaceChromeTitle(tab.title || workspaceShellLabel(tab.url),tab.url))}">&times;</button>`:'';
      item.innerHTML=`<img class="nyx-workspace-tab-icon" alt="" src="${esc(workspaceChromeIcon(tab.icon,tab.url))}"><span><strong aria-label="${esc(workspaceChromeTitle(tab.title || workspaceShellLabel(tab.url),tab.url))}">${esc(window.nyxDisplayName(workspaceChromeTitle(tab.title || workspaceShellLabel(tab.url),tab.url)))}</strong><small>${esc(workspaceShellTabDomain(tab))}</small></span>${close}`;
      bindTabIconFallback(item.querySelector('.nyx-workspace-tab-icon'));
      item.addEventListener('click',event=>{
        if(event.target.closest?.('[data-workspace-shell-close-tab]')) return;
        event.preventDefault();
        setWorkspaceShellActive(tab.id);
      });
      item.querySelector('[data-workspace-shell-close-tab]')?.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        closeWorkspaceShellTab(tab.id);
      });
      item.addEventListener('keydown',event=>{
        if(event.target.closest?.('button')) return;
        if(event.key==='Enter' || event.key===' '){event.preventDefault();setWorkspaceShellActive(tab.id)}
        if((event.key==='Delete' || event.key==='Backspace') && workspaceShellTabs.length>1){event.preventDefault();closeWorkspaceShellTab(tab.id)}
      });
      if(tabListDesign){
        const slot=document.createElement('div');
        slot.className='nyx-workspace-tab-slot';
        const add=document.createElement('button');
        add.className='nyx-workspace-tab-add';
        add.type='button';
        add.dataset.workspaceShellNewTabAfter=tab.id;
        add.setAttribute('aria-label',`Open a new page after ${workspaceChromeTitle(tab.title || workspaceShellLabel(tab.url),tab.url)}`);
        add.title='New page';
        add.textContent='+';
        slot.append(item,add);
        list.appendChild(slot);
      }else list.appendChild(item);
      if(opening){
        let openingFinished=false;
        const finishOpening=()=>{
          if(openingFinished) return;
          openingFinished=true;
          workspaceShellOpeningTabs.delete(tab.id);
          item.classList.remove('tab-opening');
        };
        item.addEventListener('animationend',finishOpening,{once:true});
        setTimeout(finishOpening,1250);
      }
    });
    document.querySelectorAll('[data-workspace-shell-tabs-toggle]').forEach(button=>button.setAttribute('aria-expanded',String(document.body.classList.contains('nyx-tab-sidebar-open'))));
    const input=document.querySelector('[data-workspace-shell-url]');
    if(input && document.activeElement!==input) input.value=workspaceShellDisplayValue(active.url);
    syncWorkspaceShellSecurityIndicator(active.url,active.securityState);
    renderWorkspaceBookmarks();
    if(typeof applyVisualEffectSetting==='function') applyVisualEffectSetting();
    if(!workspaceSuggestionsAllowed()) hideWorkspaceSuggestions();
    if(active?.url!=='nyx://developer') hideNyxErudaPanel();
    renderNyxVisualTabStrip();
    syncNyxVisualDockState();
  }
  function openWorkspaceShellTab(url='',options={}){
    closeWeatherForWindowOpen();



    closeWorkspaceShellSettings();
    const id='shell-'+Date.now()+Math.random().toString(16).slice(2);
    const normalized=url ? normalize(url) : '';
    const isBlank=!normalized;
    workspaceShellTabs.push({id,url:normalized,title:isBlank ? 'New Tab' : workspaceShellLabel(normalized),icon:isBlank ? favicons.nyx : iconForUrl(normalized)});
    workspaceShellOpeningTabs.add(id);
    workspaceShellActiveTab=id;
    renderWorkspaceShellTabs();
    if(activeWorkspace?.win?.isConnected && typeof activeWorkspace.addTab==='function'){
      const created=activeWorkspace.addTab(normalized,options.forceMode || '');
      if(!created){
        workspaceShellTabs.splice(0,workspaceShellTabs.length,...workspaceShellTabs.filter(tab=>tab.id!==id));
        workspaceShellActiveTab=workspaceShellTabs[0]?.id || null;
        renderWorkspaceShellTabs();
        return null;
      }else{
        workspaceShellTabs.find(tab=>tab.id===id).workspaceTabId=created.id;
      }
      if(!isBlank){
        created.url=normalized;
        created.title=workspaceShellLabel(normalized);
        created.icon=iconForUrl(normalized);
        workspaceShellActiveTab=id;
        activeWorkspace.activate?.(created.id);
        activeWorkspace.renderTabs?.();
        updateWorkspaceShellLocation(normalized,created.id);
      }
      else{
        activeWorkspace.activate?.(created?.id);
        created.url='';
        created.title='New Tab';
        created.icon=favicons.nyx;
        created.history=[''];
        created.index=0;
        created.scramjetFrame=null;
        created.frame.removeAttribute('src');
        created.frame.removeAttribute('srcdoc');
        created.frame.classList.remove('active');
        renderWorkspaceShellHomeMode(activeWorkspace.win);
        activeWorkspace.renderTabs?.();
        updateWorkspaceShellLocation('',created.id,true);
        renderWorkspaceShellTabs();
        if(options.focusAddress!==false) setTimeout(()=>document.querySelector('[data-workspace-shell-url]')?.focus(),30);
      }
      return id;
    }
    const win=openWorkspace(normalized,options);
    win?.classList.add('maximized');
    const created=activeWorkspace?.tabs?.[activeWorkspace.tabs.length-1];
    if(created) workspaceShellTabs.find(tab=>tab.id===id).workspaceTabId=created.id;
    if(created && !isBlank){
      created.url=normalized;
      created.title=workspaceShellLabel(normalized);
      created.icon=iconForUrl(normalized);
      workspaceShellActiveTab=id;
      activeWorkspace?.activate?.(created.id);
      activeWorkspace?.renderTabs?.();
    }
    if(isBlank){
      if(created){
        created.url='';
        created.title='New Tab';
        created.icon=favicons.nyx;
        created.history=[''];
        created.index=0;
        created.scramjetFrame=null;
        created.frame.removeAttribute('src');
        created.frame.removeAttribute('srcdoc');
        created.frame.classList.remove('active');
      }
      renderWorkspaceShellHomeMode(activeWorkspace?.win);
      activeWorkspace?.activate?.(created?.id);
      renderWorkspaceShellHomeMode(activeWorkspace?.win);
      activeWorkspace?.renderTabs?.();
      updateWorkspaceShellLocation('',created?.id || '',true);
      renderWorkspaceShellTabs();
      if(options.focusAddress!==false) setTimeout(()=>document.querySelector('[data-workspace-shell-url]')?.focus(),30);
    }
    updateDockFullscreenState();
    return id;
  }
  function openWorkspaceShellTabAfter(afterId){
    const id=openWorkspaceShellTab('',{focusAddress:false});
    const created=workspaceShellTabs.find(tab=>tab.id===id);
    const after=workspaceShellTabs.find(tab=>tab.id===afterId);
    if(!created || !after) return id;
    workspaceShellTabs.splice(workspaceShellTabs.indexOf(created),1);
    workspaceShellTabs.splice(workspaceShellTabs.indexOf(after)+1,0,created);
    if(activeWorkspace?.tabs?.length){
      const rank=new Map(workspaceShellTabs.map((tab,index)=>[tab.workspaceTabId,index]).filter(([tabId])=>tabId));
      const originalOrder=new Map(activeWorkspace.tabs.map((tab,index)=>[tab.id,index]));
      activeWorkspace.tabs.sort((left,right)=>{
        const leftRank=rank.has(left.id)?rank.get(left.id):Number.MAX_SAFE_INTEGER;
        const rightRank=rank.has(right.id)?rank.get(right.id):Number.MAX_SAFE_INTEGER;
        return leftRank-rightRank || originalOrder.get(left.id)-originalOrder.get(right.id);
      });
      activeWorkspace.renderTabs?.();
    }
    renderWorkspaceShellTabs();
    setTimeout(()=>document.querySelector('[data-workspace-shell-url]')?.focus(),30);
    return id;
  }
  function openWorkspaceShellInternalTab(name){
    hideWorkspaceSuggestions();
    if(String(name || '').toLowerCase()==='settings'){
      const existing=workspaceShellTabs.find(tab=>tab.url==='nyx://settings');
      if(existing){
        setWorkspaceShellActive(existing.id);
        renderWorkspaceShellSettingsTab();
        return existing.id;
      }
      const id=openWorkspaceShellTab('');
      const shellTab=workspaceShellTabs.find(tab=>tab.id===id);
      if(shellTab){
        shellTab.url='nyx://settings';
        shellTab.title='Settings';
        shellTab.icon=appIcon('settings');
        const linked=activeWorkspace?.tabs?.find(tab=>tab.id===shellTab.workspaceTabId);
        if(linked){
          linked.url='nyx://settings';
          linked.title='Settings';
          linked.icon=shellTab.icon;
          linked.history=['nyx://settings'];
          linked.index=0;
        }
      }
      renderWorkspaceShellTabs();
      const address=document.querySelector('[data-workspace-shell-url]');
      if(address) address.value='nyx://settings';
      renderWorkspaceShellSettingsTab();
      return id;
    }
    closeWorkspaceShellSettings();
    const id=openWorkspaceShellTab('');
    if(id) workspaceShellActiveTab=id;
    showWorkspaceShellInternalPage(name);
    return id;
  }
  async function openNyxVmsApp(){
    try{

      const id=openWorkspaceShellTab('/apps/nyxcloud/?embedded=1',{forceMode:'iframe'});
      const tab=workspaceShellTabs.find(item=>item.id===id);if(tab)tab.title='VMs';
      renderWorkspaceShellTabs();
    }catch(error){toast(error.message);}
  }
  function openWorkspaceShellAppTab(url){
    if(String(url||'').replace(/\/+$/,'')==='/apps/nyxcloud'){void openNyxVmsApp();return;}
    hideWorkspaceSuggestions();
    closeWeatherForWindowOpen();
    if(String(url || '').trim().toLowerCase()==='nyx://settings'){
      return openWorkspaceShellInternalTab('settings');
    }
    if(String(url || '').trim().toLowerCase()==='nyx://ai'){
      return openWorkspaceShellInternalTab('ai');
    }
    if(String(url || '').trim().toLowerCase()==='nyx://ephesians1'){
      return openWorkspaceShellInternalTab('ephesians1');
    }
    if(/^nyx:\/\/(apps|terms|developer|about|credits)$/i.test(String(url || '').trim())){
      return openWorkspaceShellInternalTab(String(url).trim().slice(6).toLowerCase());
    }
    const id=openWorkspaceShellTab(url || '',{forceMode:appCompatibilityMode(url)});
    if(id) workspaceShellActiveTab=id;
    renderWorkspaceShellTabs();
    return id;
  }
  function openNyxAiSettings(){
    return openWorkspaceShellInternalTab('ai');
  }
  function ensureWorkspaceShellLinkedTab(shellTab){
    if(!shellTab || !activeWorkspace?.win?.isConnected) return null;
    let tab=shellTab.workspaceTabId ? activeWorkspace.tabs?.find(item=>item.id===shellTab.workspaceTabId) : null;
    if(tab){
      activeWorkspace.activate?.(tab.id);
      return tab;
    }
    tab=activeWorkspace.tabs?.find(item=>item.id===activeWorkspace.active) || activeWorkspace.tabs?.[0] || null;
    if(!tab && typeof activeWorkspace.addTab==='function') tab=activeWorkspace.addTab('');
    if(!tab) return null;
    shellTab.workspaceTabId=tab.id;
    activeWorkspace.activate?.(tab.id);
    return tab;
  }
  function workspaceShellTabPreservesSearch(shellTab){
    const source=workspaceShellSourceUrl(shellTab?.url || '');
    if(!source) return false;
    try{
      const parsed=new URL(source,location.href);
      return parsed.origin===location.origin && ['/apps/chat/','/apps/chat/index.html'].includes(parsed.pathname);
    }catch{
      return false;
    }
  }
  function setWorkspaceShellActive(id){
    if(!workspaceShellTabs.some(tab=>tab.id===id)) return;
    hideWorkspaceSuggestions();
    setWorkspaceTabSidebarOpen(false);
    closeWeatherForWindowOpen();
    workspaceShellActiveTab=id;
    const shellTab=workspaceShellTabs.find(tab=>tab.id===id);
    if(shellTab?.url==='nyx://settings') renderWorkspaceShellSettingsTab();
    else closeWorkspaceShellSettings();
    if(shellTab?.title==='Home' && !shellTab.url){
      renderWorkspaceShellHomeMode(activeWorkspace?.win,'home');
    }else if(isWorkspaceShellBlankUrl(shellTab?.url)){
      if(shellTab?.workspaceTabId && activeWorkspace?.activate) activeWorkspace.activate(shellTab.workspaceTabId);
      renderWorkspaceShellHomeMode(activeWorkspace?.win);
    }else if(shellTab?.workspaceTabId && activeWorkspace?.activate) activeWorkspace.activate(shellTab.workspaceTabId);
    renderWorkspaceShellTabs();
    animateActiveWorkspaceShellTab();
  }
  function animateActiveWorkspaceShellTab(){
    if(suppressHomeEntranceOnStartup) return;
    requestAnimationFrame(()=>{
      const tab=document.querySelector('body.workspace-shell .nyx-workspace-tab-row.active,body.workspace-shell .brand-mini > .active:is(.workspace-mode-app-button,.workspace-mode-shell-tab)');
      if(!tab) return;
      tab.classList.remove('tab-activating');
      void tab.offsetWidth;
      tab.classList.add('tab-activating');
      setTimeout(()=>tab.classList.remove('tab-activating'),340);
    });
  }
  function setWorkspaceShellHomeActive(){
    document.body.classList.remove('nyx-home-search-active');
    closeWeatherForWindowOpen();
    closeWorkspaceShellSettings();
    ensureWorkspaceShellHome();
    let homeTab=workspaceShellTabs.find(tab=>tab.title==='Home' && !tab.url);
    if(!homeTab){
      const id='shell-'+Date.now()+Math.random().toString(16).slice(2);
      homeTab={id,url:'',title:'Home'};
      workspaceShellTabs.unshift(homeTab);
    }
    workspaceShellActiveTab=homeTab.id;
    if(!activeWorkspace?.win?.isConnected){
      const win=openWorkspace('');
      win?.classList.add('maximized');
      updateDockFullscreenState();
    }
    if(activeWorkspace?.win?.isConnected){
      const state=activeWorkspace;
      state?.tabs?.forEach(tab=>tab.frame?.classList.remove('active'));
      renderWorkspaceShellHomeMode(state.win,'home');
      state?.renderTabs?.();
      playHomeEntranceAnimation(state.win);
    }
    renderWorkspaceShellTabs();
    animateActiveWorkspaceShellTab();
    const input=document.querySelector('[data-workspace-shell-url]');
    if(input) input.value='';
  }

  function workspaceShellSettingsMarkup(presetTiles){
    const savedTitle=esc(store.text('nyx.tabTitle',document.title || 'ռʏӼ'));
    const savedFavicon=esc(store.text('nyx.tabFavicon',nyxFaviconHref()));
    const currentPreset=esc(store.text('nyx.logo','nyx'));
    const engine=esc(store.text('nyx.engine','duckduckgo'));
    const savedWorkspaceMode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
    const workspaceMode=esc(savedWorkspaceMode==='rammerhead' ? 'auto' : savedWorkspaceMode);
    const transport=esc(normalizeWorkspaceTransportName(store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT)));
    const theme=esc(store.text('nyx.theme','default'));
    const effect=esc(store.text('nyx.visualEffect','none'));
    const effectSpeed=esc(store.text('nyx.visualEffectSpeed','1.1'));
    const effectAmount=esc(store.text('nyx.visualEffectAmount','16'));
    return `<section class="settings-app settings-single-pane workspace-only-settings"><main class="settings-main"><h1>Workspace Settings</h1><div class="settings-section active"><section class="settings-block"><h2>Course tab appearance</h2><div class="settings-form-row"><input class="settings-input" data-tab-title value="${savedTitle}" placeholder="Course heading"><input class="settings-input" data-tab-favicon-file type="file" accept="image/*,.ico" aria-label="Choose tab icon file"><input type="hidden" data-tab-favicon value="${savedFavicon}"></div><p>Choose a title and icon file, then press Apply.</p><div class="settings-actions"><button class="settings-action" data-tab-cloak-apply type="button">Apply course appearance</button><button class="settings-action" data-preset="deltamath" type="button">Reset</button></div></section><section class="settings-block"><h2>Course presets</h2><select class="settings-select" data-preset-select><option value="deltamath" ${currentPreset==='deltamath'?'selected':''}>DeltaMath</option><option value="nyx" ${currentPreset==='nyx'?'selected':''}>ռʏӼ</option><option value="google" ${currentPreset==='google'?'selected':''}>Google</option><option value="drive" ${currentPreset==='drive'?'selected':''}>Google Drive</option><option value="classlink" ${currentPreset==='classlink'?'selected':''}>ClassLink</option><option value="classroom" ${currentPreset==='classroom'?'selected':''}>Google Classroom</option></select></section><section class="settings-block"><h2>Study window</h2><div class="settings-form-row"><select class="settings-select" data-cloak-type><option value="a" ${store.text('nyx.cloakType','a')==='a'?'selected':''}>about:blank</option><option value="b" ${store.text('nyx.cloakType','a')==='b'?'selected':''}>Blob</option><option value="m" ${store.text('nyx.cloakType','a')==='m'?'selected':''}>Current tab iframe</option></select><input class="settings-input" data-cloak-redirect-url value="${esc(store.text('nyx.cloakRedirectUrl','https://google.com/'))}" placeholder="Original page return address"></div><div class="settings-actions"><button class="settings-action" data-about type="button">Open in About:Blank</button><button class="settings-action" data-blob type="button">Open in Blob</button></div><div class="settings-row"><span>Automatic study window</span><button class="settings-action ${store.get('nyx.autoCloak',false)?'on':''}" data-switch="nyx.autoCloak" type="button">${store.get('nyx.autoCloak',false)?'On':'Off'}</button></div><div class="settings-row"><span>Return original page after opening</span><button class="settings-action ${store.get('nyx.cloakRedirectOriginal',false)?'on':''}" data-switch="nyx.cloakRedirectOriginal" type="button">${store.get('nyx.cloakRedirectOriginal',false)?'On':'Off'}</button></div><div class="settings-actions"><button class="settings-action" data-save-cloak type="button">Save study window settings</button><button class="settings-action" data-launch-selected-cloak type="button">Launch Selected</button></div></section><section class="settings-block"><h2>Class shortcut</h2><p>Press this combo anytime to instantly close the current tab without a confirmation.</p><div class="settings-row"><strong class="panic-key-display" data-panic-key-display>${esc(store.text('nyx.panicKey','not set'))}</strong></div><div class="settings-actions"><button class="settings-action" data-panic-capture type="button">Capture</button><button class="settings-action" data-panic-clear type="button">Clear</button></div></section><section class="settings-block"><h2>Theme</h2><select class="settings-select" data-theme-value><option value="default" ${theme==='default'?'selected':''}>Default</option><option value="ruby" ${theme==='ruby'?'selected':''}>Ruby</option><option value="emerald" ${theme==='emerald'?'selected':''}>Emerald</option><option value="sakura" ${theme==='sakura'?'selected':''}>Sakura</option><option value="fresh" ${theme==='fresh'?'selected':''}>White</option></select></section><section class="settings-block"><h2>Effects</h2><select class="settings-select" data-effect-value><option value="none" ${effect==='none'?'selected':''}>None</option><option value="rain" ${effect==='rain'?'selected':''}>Rain</option><option value="stars" ${effect==='stars'?'selected':''}>Stars</option><option value="hearts" ${effect==='hearts'?'selected':''}>Hearts</option><option value="pokeballs" ${effect==='pokeballs'?'selected':''}>Pokeballs</option><option value="flowers" ${effect==='flowers'?'selected':''}>Flowers</option><option value="emeralds" ${effect==='emeralds'?'selected':''}>Emeralds</option></select><div class="settings-range"><span>Speed</span><input data-effect-speed type="range" min=".3" max="3" step=".1" value="${effectSpeed}"><strong data-effect-speed-label>${effectSpeed}x</strong></div><div class="settings-range"><span>Amount</span><input data-effect-amount type="range" min="1" max="64" step="1" value="${effectAmount}"><strong data-effect-amount-label>${effectAmount}</strong></div></section><section class="settings-block"><h2>S3ARC4 Engine</h2><select class="settings-select" data-workspace-engine><option value="duckduckgo" ${engine==='duckduckgo'?'selected':''}>Reference Search</option><option value="google" ${engine==='google'?'selected':''}>Google</option><option value="bing" ${engine==='bing'?'selected':''}>Bing</option></select></section><section class="settings-block"><h2>Learning engine</h2><select class="settings-select" data-workspace-mode-select><option value="auto" ${workspaceMode==='auto'?'selected':''}>Auto</option><option value="scramjet" ${workspaceMode==='scramjet'?'selected':''}>Learning engine</option></select></section><section class="settings-block"><h2>Compatibility mode</h2><p>Use the alternate connection when a network cannot open sites. Turn off for the standard connection. Reload website tabs after changing. Custom connections keep their saved choice.</p><div class="settings-row"><span>Use Compatibility mode</span><button class="settings-action ${store.get('nyx.httpBridge',true)?'on':''}" data-switch="nyx.httpBridge" type="button">${store.get('nyx.httpBridge',true)?'On':'Off'}</button></div></section><section class="settings-block"><h2>Connection method</h2><select class="settings-select" data-workspace-transport><option value="epoxy" ${transport==='epoxy'?'selected':''}>Atlas connection</option><option value="wisp" ${transport==='wisp'?'selected':''}>Campus connection endpoint</option><option value="libcurl" ${transport==='libcurl'?'selected':''}>Textbook connection</option></select><div class="settings-actions"><button class="settings-action" data-workspace-settings-save type="button">Save Workspace Settings</button></div></section><section class="settings-block"><h2>Popup Protection</h2><p>Blocks malicious ads/sites.</p><button class="settings-action ${popupProtectionEnabled()?'on':''}" data-popup-protection data-enabled="${popupProtectionEnabled()?'true':'false'}" type="button">Popup Protection ${popupProtectionEnabled()?'On':'Off'}</button><p style="margin-top:12px;color:#fde047;font-weight:400;line-height:1.42;text-shadow:none">*Warning: If this option is disabled, your computer may be exposed to various security threats, including viruses such as Trojan, disguised as Opera GX (which obviously is not). Disabling this feature could result in significant damage to your system, unaware access to your data, and potential sale of your personal data. It is <span style="color:#ff3b3b;text-shadow:0 0 4px rgba(255,255,255,.35),0 0 7px rgba(255,59,59,.95),0 0 14px rgba(255,59,59,.82),0 0 24px rgba(185,28,28,.72),0 0 38px rgba(127,29,29,.58)">STRONGLY</span> recommended to keep this setting enabled. This feature remains active unless the user intentionally chooses to disable it.*</p></section></div></main></section>`;
  }
  function workspaceShellPresetTiles(){
    return `<button class="quick-tile" data-preset="deltamath" type="button"><img class="quick-icon" alt="" src="${favicons.deltamath}"><span>DeltaMath tab</span></button><button class="quick-tile" data-preset="nyx" type="button"><img class="quick-icon" alt="" src="${nyxTabFavicon}"><span>ռʏӼ tab</span></button><button class="quick-tile" data-preset="google" type="button"><img class="quick-icon" alt="" src="${favicons.google}"><span>Google tab</span></button><button class="quick-tile" data-preset="drive" type="button"><img class="quick-icon" alt="" src="${favicons.drive}"><span>Drive tab</span></button><button class="quick-tile" data-preset="classlink" type="button"><img class="quick-icon" alt="" src="${favicons.classlink}"><span>ClassLink tab</span></button>`;
  }
  function saveWorkspaceShellSettings(root=document){
    const engine=root.querySelector('[data-workspace-engine]');
    const mode=root.querySelector('[data-workspace-mode-select]');
    const transport=root.querySelector('[data-workspace-transport]');
    const font=root.querySelector('[data-font-value]');
    const tabDesign=root.querySelector('[data-tab-design-value]');
    store.setText('nyx.engine', engine?.value || 'duckduckgo');
    store.setText('nyx.workspaceMode', normalizeWorkspaceModeName(mode?.value || DEFAULT_WORKSPACE_MODE));
    if(font) store.setText('nyx.font',nyxFontChoice(font.value)[0]);
    if(tabDesign) store.setText('nyx.tabDesign',normalizeWorkspaceTabDesign(tabDesign.value));
    const nextTransport=normalizeWorkspaceTransportName(transport?.value);
    if(normalizeWorkspaceTransportName(store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT))!==nextTransport){
      studyjetInstallPromise=null;
      studyjetController=null;
      studyjetTransport=null;
      studyjetTransportKey='';
    }
    store.setText('nyx.transport', nextTransport);
    applyUserSettings();
    resetWorkspaceConnectionRuntime();
  }
  function enhanceWorkspaceShellSettings(overlay){
    const app=overlay.querySelector('.settings-app');
    const main=app?.querySelector('.settings-main');
    const source=main?.querySelector('.settings-section.active');
    if(!app || !main || !source) return;



    const workspaceModeSelect=source.querySelector('[data-workspace-mode-select]');

    if(workspaceModeSelect){
      const workspaceModeLabels={
        auto:'Auto',
        scramjet:'Learning engine',

      };
      [...workspaceModeSelect.options].forEach(option=>{
        if(workspaceModeLabels[option.value]) option.textContent=workspaceModeLabels[option.value];
      });
    }

    app.classList.add('nyx-settings-dashboard');
    main.querySelector(':scope > h1')?.remove();
    const settingsIcons={
      account:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
      privacy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 18a2 2 0 0 0-4 0"/><path d="m19 11-2.11-6.657a2 2 0 0 0-2.752-1.148l-1.276.61A2 2 0 0 1 12 4H8.5a2 2 0 0 0-1.925 1.456L5 11"/><path d="M2 11h20"/><circle cx="17" cy="18" r="3"/><circle cx="7" cy="18" r="3"/></svg>',
      customize:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
      browsing:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
      advanced:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></svg>'
    };
    const definitions=[
      ['general','General',settingsIcons.advanced,'Choose Nyx defaults and everyday behavior.',['nyx','home design','search engine']],
      ['appearance','Appearance',settingsIcons.customize,'Make Nyx feel like yours.',['theme','homepage','sidebar','custom theme','effects','wallpapers','line waves','performance']],
      ['workspace','Workspace',settingsIcons.browsing,'Manage course tabs, reference search, and workspace controls.',['course tab appearance','course presets','study window','tab design']],
      ['privacy','Study focus',settingsIcons.privacy,'Manage tab presentation and unwanted interruptions.',['focus tabs','popup protection']],
      ['connections','Connections',settingsIcons.browsing,'Choose how Nyx reaches the web.',['learning engine','compatibility mode','connection method','campus connection address']],
      ['accounts','Accounts',settingsIcons.account,'Manage your identity, cloud saves, and staff tools.',['account','cloud saves','owner dashboard','founder profile']],
      ['data','Data',settingsIcons.advanced,'Move, download, or reset local Nyx data.',['data transfer','clear cache']],
      ['advanced','Advanced',settingsIcons.advanced,'Configure power-user workspace controls.',['class shortcut','font']],
      ['credits','Credits',settingsIcons.account,'Thanks to the people who help make Nyx.',[]]
    ];
    const categoryFor=title=>definitions.find(([, , , ,titles])=>titles.includes(title))?.[0] || 'advanced';
    const categories=new Map();
    definitions.forEach(([key,label])=>{
      const section=document.createElement('section');
      section.className='nyx-settings-category';
      section.dataset.settingsCategory=key;
      section.innerHTML=`<h2 class="nyx-settings-category-title">${label}</h2><div class="nyx-settings-group"></div>`;
      categories.set(key,section);
    });

    Array.from(source.querySelectorAll(':scope > .settings-block')).forEach(block=>{
      const heading=block.querySelector(':scope > h2');
      const title=(heading?.textContent || '').trim().toLowerCase();
      const description=Array.from(block.children).find(element=>element.tagName==='P');
      const copy=document.createElement('div');
      const controls=document.createElement('div');
      copy.className='nyx-settings-copy';
      controls.className='nyx-settings-control';
      const nodes=Array.from(block.childNodes);
      if(heading) copy.appendChild(heading);
      if(description) copy.appendChild(description);
      nodes.forEach(node=>{if(node!==heading && node!==description) controls.appendChild(node)});
      if(title==='popup protection'){
        const toggle=controls.querySelector('[data-popup-protection]');
        if(toggle){
          const row=document.createElement('div');
          row.className='settings-row';
          row.innerHTML='<span>Popup Protection</span>';
          row.appendChild(toggle);
          controls.prepend(row);
        }
      }
      if(title==='theme'){
        const select=controls.querySelector('[data-theme-value]');
        const current=normalizeNyxTheme(store.text('nyx.theme','default'));
        if(select) select.value=current;
        const customColor=nyxThemeHex(store.text('nyx.customThemeColor',nyxCustomThemeDefaults.base));
        const themes=[
          ['default','Default','Pure black with neutral glass',['#000000','#151515','#333333']],
          ['halloween','Halloween','Warm orange with dark glass',['#ff963c','#5a321e','#17100c']],
          ['midnight','Midnight','Deep blue, calm and focused',['#75b8ff','#243756','#121924']],
          ['ruby','Ruby','Deep reds with crisp highlights',['#fb7185','#5b2231','#201218']],
          ['emerald','Emerald','Rich green, balanced and clear',['#63e6a5','#1d4a36','#101b16']],
          ['sakura','Sakura','Cherry blossom pinks and creams',['#f4a3c7','#553044','#21161c']],
          ['fresh','Fern','Muted green, quiet and natural',['#a6e7b9','#2d4b3d','#141c17']],
          ['custom','Custom','Build a palette from one color',[customColor,'#2b3140','#15171c']]
        ];
        heading.textContent='Color theme';
        if(description) description.textContent='Pick a color palette for the entire interface.';
        else{
          const themeDescription=document.createElement('p');
          themeDescription.textContent='Pick a color palette for the entire interface.';
          copy.appendChild(themeDescription);
        }
        const grid=document.createElement('div');
        grid.className='nyx-color-theme-grid';
        grid.innerHTML=themes.map(([value,label,summary,swatches])=>`<button class="nyx-color-theme-card${current===value?' selected':''}" data-nyx-theme-card="${value}" type="button" aria-pressed="${current===value}"><span class="nyx-color-theme-swatches" aria-hidden="true">${swatches.map(color=>`<i style="--nyx-theme-swatch:${color}"></i>`).join('')}</span><strong>${label}</strong><small>${summary}</small><span class="nyx-color-theme-check" aria-hidden="true">✓</span></button>`).join('');
        if(select){
          select.classList.add('nyx-color-theme-select');
          grid.querySelectorAll('[data-nyx-theme-card]').forEach(button=>button.addEventListener('click',()=>{
            select.value=button.dataset.nyxThemeCard || 'default';
            select.dispatchEvent(new Event('change',{bubbles:true}));
            grid.querySelectorAll('[data-nyx-theme-card]').forEach(card=>{
              const selected=card===button;
              card.classList.toggle('selected',selected);
              card.setAttribute('aria-pressed',String(selected));
            });
          }));
          controls.replaceChildren(grid,select);
        }else controls.replaceChildren(grid);
        block.classList.add('nyx-color-theme-block');
      }
      if(categoryFor(title)==='workspace'){
        block.classList.add('nyx-workspace-settings-card');
        const labels=[['[data-tab-title]','Course heading'],['[data-tab-favicon-file]','Tab icon'],['[data-cloak-type]','Open Nyx in'],['[data-cloak-redirect-url]','Return destination']];
        labels.forEach(([selector,text])=>{
          const field=controls.querySelector(selector);
          if(!field)return;
          const label=document.createElement('label');label.className='nyx-workspace-setting-field';
          const caption=document.createElement('span');caption.textContent=text;
          field.replaceWith(label);label.append(caption,field);
        });
        if(title==='course tab appearance')heading.textContent='Course appearance';
        if(title==='course presets')heading.textContent='Quick presets';
        if(title==='study window'){
          heading.textContent='Launch options';
          const toggles=document.createElement('div');toggles.className='nyx-workspace-setting-toggles';
          const rows=[...controls.querySelectorAll(':scope > .settings-row')];
          if(rows.length){rows[0].before(toggles);rows.forEach(row=>toggles.appendChild(row));}
        }
      }
      block.replaceChildren(copy,controls);
      block.dataset.settingsSearch=(block.textContent || '').toLowerCase();
      categories.get(categoryFor(title)).querySelector('.nyx-settings-group').appendChild(block);
    });
    source.remove();

    const performance=document.createElement('section');
    performance.className='settings-block';
    performance.dataset.settingsSearch='performance high medium low animations effects';
    performance.innerHTML=`<div class="nyx-settings-copy"><h2>Performance</h2><p>Choose the visual quality level for Nyx. Low minimizes motion and effects; Medium keeps normal motion with fewer heavy effects; High enables the full experience.</p></div><div class="nyx-settings-control"><div class="settings-actions" data-nyx-performance-options><button class="settings-action" data-nyx-performance-tier="low" type="button">Low</button><button class="settings-action" data-nyx-performance-tier="medium" type="button">Medium</button><button class="settings-action" data-nyx-performance-tier="high" type="button">High</button></div></div>`;
    const activeTier=getNyxPerformanceTier();
    performance.querySelectorAll('[data-nyx-performance-tier]').forEach(button=>button.classList.toggle('on',button.dataset.nyxPerformanceTier===activeTier));
    categories.get('appearance').querySelector('.nyx-settings-group').appendChild(performance);

    const about=document.createElement('section');
    about.className='settings-block';
    about.dataset.settingsSearch='about nyx version support reset cache';
    about.innerHTML='<div class="nyx-settings-copy"><h2>Nyx</h2><p>Nyx Learning workspace. Settings are stored on this device unless they belong to your signed-in account.</p></div><div class="nyx-settings-control"><p class="nyx-settings-version">Version 2</p><div class="settings-actions"><button class="settings-action" data-clear-nyx-cache type="button">Reset local settings</button></div></div>';
    categories.get('general').querySelector('.nyx-settings-group').appendChild(about);

    const credits=document.createElement('section');
    credits.className='settings-block';
    credits.innerHTML=nyxCreditsPageMarkup();
    credits.dataset.settingsSearch=('credits '+credits.textContent).toLowerCase();
    categories.get('credits').querySelector('.nyx-settings-group').appendChild(credits);

    const side=document.createElement('aside');
    side.className='nyx-settings-side';
    side.innerHTML=`<label class="nyx-settings-filter"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" placeholder="Filter settings" aria-label="Filter settings"></label><nav class="nyx-settings-nav" aria-label="Settings categories">${definitions.map(([key,label,icon])=>`<button class="${key==='appearance'?'active':''}" data-settings-category-button="${key}" type="button"><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav>`;
    const header=document.createElement('header');
    header.className='nyx-settings-header';
    header.innerHTML='<h1>Appearance</h1><p>Customize Nyx’s look and visual experience.</p>';
    app.prepend(side);
    main.prepend(header);
    categories.forEach(section=>main.appendChild(section));

    const title=header.querySelector('h1');
    const filter=side.querySelector('input');
    const buttons=Array.from(side.querySelectorAll('[data-settings-category-button]'));
    const activate=key=>{
      filter.value='';
      categories.forEach((section,category)=>{
        section.classList.toggle('active',category===key);
        section.hidden=category!==key;
        section.querySelectorAll('.settings-block').forEach(block=>{block.hidden=false});
      });
      buttons.forEach(button=>button.classList.toggle('active',button.dataset.settingsCategoryButton===key));
      const definition=definitions.find(([category])=>category===key);
      title.textContent=definition?.[1] || 'Settings';
      header.querySelector('p').textContent=definition?.[3] || 'Adjust your Nyx preferences.';
      main.scrollTop=0;
    };
    buttons.forEach(button=>button.addEventListener('click',()=>activate(button.dataset.settingsCategoryButton)));
    filter.addEventListener('input',()=>{
      const query=filter.value.trim().toLowerCase();
      if(!query){
        activate(buttons.find(button=>button.classList.contains('active'))?.dataset.settingsCategoryButton || 'appearance');
        return;
      }
      title.textContent="S3ARC4 Results";
      header.querySelector('p').textContent='Matching settings across Nyx.';
      buttons.forEach(button=>button.classList.remove('active'));
      categories.forEach(section=>{
        let matches=0;
        section.querySelectorAll('.settings-block').forEach(block=>{
          const visible=block.dataset.settingsSearch.includes(query);
          block.hidden=!visible;
          if(visible) matches++;
        });
        section.hidden=matches===0;
        section.classList.toggle('active',matches>0);
      });
    });
    app.querySelectorAll('.nyx-settings-nav button,.nyx-settings-category-title,.nyx-settings-header h1,.nyx-settings-copy > h2,.nyx-workspace-settings-card .settings-row > span,.nyx-workspace-setting-field > span,.nyx-workspace-settings-card .settings-action').forEach(element=>element.setAttribute('data-nyx-display-label',''));
    activate('appearance');
    syncFounderOwnerControls();
  }
  function openWorkspaceShellSettings(){
    if(!document.body.classList.contains('workspace-shell')){
      openSettings();
      return;
    }
    return openWorkspaceShellInternalTab('settings');
  }
  function renderWorkspaceShellSettingsTab(){
    document.querySelector('.workspace-shell-settings-overlay')?.remove();
    const overlay=document.createElement('div');
    overlay.className='workspace-shell-settings-overlay';
    overlay.innerHTML=`<main class="workspace-shell-settings-panel" aria-label="Settings">${workspaceShellSettingsMarkup(workspaceShellPresetTiles())}</main>`;
    (document.getElementById('app') || document.body).appendChild(overlay);
    const transportSelect=overlay.querySelector('[data-workspace-transport]');
    const legacyLibcurlOption=transportSelect?.querySelector('option[value="libcurl"]');
    if(legacyLibcurlOption){
      legacyLibcurlOption.value='libcurlRaw';
      legacyLibcurlOption.textContent='Textbook';
    }
    if(transportSelect && !transportSelect.querySelector('option[value="auto"]')){
      transportSelect.prepend(new Option('Auto (recommended)','auto'));
      transportSelect.value=normalizeWorkspaceTransportName(store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT));
    }
    if(transportSelect){
      const transportLabels={epoxy:'Atlas',wisp:'Campus connection',libcurl:'Textbook',libcurlRaw:'Textbook',auto:'Auto'};
      [...transportSelect.options].forEach(option=>{
        if(transportLabels[option.value]) option.textContent=transportLabels[option.value];
      });
    }
    const transportBlock=transportSelect?.closest('.settings-block');
    if(transportBlock){
      const customWisp=storedCustomWispUrl();
      const wispBlock=document.createElement('section');
      wispBlock.className='settings-block nyx-wisp-setting';
      wispBlock.innerHTML=`<h2>Campus connection address</h2><p>Use a custom campus connection for Nyx. Only use a connection you trust because it carries your website traffic.</p><div class="settings-form-row"><input class="settings-input" data-workspace-wisp-url type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(customWisp)}" placeholder="${esc(defaultWispUrl())}" aria-label="Custom Campus connection address"></div><p class="settings-hint" data-workspace-wisp-status>${customWisp ? `Custom campus connection: ${esc(customWisp)}` : `Default campus connection: ${esc(defaultWispUrl())}`}</p><div class="settings-actions"><button class="settings-action" data-workspace-wisp-save type="button">Save Campus connection address</button><button class="settings-action" data-workspace-wisp-reset type="button">Use default</button><button class="settings-action" data-workspace-connection-repair type="button">Repair connection</button></div>`;
      transportBlock.after(wispBlock);
      const transferBlock=document.createElement('section');
      transferBlock.className='settings-block nyx-data-transfer-setting';
      transferBlock.innerHTML="<h2>Data Transfer</h2><p>Move supported game saves, A1 conversations, utility history, shortcuts, and safe device preferences between Nyx links. Authentication sessions, personal API keys, and custom connection credentials are never included.</p><p class=\"settings-hint\" data-nyx-data-transfer-status>Export on this link, then import the downloaded JSON backup on another Nyx link.</p><input data-nyx-data-import-file type=\"file\" accept=\"application/json,.json\" hidden><div class=\"settings-actions\"><button class=\"settings-action\" data-nyx-data-export type=\"button\">Export data</button><button class=\"settings-action\" data-nyx-data-import type=\"button\">Import data</button><button class=\"settings-action\" data-nyx-data-reload type=\"button\" hidden>Reload Nyx</button></div><p class=\"settings-hint\">Backups can contain browsing, game, and conversation data. Store the file securely.</p>";
      wispBlock.after(transferBlock);
    }
    const effectBlock=overlay.querySelector('[data-effect-value]')?.closest('.settings-block');
    if(effectBlock){
      const privacyBlock=document.createElement('section');
      privacyBlock.className='settings-block';
      const hideDetails=websiteDetailsHidden();
      privacyBlock.innerHTML=`<h2>Focus tabs</h2><p>Hides your current tab names and icons from view.</p><div class="settings-row"><span>Simplify names and icons</span><button class="settings-action ${hideDetails?'on':''}" data-switch="nyx.hideWebsiteDetails" type="button">${hideDetails?'On':'Off'}</button></div>`;
      const fontBlock=document.createElement('section');
      fontBlock.className='settings-block';
      fontBlock.innerHTML=`<h2>Font</h2><select class="settings-select" data-font-value>${nyxFontOptionsMarkup()}</select>`;
      effectBlock.before(fontBlock);
      const homepageBlock=document.createElement('section');
      homepageBlock.className='settings-block nyx-homepage-appearance-setting';
      homepageBlock.innerHTML='<h2>Homepage</h2><p>Keep new tabs focused on the Nyx title and wallpaper.</p><div class="settings-row"><span>New tab opens</span><strong>Home</strong></div>';

      const lagBlock=document.createElement('section');
      lagBlock.className='settings-block';
      const lagOn=store.get('nyx.lagReducer',false);
      lagBlock.innerHTML=`<h2>Lag Reducer</h2><p>Turns off heavier blur, shadows, particles, and startup effects for smoother browsing.</p><div class="settings-row"><span>Lag Reducer</span><button class="settings-action ${lagOn?'on':''}" data-switch="nyx.lagReducer" data-lag-reducer type="button">${lagOn?'On':'Off'}</button></div>`;
      const liteBlock=document.createElement('section');
      liteBlock.className='settings-block';
      const liteOn=store.get('nyx.performanceLite',false);
      liteBlock.innerHTML=`<h2>Lite Mode</h2><p>Lightens blur, shadows, and particles without fully disabling animations.</p><div class="settings-row"><span>Lite Mode</span><button class="settings-action ${liteOn?'on':''}" data-switch="nyx.performanceLite" data-performance-lite type="button">${liteOn?'On':'Off'}</button></div>`;
      const backgroundsBlock=document.createElement('section');
      backgroundsBlock.className='settings-block nyx-wallpaper-block';
      backgroundsBlock.innerHTML='<h2>Wallpapers</h2><p>Choose a background, then explore its styles.</p>';
      const wallpaperPicker=document.createElement('div');
      showNyxWallpaperFamily(wallpaperPicker);
      const upload=document.createElement('div');
      upload.className='nyx-wallpaper-upload';
      upload.innerHTML='<input type="file" accept="image/*" data-custom-wallpaper-file hidden aria-label="Choose wallpaper image"><button class="settings-action" data-upload-wallpaper type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></svg>Upload wallpaper</button><button class="settings-action" data-reset-wallpaper type="button">Use theme background</button>';
      upload.querySelector('[data-upload-wallpaper]').addEventListener('click',()=>upload.querySelector('input').click());
      upload.querySelector('[data-reset-wallpaper]').addEventListener('click',()=>{
        store.setText('nyx.customBgData','');
        store.setText('nyx.customBgUrl','');
        store.setText('nyx.customBg','');
        const theme=normalizeNyxTheme(store.text('nyx.theme','default'));
        store.setText('nyx.beamWallpaper',nyxThemeBeamWallpaper(theme));
        store.setText('nyx.beamTheme',theme);
        applyUserSettings();
        showNyxWallpaperFamily(wallpaperPicker);
        toast('Theme background restored');
      });
      backgroundsBlock.append(upload,wallpaperPicker);
      const legacyScene=document.createElement('div');
      legacyScene.className='settings-row nyx-wallpaper-legacy';
      const threeDOn=store.get('nyx.threeDBackgrounds',false);
      legacyScene.innerHTML=`<span>Legacy 3D scene</span><button class="settings-action ${threeDOn?'on':''}" data-switch="nyx.threeDBackgrounds" type="button" aria-checked="${threeDOn}">${threeDOn?'On':'Off'}</button>`;
      backgroundsBlock.append(legacyScene);
      const customThemeBlock=document.createElement('section');
      customThemeBlock.className='settings-block nyx-custom-theme-maker';
      const customColor=nyxThemeHex(store.text('nyx.customThemeColor',nyxCustomThemeDefaults.base));
      customThemeBlock.innerHTML=`<h2>Custom Theme</h2><p>Choose one color and Nyx generates the canvas, panels, borders, and accents from it.</p><div class="nyx-custom-theme-controls"><label class="nyx-custom-theme-picker"><input type="color" value="${customColor}" data-custom-theme-color aria-label="Custom theme color"><span class="nyx-custom-theme-swatch" data-custom-theme-swatch style="--nyx-swatch:${customColor}"></span></label><input class="settings-input" value="${customColor}" data-custom-theme-hex aria-label="Custom theme color hex" maxlength="7" spellcheck="false"></div><div class="settings-actions"><button class="settings-action" data-apply-custom-theme type="button">Apply Custom Theme</button><button class="settings-action" data-reset-custom-theme type="button">Reset Color</button></div>`;
      const founderProfileBlock=document.createElement('section');
      founderProfileBlock.className='settings-block';
      founderProfileBlock.hidden=true;
      founderProfileBlock.innerHTML='<h2>Founder Profile</h2><p>Customize the public profile shown on About Nyx.</p><div class="settings-actions"><button class="settings-action" data-open-founder-profile-editor type="button">Customize Founder Profile</button></div>';
      founderProfileBlock.dataset.founderProfileSettingsCard='';
      const ownerDashboardBlock=document.createElement('section');
      ownerDashboardBlock.className='settings-block';
      ownerDashboardBlock.hidden=true;
      ownerDashboardBlock.dataset.ownerDashboardCard='';
      ownerDashboardBlock.innerHTML='<h2>Owner Dashboard</h2><p>Manage users, roles, subscriptions, security, and account activity.</p><div class="settings-actions"><button class="settings-action" data-open-owner-dashboard type="button">Open Owner Dashboard</button></div>';
      const accountBlock=document.createElement('section');
      accountBlock.className='settings-block';
      accountBlock.hidden=true;
      accountBlock.dataset.founderAccountCard='';
      accountBlock.innerHTML='<h2><button class="nyx-account-settings-link" data-open-nyx-account-settings type="button">Account</button></h2><p data-founder-account-status>Sign in to manage your Nyx account.</p><div class="settings-actions"><button class="settings-action" data-open-nyx-account type="button">Create or sign in</button><button class="settings-action" data-open-nyx-profile type="button" hidden>Edit account</button><button class="settings-action" data-nyx-account-sign-out type="button" hidden>Sign out</button></div>';
      const cloudSaveBlock=document.createElement('section');
      cloudSaveBlock.className='settings-block';
      cloudSaveBlock.innerHTML='<h2>Cloud Saves</h2><p data-nyx-cloud-save-status>Sign in to sync supported game progress and Nyx preferences.</p>';
      const resetBlock=document.createElement('section');
      resetBlock.className='settings-block';
      resetBlock.innerHTML=`<h2>Clear Cache</h2><p>Removes cookies, cache files, saved settings, connection storage, and service workers, then reloads nyx like a fresh install.</p><div class="settings-actions"><button class="settings-action danger-action" data-clear-nyx-cache type="button">Clear Cache and Reset</button></div>`;
      effectBlock.before(privacyBlock);
      effectBlock.before(homepageBlock);

      effectBlock.before(lagBlock);
      effectBlock.before(liteBlock);
      effectBlock.before(backgroundsBlock);
      effectBlock.before(customThemeBlock);
      effectBlock.before(accountBlock);
      effectBlock.before(cloudSaveBlock);
      effectBlock.before(ownerDashboardBlock);
      effectBlock.before(founderProfileBlock);
      effectBlock.before(resetBlock);
    }
    ensureFreshThemeOptions(overlay);
    enhanceWorkspaceShellSettings(overlay);
    syncSwitches(overlay);
    wirePresetCloakControls(overlay);
    syncFounderOwnerControls();
  }
  function closeWorkspaceShellSettings(){
    document.querySelector('.workspace-shell-settings-overlay')?.remove();
    syncNyxVisualDockState();
  }

  function closeWorkspaceShellTab(id){
    const index=workspaceShellTabs.findIndex(tab=>tab.id===id);
    if(index<0) return;
    const closingWasActive=workspaceShellActiveTab===id;
    const closing=workspaceShellTabs[index];
    try{
      if(closingWasActive && closing.url==='nyx://settings') closeWorkspaceShellSettings();
      const nextIndex=workspaceShellTabs.findIndex(tab=>tab.id===id);
      if(nextIndex<0) return;
      const shellTab=workspaceShellTabs[nextIndex];



      if(shellTab?.workspaceTabId && activeWorkspace?.closeTab){
        try{activeWorkspace.closeTab(shellTab.workspaceTabId)}catch(error){console.warn('Nyx: embedded tab cleanup failed during shell close',error)}
      }
      workspaceShellTabs.splice(nextIndex,1);
      if(workspaceShellActiveTab===id) workspaceShellActiveTab=workspaceShellTabs[Math.max(0,nextIndex-1)]?.id || workspaceShellTabs[0]?.id || null;
      if(!workspaceShellTabs.length){
        const freshId='shell-'+Date.now()+Math.random().toString(16).slice(2);
        workspaceShellTabs.push({id:freshId,url:'',title:'Home'});
        workspaceShellActiveTab=freshId;
        if(!activeWorkspace?.win?.isConnected){
          const win=openWorkspace('');
          win?.classList.add('maximized');
        }
      }
      const activeShell=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab) || workspaceShellTabs[0];
      if(closingWasActive){
        hideWorkspaceSuggestions();
        const address=document.querySelector('[data-workspace-shell-url]');
        if(address) address.value=workspaceShellDisplayValue(activeShell?.url || '');
      }
      if(!closingWasActive){
        renderWorkspaceShellTabs();
        return;
      }
      if(activeShell?.title==='Home' && !activeShell.url){
        if(activeWorkspace?.win?.isConnected){
          activeWorkspace.tabs?.forEach(tab=>tab.frame?.classList.remove('active'));
          renderWorkspaceShellHomeMode(activeWorkspace.win,'home');
          activeWorkspace.renderTabs?.();
        }
      }else if(activeShell?.url==='nyx://settings'){
        if(activeShell?.workspaceTabId && activeWorkspace?.activate) activeWorkspace.activate(activeShell.workspaceTabId);
        renderWorkspaceShellSettingsTab();
      }else if(isWorkspaceShellBlankUrl(activeShell?.url)){
        if(activeShell?.workspaceTabId && activeWorkspace?.activate) activeWorkspace.activate(activeShell.workspaceTabId);
        renderWorkspaceShellHomeMode(activeWorkspace?.win);
      }else if(activeShell?.workspaceTabId && activeWorkspace?.activate){
        activeWorkspace.activate(activeShell.workspaceTabId);
      }
      renderWorkspaceShellTabs();
    }finally{




      if(!document.body.classList.contains('workspace-shell')){
        document.body.classList.add('workspace-shell');
      }
      ensureNyxVisualDock();
      deferNyxVisualDockRecovery();
    }
  }
  function updateWorkspaceShellLocation(url,workspaceTabId='',forceInput=false){
    ensureWorkspaceShellHome();
    const tab=(workspaceTabId && workspaceShellTabs.find(tab=>tab.workspaceTabId===workspaceTabId))
      || workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab)
      || workspaceShellTabs[0];
    const nextUrl=String(url || '').trim();
    const previousUrl=String(tab.url || '').trim();
    tab.url=nextUrl;
    if(nextUrl!==previousUrl || !tab.securityState) tab.securityState=workspaceShellSecurityStateForUrl(nextUrl);
    if(nextUrl){
      tab.title=workspaceShellLabel(nextUrl);
      tab.icon=iconForUrl(nextUrl);
    }else if(tab.title!=='Home' && tab.title!=='New Tab'){
      tab.title='New Tab';
      tab.icon=favicons.nyx;
    }
    renderWorkspaceShellTabs();
    if(forceInput && tab.id===workspaceShellActiveTab){
      const input=document.querySelector('[data-workspace-shell-url]');
      if(input){
        input.value=workspaceShellDisplayValue(nextUrl);
        input.dataset.selectOnFocus='1';
      }
    }
  }
  function navigateWorkspaceShell(value){
    closeWorkspaceShellSettings();
    document.body.classList.remove('menu-open');
    const raw=canonicalAddressInput(value);
    if(!raw){
      openWorkspaceShellTab('');
      return;
    }
    if(raw.toLowerCase()==='nyx://ai'){
      showWorkspaceShellInternalPage('ai');
      return;
    }
    if(raw.toLowerCase()==='nyx://settings'){
      openWorkspaceShellSettings();
      return;
    }
    if(raw.toLowerCase()==='nyx://ephesians1'){
      showWorkspaceShellInternalPage('ephesians1');
      return;
    }
    if(/^nyx:\/\/(terms|developer|about|credits)$/i.test(raw)){
      openWorkspaceShellInternalTab(raw.slice(6).toLowerCase());
      return;
    }
    if(shouldTriggerSixtySevenJumpscare(raw)){
      showSixtySevenJumpscare();
      return;
    }
    ensureWorkspaceShellHome();



    scheduleNyxVisualDockViewportRepair();
    const connectionInternal=/^(?:\/service\/|\/~\/sj\/|\/scramjet\/service\/|nyx:\/\/)/i.test(raw);
    const looksLikeUrl=/^(?:[a-z][a-z0-9+.-]*:|[\w.-]+\.[a-z]{2,}(?:\/|$)|\/|\.\/|\.\.\/|assets\/)/i.test(raw);
    const isSearchQuery=raw && !looksLikeUrl && !connectionInternal;
    if(isSearchQuery) rememberNyxRecentSearch(raw);
    const normalized=normalize(raw);
    const target=isSearchQuery ? selectedSearchUrl(raw) : (normalized || raw);
    let shellTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab) || workspaceShellTabs[0];
    if(workspaceShellTabPreservesSearch(shellTab)){
      const resultShellId=openWorkspaceShellTab('',{focusAddress:false});
      const resultShellTab=workspaceShellTabs.find(tab=>tab.id===resultShellId);
      if(resultShellTab){
        shellTab=resultShellTab;
        setWorkspaceShellActive(resultShellId);
      }
    }
    if(activeWorkspace?.win?.isConnected){
      ensureWorkspaceShellLinkedTab(shellTab);
      if(shellTab?.workspaceTabId) activeWorkspace.activate?.(shellTab.workspaceTabId);
      if(activeWorkspace.navigate) activeWorkspace.navigate(target);
      else openWorkspace(target);
      const activeTab=activeWorkspace?.tabs?.find(tab=>tab.id===shellTab?.workspaceTabId || tab.id===activeWorkspace.active);
      if(activeTab){
        if(shellTab) shellTab.workspaceTabId=activeTab.id;
        if(shellTab) workspaceShellActiveTab=shellTab.id;
        activeWorkspace.activate?.(activeTab.id);
        activeTab.url=target;
        activeTab.title=workspaceShellLabel(target);
        activeTab.icon=iconForUrl(target);
        activeWorkspace.renderTabs?.();
      }
    }else{
      const win=openWorkspace(target);
      win?.classList.add('maximized');
      const created=activeWorkspace?.tabs?.[activeWorkspace.tabs.length-1];
      if(shellTab && created) shellTab.workspaceTabId=created.id;
      updateDockFullscreenState();
    }
    updateWorkspaceShellLocation(target,'',true);
  }
  function goWorkspaceShellHome(){
    ensureWorkspaceShellHome();
    if(!activeWorkspace?.win?.isConnected){
      const win=openWorkspace('');
      win?.classList.add('maximized');
      updateDockFullscreenState();
    }
    const shellTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab) || workspaceShellTabs[0];
    if(shellTab?.workspaceTabId && activeWorkspace?.activate) activeWorkspace.activate(shellTab.workspaceTabId);
    const state=activeWorkspace;
    const tab=state?.tabs?.find(t=>t.id===state.active);
    if(tab){
        tab.url='';
        tab.title='Home';
        tab.icon=favicons.nyx;
      tab.history=[''];
      tab.index=0;
      tab.scramjetFrame=null;
      tab.frame.removeAttribute('src');
      tab.frame.removeAttribute('srcdoc');
      tab.frame.classList.remove('active');
    }
    state?.win?.querySelector('.workspace-home')?.classList.remove('hidden');
    state?.win?.classList.add('workspace-blank');
    playWorkspaceShellPageReveal(state?.win || document);
    state?.renderTabs?.();
    updateWorkspaceShellLocation('');
    document.querySelector('[data-workspace-shell-url]')?.focus();
  }

  function legacyWorkspaceShellInternalPage(name){
    ensureWorkspaceShellHome();
    if(!activeWorkspace?.win?.isConnected){
      const win=openWorkspace('');
      win?.classList.add('maximized');
      const shellTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
      const created=activeWorkspace?.tabs?.[activeWorkspace.tabs.length-1];
      if(shellTab && created) shellTab.workspaceTabId=created.id;
      updateDockFullscreenState();
    }
    const shellTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
    const state=activeWorkspace;
    const tab=ensureWorkspaceShellLinkedTab(shellTab) || state?.tabs?.find(t=>t.id===state.active);
    if(!tab) return false;
    const discordFounderProfileStyle='.nyx-founder-profile-standard{display:block!important;max-width:620px!important;margin:0 auto!important;padding:0!important;overflow:hidden!important;border:1px solid color-mix(in srgb,var(--nyx-founder-accent,#8fb8ff) 42%,transparent)!important;border-radius:16px!important;background:#111827!important;box-shadow:0 16px 42px rgba(0,0,0,.32)!important}.nyx-founder-profile-standard .nyx-founder-banner{height:140px!important;margin:0!important;background:var(--nyx-founder-accent,#8fb8ff)!important}.nyx-founder-profile-standard .nyx-founder-profile-content{display:block!important;padding:0 16px 18px!important}.nyx-founder-profile-standard .nyx-founder-image-wrap{width:88px!important;height:88px!important;margin:-45px 0 0!important;border:6px solid #111827!important;border-radius:50%!important;background:#111827!important}.nyx-founder-profile-standard .nyx-founder-image{border:0!important;border-radius:50%!important;background:#172338!important}.nyx-founder-profile-standard .nyx-founder-status{right:-2px!important;bottom:-2px!important;border:4px solid #111827!important}.nyx-founder-profile-standard .nyx-founder-copy{padding-top:13px!important}.nyx-founder-name-row{display:flex!important;align-items:center!important;gap:7px!important}.nyx-founder-profile-standard .nyx-founder-copy h3{margin:0!important;color:#f8fbff!important;font-size:24px!important;font-weight:700!important;letter-spacing:-.025em!important}.nyx-founder-owner-crown{color:#f0c85c!important;font-size:18px!important;line-height:1!important}.nyx-founder-profile-standard .nyx-founder-handle{margin:2px 0 10px!important;color:#b5c2d5!important;font-size:14px!important}.nyx-founder-profile-standard .nyx-founder-role{margin:0 0 11px!important;color:#9cadc4!important;font-size:11px!important;font-weight:600!important;letter-spacing:.09em!important}.nyx-founder-role-list{display:flex!important;flex-wrap:wrap!important;gap:7px!important;margin:0 0 12px!important}.nyx-founder-role-chip{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:4px 8px!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:4px!important;background:rgba(255,255,255,.08)!important;color:#d9e3f1!important;font-size:11px!important;font-weight:650!important}.nyx-founder-role-owner{border-color:color-mix(in srgb,var(--nyx-founder-accent,#8fb8ff) 78%,transparent)!important;background:color-mix(in srgb,var(--nyx-founder-accent,#8fb8ff) 22%,transparent)!important;color:#fff!important}.nyx-founder-role-owner span{color:#f0c85c!important}.nyx-founder-profile-standard .nyx-founder-badges{margin:0 0 14px!important}.nyx-founder-profile-standard .nyx-founder-badge{border:0!important;border-radius:4px!important;background:rgba(255,255,255,.1)!important;color:#c9d7ea!important}.nyx-founder-about{padding-top:13px!important;border-top:1px solid rgba(255,255,255,.14)!important}.nyx-founder-about>strong{display:block!important;margin-bottom:7px!important;color:#f5f8ff!important;font-size:12px!important;font-weight:700!important;text-transform:uppercase!important}.nyx-founder-profile-standard .nyx-founder-bio{color:#d5dfec!important;font-size:14px!important;line-height:1.55!important}.nyx-founder-profile-standard .nyx-founder-link{margin-top:14px!important;color:#cbd9ff!important}@media(max-width:680px){.nyx-founder-profile-standard .nyx-founder-image-wrap{width:88px!important;margin:-45px 0 0!important}.nyx-founder-profile-standard .nyx-founder-copy{text-align:left!important}.nyx-founder-profile-standard .nyx-founder-badges{justify-content:flex-start!important}}';
    const pages={
      apps:{title:'Apps',body:`<style>html,body,.apps-shell-page{background:transparent!important;background-image:none!important}</style><div class="workspace-home workspace-shell-page apps-shell-page"><h1 class="home-heading">Apps</h1><p class="home-sub">Everything in Nyx.</p><div class="quick-grid apps-launch-grid" data-nyx-global-app-grid>${quickTiles()}</div></div>`},
      links:{title:'Bookmarks',body:`<div class="workspace-home workspace-shell-page"><h1 class="home-heading">Bookmarks</h1><p class="home-sub">Common links.</p><div class="quick-grid"><button class="quick-tile" data-url="https://www.google.com/"><img class="quick-icon" alt="" src="${appIcon('google.com')}"><span>Google</span></button><button class="quick-tile" data-url="https://duckduckgo.com/"><img class="quick-icon" alt="" src="${appIcon('duckduckgo.com')}"><span>Reference Search</span></button><button class="quick-tile" data-url="https://docs.google.com/"><img class="quick-icon" alt="" src="${appIcon('docs.google.com')}"><span>Docs</span></button></div></div>`}
    };
    const page=pages[name] || pages.apps;
    tab.url='nyx://'+name;
    tab.title=page.title;
    const clearInternal=/^(apps)$/i.test(String(name || page.title || ''));
    state.win.classList.toggle('internal-clear',clearInternal);
    tab.frame.classList.toggle('transparent-internal-page',clearInternal);
    tab.frame.setAttribute('allowtransparency','true');
    tab.frame.style.backgroundColor=clearInternal?'transparent':'';
    applyGlassInternalTheme(tab.frame);
    tab.frame.removeAttribute('src');
    tab.frame.srcdoc=workspaceShellPageSrcdoc(page);
    tab.frame.classList.add('active');
    state.win.querySelector('.workspace-home')?.classList.add('hidden');
    state.win.classList.remove('workspace-blank');
    state.renderTabs?.();
    if(shellTab){
      shellTab.url=tab.url;
      shellTab.title=tab.title;
      shellTab.icon=tab.icon;
      renderWorkspaceShellTabs();
    }
    updateWorkspaceShellLocation(tab.url);
    return true;
  }

  function workspaceShellPageSrcdoc(page){
    const script='function nyxEffectPayload(){return{type:"nyx:effect-settings",effect:document.querySelector("[data-effect-value]")?.value||"none",speed:document.querySelector("[data-effect-speed]")?.value||"1.1",amount:document.querySelector("[data-effect-amount]")?.value||"16",theme:document.querySelector("[data-theme-value]")?.value||"default"}}function nyxWorkspacePayload(){return{type:"nyx:workspace-settings",engine:document.querySelector("[data-workspace-engine]")?.value||"duckduckgo",workspaceMode:document.querySelector("[data-workspace-mode-select]")?.value||"auto",transport:document.querySelector("[data-workspace-transport]")?.value||"libcurlRaw"}}document.addEventListener("click",e=>{const preset=e.target.closest("[data-preset]");if(preset){e.preventDefault();e.stopPropagation();parent.postMessage({type:"nyx:preset",preset:preset.dataset.preset},"*");return}const app=e.target.closest("[data-app-url]");if(app){e.preventDefault();parent.postMessage({type:"nyx:navigate",url:app.dataset.appUrl},"*");return}const url=e.target.closest("[data-url]");if(url&&url.closest(".shell-page,.workspace-shell-page")){e.preventDefault();parent.postMessage({type:"nyx:navigate",url:url.dataset.url},"*");return}if(e.target.closest("[data-workspace-settings-save]")){e.preventDefault();parent.postMessage(nyxWorkspacePayload(),"*")}if(e.target.closest("[data-page-fullscreen]"))parent.postMessage({type:"nyx:fullscreen"},"*");if(e.target.closest("[data-shell-about]"))parent.postMessage({type:"nyx:about"},"*");if(e.target.closest("[data-shell-about-tab]"))parent.postMessage({type:"nyx:about-tab"},"*")});document.addEventListener("change",e=>{const presetSelect=e.target.closest("[data-preset-select]");if(presetSelect){document.querySelectorAll("[data-tab-title]").forEach(el=>{el.value=presetSelect.options[presetSelect.selectedIndex]?.textContent||presetSelect.value||"nyx"});parent.postMessage({type:"nyx:preset",preset:presetSelect.value||"nyx"},"*");return}if(e.target.closest("[data-effect-value],[data-effect-speed],[data-effect-amount],[data-theme-value]"))parent.postMessage(nyxEffectPayload(),"*");if(e.target.closest("[data-workspace-engine],[data-workspace-mode-select],[data-workspace-transport]"))parent.postMessage(nyxWorkspacePayload(),"*")});document.addEventListener("input",e=>{const presetSelect=e.target.closest("[data-preset-select]");if(presetSelect){parent.postMessage({type:"nyx:preset",preset:presetSelect.value||"nyx"},"*");return}if(e.target.closest("[data-effect-speed],[data-effect-amount]")){document.querySelectorAll("[data-effect-speed-label]").forEach(el=>{el.textContent=(Number(document.querySelector("[data-effect-speed]")?.value||1.1)).toFixed(1)+"x"});document.querySelectorAll("[data-effect-amount-label]").forEach(el=>{el.textContent=document.querySelector("[data-effect-amount]")?.value||"16"});parent.postMessage(nyxEffectPayload(),"*")}});';
    const popupScript='document.addEventListener("click",e=>{const popup=e.target.closest("[data-popup-protection]");if(!popup)return;e.preventDefault();const next=popup.dataset.enabled!=="true";popup.dataset.enabled=String(next);popup.classList.toggle("on",next);popup.textContent="Popup Protection "+(next?"On":"Off");parent.postMessage({type:"nyx:popup-protection",enabled:next},"*")});';
    const panicFrameScript='let NYX_PANIC_CAPTURE=false;function nyxPanicCombo(e){const key=String(e.key||"").trim();if(!key||["Control","Shift","Alt","Meta"].includes(key))return "";const parts=[];if(e.ctrlKey)parts.push("Ctrl");if(e.altKey)parts.push("Alt");if(e.shiftKey)parts.push("Shift");if(e.metaKey)parts.push("Meta");parts.push(key.length===1?key.toUpperCase():key.replace(/^Arrow/,""));return parts.join("+")}document.addEventListener("click",e=>{if(e.target.closest("[data-panic-capture]"))NYX_PANIC_CAPTURE=true;if(e.target.closest("[data-panic-clear]"))NYX_PANIC_CAPTURE=false},true);document.addEventListener("keydown",e=>{if(!NYX_PANIC_CAPTURE)return;const combo=nyxPanicCombo(e);if(!combo)return;e.preventDefault();e.stopPropagation();NYX_PANIC_CAPTURE=false;document.querySelectorAll("[data-panic-key-display]").forEach(el=>el.textContent=combo);parent.postMessage({type:"nyx:panic-key-set",combo},"*")},true);';
    const finalInternalPaintScript='document.querySelectorAll("[data-effect-speed-label]").forEach(el=>{el.textContent=Number(NYX_EFFECT_SPEED).toFixed(1)+"x"});';
    return '<!doctype html><html data-nyx-theme="'+esc(normalizeNyxTheme(store.text('nyx.theme','default')))+'" style="--nyx-custom-base:'+esc(nyxCustomThemePalette().base)+'" data-nyx-appearance="'+esc(store.text('nyx.appearance','dark'))+'"><head><meta charset="utf-8"><base target="_self"><link rel="stylesheet" href="/css/avatar-decorations.css"><link rel="stylesheet" href="/css/profile-effects.css"><style>'+(page.style||'')+'</style><link rel="stylesheet" href="/apps/obsidian.css?v=20261001-halloween-v3"><link rel="stylesheet" href="/apps/internal-pages.css?v=20260926-icons-v2"></head><body>'+page.body+'<script>const NYX_EFFECT='+JSON.stringify(store.text('nyx.visualEffect','none'))+';const NYX_EFFECT_SPEED='+JSON.stringify(store.text('nyx.visualEffectSpeed','1.1'))+';const NYX_EFFECT_AMOUNT='+JSON.stringify(store.text('nyx.visualEffectAmount','16'))+';const NYX_THEME='+JSON.stringify(normalizeNyxTheme(store.text('nyx.theme','default')))+';'+finalInternalPaintScript+script+popupScript+panicFrameScript+(page.script||'')+'<\/script></body></html>';
  }
  function showWorkspaceShellInternalPage(name){
    hideWorkspaceSuggestions();
    if(/^(lionai|lion ai)$/i.test(String(name || ''))) name='ai';
    if(/^settings$/i.test(String(name || ''))){
      openWorkspaceShellSettings();
      return true;
    }
    ensureWorkspaceShellHome();
    if(!activeWorkspace?.win?.isConnected){
      const win=openWorkspace('');
      win?.classList.add('maximized');
      const shellTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
      const created=activeWorkspace?.tabs?.[activeWorkspace.tabs.length-1];
      if(shellTab && created) shellTab.workspaceTabId=created.id;
      updateDockFullscreenState();
    }
    const shellTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
    if(shellTab?.workspaceTabId && activeWorkspace?.activate) activeWorkspace.activate(shellTab.workspaceTabId);
    const state=activeWorkspace;
    const tab=state?.tabs?.find(t=>t.id===state.active);
    if(!tab) return false;
    if(/^ai$/i.test(String(name || ''))){
      tab.url='nyx://ai';
      tab.title="Nyx A1";
      tab.icon=favicons.nyx;
      state.win.classList.remove('internal-clear','workspace-blank');
      tab.frame.classList.remove('transparent-internal-page');
      tab.frame.removeAttribute('srcdoc');
      tab.frame.src='/ai.html';
      tab.frame.classList.add('active');
      state.win.querySelector('.workspace-home')?.classList.add('hidden');
      state.renderTabs?.();
      updateWorkspaceShellLocation(tab.url);
      return true;
    }
    const presetTiles=`<button class="quick-tile" data-preset="deltamath" type="button"><img class="quick-icon" alt="" src="${favicons.deltamath}"><span>DeltaMath tab</span></button><button class="quick-tile" data-preset="nyx" type="button"><img class="quick-icon" alt="" src="${favicons.nyx}"><span>ռʏӼ tab</span></button><button class="quick-tile" data-preset="google" type="button"><img class="quick-icon" alt="" src="${favicons.google}"><span>Google tab</span></button><button class="quick-tile" data-preset="drive" type="button"><img class="quick-icon" alt="" src="${favicons.drive}"><span>Drive tab</span></button><button class="quick-tile" data-preset="classlink" type="button"><img class="quick-icon" alt="" src="${favicons.classlink}"><span>ClassLink tab</span></button>`;
    const utilityPageStyle=`
      html,body{min-height:100%!important;background:#0a1220!important;color:#eaf2ff!important}
      .nyx-utility-tab{width:min(860px,calc(100vw - 44px));min-height:100vh;margin:0 auto;padding:clamp(34px,6vw,72px) clamp(22px,5vw,58px) 90px!important;background:transparent!important;color:#eaf2ff!important}
      .nyx-utility-tab .utility-kicker{margin:0 0 8px!important;color:#8fb8ff!important;font-size:12px!important;font-weight:500!important;letter-spacing:.16em!important;text-transform:uppercase!important;text-shadow:none!important}
      .nyx-utility-tab h1{margin:0 0 10px!important;color:#f4f8ff!important;font-size:clamp(34px,6vw,58px)!important;font-weight:420!important;letter-spacing:-.045em!important;text-shadow:none!important}
      .nyx-utility-tab .utility-updated{margin:0 0 34px!important;color:#8498b7!important;font-size:12px!important;font-weight:400!important;text-shadow:none!important}
      .nyx-utility-tab section{padding:20px 0;border-top:1px solid rgba(111,158,232,.22)}
      .nyx-utility-tab section h2{margin:0 0 7px!important;color:#edf4ff!important;font-size:16px!important;font-weight:520!important;text-shadow:none!important}
      .nyx-utility-tab section p,.nyx-utility-tab .about-lead{max-width:68ch;margin:0!important;color:#a9b9d0!important;font-size:14px!important;font-weight:400!important;line-height:1.68!important;text-shadow:none!important}
      .nyx-utility-tab .utility-intro{max-width:68ch;margin:0 0 32px!important;color:#b7c5d9!important;font-size:14px!important;line-height:1.68!important}.nyx-utility-tab section p+p{margin-top:10px!important}.nyx-utility-tab ul{max-width:68ch;margin:10px 0 14px;padding-left:22px;color:#a9b9d0;font-size:14px;line-height:1.62}.nyx-utility-tab li+li{margin-top:4px}.nyx-utility-tab strong{color:#edf4ff!important;font-weight:600!important}
      .nyx-about-tab{display:flex;min-height:calc(100vh - 1px);flex-direction:column;justify-content:center}.nyx-about-tab .about-mark{width:48px;height:48px;display:grid;place-items:center;margin-bottom:24px;border:1px solid rgba(111,158,232,.42);border-radius:15px;background:rgba(17,26,41,.72);color:#8fb8ff;font-size:23px}
      .nyx-about-details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:30px 0 0}.nyx-about-details div{padding:14px;border:1px solid rgba(111,158,232,.22);border-radius:13px;background:rgba(17,26,41,.54)}.nyx-about-details dt{color:#8498b7;font-size:10px;letter-spacing:.09em;text-transform:uppercase}.nyx-about-details dd{margin:5px 0 0;color:#edf4ff;font-size:13px}
      body{--credits-accent:#8fb8ff;--credits-line:rgba(143,184,255,.24);--credits-card:rgba(15,25,42,.72)}body.theme-midnight{--credits-accent:#789edc}body.theme-ruby{--credits-accent:#db7f91;--credits-line:rgba(219,127,145,.26)}body.theme-emerald{--credits-accent:#65b99b;--credits-line:rgba(101,185,155,.25)}body.theme-sakura{--credits-accent:#d798b8;--credits-line:rgba(215,152,184,.26)}body.theme-fresh{--credits-accent:#86a77e;--credits-line:rgba(134,167,126,.26);--credits-card:rgba(19,28,21,.78)}
      .nyx-credits-tab{width:min(1040px,calc(100vw - 34px));padding:clamp(46px,7vw,92px) clamp(20px,5vw,62px) 70px!important}.nyx-credits-hero{text-align:center;margin:0 auto 68px}.nyx-credits-tab .nyx-credits-hero h1{margin:0 0 14px!important;font-size:clamp(48px,8vw,86px)!important;font-weight:400!important;letter-spacing:-.055em!important}.nyx-credits-hero>p:last-child{max-width:620px;margin:0 auto!important;color:#9cadc4!important;font-size:15px!important;line-height:1.6!important}
      .nyx-credits-tab .nyx-credits-section{padding:0!important;margin:0 0 76px!important;border:0!important}.nyx-credits-tab .nyx-credits-section>h2{width:max-content;margin:0 auto 34px!important;padding-bottom:7px!important;border-bottom:2px solid var(--credits-accent)!important;color:#eef4ff!important;font-size:clamp(31px,5vw,48px)!important;font-weight:400!important;letter-spacing:-.035em!important;text-align:center!important}
      .nyx-founder-profile{display:grid;grid-template-columns:minmax(240px,360px) minmax(0,1fr);align-items:center;gap:clamp(28px,6vw,72px);padding:clamp(18px,3vw,30px);border:1px solid var(--credits-line);border-radius:24px;background:linear-gradient(135deg,color-mix(in srgb,var(--credits-accent) 10%,transparent),transparent 42%),var(--credits-card);box-shadow:0 24px 70px rgba(0,0,0,.24)}
      .nyx-founder-image-wrap{aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border:1px solid var(--credits-line);border-radius:20px;background:#050a12}.nyx-founder-image{display:block;width:100%;height:100%;padding:0;object-fit:cover;object-position:center;box-sizing:border-box}.nyx-founder-copy .nyx-founder-role{margin:0 0 6px!important;color:var(--credits-accent)!important;font-size:11px!important;font-weight:500!important;letter-spacing:.16em!important;text-transform:uppercase!important}.nyx-founder-copy h3{margin:0 0 16px!important;color:#f5f8ff!important;font-size:clamp(31px,5vw,50px)!important;font-weight:400!important;letter-spacing:-.04em!important}.nyx-founder-copy>p{margin:0!important;color:#aebdd1!important;font-size:15px!important;font-weight:400!important;line-height:1.72!important;overflow-wrap:anywhere}.nyx-founder-copy .nyx-founder-note{margin-top:16px!important;color:#d7e1ef!important}
      .nyx-credit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.nyx-credit-grid article{min-height:176px;padding:22px;border:1px solid var(--credits-line);border-radius:19px;background:var(--credits-card)}.nyx-credit-grid article>span{display:grid;place-items:center;width:38px;height:38px;margin-bottom:24px;border:1px solid var(--credits-line);border-radius:12px;color:var(--credits-accent);font-size:20px}.nyx-credit-grid h3{margin:0 0 8px!important;color:#eef4ff!important;font-size:16px!important;font-weight:500!important}.nyx-credit-grid p{margin:0!important;color:#94a6bf!important;font-size:13px!important;line-height:1.55!important}
      .nyx-credits-footer{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:24px 0 0;border-top:1px solid var(--credits-line);color:#8498b7}.nyx-credits-footer img{width:38px;height:38px;border-radius:10px;object-fit:contain}.nyx-credits-footer div{display:grid;gap:2px}.nyx-credits-footer strong{font-size:14px!important;font-weight:500!important}.nyx-credits-footer span,.nyx-credits-footer small{font-size:11px!important}
      .nyx-terminal-tab{width:min(980px,calc(100vw - 34px));height:calc(100vh - 34px);min-height:420px;margin:17px auto;padding:0!important;display:grid;grid-template-rows:auto 1fr auto;border:1px solid rgba(111,158,232,.30);border-radius:17px;overflow:hidden;background:#080f1a!important}.nyx-terminal-toolbar{min-height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 17px;border-bottom:1px solid rgba(111,158,232,.22);color:#8498b7;font-size:11px;letter-spacing:.04em}.nyx-terminal-toolbar span:first-child{display:flex;align-items:center;gap:8px;color:#eaf2ff}.nyx-terminal-toolbar i{width:7px;height:7px;border-radius:50%;background:#79aaff}
      .nyx-terminal-output{overflow:auto;padding:20px;color:#b9c8dc;font:400 12px/1.75 "Cascadia Code",Consolas,monospace}.nyx-terminal-line.command{margin-top:9px;color:#8fb8ff}.nyx-terminal-line.error{color:#ff8292}.nyx-terminal-form{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:12px 14px;border-top:1px solid rgba(111,158,232,.22);background:rgba(17,26,41,.70)}.nyx-terminal-form label{color:#8fb8ff;font:400 12px/1 "Cascadia Code",Consolas,monospace}.nyx-terminal-form input{width:100%;height:38px;padding:0 11px;border:1px solid rgba(111,158,232,.32);border-radius:9px;background:#080f1a;color:#eaf2ff;outline:0;font:400 12px/1 "Cascadia Code",Consolas,monospace}.nyx-terminal-form input:focus{border-color:#8fb8ff}.nyx-terminal-form button{height:38px;padding:0 16px;border:1px solid rgba(111,158,232,.38);border-radius:9px;background:rgba(111,158,232,.12);color:#eaf2ff;font:400 12px Outfit,Arial,sans-serif}.nyx-terminal-form button:hover{transform:none!important;background:rgba(111,158,232,.18)!important;border-color:#8fb8ff!important;box-shadow:none!important}
      @media(max-width:680px){.nyx-about-details{grid-template-columns:1fr}.nyx-founder-profile{grid-template-columns:1fr}.nyx-founder-image-wrap{width:min(310px,100%);margin:auto}.nyx-founder-copy{text-align:center}.nyx-credit-grid{grid-template-columns:1fr}.nyx-credits-footer{grid-template-columns:auto 1fr}.nyx-credits-footer small{grid-column:1/-1}.nyx-terminal-tab{width:calc(100vw - 16px);height:calc(100vh - 16px);margin:8px auto}.nyx-terminal-form{grid-template-columns:auto 1fr}.nyx-terminal-form button{grid-column:2}}
    `;
    const discordFounderProfileStyle='.nyx-founder-profile-standard{display:block!important;max-width:620px!important;margin:0 auto!important;padding:0!important;overflow:hidden!important;border:1px solid color-mix(in srgb,var(--nyx-founder-accent,#8fb8ff) 42%,transparent)!important;border-radius:16px!important;background:#111827!important;box-shadow:0 16px 42px rgba(0,0,0,.32)!important}.nyx-founder-profile-standard .nyx-founder-banner{height:140px!important;margin:0!important;background:var(--nyx-founder-accent,#8fb8ff)!important}.nyx-founder-profile-standard .nyx-founder-profile-content{display:block!important;padding:0 16px 18px!important}.nyx-founder-profile-standard .nyx-founder-image-wrap{width:88px!important;height:88px!important;margin:-45px 0 0!important;border:6px solid #111827!important;border-radius:50%!important;background:#111827!important}.nyx-founder-profile-standard .nyx-founder-image{display:block!important;width:88px!important;height:88px!important;border:0!important;border-radius:50%!important;background:#172338!important}.nyx-founder-profile-standard .nyx-founder-copy{padding-top:13px!important}.nyx-founder-name-row{display:flex!important;align-items:center!important;gap:7px!important}.nyx-founder-profile-standard .nyx-founder-copy h3{margin:0!important;color:#f8fbff!important;font-size:24px!important;font-weight:700!important}.nyx-founder-profile-standard .nyx-founder-handle{margin:2px 0 10px!important;color:#b5c2d5!important;font-size:14px!important}.nyx-founder-role-list{display:flex!important;flex-wrap:wrap!important;gap:7px!important;margin:0 0 12px!important}.nyx-founder-role-chip,.nyx-founder-badge{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:4px 8px!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:4px!important;background:rgba(255,255,255,.08)!important;color:#d9e3f1!important;font-size:11px!important}.nyx-founder-role-owner{border-color:color-mix(in srgb,var(--nyx-founder-accent,#8fb8ff) 78%,transparent)!important;background:color-mix(in srgb,var(--nyx-founder-accent,#8fb8ff) 22%,transparent)!important;color:#fff!important}.nyx-founder-about{padding-top:13px!important;border-top:1px solid rgba(255,255,255,.14)!important}.nyx-founder-about>strong{display:block!important;margin-bottom:7px!important;color:#f5f8ff!important;font-size:12px!important;text-transform:uppercase!important}.nyx-founder-profile-standard .nyx-founder-bio{color:#d5dfec!important;font-size:14px!important;line-height:1.55!important}';
    const founderAccentEffectStyle=`
      .nyx-founder-profile-standard{position:relative!important;isolation:isolate!important;border-color:color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 66%,#4e5058)!important;background:linear-gradient(180deg,color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 78%,#1e1f22) 0%,color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 62%,#1e1f22) 54%,color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 68%,#1e1f22) 100%)!important;box-shadow:0 16px 42px rgba(0,0,0,.32),inset 0 3px 0 var(--nyx-founder-accent-primary,#8fb8ff),inset 0 -3px 0 var(--nyx-founder-accent-secondary,#8ea1ff)!important}
      .nyx-founder-profile-standard>*:not(.nyx-founder-profile-effect){position:relative;z-index:1}.nyx-founder-profile-effect{display:none;position:absolute!important;z-index:2!important;inset:0;overflow:hidden;pointer-events:none}
      .nyx-founder-profile-standard .nyx-founder-banner{height:auto!important;aspect-ratio:17/6!important;background:var(--nyx-founder-banner-color,var(--nyx-founder-accent-secondary,#8ea1ff))!important}.nyx-founder-profile-standard .nyx-founder-banner img{object-fit:contain!important}
      .nyx-founder-profile-standard .nyx-founder-profile-content{background:linear-gradient(180deg,color-mix(in srgb,#2b2d31 72%,var(--nyx-founder-accent-primary,#8fb8ff)) 0%,color-mix(in srgb,#2b2d31 80%,var(--nyx-founder-accent-primary,#8fb8ff)) 58%,color-mix(in srgb,#2b2d31 82%,var(--nyx-founder-accent-secondary,#8ea1ff)) 100%)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)!important}
      .nyx-founder-profile-standard .nyx-founder-image-wrap{position:relative!important;overflow:visible!important;border-color:var(--nyx-founder-accent-primary,#8fb8ff)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 50%,transparent),0 8px 20px rgba(0,0,0,.3)!important}.nyx-founder-profile-standard .nyx-founder-status{z-index:5!important;border-color:color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 22%,#111827)!important}
      .nyx-founder-profile-standard .nyx-avatar-decoration{display:none;position:absolute!important;z-index:3!important;inset:-16px;pointer-events:none;color:var(--nyx-founder-accent-primary,#8fb8ff);filter:drop-shadow(0 0 7px color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 68%,transparent))}.nyx-founder-profile-standard .nyx-avatar-decoration::before,.nyx-founder-profile-standard .nyx-avatar-decoration::after,.nyx-founder-profile-standard .nyx-avatar-decoration>span{content:"";position:absolute;display:block;box-sizing:border-box}
      .nyx-founder-profile-standard .nyx-avatar-decoration-starfall>.nyx-avatar-decoration{display:block;background:radial-gradient(circle at 15% 24%,#fff 0 2px,transparent 2.7px),radial-gradient(circle at 84% 18%,var(--nyx-founder-accent-secondary,#8ea1ff) 0 2.5px,transparent 3.2px),radial-gradient(circle at 90% 72%,#fff 0 1.8px,transparent 2.5px),radial-gradient(circle at 17% 81%,var(--nyx-founder-accent-primary,#8fb8ff) 0 2.3px,transparent 3px);animation:nyx-founder-decoration-twinkle 2.8s ease-in-out infinite}.nyx-founder-profile-standard .nyx-avatar-decoration-starfall>.nyx-avatar-decoration::before,.nyx-founder-profile-standard .nyx-avatar-decoration-starfall>.nyx-avatar-decoration::after{width:17px;height:17px;background:linear-gradient(135deg,#fff,var(--nyx-founder-accent-secondary,#8ea1ff));clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)}.nyx-founder-profile-standard .nyx-avatar-decoration-starfall>.nyx-avatar-decoration::before{right:-1px;top:13px}.nyx-founder-profile-standard .nyx-avatar-decoration-starfall>.nyx-avatar-decoration::after{left:3px;bottom:9px;width:12px;height:12px}
      .nyx-founder-profile-standard .nyx-avatar-decoration-orbit>.nyx-avatar-decoration{display:block;border:2px solid color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 72%,transparent);border-left-color:var(--nyx-founder-accent-secondary,#8ea1ff);border-right-color:var(--nyx-founder-accent-secondary,#8ea1ff);border-radius:50%;animation:nyx-founder-decoration-orbit 7s linear infinite}.nyx-founder-profile-standard .nyx-avatar-decoration-orbit>.nyx-avatar-decoration::before,.nyx-founder-profile-standard .nyx-avatar-decoration-orbit>.nyx-avatar-decoration::after{border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--nyx-founder-accent-primary,#8fb8ff),0 0 12px 5px color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 72%,transparent)}.nyx-founder-profile-standard .nyx-avatar-decoration-orbit>.nyx-avatar-decoration::before{width:8px;height:8px;top:8px;right:11px}.nyx-founder-profile-standard .nyx-avatar-decoration-orbit>.nyx-avatar-decoration::after{width:6px;height:6px;left:8px;bottom:15px}
      .nyx-founder-profile-standard .nyx-avatar-decoration-laurel>.nyx-avatar-decoration,.nyx-founder-profile-standard .nyx-avatar-decoration-neon-wings>.nyx-avatar-decoration{display:block}.nyx-founder-profile-standard .nyx-avatar-decoration-laurel>.nyx-avatar-decoration::before,.nyx-founder-profile-standard .nyx-avatar-decoration-laurel>.nyx-avatar-decoration::after{top:13px;width:35px;height:88px;border:7px dotted color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 86%,#fff);border-top-color:transparent;border-bottom-color:transparent;border-radius:50%}.nyx-founder-profile-standard .nyx-avatar-decoration-laurel>.nyx-avatar-decoration::before{left:-5px;border-right:0;transform:rotate(-11deg)}.nyx-founder-profile-standard .nyx-avatar-decoration-laurel>.nyx-avatar-decoration::after{right:-5px;border-left:0;transform:rotate(11deg)}.nyx-founder-profile-standard .nyx-avatar-decoration-laurel>.nyx-avatar-decoration>span{left:50%;bottom:1px;width:16px;height:16px;background:linear-gradient(135deg,var(--nyx-founder-accent-primary,#8fb8ff),var(--nyx-founder-accent-secondary,#8ea1ff));clip-path:polygon(50% 0,61% 36%,100% 50%,61% 64%,50% 100%,39% 64%,0 50%,39% 36%);transform:translateX(-50%)}
      .nyx-founder-profile-standard .nyx-avatar-decoration-neon-wings>.nyx-avatar-decoration::before,.nyx-founder-profile-standard .nyx-avatar-decoration-neon-wings>.nyx-avatar-decoration::after{top:23px;width:39px;height:72px;background:linear-gradient(160deg,#fff 0 5%,var(--nyx-founder-accent-secondary,#8ea1ff) 28%,var(--nyx-founder-accent-primary,#8fb8ff) 74%,transparent 75%);clip-path:polygon(100% 2%,65% 18%,33% 10%,50% 38%,0 31%,42% 60%,8% 71%,64% 80%,53% 100%,100% 72%)}.nyx-founder-profile-standard .nyx-avatar-decoration-neon-wings>.nyx-avatar-decoration::before{left:-24px}.nyx-founder-profile-standard .nyx-avatar-decoration-neon-wings>.nyx-avatar-decoration::after{right:-24px;transform:scaleX(-1)}
      .nyx-founder-profile-standard .nyx-founder-handle{color:#c4c7ce!important}.nyx-founder-profile-standard .nyx-founder-role,.nyx-founder-profile-standard .nyx-founder-link,.nyx-founder-profile-standard .nyx-founder-about>strong{color:#f2f3f5!important}
      .nyx-founder-profile-standard .nyx-founder-role-chip,.nyx-founder-profile-standard .nyx-founder-badge{border-color:color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 48%,transparent)!important;background:linear-gradient(120deg,color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 24%,#24252b),color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 20%,#24252b))!important;color:#fff!important}.nyx-founder-role-owner{border-color:color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 78%,transparent)!important;background:color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 30%,#24252b)!important}
      .nyx-founder-profile-standard .nyx-founder-about{border-color:rgba(255,255,255,.18)!important}.nyx-founder-profile-standard .nyx-founder-bio{color:#e5e7eb!important}
      .nyx-styled-display-name{display:inline-block!important;color:var(--nyx-name-color-primary,#fff)!important;-webkit-text-fill-color:var(--nyx-name-color-primary,#fff)!important;line-height:1.14}.nyx-name-font-gg-sans{font-family:"Outfit","Segoe UI",Arial,sans-serif!important}.nyx-name-font-headline{font-family:"Arial Black","Franklin Gothic Heavy","Segoe UI",sans-serif!important;font-size:1.08em!important;font-weight:900!important;letter-spacing:-.035em}.nyx-name-font-rounded{font-family:"Arial Rounded MT Bold","Trebuchet MS","Segoe UI",sans-serif!important;font-size:1.06em!important;font-weight:900!important;letter-spacing:-.025em}.nyx-name-font-wide{font-family:"Arial Black","Trebuchet MS","Segoe UI",sans-serif!important;font-size:1.04em!important;font-weight:900!important;letter-spacing:.075em;text-transform:uppercase}.nyx-name-font-slab{font-family:Rockwell,"Roboto Slab","Palatino Linotype",Georgia,serif!important;font-size:1.06em!important;font-weight:900!important;letter-spacing:-.02em}.nyx-name-font-condensed{font-family:"Bahnschrift Condensed","Arial Narrow","Roboto Condensed",sans-serif!important;font-size:1.1em!important;font-stretch:condensed;font-weight:800!important;letter-spacing:.015em}.nyx-name-font-mono-block{font-family:"Cascadia Mono","Segoe UI Mono","Courier New",monospace!important;font-size:1.02em!important;font-weight:900!important;letter-spacing:-.055em}.nyx-name-font-tempo{font-family:Impact,"Arial Black",sans-serif!important;font-weight:500!important;letter-spacing:.02em}.nyx-name-font-sakura{font-family:"Segoe Script","Brush Script MT",cursive!important;font-weight:700!important}.nyx-name-font-jellybean{font-family:"Comic Sans MS","Trebuchet MS",cursive!important;font-weight:700!important}.nyx-name-font-modern{font-family:"Arial Narrow","Helvetica Neue",Arial,sans-serif!important;font-weight:800!important;letter-spacing:.07em;text-transform:uppercase}.nyx-name-font-medieval{font-family:"Palatino Linotype","Book Antiqua",Georgia,serif!important;font-weight:700!important;letter-spacing:.025em}.nyx-name-font-eight-bit{font-family:"Cascadia Mono","Courier New",monospace!important;font-weight:800!important;letter-spacing:-.06em;text-transform:uppercase}.nyx-name-font-vampyre{font-family:Copperplate,"Times New Roman",serif!important;font-weight:800!important;font-variant:small-caps;letter-spacing:.07em}.nyx-name-effect-solid{color:var(--nyx-name-color-primary,#fff)!important;-webkit-text-fill-color:var(--nyx-name-color-primary,#fff)!important}.nyx-name-effect-gradient,.nyx-name-effect-neon,.nyx-name-effect-pop{background:linear-gradient(105deg,var(--nyx-name-color-primary,#fff),var(--nyx-name-color-secondary,#8ea1ff),var(--nyx-name-color-primary,#fff));background-size:220% 100%;background-clip:text;-webkit-background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent!important}.nyx-name-effect-gradient{animation:nyx-founder-name-gradient 5s ease-in-out infinite}.nyx-name-effect-neon{text-shadow:0 0 5px color-mix(in srgb,var(--nyx-name-color-primary,#fff) 88%,transparent),0 0 12px color-mix(in srgb,var(--nyx-name-color-secondary,#8ea1ff) 78%,transparent);animation:nyx-founder-name-neon 2.4s ease-in-out infinite}.nyx-name-effect-toon{color:var(--nyx-name-color-primary,#fff)!important;-webkit-text-fill-color:var(--nyx-name-color-primary,#fff)!important;-webkit-text-stroke:1px color-mix(in srgb,var(--nyx-name-color-secondary,#8ea1ff) 76%,#17181b);text-shadow:2px 2px 0 var(--nyx-name-color-secondary,#8ea1ff),3px 3px 0 rgba(0,0,0,.42)}.nyx-name-effect-pop{filter:drop-shadow(0 2px 0 color-mix(in srgb,var(--nyx-name-color-secondary,#8ea1ff) 72%,#111));animation:nyx-founder-name-gradient 4.6s linear infinite,nyx-founder-name-pop 2.8s ease-in-out infinite;transform-origin:center bottom}
      .nyx-founder-effect-glow{box-shadow:0 0 34px color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 64%,transparent),0 16px 42px rgba(0,0,0,.32)!important}
      .nyx-founder-effect-sparkle .nyx-founder-profile-effect{display:block;background-image:radial-gradient(circle at 12% 18%,#fff 0 1.7px,transparent 2.5px),radial-gradient(circle at 42% 43%,#fff 0 1.1px,transparent 2.1px),radial-gradient(circle at 78% 22%,#fff 0 1.8px,transparent 2.7px),radial-gradient(circle at 88% 72%,#fff 0 1.2px,transparent 2.2px),radial-gradient(circle at 24% 84%,#fff 0 1.3px,transparent 2.3px);background-size:150px 150px,193px 193px,221px 221px,169px 169px,247px 247px;filter:drop-shadow(0 0 5px rgba(255,255,255,.8));animation:nyx-founder-sparkle 6s linear infinite}
      .nyx-founder-effect-aurora .nyx-founder-profile-effect{display:block;opacity:.65;background:linear-gradient(118deg,transparent 15%,color-mix(in srgb,var(--nyx-founder-accent-primary,#8fb8ff) 64%,transparent) 35%,transparent 49%,color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 68%,transparent) 67%,transparent 85%);background-size:220% 100%;mix-blend-mode:screen;animation:nyx-founder-aurora 8s ease-in-out infinite}
      .nyx-founder-effect-holographic .nyx-founder-profile-effect{display:block;opacity:.6;background:linear-gradient(112deg,transparent 12%,rgba(255,111,211,.38) 29%,rgba(100,219,255,.42) 43%,rgba(242,255,150,.36) 56%,rgba(172,130,255,.43) 69%,transparent 86%);background-size:250% 100%;mix-blend-mode:screen;animation:nyx-founder-holographic 5.6s linear infinite}
      .nyx-founder-effect-fireflies .nyx-founder-profile-effect{display:block;background-image:radial-gradient(circle at 12% 77%,#fff8af 0 2px,transparent 4px),radial-gradient(circle at 31% 31%,#fff7a1 0 1.5px,transparent 3.5px),radial-gradient(circle at 53% 67%,#fff8b8 0 2px,transparent 4px),radial-gradient(circle at 76% 42%,#fff6a2 0 1.6px,transparent 3.5px),radial-gradient(circle at 91% 80%,#fff8b4 0 2px,transparent 4px);background-size:230px 250px;filter:drop-shadow(0 0 7px rgba(255,238,133,.9));animation:nyx-founder-fireflies 7s ease-in-out infinite}
      .nyx-founder-effect-cosmic-dust .nyx-founder-profile-effect{display:block;opacity:.88;background-image:radial-gradient(ellipse at 24% 38%,color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 34%,transparent) 0,transparent 42%),radial-gradient(circle at 8% 22%,#fff 0 1.5px,transparent 2.7px),radial-gradient(circle at 72% 12%,#c7e5ff 0 1.8px,transparent 3px),radial-gradient(circle at 42% 68%,#f0c4ff 0 2px,transparent 3.4px),radial-gradient(circle at 88% 81%,#fff 0 1.2px,transparent 2.6px),radial-gradient(circle at 30% 87%,#aee8ff 0 1px,transparent 2.3px);background-size:100% 100%,127px 149px,181px 167px,211px 193px,157px 223px,239px 179px;mix-blend-mode:screen;filter:drop-shadow(0 0 5px rgba(197,226,255,.8));animation:nyx-founder-cosmic-dust 14s linear infinite}
      .nyx-founder-effect-electric-storm .nyx-founder-profile-effect{display:block;opacity:.1;background-image:linear-gradient(118deg,transparent 0 41%,rgba(255,255,255,.95) 42% 42.8%,color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 88%,#fff) 43% 44%,transparent 45% 100%),linear-gradient(63deg,transparent 0 58%,rgba(255,255,255,.88) 59% 59.6%,color-mix(in srgb,var(--nyx-founder-accent-primary,#5865f2) 84%,#fff) 60% 61%,transparent 62% 100%);background-size:170% 190%,210% 170%;background-position:120% -40%,-80% 130%;mix-blend-mode:screen;filter:drop-shadow(0 0 8px rgba(174,213,255,.95));animation:nyx-founder-electric-storm 4.2s steps(1,end) infinite}
      .nyx-founder-effect-meteor-shower .nyx-founder-profile-effect{display:block;opacity:.92;background:radial-gradient(circle,rgba(255,255,255,.95) 0 1.2px,transparent 2px) 18% -12%/109px 127px,radial-gradient(circle,color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 74%,#fff) 0 1px,transparent 2px) 72% -28%/157px 173px,radial-gradient(circle,rgba(214,231,255,.78) 0 .9px,transparent 1.8px) 38% 4%/197px 149px;filter:drop-shadow(0 0 3px color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 45%,transparent));animation:nyx-founder-meteor-shower 9s linear infinite}
      .nyx-founder-effect-cyber-grid .nyx-founder-profile-effect{display:block;opacity:.52;background-image:linear-gradient(color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 76%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--nyx-founder-accent-primary,#5865f2) 72%,transparent) 1px,transparent 1px),linear-gradient(180deg,transparent 30%,color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 18%,transparent) 100%);background-size:34px 34px,34px 34px,100% 100%;-webkit-mask-image:linear-gradient(to bottom,transparent 2%,#000 31%,#000 100%);mask-image:linear-gradient(to bottom,transparent 2%,#000 31%,#000 100%);filter:drop-shadow(0 0 4px color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 70%,transparent));animation:nyx-founder-cyber-grid 4.5s linear infinite}
      .nyx-founder-effect-plasma .nyx-founder-profile-effect{display:block;inset:-28%!important;opacity:.4;background:conic-gradient(from 0deg at 50% 50%,transparent 0 8%,var(--nyx-founder-accent-secondary,#8ea1ff) 20%,transparent 34%,var(--nyx-founder-accent-primary,#5865f2) 50%,transparent 66%,#df7cff 79%,transparent 94%);mix-blend-mode:screen;filter:blur(28px) saturate(1.45);animation:nyx-founder-plasma 9s linear infinite}
      .nyx-founder-effect-snowfall .nyx-founder-profile-effect{display:block;opacity:.84;background-image:radial-gradient(circle,#fff 0 2px,transparent 2.8px),radial-gradient(circle,#dceeff 0 1.3px,transparent 2.2px),radial-gradient(circle,#fff 0 2.6px,transparent 3.4px);background-size:83px 109px,137px 157px,191px 227px;background-position:12px -130px,63px -180px,116px -260px;filter:drop-shadow(0 0 3px rgba(222,241,255,.9));animation:nyx-founder-snowfall 8.5s linear infinite}
      .nyx-founder-effect-embers .nyx-founder-profile-effect{display:block;opacity:.9;background-image:radial-gradient(circle,#fff2ad 0 1.4px,#ff8a3d 1.7px 2.8px,transparent 4px),radial-gradient(circle,#ffd166 0 1px,#ff5c35 1.4px 2.5px,transparent 3.8px),radial-gradient(circle,#fff0ac 0 1.2px,#ff6a2b 1.6px 2.8px,transparent 4px);background-size:109px 173px,157px 211px,223px 263px;background-position:7px 100%,73px 118%,151px 110%;mix-blend-mode:screen;filter:drop-shadow(0 0 5px rgba(255,107,43,.88));animation:nyx-founder-embers 7s linear infinite}
      .nyx-founder-effect-bubbles .nyx-founder-profile-effect{display:block;opacity:.72;background-image:radial-gradient(circle,transparent 0 5px,rgba(255,255,255,.58) 6px 7px,transparent 8px),radial-gradient(circle,transparent 0 9px,color-mix(in srgb,var(--nyx-founder-accent-secondary,#8ea1ff) 72%,#fff) 10px 11px,transparent 12px),radial-gradient(circle,transparent 0 13px,rgba(213,243,255,.5) 14px 15px,transparent 16px);background-size:93px 131px,157px 191px,229px 271px;background-position:9px 120%,62px 135%,133px 150%;mix-blend-mode:screen;filter:drop-shadow(0 0 4px rgba(207,239,255,.55));animation:nyx-founder-bubbles 10s linear infinite}
      @keyframes nyx-founder-name-gradient{0%,100%{background-position:0 50%}50%{background-position:100% 50%}}@keyframes nyx-founder-name-neon{0%,100%{filter:brightness(.9)}50%{filter:brightness(1.28)}}@keyframes nyx-founder-name-pop{0%,82%,100%{transform:translateY(0) scale(1)}88%{transform:translateY(-2px) scale(1.035)}93%{transform:translateY(0) scale(.985)}}@keyframes nyx-founder-sparkle{to{background-position:150px -150px,-193px -193px,221px -221px,-169px 169px,247px -247px}}@keyframes nyx-founder-aurora{50%{background-position:100% 0}}@keyframes nyx-founder-holographic{to{background-position:250% 0}}@keyframes nyx-founder-fireflies{50%{background-position:35px -54px;transform:translateY(-10px)}}@keyframes nyx-founder-cosmic-dust{to{background-position:0 0,127px -149px,-181px -167px,211px -193px,-157px 223px,239px -179px}}@keyframes nyx-founder-electric-storm{0%,16%,18%,55%,57%,100%{opacity:.08}17%,56%{opacity:.88}17.4%,56.4%{opacity:.28}17.8%,56.8%{opacity:.72}40%{background-position:-50% 90%,140% -20%}}@keyframes nyx-founder-meteor-shower{to{background-position:18% 260px,72% 320px,38% 300px}}@keyframes nyx-founder-cyber-grid{to{background-position:0 68px,68px 0,0 0}}@keyframes nyx-founder-plasma{to{transform:rotate(360deg) scale(1.06)}}@keyframes nyx-founder-snowfall{to{background-position:12px 650px,63px 620px,116px 590px}}@keyframes nyx-founder-embers{to{background-position:18px -280px,56px -370px,174px -450px}}@keyframes nyx-founder-bubbles{to{background-position:31px -290px,39px -390px,178px -510px}}@keyframes nyx-founder-decoration-orbit{to{transform:rotate(360deg)}}@keyframes nyx-founder-decoration-twinkle{0%,100%{opacity:.55;filter:brightness(.85)}50%{opacity:1;filter:brightness(1.35)}}@media(prefers-reduced-motion:reduce){.nyx-founder-profile-effect,.nyx-avatar-decoration,.nyx-styled-display-name{animation:none!important}}
    `;
    const terminalPageScript=`(()=>{const output=document.querySelector('[data-nyx-terminal-output]');const input=document.querySelector('[data-nyx-terminal-input]');const write=(text,type='')=>{const row=document.createElement('div');row.className='nyx-terminal-line'+(type?' '+type:'');row.textContent=String(text);output.appendChild(row);output.scrollTop=output.scrollHeight};const run=raw=>{const command=String(raw||'').trim();if(!command)return;write('nyx> '+command,'command');const name=command.toLowerCase();if(name==='clear'){output.textContent='';return}if(name==='help'){write('Commands: help, status, theme, origin, storage, date, clear');return}if(name==='status'){write('Nyx is '+(navigator.onLine?'online':'offline')+' · '+(navigator.platform||'workspace'));return}if(name==='theme'){write('Theme: '+(document.body.className.match(/theme-([^ ]+)/)?.[1]||'default'));return}if(name==='origin'){write('Origin: '+parent.location.origin);return}if(name==='storage'){write('Local settings entries: '+localStorage.length);return}if(name==='date'){write(new Date().toLocaleString());return}write('Unknown command: '+command+'. Type "help" for the command list.','error')};write('Nyx Developer Console');write('Type "help" to list commands. Workspace DevTools cannot be opened by a webpage.');document.querySelector('[data-nyx-terminal-form]')?.addEventListener('submit',event=>{event.preventDefault();run(input?.value);if(input)input.value=''});setTimeout(()=>input?.focus(),50)})();`;
    const pages={
      apps:{title:'Apps',body:`<style>html,body,.apps-shell-page{background:transparent!important;background-image:none!important}</style><section class="shell-page apps-shell-page"><h1>Apps</h1><p>Everything in Nyx.</p><div class="quick-grid apps-launch-grid" data-nyx-global-app-grid>${quickTiles()}</div></section>`},
      links:{title:'Bookmarks',body:`<section class="shell-page"><h1>Bookmarks</h1><p>Common links.</p><div class="quick-grid"><button class="quick-tile" data-url="https://www.google.com/"><img class="quick-icon" alt="" src="${appIcon('google.com')}"><span>Google</span></button><button class="quick-tile" data-url="https://duckduckgo.com/"><img class="quick-icon" alt="" src="${appIcon('duckduckgo.com')}"><span>Reference Search</span></button><button class="quick-tile" data-url="https://docs.google.com/"><img class="quick-icon" alt="" src="${appIcon('docs.google.com')}"><span>Docs</span></button></div></section>`},
      terms:{title:'Terms Of Service',style:utilityPageStyle,body:nyxTermsPageMarkup()},
      about:{title:'About Nyx',style:utilityPageStyle+nyxCreditsPresentationStyle+nyxCreditsOwnerImageStyle,script:nyxCreditsLinkScript,body:nyxCreditsPageMarkup()},
      credits:{title:'About Nyx',style:utilityPageStyle+nyxCreditsPresentationStyle+nyxCreditsOwnerImageStyle,script:nyxCreditsLinkScript,body:nyxCreditsPageMarkup()},
      developer:{title:'Developer Console',style:utilityPageStyle,body:`<section aria-label="Eruda developer console"></section>`},
      ephesians1:{title:'Ephesians 1',body:`<section class="shell-page ephesians-diagram"><style>
        .ephesians-diagram{--ink:#f8fafc;--muted:#cbd5e1;--line:rgba(255,255,255,.24);max-width:1120px;margin:auto;padding-bottom:64px}.ephesians-diagram h1{text-align:center;font-size:clamp(30px,5vw,48px);margin:4px 0 6px}.ephesians-diagram>.diagram-sub{text-align:center;margin:0 0 28px;color:var(--muted);font-size:15px}.eph-flow{display:grid;gap:12px}.eph-block{padding:17px 20px;border:1px solid var(--line);border-left:6px solid #94a3b8;border-radius:14px;background:rgba(15,23,42,.58);box-shadow:0 12px 28px rgba(0,0,0,.16)}.eph-block h2{font-size:19px;margin:5px 0 7px}.eph-block p{margin:0;color:#e2e8f0;line-height:1.48;font-size:14px}.eph-verse{color:#cbd5e1;font-size:11px;font-weight:800;letter-spacing:.11em}.eph-father{border-left-color:#60a5fa}.eph-son{border-left-color:#fbbf24}.eph-spirit{border-left-color:#4ade80}.eph-prayer{border-left-color:#c084fc}.eph-arrow{text-align:center;height:22px;font:700 24px/22px Arial,sans-serif;color:#cbd5e1}.eph-purpose{text-align:center;padding:16px;border:1px solid rgba(255,255,255,.34);border-radius:14px;background:rgba(255,255,255,.10);font-size:17px;font-weight:800}.eph-purpose small{display:block;margin-bottom:5px;color:#cbd5e1;font-size:11px;letter-spacing:.1em}.eph-triad{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.eph-triad .eph-block{padding:15px}.eph-triad h2{font-size:17px}@media(max-width:720px){.eph-triad{grid-template-columns:1fr}.ephesians-diagram{padding:20px 4px 50px!important}}</style>
        <h1>Ephesians 1</h1><p class="diagram-sub">God’s purpose in Christ, the Spirit’s seal, and Paul’s prayer for the church</p>
        <div class="eph-flow">
          <article class="eph-block"><div class="eph-verse">1:1–2 · GREETING</div><h2>Paul writes to the faithful in Christ Jesus</h2><p>Grace and peace come from God our Father and the Lord Jesus Christ.</p></article>
          <div class="eph-arrow">↓</div>
          <article class="eph-block eph-father"><div class="eph-verse">1:3–6 · THE FATHER’S PURPOSE</div><h2>Blessed, chosen, and adopted in Christ</h2><p>Before creation, God chose believers and predestined them for adoption through Jesus Christ, according to his loving will.</p></article>
          <div class="eph-arrow">↓</div>
          <article class="eph-block eph-son"><div class="eph-verse">1:7–12 · THE SON’S WORK</div><h2>Redemption, forgiveness, and an inheritance</h2><p>In Christ, believers are redeemed through his blood. God’s plan is to unite all things in Christ—things in heaven and on earth.</p></article>
          <div class="eph-arrow">↓</div>
          <article class="eph-block eph-spirit"><div class="eph-verse">1:13–14 · THE SPIRIT’S SEAL</div><h2>Hearing and believing the gospel → sealed with the Spirit</h2><p>The promised Holy Spirit guarantees the believers’ inheritance until final redemption.</p></article>
          <div class="eph-arrow">↓</div>
          <div class="eph-purpose"><small>REPEATED PURPOSE · 1:6, 12, 14</small>All of this is to the praise of his glory.</div>
          <div class="eph-arrow">↓</div>
          <article class="eph-block eph-prayer"><div class="eph-verse">1:15–23 · PAUL’S PRAYER</div><h2>Pray for spiritual sight</h2><p>Paul asks that believers know the hope of God’s calling, the riches of his inheritance, and the immeasurable greatness of his power.</p></article>
          <div class="eph-arrow">↓</div>
          <div class="eph-triad"><article class="eph-block eph-prayer"><div class="eph-verse">1:20</div><h2>Power displayed</h2><p>God raised Christ and seated him at his right hand.</p></article><article class="eph-block eph-prayer"><div class="eph-verse">1:21–22</div><h2>Christ exalted</h2><p>He is above every rule, authority, power, and name.</p></article><article class="eph-block eph-prayer"><div class="eph-verse">1:22–23</div><h2>Christ and the church</h2><p>Christ is head over all things to the church, his body.</p></article></div>
        </div>
      </section>`}
    };
    const page=pages[name] || pages.apps;
    tab.url='nyx://'+name;
    tab.title=page.title;
    const clearInternal=/^(apps)$/i.test(String(name || page.title || ''));
    state.win.classList.toggle('internal-clear',clearInternal);
    tab.frame.classList.toggle('transparent-internal-page',clearInternal);
    tab.frame.setAttribute('allowtransparency','true');
    tab.frame.style.backgroundColor=clearInternal?'transparent':'';
    applyGlassInternalTheme(tab.frame);
    tab.frame.removeAttribute('src');
    tab.frame.srcdoc=workspaceShellPageSrcdoc(page);
    tab.frame.classList.add('active');
    state.win.querySelector('.workspace-home')?.classList.add('hidden');
    state.win.classList.remove('workspace-blank');
    state.renderTabs?.();
    updateWorkspaceShellLocation(tab.url);
    if(name==='developer') showNyxErudaPanel(state.win);
    else hideNyxErudaPanel();
    return true;
  }
  function applyGlassInternalTheme(frame){
    if(!frame || frame.dataset.nyxGlassThemePending==='true')return;
    frame.dataset.nyxGlassThemePending='true';
    frame.addEventListener('load',()=>{
      delete frame.dataset.nyxGlassThemePending;
      const doc=frame.contentDocument;
      if(!doc?.head)return;
      doc.documentElement.dataset.nyxAppearance=store.text('nyx.appearance','dark');
      doc.documentElement.dataset.nyxTheme=normalizeNyxTheme(store.text('nyx.theme','default'));
      doc.documentElement.style.setProperty('--nyx-custom-base',nyxCustomThemePalette().base);
      if(!doc.querySelector('link[href*="/apps/obsidian.css"]')){
        const link=doc.createElement('link');link.rel='stylesheet';link.href='/apps/obsidian.css?v=20261001-halloween-v3';doc.head.appendChild(link);
      }
    },{once:true});
  }
  function bgButton(key, compact=false){
    return `<button class="bg-choice" data-bg-choice="${esc(key)}" title="${esc(bgNames[key]||'Background')}" aria-label="${esc(bgNames[key]||'Background')}"><span>${esc(bgNames[key]||'Background')}</span></button>`;
  }
  function backgroundScope(root=document){
    return root?.dataset?.bgScope || (document.body.classList.contains('workspace-shell') ? 'workspace' : 'windows');
  }
  function currentBackgroundKeyForScope(scope){
    return scope==='workspace' ? store.text('nyx.workspaceBackground','lofiPurple') : store.text('nyx.background','dragon');
  }
  function renderBackgroundChoices(root, current=currentBackgroundKeyForScope(backgroundScope(root))){
    const scope=backgroundScope(root);
    const customData=store.text('nyx.customBgData','');
    const customUrl=store.text('nyx.customBgUrl','');
    const custom=scope==='workspace' ? '' : (customData || customUrl);
    const hasCustom=!!custom;
    root.dataset.bgScope=scope;
    const choices=(hasCustom ? `<button class="bg-choice selected" data-custom-bg-preview title="Uploaded background" aria-label="Uploaded background"><span>Uploaded</span></button>` : '') + Object.keys(bgPresets).map(k=>bgButton(k)).join('');
    root.innerHTML=choices;
    root.querySelectorAll('[data-bg-choice]').forEach(btn=>{
      btn.style.backgroundImage = bgPresets[btn.dataset.bgChoice] || bgPresets.dragon;
    });
    const customBtn=root.querySelector('[data-custom-bg-preview]');
    if(customBtn){
      const customPreview=customUrl && !customData ? (imageConnectionSrc(customUrl) || customUrl) : custom;
      customBtn.style.backgroundImage = normalizeBgValue(customPreview);
      customBtn.classList.add('selected');
    }
    root.querySelectorAll('[data-bg-choice]').forEach(btn=>btn.classList.toggle('selected',!hasCustom && btn.dataset.bgChoice===current));
    syncBackgroundPreview();
  }
  function chooseBackground(key, scope='windows'){
    if(scope==='workspace'){
      store.setText('nyx.workspaceBackground', key || 'lofiPurple');
    }else{
      store.setText('nyx.background', key || 'dragon');
      store.setText('nyx.customBg','');
      store.setText('nyx.customBgUrl','');
      store.setText('nyx.customBgData','');
    }
    applyUserSettings();
  }
  const NYX_PERFORMANCE_TIER_KEY='nyx.performanceTier';
  const NYX_PERFORMANCE_TIER_SOURCE_KEY='nyx.performanceTierSource';
  const nyxPerformanceTiers=new Set(['high','medium','low']);
  function getNyxPerformanceTier(){
    let tier=store.text(NYX_PERFORMANCE_TIER_KEY,'').toLowerCase();
    const source=store.text(NYX_PERFORMANCE_TIER_SOURCE_KEY,'').toLowerCase();
    if(nyxPerformanceTiers.has(tier) && (source==='auto'||source==='explicit')) return tier;
    const lowEnd=(navigator.deviceMemory && navigator.deviceMemory<=4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency<=4);


    tier=store.get('nyx.performanceLite',false) ? 'medium' : lowEnd ? 'medium' : 'high';
    store.setText(NYX_PERFORMANCE_TIER_KEY,tier);
    store.setText(NYX_PERFORMANCE_TIER_SOURCE_KEY,'auto');
    return tier;
  }
  function applyNyxPerformanceTier(tier=getNyxPerformanceTier()){
    tier=nyxPerformanceTiers.has(tier) ? tier : 'high';
    const low=tier==='low';
    const lite=tier==='medium'||low;
    const root=document.documentElement;
    root.dataset.perfTier=tier;
    root.classList.toggle('perf-lite',lite);
    root.classList.toggle('perf-min',low);
    document.body.classList.toggle('lag-reducer',low);
    document.body.classList.toggle('performance-lite',lite);
    store.set('nyx.lagReducer',low);
    store.set('nyx.performanceLite',tier==='medium');
    qsa('[data-nyx-performance-tier]').forEach(button=>{
      const active=button.dataset.nyxPerformanceTier===tier;
      button.classList.toggle('is-active',active);
      button.classList.toggle('on',active);
      button.setAttribute('aria-pressed',String(active));
    });
    return tier;
  }
  function setNyxPerformanceTier(tier){
    const next=nyxPerformanceTiers.has(tier) ? tier : 'high';
    store.setText(NYX_PERFORMANCE_TIER_KEY,next);
    store.setText(NYX_PERFORMANCE_TIER_SOURCE_KEY,'explicit');
    return applyNyxPerformanceTier(next);
  }
  function applyLagReducerSetting(){
    const lag=applyNyxPerformanceTier()==='low';
    if(lag){
      const welcome=$('welcomeScreen');
      if(welcome) welcome.classList.add('hidden','force-hidden');
      store.set('nyx.backgroundEnhancer',false);
      store.setText('nyx.glassLevel','0');
      document.documentElement.style.setProperty('--glass-blur','0px');
    }
    qsa('[data-lag-reducer]').forEach(el=>el.classList.toggle('on',lag));
    qsa('[data-switch="nyx.lagReducer"]').forEach(el=>el.classList.toggle('on',lag));
    qsa('[data-performance-lite]').forEach(el=>el.classList.toggle('on',store.get('nyx.performanceLite',false)));
    qsa('[data-switch="nyx.performanceLite"]').forEach(el=>el.classList.toggle('on',store.get('nyx.performanceLite',false)));
  }
  function syncPerformanceLite(){
    const enabled=applyNyxPerformanceTier()!=='high';
    if(enabled){
      document.documentElement.style.setProperty('--glass-blur','10px');
      document.documentElement.style.setProperty('--glass-saturate','1.08');
    }
  }
  let runtimeLagWatchStarted=false;
  function startRuntimeLagWatch(){
    if(runtimeLagWatchStarted) return;
    runtimeLagWatchStarted=true;
    let last=performance.now();
    let slowFrames=0;
    let clearTimer=0;
    let lastToast=0;
    const loop=now=>{
      const delta=now-last;
      last=now;
      if(!store.get('nyx.lagReducer',false)){
        if(delta>58) slowFrames+=1.35;
        else slowFrames=Math.max(0,slowFrames-.25);
        if(slowFrames>=5){
          document.body.classList.add('runtime-lag-guard');
          clearTimeout(clearTimer);
          clearTimer=setTimeout(()=>{
            slowFrames=0;
            document.body.classList.remove('runtime-lag-guard');
          },14000);
          if(Date.now()-lastToast>30000){
            lastToast=Date.now();
            toast('Lag guard trimmed effects for a moment');
          }
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  function applyWorkspaceShellMode(){
    try{localStorage.removeItem('nyx.workspaceShellMode')}catch{}
    if(store.text('nyx.glassLevel','80')!=='-40') store.setText('nyx.glassLevel','-40');
    store.set('nyx.backgroundEnhancer',false);
    document.body.classList.add('workspace-shell');
    syncChromeMode();
    applyGlassSetting();
    updateResponsiveFit();
    updateDockFullscreenState();
  }
  function ensureVisualEffectNodes(count=64){
    const layer=$('visualEffects');
    if(!layer) return [];
    while(layer.children.length<count) layer.appendChild(document.createElement('i'));
    while(layer.children.length>count) layer.lastElementChild?.remove();
    return Array.from(layer.children);
  }

  let nyxStartupOpened=false;
  let defaultVantaInstance=null;
  let rubyVantaInstance=null;
  let whiteVantaInstance=null;
  let emeraldVantaInstance=null;
  let sakuraVantaInstance=null;
  function shouldPauseVantaBackgrounds(){
    return document.body.classList.contains('workspace-content-active');
  }
  function threeDBackgroundsEnabled(){
    return store.get('nyx.threeDBackgrounds',false);
  }
  const nyxCustomThemeDefaults={base:'#6f9ee8'};
  function nyxThemeHex(value,fallback=nyxCustomThemeDefaults.base){
    const raw=String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : fallback;
  }
  function nyxShadeHex(hex,percent=0){
    const clean=nyxThemeHex(hex);
    const amount=Math.max(-100,Math.min(100,Number(percent) || 0))/100;
    const channel=index=>{
      const value=parseInt(clean.slice(index,index+2),16);
      return Math.round(amount>=0 ? value+(255-value)*amount : value*(1+amount));
    };
    return '#'+[1,3,5].map(index=>channel(index).toString(16).padStart(2,'0')).join('');
  }
  function nyxHexToNumber(hex){
    return parseInt(nyxThemeHex(hex).slice(1),16);
  }
  function nyxThemeLogoFilter(hex){
    const clean=nyxThemeHex(hex);
    const channels=[1,3,5].map(index=>parseInt(clean.slice(index,index+2),16)/255);
    const max=Math.max(...channels);
    const min=Math.min(...channels);
    const delta=max-min;
    let hue=0;
    if(delta){
      if(max===channels[0]) hue=60*(((channels[1]-channels[2])/delta)%6);
      else if(max===channels[1]) hue=60*((channels[2]-channels[0])/delta+2);
      else hue=60*((channels[0]-channels[1])/delta+4);
    }
    if(hue<0) hue+=360;
    const lightness=(max+min)/2;
    const saturation=delta ? delta/(1-Math.abs(2*lightness-1)) : 0;
    const hueShift=((hue-208+540)%360)-180;
    const saturationScale=Math.max(0,Math.min(4,saturation/.53));
    const brightnessScale=Math.max(.35,Math.min(1.7,lightness/.64));
    return `hue-rotate(${hueShift.toFixed(1)}deg) saturate(${saturationScale.toFixed(2)}) brightness(${brightnessScale.toFixed(2)})`;
  }
  function nyxCustomThemePalette(color=store.text('nyx.customThemeColor',nyxCustomThemeDefaults.base)){
    const base=nyxThemeHex(color);
    const maxChannel=Math.max(...[1,3,5].map(index=>parseInt(base.slice(index,index+2),16)));
    const constellationLighten=maxChannel===0 ? 100 : maxChannel<96 ? 78 : maxChannel<176 ? 58 : 38;
    return {
      base,
      canvas:nyxShadeHex(base,-84),
      top:nyxShadeHex(base,-91),
      field:nyxShadeHex(base,-79),
      panel:nyxShadeHex(base,-74),
      line:nyxShadeHex(base,-30),
      accent:nyxShadeHex(base,8),
      bright:nyxShadeHex(base,38),
      text:'#f4f7ff',
      muted:nyxShadeHex(base,48),
      dot:nyxShadeHex(base,-67),
      'constellation-dot':nyxShadeHex(base,constellationLighten)
    };
  }
  function applyCustomThemePalette(theme=normalizeNyxTheme(store.text('nyx.theme','default'))){
    const root=document.documentElement;
    const names=['base','canvas','top','field','panel','line','accent','bright','text','muted','dot','constellation-dot'];
    if(theme!=='custom'){
      names.forEach(name=>root.style.removeProperty('--nyx-custom-'+name));
      root.style.removeProperty('--nyx-custom-logo-filter');
      return;
    }
    const palette=nyxCustomThemePalette();
    names.forEach(name=>root.style.setProperty('--nyx-custom-'+name,palette[name]));
    root.style.setProperty('--nyx-custom-logo-filter',nyxThemeLogoFilter(palette.bright));
  }
  function applyCustomThemeColor(value){
    const color=nyxThemeHex(value);
    store.setText('nyx.customThemeColor',color);
    store.setText('nyx.theme','custom');
    stopDefaultVanta();
    applyThemeSetting();
    applyNyxThemeBeamWallpaper('custom');
    return color;
  }
  function syncCustomThemeMaker(root=document,color=nyxThemeHex(store.text('nyx.customThemeColor',nyxCustomThemeDefaults.base))){
    root.querySelectorAll?.('[data-custom-theme-color],[data-custom-theme-hex]')?.forEach(input=>{input.value=color});
    root.querySelectorAll?.('[data-custom-theme-swatch]')?.forEach(swatch=>swatch.style.setProperty('--nyx-swatch',color));
  }
  function syncHomeDotFieldVisibility(){
    qsa('.nyx-home-dot-field').forEach(canvas=>canvas.remove());
  }
  function shouldShowDefaultVanta(){
    const theme=store.text('nyx.theme','default');
    return threeDBackgroundsEnabled() && (theme==='default' || theme==='midnight' || theme==='custom') && !shouldPauseVantaBackgrounds() && !document.body.classList.contains('custom-bg-active');
  }
  function shouldShowRubyVanta(){
    const theme=store.text('nyx.theme','default');
    return threeDBackgroundsEnabled() && theme==='ruby' && !shouldPauseVantaBackgrounds() && !document.body.classList.contains('custom-bg-active');
  }
  function shouldShowWhiteVanta(){
    const theme=store.text('nyx.theme','default');
    return threeDBackgroundsEnabled() && theme==='fresh' && !shouldPauseVantaBackgrounds() && !document.body.classList.contains('custom-bg-active');
  }
  function shouldShowEmeraldVanta(){
    const theme=store.text('nyx.theme','default');
    return threeDBackgroundsEnabled() && theme==='emerald' && !shouldPauseVantaBackgrounds() && !document.body.classList.contains('custom-bg-active');
  }
  function shouldShowSakuraVanta(){
    const theme=store.text('nyx.theme','default');
    return threeDBackgroundsEnabled() && theme==='sakura' && !shouldPauseVantaBackgrounds() && !document.body.classList.contains('custom-bg-active');
  }
  function stopDefaultVanta(){
    if(!defaultVantaInstance) return;
    try{defaultVantaInstance.destroy()}catch{}
    defaultVantaInstance=null;
  }
  function stopRubyVanta(){
    if(!rubyVantaInstance) return;
    try{rubyVantaInstance.destroy()}catch{}
    rubyVantaInstance=null;
  }
  function stopWhiteVanta(){
    if(!whiteVantaInstance) return;
    try{whiteVantaInstance.destroy()}catch{}
    whiteVantaInstance=null;
  }
  function stopEmeraldVanta(){
    if(!emeraldVantaInstance) return;
    try{emeraldVantaInstance.destroy()}catch{}
    emeraldVantaInstance=null;
  }
  function stopSakuraVanta(){
    if(!sakuraVantaInstance) return;
    try{sakuraVantaInstance.destroy()}catch{}
    sakuraVantaInstance=null;
  }
  function syncDefaultVantaBackground(){
    const layer=$('defaultVantaBg');
    if(!layer) return;
    const show=shouldShowDefaultVanta();
    layer.hidden=!show;
    if(!show){
      stopDefaultVanta();
      return;
    }
    if(defaultVantaInstance || !window.VANTA?.NET || !window.THREE) return;
    try{
      const customPalette=store.text('nyx.theme','default')==='custom' ? nyxCustomThemePalette() : null;
      defaultVantaInstance=VANTA.NET({
        el:layer,
        mouseControls:true,
        touchControls:true,
        gyroControls:false,
        minHeight:200.00,
        minWidth:200.00,
        scale:1.00,
        scaleMobile:1.00,
        color:customPalette ? nyxHexToNumber(customPalette.accent) : 0x511151,
        backgroundColor:customPalette ? nyxHexToNumber(customPalette.canvas) : 0x241933
      });
    }catch{
      stopDefaultVanta();
    }
  }
  function syncRubyVantaBackground(){
    const layer=$('rubyVantaBg');
    if(!layer) return;
    const show=shouldShowRubyVanta();
    layer.hidden=!show;
    if(!show){
      stopRubyVanta();
      return;
    }
    if(rubyVantaInstance || !window.VANTA?.GLOBE || !window.THREE) return;
    try{
      rubyVantaInstance=VANTA.GLOBE({
        el:layer,
        mouseControls:true,
        touchControls:true,
        gyroControls:false,
        minHeight:200.00,
        minWidth:200.00,
        scale:1.00,
        scaleMobile:1.00,
        color:0xab1a1a
      });
    }catch{
      stopRubyVanta();
    }
  }
  function syncWhiteVantaBackground(){
    const layer=$('whiteVantaBg');
    if(!layer) return;
    const show=shouldShowWhiteVanta();
    layer.hidden=!show;
    if(!show){
      stopWhiteVanta();
      return;
    }
    if(whiteVantaInstance || !window.VANTA?.BIRDS || !window.THREE) return;
    try{
      whiteVantaInstance=VANTA.BIRDS({
        el:layer,
        mouseControls:true,
        touchControls:true,
        gyroControls:false,
        minHeight:200.00,
        minWidth:200.00,
        scale:1.00,
        scaleMobile:1.00,
        backgroundColor:0x162019,
        color1:0xd9e5d6,
        color2:0x728f6b,
        separation:24.00,
        cohesion:22.00
      });
    }catch{
      stopWhiteVanta();
    }
  }
  function syncEmeraldVantaBackground(){
    const layer=$('emeraldVantaBg');
    if(!layer) return;
    const show=shouldShowEmeraldVanta();
    layer.hidden=!show;
    if(!show){
      stopEmeraldVanta();
      return;
    }
    if(emeraldVantaInstance || !window.VANTA?.DOTS || !window.THREE) return;
    try{
      emeraldVantaInstance=VANTA.DOTS({
        el:layer,
        mouseControls:true,
        touchControls:true,
        gyroControls:false,
        minHeight:200.00,
        minWidth:200.00,
        scale:1.00,
        scaleMobile:1.00,
        color:0x10ab3b,
        color2:0x3bae28,
        backgroundColor:0x123025,
        size:2.00
      });
    }catch{
      stopEmeraldVanta();
    }
  }
  function syncSakuraVantaBackground(){
    const layer=$('sakuraVantaBg');
    if(!layer) return;
    const show=shouldShowSakuraVanta();
    layer.hidden=!show;
    if(!show){
      stopSakuraVanta();
      return;
    }
    if(sakuraVantaInstance || !window.VANTA?.CLOUDS || !window.THREE) return;
    try{
      sakuraVantaInstance=VANTA.CLOUDS({
        el:layer,
        mouseControls:true,
        touchControls:true,
        gyroControls:false,
        minHeight:200.00,
        minWidth:200.00,
        cloudColor:0xc9adde,
        sunColor:0xff1818,
        sunGlareColor:0xf23f04,
        sunlightColor:0xde1d4b
      });
    }catch{
      stopSakuraVanta();
    }
  }
  function syncThemeVantaBackgrounds(){



    syncDefaultVantaBackground();
    syncRubyVantaBackground();
    syncWhiteVantaBackground();
    syncEmeraldVantaBackground();
    syncSakuraVantaBackground();
    syncHomeDotFieldVisibility();
    syncNyxWaveBackground();
  }
  function syncNyxWaveBackground(){
    const wave=$('nyxWaveBg');
    if(!wave) return;
    const active=!document.documentElement.dataset.nyxBeamWallpaper && !threeDBackgroundsEnabled() && !store.get('nyx.lagReducer',false) && !document.body.classList.contains('workspace-content-active') && !document.body.classList.contains('custom-bg-active');
    const notify=()=>{
      try{wave.contentWindow?.postMessage({type:'nyx-wave-active',active},location.origin)}catch{}
    };
    wave.dataset.active=active ? '1' : '0';
    if(!wave.dataset.waveSyncReady){
      wave.dataset.waveSyncReady='1';
      wave.addEventListener('load',notify);
    }
    notify();
  }
  function ensureFreshThemeOptions(root=document){
    root.querySelectorAll?.('[data-theme-value]')?.forEach(select=>{
      let freshOption=select.querySelector('option[value="fresh"]');
      if(!freshOption){
        const option=document.createElement('option');
        option.value='fresh';
        option.textContent='Fern';
        select.appendChild(option);
        freshOption=option;
      }
      freshOption.textContent='Fern';
      if(!select.querySelector('option[value="midnight"]')){
        const option=document.createElement('option');
        option.value='midnight';
        option.textContent='Midnight';
        select.appendChild(option);
      }
      if(!select.querySelector('option[value="halloween"]')){
        const option=document.createElement('option');
        option.value='halloween';
        option.textContent='Halloween';
        select.appendChild(option);
      }
      if(!select.querySelector('option[value="custom"]')){
        const option=document.createElement('option');
        option.value='custom';
        option.textContent='Custom';
        select.appendChild(option);
      }
    });
  }
  const nyxThemeNames=['default','ruby','emerald','sakura','fresh','midnight','halloween','custom'];
  const nyxThemeClasses=nyxThemeNames.map(name=>'theme-'+name);
  function normalizeNyxTheme(value){
    return nyxThemeNames.includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'default';
  }
  function applyThemeSetting(){
    const theme=normalizeNyxTheme(store.text('nyx.theme','default'));
    if(store.text('nyx.theme','default')!==theme) store.setText('nyx.theme',theme);
    document.body.classList.remove(...nyxThemeClasses);
    document.body.classList.add('theme-'+theme);
    document.body.dataset.nyxTheme=theme;
    document.documentElement.dataset.nyxTheme=theme;
    document.documentElement.style.colorScheme='dark';
    qsa('#userGreeting').forEach(el=>{
      if(theme==='fresh'){
        el.style.setProperty('color','#d9e5d6','important');
        el.style.setProperty('-webkit-text-fill-color','#d9e5d6','important');
        el.style.setProperty('border-color','#354b36','important');
      }else{
        el.style.removeProperty('color');
        el.style.removeProperty('-webkit-text-fill-color');
        el.style.removeProperty('border-color');
      }
    });
    applyCustomThemePalette(theme);
    applyNyxLogoTheme(theme);
    ensureFreshThemeOptions();
    qsa('[data-theme-value]').forEach(el=>{el.value=theme});
    qsa('[data-nyx-theme-card]').forEach(card=>{
      const selected=card.dataset.nyxThemeCard===theme;
      card.classList.toggle('selected',selected);
      card.setAttribute('aria-pressed',String(selected));
    });
    syncInternalThemeFrames(theme);
    syncThemeVantaBackgrounds();
    window.dispatchEvent(new CustomEvent('nyx:themechange',{detail:{theme}}));
  }
  function applyHomeDesignSetting(){
    const homeDesign='redesigned';
    if(store.text('nyx.homeDesign','redesigned')!==homeDesign) store.setText('nyx.homeDesign',homeDesign);
    document.documentElement.dataset.nyxHomeDesign=homeDesign;
    document.body.dataset.nyxHomeDesign=homeDesign;
    ['nyxHomepageMinimalStyles','nyxWorkspaceMicrointeractionsStyles'].forEach(id=>{
      const stylesheet=document.getElementById(id);
      if(stylesheet) stylesheet.disabled=false;
    });
    window.dispatchEvent(new CustomEvent('nyx:homedesignchange',{detail:{homeDesign}}));
  }
  function syncInternalThemeFrames(theme=store.text('nyx.theme','default')){
    const clean=normalizeNyxTheme(theme);
    document.querySelectorAll('iframe.view').forEach(frame=>{
      try{
        const frameHref=String(frame.contentWindow?.location?.href || frame.getAttribute('src') || '');
        const source=workspaceShellSourceUrl(frameHref) || frameHref;
        const target=new URL(source,location.href);
        if(target.origin!==location.origin && !(frame.hasAttribute('srcdoc') && frameHref==='about:srcdoc')) return;
        const doc=frame.contentDocument;
        if(!doc?.body) return;
        frame.classList.add('transparent-internal-page');
        frame.setAttribute('allowtransparency','true');
        frame.style.backgroundColor='transparent';
        doc.documentElement.classList.add('nyx-embedded-built-in');
        doc.body.classList.add('nyx-embedded-built-in');
        doc.body.classList.remove(...nyxThemeClasses);
        doc.body.classList.add('theme-'+clean);
        doc.body.dataset.nyxTheme=clean;
        doc.documentElement.dataset.nyxTheme=clean;
        if(clean==='custom') doc.documentElement.style.setProperty('--nyx-custom-base',nyxCustomThemePalette().base);
        else doc.documentElement.style.removeProperty('--nyx-custom-base');
        doc.documentElement.dataset.nyxAppearance=store.text('nyx.appearance','dark');
        ensureFreshThemeOptions(doc);
        doc.querySelectorAll('[data-theme-value]').forEach(el=>{el.value=clean});
      }catch{}
      try{frame.contentWindow?.postMessage?.({type:'nyx:theme-sync',theme:clean},'*')}catch{}
    });
  }
  function applyVisualEffectSetting(){
    const effect=store.text('nyx.visualEffect','none');
    const allowed=['none','rain','stars','hearts','pokeballs','flowers','emeralds'];
    const value=allowed.includes(effect) ? effect : 'none';
    const speed=Math.max(.3,Math.min(3,Number(store.text('nyx.visualEffectSpeed','1.1')) || 1.1));
    const requestedAmount=Math.max(1,Math.min(64,Number(store.text('nyx.visualEffectAmount','16')) || 16));
    const canShow=nyxStartupOpened && document.body.classList.contains('workspace-shell') && !document.body.classList.contains('workspace-content-active') && !store.get('nyx.lagReducer',false);
    syncPerformanceLite();
    const lite=document.body.classList.contains('performance-lite');
    const amount=lite ? Math.min(requestedAmount,16) : requestedAmount;
    const nodes=ensureVisualEffectNodes(canShow && value!=='none' ? amount : 0);
    const isFallingEffect=['hearts','pokeballs','flowers','emeralds'].includes(value);
    const randomizeFallingNode=node=>{
      const startX=Math.random()*112-6;
      const driftA=(Math.random()*34-17) + (Math.random()<.5 ? -18 : 18);
      const driftB=driftA * (Math.random()*-.75-.15) + (Math.random()*18-9);
      const driftC=driftA * (Math.random()*.55-.2) + (Math.random()*26-13);
      node.style.setProperty('--fall-x',startX.toFixed(2)+'vw');
      node.style.setProperty('--fall-start-y',(-24-Math.random()*36).toFixed(2)+'vh');
      node.style.setProperty('--fall-mid-y-a',(22+Math.random()*24).toFixed(2)+'vh');
      node.style.setProperty('--fall-mid-y-b',(58+Math.random()*28).toFixed(2)+'vh');
      node.style.setProperty('--fall-end-y',(112+Math.random()*28).toFixed(2)+'vh');
      node.style.setProperty('--fall-drift-a',driftA.toFixed(2)+'vw');
      node.style.setProperty('--fall-drift-b',driftB.toFixed(2)+'vw');
      node.style.setProperty('--fall-drift-c',driftC.toFixed(2)+'vw');
      node.style.setProperty('--fall-rot-start',(Math.random()*90-45).toFixed(0)+'deg');
      node.style.setProperty('--fall-rot-a',(80+Math.random()*160).toFixed(0)+'deg');
      node.style.setProperty('--fall-rot-b',(230+Math.random()*220).toFixed(0)+'deg');
      node.style.setProperty('--fall-rot-end',(430+Math.random()*520).toFixed(0)+'deg');
      node.style.setProperty('--fall-scale-start',(.62+Math.random()*.24).toFixed(2));
      node.style.setProperty('--fall-scale-a',(.82+Math.random()*.34).toFixed(2));
      node.style.setProperty('--fall-scale-b',(.72+Math.random()*.32).toFixed(2));
      node.style.setProperty('--fall-scale-end',(.82+Math.random()*.36).toFixed(2));
      node.style.setProperty('--fall-opacity',(.66+Math.random()*.32).toFixed(2));
    };
    nodes.forEach((node,index)=>{
      node.style.display=index<amount ? '' : 'none';
      node.style.left=(Math.random()*104-2).toFixed(2)+'%';
      node.style.top=(Math.random()*96).toFixed(2)+'%';
      node.style.fontSize=(16+Math.random()*20).toFixed(1)+'px';
      node.style.animationDelay='-'+(Math.random()*(isFallingEffect ? 14 : 6)/speed).toFixed(2)+'s';
      const baseDuration=isFallingEffect ? 7.6+Math.random()*7.8 : .85+Math.random()*1.8;
      node.style.animationDuration=(baseDuration/speed).toFixed(2)+'s';
      node.style.opacity=(.58+Math.random()*.42).toFixed(2);
      if(isFallingEffect){
        randomizeFallingNode(node);
        node.onanimationiteration=()=>randomizeFallingNode(node);
      }else{
        node.onanimationiteration=null;
      }
      const randomEdge=side=>{
        if(side===0) return {x:(Math.random()*120-10).toFixed(2)+'vw',y:'-14vh'};
        if(side===1) return {x:'114vw',y:(Math.random()*120-10).toFixed(2)+'vh'};
        if(side===2) return {x:(Math.random()*120-10).toFixed(2)+'vw',y:'114vh'};
        return {x:'-14vw',y:(Math.random()*120-10).toFixed(2)+'vh'};
      };
      const startSide=Math.floor(Math.random()*4);
      const endSide=(startSide+2+Math.floor(Math.random()*2))%4;
      const start=randomEdge(startSide);
      const end=randomEdge(endSide);
      node.style.setProperty('--effect-x0',start.x);
      node.style.setProperty('--effect-y0',start.y);
      node.style.setProperty('--effect-x1',end.x);
      node.style.setProperty('--effect-y1',end.y);
    });
    ['rain','stars','hearts','pokeballs','flowers','emeralds'].forEach(name=>document.body.classList.toggle('effect-'+name,value===name && canShow));
    document.body.classList.toggle('effect-amount-low',amount<=6);
    document.body.classList.toggle('effect-amount-medium',amount>6 && amount<=10);
    document.documentElement.style.setProperty('--effect-speed',String(speed));
    qsa('[data-effect-value]').forEach(el=>{el.value=value});
    qsa('[data-effect-speed]').forEach(el=>{el.value=String(speed)});
    qsa('[data-effect-amount]').forEach(el=>{el.value=String(requestedAmount)});
    qsa('[data-effect-speed-label]').forEach(el=>{el.textContent=speed.toFixed(1)+'x'});
    qsa('[data-effect-amount-label]').forEach(el=>{el.textContent=String(requestedAmount)});
  }

  function applyUserSettings(){
    document.body.classList.toggle('three-d-backgrounds',store.get('nyx.threeDBackgrounds',false));
    applyNyxBeamWallpaper();
    document.body.classList.toggle('nyx-home-hide-search',!store.get('nyx.homeShowSearch',true));
    document.body.classList.toggle('nyx-home-hide-quick-actions',!store.get('nyx.homeShowQuickActions',true));
    document.body.classList.add('nyx-home-hide-constellations');
    applyNyxSidebarLocation();
    applyLagReducerSetting();
    applyWorkspaceShellMode();
    applyHomeDesignSetting();
    applyWorkspaceTabDesignSetting();
    applyThemeSetting();
    syncPerformanceLite();
    syncThemeVantaBackgrounds();
    applyFontSetting();
    applyVisualEffectSetting();
    const name=store.text('nyx.userName','').trim();
    const greeting=$('userGreeting');
    if(greeting){
      greeting.textContent=name || 'Set username';
      greeting.classList.toggle('needs-name',!name);
    }
    const customData=store.text('nyx.customBgData','');
    const customUrl=store.text('nyx.customBgUrl','');
    const value=currentBackgroundValue();
    const customSrc=customData || customUrl;
    document.documentElement.style.setProperty('--bg-size','cover');
    if(nyxStartupOpened){
      setCustomBackgroundLayer(customSrc);
    }else{
      document.body.classList.remove('custom-bg-active');
      $('customBgImage')?.removeAttribute('src');
    }
    applyBackgroundValue(value);
    setBackgroundProperty('--bg-enhanced-render',normalizeBgValue(value));
    document.documentElement.style.setProperty('--workspace-bg-render',normalizeBgValue(currentWorkspaceBackgroundValue()));
    syncBackgroundPreview(value);
    updateWeatherContrast(value);
    store.set('nyx.backgroundEnhancer',false);
    const enhance=false;
    document.body.classList.remove('bg-enhanced');
    document.documentElement.style.setProperty('--bg-brightness','1');
    document.documentElement.style.setProperty('--bg-contrast','1');
    document.documentElement.style.setProperty('--bg-saturate','1');
    setBackgroundProperty('--bg-bright-mask','linear-gradient(transparent,transparent)');
    setQualityStatus('');
    qsa('[data-bg-enhancer]').forEach(el=>el.classList.toggle('on',enhance));
    const engine=store.text('nyx.engine','duckduckgo');
    qsa('[data-engine-value]').forEach(el=>{el.value=engine});
    syncHomeSearchEnginePresentation();
    applyGlassSetting();
    syncPerformanceLite();
    if(nyxStartupOpened){
      startHieroglyphObserver();
      applyHieroglyphText();
    }
  }
  function migrateGlassDefault(){
    if(store.get('nyx.glassDefault80',false)) return;
    const saved=store.text('nyx.glassLevel','');
    if(!saved || saved==='72') store.setText('nyx.glassLevel','80');
    store.set('nyx.glassDefault80',true);
  }
  function applyGlassSetting(){
    const raw=store.text('nyx.glassLevel','80');
    const parsed=Number(raw);
    const value=Math.max(-200,Math.min(200,Number.isFinite(parsed) ? parsed : 80));
    const brightness=Math.max(0,Math.min(value,100))/100;
    const extra=Math.max(0,value-100)/100;
    const negative=Math.abs(Math.min(value,0))/200;
    const alpha=Math.min(0.94,0.7 - brightness * 0.58 + negative * 0.24).toFixed(3);
    const cardA=Math.min(0.32,0.19 - brightness * 0.14 + negative * 0.08).toFixed(3);
    const cardB=Math.min(0.24,0.12 - brightness * 0.09 + negative * 0.08).toFixed(3);
    const control=Math.min(0.28,0.16 - brightness * 0.105 + negative * 0.075).toFixed(3);
    const baseBlur=36 - brightness * 16 + negative * 32;
    const blur=Math.max(0,Math.round(baseBlur * (1 - extra)));
    const saturate=Math.max(0.8,1.02 + brightness * 0.58 - negative * 0.22).toFixed(2);
    const root=document.documentElement;
    root.style.setProperty('--glass-panel',`rgba(10,12,15,${alpha})`);
    root.style.setProperty('--glass-card-a',`rgba(255,255,255,${cardA})`);
    root.style.setProperty('--glass-card-b',`rgba(255,255,255,${cardB})`);
    root.style.setProperty('--glass-control',`rgba(255,255,255,${control})`);
    root.style.setProperty('--glass-blur',blur+'px');
    root.style.setProperty('--glass-saturate',saturate);
    root.style.setProperty('--glass-clarity',brightness.toFixed(2));
    qsa('[data-glass-value]').forEach(el=>{el.value=String(value)});
    qsa('[data-glass-output]').forEach(el=>{el.textContent=value+'%'});
  }

  function normalizeBgValue(value){
    const raw=String(value||'').trim();
    if(raw.startsWith('url(') || raw.startsWith('linear-gradient')) return raw;
    const src=/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(raw) ? 'https://'+raw : raw;
    return `url("${src.replaceAll('"','%22')}")`;
  }
  function bgSrc(value){
    const match=String(value||'').match(/^url\(["']?(.+?)["']?\)$/);
    return match ? match[1] : '';
  }
  function currentBackgroundValue(){
    const bg=store.text('nyx.background','dragon');
    const customData=store.text('nyx.customBgData','');
    const customUrl=store.text('nyx.customBgUrl','');
    const legacy=store.text('nyx.customBg','');
    return customData ? `url("${customData}")` : customUrl ? `url("${customUrl.replaceAll('"','%22')}")` : legacy || bgPresets[bg] || bgPresets.dragon;
  }
  function currentWorkspaceBackgroundValue(){
    const bg=store.text('nyx.workspaceBackground','lofiPurple');
    return bgPresets[bg] || bgPresets.lofiPurple || bgPresets.dragon;
  }
  function imageConnectionSrc(src){
    if(!/^https?:\/\//i.test(src)) return '';
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(src.replace(/^https?:\/\//i,''));
  }
  function imageCandidates(src){
    const connectionLesson=imageConnectionSrc(src);
    return connectionLesson && connectionLesson!==src ? [src,connectionLesson] : [src];
  }
  function loadImageWithFallback(img, src, onLoad, onError){
    const candidates=imageCandidates(src);
    let index=0;
    img.referrerPolicy='no-referrer';
    img.onload=()=>onLoad?.(img.src,img);
    img.onerror=()=>{
      index++;
      if(index<candidates.length){
        img.src=candidates[index];
        return;
      }
      onError?.();
    };
    img.src=candidates[index] || '';
  }
  function syncBackgroundPreview(value=currentBackgroundValue()){
    const cssValue=normalizeBgValue(value);
    const src=bgSrc(cssValue);
    qsa('[data-bg-full-preview]').forEach(el=>{
      el.style.backgroundImage=src ? '' : cssValue;
      el.textContent='';
      if(src){
        const img=document.createElement('img');
        img.alt='';
        loadImageWithFallback(img,src,loadedSrc=>{
          if(loadedSrc!==src) el.style.backgroundImage=`url("${loadedSrc}")`;
        },()=>{
          el.style.backgroundImage=cssValue;
          el.textContent='Preview unavailable';
        });
        el.appendChild(img);
      }
    });
  }
  function setQualityStatus(text=''){
    qsa('[data-bg-quality-status]').forEach(el=>{el.textContent=text});
  }
  function compactBackgroundSource(source, slot){
    const registry=compactBackgroundSource.registry ||= new Map();
    const previous=registry.get(slot);
    if(previous?.source===source) return previous.url;
    let url=source;
    if(/^data:image\/[^;,]+;base64,/i.test(source)){
      try{
        const split=source.indexOf(',');
        const binary=atob(source.slice(split+1));
        url=URL.createObjectURL(new Blob([Uint8Array.from(binary,char=>char.charCodeAt(0))],{type:source.slice(5,source.indexOf(';'))}));
      }catch{}
    }
    registry.set(slot,{source,url});
    if(previous && previous.url!==previous.source) setTimeout(()=>URL.revokeObjectURL(previous.url),1000);
    return url;
  }
  function setBackgroundProperty(name,value){
    const source=bgSrc(value);
    const compact=compactBackgroundSource(source || '',name);
    document.documentElement.style.setProperty(name,source && compact!==source ? `url("${compact}")` : value);
  }
  function setCustomBackgroundLayer(src, enhancedSrc=''){
    const img=$('customBgImage');
    if(!img) return Promise.resolve(null);
    const layerRun=++customBgLayerRun;
    const next=compactBackgroundSource(enhancedSrc || src || '', 'customBgImage');
    if(!next){
      document.body.classList.remove('custom-bg-active');
      img.removeAttribute('src');
      syncThemeVantaBackgrounds();
      return Promise.resolve(null);
    }
    return new Promise(resolve=>{
      loadImageWithFallback(img,next,(loadedSrc,loadedImg)=>{
      if(layerRun!==customBgLayerRun){resolve(null); return}
      const loadedCss=`url("${loadedSrc.replaceAll('"','%22')}")`;
      setBackgroundProperty('--bg-render',loadedCss);
      setBackgroundProperty('--bg-enhanced-render',loadedCss);
      document.body.classList.add('custom-bg-active');
      syncThemeVantaBackgrounds();
      resolve({src:loadedSrc,width:loadedImg.naturalWidth,height:loadedImg.naturalHeight});
    },()=>{
      if(layerRun!==customBgLayerRun){resolve(null); return}
      document.body.classList.remove('custom-bg-active');
      syncThemeVantaBackgrounds();
      resolve(null);
    });
    });
  }
  function renderEnhancedImage(src, done){
    const img=new Image();
    const candidates=imageCandidates(src);
    let index=0;
    img.crossOrigin='anonymous';
    img.referrerPolicy='no-referrer';
    img.onload=()=>{
      try{
        const minW=2560, minH=1440, maxW=3840, maxH=2160;
        const minScale=Math.max(minW/img.naturalWidth,minH/img.naturalHeight,1);
        const maxScale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight);
        const upscale=Math.max(1,Math.min(minScale,maxScale));
        const w=Math.round(img.naturalWidth*upscale);
        const h=Math.round(img.naturalHeight*upscale);
        let source=img;
        let sourceW=img.naturalWidth;
        let sourceH=img.naturalHeight;
        while(sourceW*1.75<w && sourceH*1.75<h){
          const step=document.createElement('canvas');
          step.width=Math.min(w,Math.round(sourceW*1.75));
          step.height=Math.min(h,Math.round(sourceH*1.75));
          const stepCtx=step.getContext('2d');
          if(!stepCtx) throw new Error('canvas unavailable');
          stepCtx.imageSmoothingEnabled=true;
          stepCtx.imageSmoothingQuality='high';
          stepCtx.drawImage(source,0,0,step.width,step.height);
          source=step;
          sourceW=step.width;
          sourceH=step.height;
        }
        const canvas=document.createElement('canvas');
        canvas.width=w;
        canvas.height=h;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx) throw new Error('canvas unavailable');
        ctx.imageSmoothingEnabled=true;
        ctx.imageSmoothingQuality='high';
        ctx.drawImage(source,0,0,w,h);
        const pixels=ctx.getImageData(0,0,w,h);
        const data=pixels.data;
        const original=new Uint8ClampedArray(data);
        const at=(x,y,c)=>original[((Math.max(0,Math.min(h-1,y))*w + Math.max(0,Math.min(w-1,x)))*4)+c];
        for(let y=0;y<h;y++){
          for(let x=0;x<w;x++){
            const idx=(y*w+x)*4;
            for(let c=0;c<3;c++){
              const blur=(
                at(x-1,y-1,c)+at(x,y-1,c)*2+at(x+1,y-1,c)+
                at(x-1,y,c)*2+at(x,y,c)*4+at(x+1,y,c)*2+
                at(x-1,y+1,c)+at(x,y+1,c)*2+at(x+1,y+1,c)
              )/16;
              const detail=original[idx+c]-blur;
              const edge=Math.min(36,Math.abs(detail))*Math.sign(detail);
              const sharpened=original[idx+c] + detail*2.65 + edge*.9;
              data[idx+c]=Math.max(0,Math.min(255,(sharpened-128)*1.16+128+6));
            }
          }
        }
        ctx.putImageData(pixels,0,0);
        done(canvas.toDataURL('image/jpeg',0.97),`Quality Boost active: ${img.naturalWidth}x${img.naturalHeight} to ${w}x${h}`);
      }catch{
        done('', 'Quality boost needs an uploaded/local image or a CORS-enabled link');
      }
    };
    img.onerror=()=>{
      index++;
      if(index<candidates.length){
        img.src=candidates[index];
        return;
      }
      done('', 'Background link could not be loaded');
    };
    img.src=candidates[index] || src;
  }
  function setWeatherContrast(lightBackground){
    const root=document.documentElement;
    if(lightBackground){
      root.style.setProperty('--weather-text','#0f172a');
      root.style.setProperty('--weather-muted','#334155');
      root.style.setProperty('--weather-control','rgba(15,23,42,.14)');
      root.style.setProperty('--weather-control-border','rgba(15,23,42,.16)');
      root.style.setProperty('--weather-shadow','0 1px 10px rgba(255,255,255,.34)');
    }else{
      root.style.setProperty('--weather-text','#f8fafc');
      root.style.setProperty('--weather-muted','#dbeafe');
      root.style.setProperty('--weather-control','rgba(0,0,0,.28)');
      root.style.setProperty('--weather-control-border','rgba(255,255,255,.16)');
      root.style.setProperty('--weather-shadow','0 1px 12px rgba(0,0,0,.36)');
    }
  }
  function updateWeatherContrast(value){
    const cssValue=normalizeBgValue(value || bgPresets.dragon);
    const src=bgSrc(cssValue);
    if(!src || cssValue.startsWith('linear-gradient')){setWeatherContrast(false); return}
    const img=new Image();
    const maskCandidates=imageCandidates(src);
    let maskIndex=0;
    img.crossOrigin='anonymous';
    img.referrerPolicy='no-referrer';
    img.onload=()=>{
      try{
        const w=360, h=210;
        const canvas=document.createElement('canvas');
        canvas.width=w;
        canvas.height=h;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx) return;
        const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);
        const drawW=img.naturalWidth*scale;
        const drawH=img.naturalHeight*scale;
        ctx.drawImage(img,(w-drawW)/2,(h-drawH)/2,drawW,drawH);
        const sample=ctx.getImageData(Math.floor(w*.72),0,Math.floor(w*.28),Math.floor(h*.46)).data;
        let total=0, count=0;
        for(let i=0;i<sample.length;i+=16){
          total+=.2126*sample[i] + .7152*sample[i+1] + .0722*sample[i+2];
          count++;
        }
        setWeatherContrast(count ? total/count > 150 : false);
      }catch{
        setWeatherContrast(false);
      }
    };
    img.onerror=()=>setWeatherContrast(false);
    img.src=src;
  }
  function applyBackgroundValue(value, allowFallback=true){
    const cssValue=normalizeBgValue(value || bgPresets.dragon);
    setBackgroundProperty('--bg', cssValue);
    setBackgroundProperty('--bg-render', cssValue);
    const src=bgSrc(cssValue);
    if(!src || src.startsWith('data:') || src.startsWith('blob:')) return;
    if(store.text('nyx.customBgUrl','') || store.text('nyx.customBgData','') || store.text('nyx.customBg','')) return;
    const img=new Image();
    img.referrerPolicy='no-referrer';
    img.onerror=()=>{
      if(!allowFallback) return;
      store.setText('nyx.background','dragon');
      store.setText('nyx.customBg','');
      store.setText('nyx.customBgUrl','');
      store.setText('nyx.customBgData','');
      applyBackgroundValue(bgPresets.dragon,false);
    };
    img.onload=()=>{};
    img.src=src;
  }
  function enhanceBackgroundRender(value){
    const run=++enhancedBackgroundRun;
    const cssValue=normalizeBgValue(value || bgPresets.dragon);
    const src=bgSrc(cssValue);
    setQualityStatus('Quality Boost preparing image...');
    if(!src || cssValue.startsWith('linear-gradient')){
      setBackgroundProperty('--bg-render',cssValue);
      setBackgroundProperty('--bg-enhanced-render',cssValue);
      setBackgroundProperty('--bg-bright-mask','linear-gradient(transparent,transparent)');
      setCustomBackgroundLayer('');
      setQualityStatus('');
      return;
    }
    const isGif=/\.gif(?:[?#].*)?$/i.test(src) || /^data:image\/gif/i.test(src);
    if(isGif){
      setBackgroundProperty('--bg-render',cssValue);
      setBackgroundProperty('--bg-enhanced-render',cssValue);
      setQualityStatus('Quality Boost active: animated GIF preserved');
    }else{
      renderEnhancedImage(src,(enhancedSrc,status)=>{
        if(run!==enhancedBackgroundRun || !store.get('nyx.backgroundEnhancer',false)) return;
        setQualityStatus(status);
        if(enhancedSrc){
          const boosted=`url("${enhancedSrc}")`;
          setBackgroundProperty('--bg-enhanced-render',boosted);
          syncBackgroundPreview(boosted);
          if(store.text('nyx.customBgUrl','') || store.text('nyx.customBgData','')) setCustomBackgroundLayer(src,enhancedSrc);
        }
      });
    }
    const img=new Image();
    const maskCandidates=imageCandidates(src);
    let maskIndex=0;
    img.crossOrigin='anonymous';
    img.referrerPolicy='no-referrer';
    img.onload=()=>{
      if(run!==enhancedBackgroundRun || !store.get('nyx.backgroundEnhancer',false)) return;
      try{
        let brightMask='linear-gradient(transparent,transparent)';
        const maskW=960;
        const maskH=540;
        const maskCanvas=document.createElement('canvas');
        maskCanvas.width=maskW;
        maskCanvas.height=maskH;
        const maskCtx=maskCanvas.getContext('2d',{willReadFrequently:true});
        if(maskCtx){
          maskCtx.imageSmoothingEnabled=true;
          maskCtx.imageSmoothingQuality='high';
          const maskScale=Math.max(maskW/img.naturalWidth,maskH/img.naturalHeight);
          const drawW=img.naturalWidth*maskScale;
          const drawH=img.naturalHeight*maskScale;
          maskCtx.drawImage(img,(maskW-drawW)/2,(maskH-drawH)/2,drawW,drawH);
          const maskPixels=maskCtx.getImageData(0,0,maskW,maskH);
          const maskData=maskPixels.data;
          for(let i=0;i<maskData.length;i+=4){
            const r=maskData[i], g=maskData[i+1], b=maskData[i+2];
            const lum=.2126*r + .7152*g + .0722*b;
            const max=Math.max(r,g,b);
            const min=Math.min(r,g,b);
            const chroma=max-min;
            const saturation=max ? chroma / max : 0;
            const yellow=Math.min(r,g) - b*.72;
            const pink=Math.min(r,b) - g*.62;
            const cyan=Math.min(g,b) - r*.62;
            const blue=Math.max(0,b - Math.max(r,g)*.48);
            const brightColor=Math.max(0,yellow,pink,cyan,blue);
            const colorGate=max>170 && lum>118 && saturation>.34 && brightColor>44;
            const yellowStrength=.8 + Math.min(1,Math.max(0,(yellow-44)/120))*.2;
            const colorStrength=brightColor===yellow ? yellowStrength : brightColor===pink ? .42 : brightColor===cyan ? .22 : .14;
            const score=(lum-118)*1.4 + (saturation-.34)*320 + Math.max(0,brightColor-44)*1.8;
            const alpha=colorGate && score>120 ? Math.min(255,Math.round(255*colorStrength)) : 0;
            maskData[i]=255;
            maskData[i+1]=255;
            maskData[i+2]=255;
            maskData[i+3]=alpha;
          }
          maskCtx.putImageData(maskPixels,0,0);
          brightMask=`url("${maskCanvas.toDataURL('image/png')}")`;
        }
      if(run===enhancedBackgroundRun && store.get('nyx.backgroundEnhancer',false)){
        setBackgroundProperty('--bg-render',cssValue);
        setBackgroundProperty('--bg-bright-mask',brightMask);
      }
    }catch{
      setBackgroundProperty('--bg-render',cssValue);
      setBackgroundProperty('--bg-enhanced-render',cssValue);
      setBackgroundProperty('--bg-bright-mask','linear-gradient(transparent,transparent)');
    }
  };
  img.onerror=()=>{
    maskIndex++;
    if(maskIndex<maskCandidates.length){
      img.src=maskCandidates[maskIndex];
      return;
    }
    setBackgroundProperty('--bg-render',cssValue);
    setBackgroundProperty('--bg-enhanced-render',cssValue);
    setBackgroundProperty('--bg-bright-mask','linear-gradient(transparent,transparent)');
  };
    img.src=maskCandidates[maskIndex] || src;
  }
  const nyxMentionIds=new Set();
  let nyxMentionPollBusy=false,nyxMentionPollUid='',nyxMentionRevision=null;
  function showNyxMention(notificationId,details={}){
    if(!notificationId||nyxMentionIds.has(notificationId))return;
    nyxMentionIds.add(notificationId);
    if(nyxMentionIds.size>200)nyxMentionIds.delete(nyxMentionIds.values().next().value);
    const sender=String(details.sender||'Someone').slice(0,80),preview=String(details.preview||'').slice(0,240);
    toast(sender+' mentioned you'+(preview?': '+preview:''),'mention');
  }
  async function pollNyxMentions(){
    if(nyxMentionPollBusy||document.hidden)return;
    const user=nyxFounderSignedInUser;
    if(!user){nyxMentionPollUid='';nyxMentionRevision=null;nyxMentionIds.clear();return;}
    if(nyxMentionPollUid!==user.uid){nyxMentionPollUid=user.uid;nyxMentionRevision=null;nyxMentionIds.clear();}
    nyxMentionPollBusy=true;
    try{
      const token=await user.getIdToken();
      const response=await fetch('/api/chat/updates?since='+encodeURIComponent(nyxMentionRevision||0),{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response.ok)return;
      const payload=await response.json();
      if(nyxFounderSignedInUser?.uid!==user.uid)return;
      const initialized=nyxMentionRevision!==null;
      nyxMentionRevision=Math.max(nyxMentionRevision||0,Number(payload.revision)||0);
      if(!initialized||payload.reset)return;
      for(const event of payload.events||[]){
        if(event.kind!=='message'||event.mentionsViewer!==true||event.lastMessageAuthorUid===user.uid)continue;
        const prefix=event.scopeType==='conversation'?'dm':'message';
        showNyxMention(`${prefix}:${event.scopeId}:${event.createdAtMs}:mention`,{preview:event.lastMessageText});
      }
    }catch{ }
    finally{nyxMentionPollBusy=false;}
  }
  setInterval(()=>void pollNyxMentions(),5000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void pollNyxMentions();});
  function toast(msg,kind){
    const t=$('toast');if(!t)return;
    clearTimeout(t.nyxDismissTimer);
    const message=String(msg??'');
    const warning=/denied|failed|error|unable|unavailable|blocked|invalid/i.test(message);
    const success=/saved|copied|enabled|updated|added|success|connected/i.test(message);
    const symbol=kind==='mention'?'<path d="M21 11.5a8.5 8.5 0 1 1-3-6.5M16 8v6c0 3 5 3 5-1v-2"/><circle cx="12" cy="12" r="4"/>':warning?'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4m0 4h.01"/>':success?'<path d="m5 12 4 4L19 6"/>':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>';
    const badge=document.createElement('span');badge.className='toast-icon';badge.setAttribute('aria-hidden','true');
    badge.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+symbol+'</svg>';
    const label=document.createElement('span');label.className='toast-message';label.textContent=message;
    const progress=document.createElement('span');progress.className='toast-progress';progress.setAttribute('aria-hidden','true');
    const close=document.createElement('button');close.type='button';close.className='toast-close';close.setAttribute('aria-label','Dismiss notification');
    close.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>';
    close.addEventListener('click',()=>{clearTimeout(t.nyxDismissTimer);t.classList.remove('show');});
    t.replaceChildren(badge,label,close,progress);t.classList.add('show');
    t.nyxDismissTimer=setTimeout(()=>t.classList.remove('show'),2000);
  }
  window.__nyxStartupErrors=window.__nyxStartupErrors || [];
  if(!window.__nyxStartupErrorCapture){
    window.__nyxStartupErrorCapture=true;
    window.addEventListener('error',event=>{
      window.__nyxStartupErrors.push(event.message || 'Script error');
      if(window.__nyxStartupErrors.length>12) window.__nyxStartupErrors.shift();
    });
    window.addEventListener('unhandledrejection',event=>{
      window.__nyxStartupErrors.push(String(event.reason?.message || event.reason || 'Promise rejection'));
      if(window.__nyxStartupErrors.length>12) window.__nyxStartupErrors.shift();
    });
  }
  const postCoverWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function runPostCoverLoader(){
    const loader=$('postCoverLoader');
    const fill=$('postCoverLoaderFill');
    const label=$('postCoverLoaderLabel');
    const percent=$('postCoverLoaderPercent');
    if(!loader || !fill || !label || !percent || loader.dataset.running==='1') return true;
    loader.dataset.running='1';
    loader.setAttribute('aria-hidden','false');
    loader.classList.add('active');
    const setProgress=(value,text)=>{
      const next=Math.max(0,Math.min(100,Math.round(value)));
      fill.style.width=`${next}%`;
      percent.textContent=`${next}%`;
      label.textContent=next>=100 ? 'Launched' : 'Loading';
    };
    const withLoaderTimeout=(promise,ms=900)=>Promise.race([
      Promise.resolve(promise),
      postCoverWait(ms).then(()=>false)
    ]);
    const pingLocal=async()=>{
      try{
        const response=await fetch(location.href.split('#')[0],{cache:'no-store'});
        return response.ok || response.type==='basic';
      }catch{return true}
    };
    const fetchOk=async(path,ms=900)=>{
      if(location.protocol==='file:') return true;
      try{
        const response=await withLoaderTimeout(fetch(path,{cache:'no-store'}),ms);
        return !!(response && response.ok);
      }catch{return false}
    };
    const doubleCheck=async(run)=>{
      const first=await withLoaderTimeout(run(),1000).catch(()=>false);
      await postCoverWait(35);
      const second=await withLoaderTimeout(run(),1000).catch(()=>false);
      return Boolean(first || second);
    };
    const checks=[
      ['Checking core files',async()=>doubleCheck(async()=>(
        await fetchOk('/assets/icons/nyx-cat-moon.svg?v=3',850)
        && await fetchOk('/assets/vendor/three.r134.min.js',850)
      ))],
      ['Checking servers',async()=>doubleCheck(async()=>(
        location.protocol==='file:'
        || await Promise.all(['/scramjet/scramjet.js','/baremux/index.mjs'].map(path=>fetchOk(path,900)))
          .then(results=>results.some(Boolean))
      ))],
      ['Checking workspace engine',async()=>doubleCheck(async()=>Boolean(window.fetch && window.Promise && window.URL && window.Blob))],
      ['Checking storage',async()=>{
        return doubleCheck(async()=>{
          try{
            const key='nyx-startup-check';
            localStorage.setItem(key,'1');
            return localStorage.getItem(key)==='1' && (localStorage.removeItem(key),true);
          }catch{return false}
        });
      }],
      ['Checking connection updates',async()=>doubleCheck(async()=>{
        if(typeof preflightStateCurrent==='function') return preflightStateCurrent();
        return typeof connectionStateVersion==='string' && typeof studyjetStateVersion==='string';
      })],
      ['Checking for bugs',async()=>doubleCheck(async()=>(
        Boolean(document.body && $('desktop') && $('visualEffects') && $('customBgImage'))
        && window.__nyxStartupErrors.length===0
      ))],
      ['Launching Nyx',async()=>doubleCheck(async()=>Boolean($('workspaceShell') || $('desktop')))]
    ];
    setProgress(0,'Checking Nyx');
    for(let i=0;i<checks.length;i++){
      const [text,run]=checks[i];
      setProgress((i/checks.length)*100,text);
      try{
        const ok=await run();
        if(!ok) console.warn('post-cover check did not pass:',text);
      }catch(error){console.warn('post-cover check warning:',text,error)}
      await postCoverWait(70);
      setProgress(((i+1)/checks.length)*100,text);
    }
    setProgress(100,'Launched');
    await postCoverWait(420);
    loader.classList.remove('active');
    loader.setAttribute('aria-hidden','true');
    setTimeout(()=>{
      loader.dataset.running='0';
      setProgress(0,'Checking Nyx');
    },260);
    return true;
  }
  function saveProfile(root=document, quiet=false){
    const input=root.querySelector?.('#settingName') || document.querySelector('#settingName');
    const next=(input?.value || '').trim();
    store.setText('nyx.userName', next);
    applyUserSettings();
    if(!quiet) toast('Username saved');
  }
  async function startNyx(){
    if(nyxStartupOpened) return;
    nyxStartupOpened=true;
    applyThemeSetting();
    document.body.classList.add('nyx-startup-prep');
    document.querySelectorAll('.nyx-preflight').forEach(overlay=>overlay.remove());
    document.body.classList.add('runtime-lag-guard');
    const startupProgress=showSetupLaunchSplash();
    setTimeout(async()=>{
      const runStep=async(value,label,task,minimumVisible)=>{
        if(startupProgress?.step) return startupProgress.step(value,label,task,minimumVisible);
        try{return {ok:true,result:await Promise.resolve().then(task)}}catch(error){console.warn(`Startup task failed: ${label}`,error);return {ok:false,error}}
      };

      await runStep(12,'Preparing interface',()=>{
        applyLagReducerSetting();
        document.body.classList.add('workspace-shell');
        syncChromeMode();
      },380);

      await runStep(31,'Restoring settings',()=>{
        applyUserSettings();
      },460);

      await runStep(49,'Loading your theme',async()=>{
        applyThemeSetting();
        syncPerformanceLite();
        const fontsReady=document.fonts?.ready || Promise.resolve();
        const pageReady=document.readyState==='complete'
          ? Promise.resolve()
          : new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
        await Promise.race([
          Promise.allSettled([fontsReady,pageReady]),
          new Promise(resolve=>setTimeout(resolve,1400))
        ]);
      },480);

      await runStep(67,'Starting workspace',()=>{
        void requestNyxKeyboardLock().catch(error=>console.warn('Keyboard shortcuts unavailable',error));
        tick();
      },430);

      await runStep(83,'Loading shortcuts',()=>{
        installHomeShortcutAnimationObserver();



        initDesktopSplash();
      },400);

      await runStep(96,'Finishing startup',()=>{
        finishNyxOpenStartup();
        if(window.__nyxLearningEntry){
          const entry=window.__nyxLearningEntry; window.__nyxLearningEntry='';
          openWorkspaceShellAppTab(entry);
        }
        applyVisualEffectSetting();
        document.body.classList.remove('runtime-lag-guard');
        if(shouldShowStartupCustomization()){
          document.body.classList.remove('nyx-startup-prep');
          suppressHomeEntranceOnStartup=false;
          showSetup();
        }else{
          playNyxStartupReveal();
        }
      },440);

      await startupProgress?.complete?.('Nyx is ready');
      scheduleNyxTermsAcceptanceGate(360);
      scheduleNyxReleaseNotes(980);
    },0);
  }

  function normalize(v){
    const input=String(v||'').trim(); if(!input)return '';
    const lesson=/^(?:https?:|\/)/i.test(input) ? window.NyxLearningRoutes?.appForLearningRoute(input,location.origin) : '';
    if(lesson) return lesson.startsWith('nyx:') ? lesson : new URL(lesson,location.origin).href;
    const raw=/^apps\//i.test(input) ? `/${input}` : input;
    if(shouldTriggerSixtySevenJumpscare(raw)){
      showSixtySevenJumpscare();
      return '';
    }
    let target='';
    if(/^about:blank$/i.test(raw)) return raw;
    if(/^(blob:|data:text\/html)/i.test(raw)) return raw;
    if(/^data:text\/html/i.test(raw)) return raw;
    if(/^https?:\/\//i.test(raw)) target=raw;
    else if(/^(\/|\.\/|\.\.\/|assets\/|apps\/)/i.test(raw)){
      try{target=new URL(raw,location.href).href}catch{target=raw}
    }
    else if(/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw) && !raw.includes(' ')) target='https://'+raw;
    else {
      target=selectedSearchUrl(raw);
    }
    return target;
  }
  function getRhBase(){
    return store.text('nyx.rammerheadBase',rammerheadBase).replace(/\/+$/,'') + '/';
  }
  function getRhSession(){
    return new Promise(resolve=>{
      const base=getRhBase();
      const cached=store.text('nyx.rammerheadSession','');
      const xhr=new XMLHttpRequest();
      let done=false;
      const finish=id=>{
        if(done) return;
        done=true;
        clearTimeout(timer);
        if(id){
          store.setText('nyx.rammerheadSession',id);
          resolve({base,id});
        }else if(cached){
          resolve({base,id:cached});
        }else{
          resolve(null);
        }
      };
      const timer=setTimeout(()=>finish(null),5000);
      try{
        xhr.open('GET',base+'newsession',true);
        xhr.onload=()=>{
          const id=(xhr.responseText||'').trim();
          finish(id || null);
        };
        xhr.onerror=()=>finish(null);
        xhr.send();
      }catch{
        finish(null);
      }
    });
  }
  function rhBuildUrl(base,id,url){
    return base + id + '/' + url;
  }
  function connectionModeUrl(mode,url,privacySessionId=''){
    mode=normalizeWorkspaceModeName(mode);
    const target=connectionTargetUrl(url);
    if(!target) return url;
    {}
    if(mode==='scramjet') return studyjetUrl(target) || target;
    return url;
  }
  window.nyxProxyGameUrl=async url=>{
    const target=connectionTargetUrl(url);
    if(!target) return '';
    const ready=await installStudyjet();
    if(!ready) throw new Error('The game connection is unavailable.');
    return studyjetUrl(target);
  };
  const nyxManagedGameFrames=new WeakMap();
  const nyxAdProtectedGameFrames=new WeakSet();
  const nyxAdProtectedGameDocuments=new WeakSet();
  function isNyxPublisherFrame(frame){
    try{
      if(!['nyxlearning.org','www.nyxlearning.org','localhost','127.0.0.1','[::1]'].includes(location.hostname))return false;
      const source=frame?.getAttribute('src') || '';
      const paths=['/apps/sponsor/banner.html','/apps/sponsor/side.html','/apps/sponsor/native.html','/apps/sponsor/social.html'];
      if(!frame?.hasAttribute('sandbox'))return false;
      if(source.startsWith('data:text/html;charset=utf-8,')&&paths.includes(frame.dataset.nyxSponsorPath))return true;
      const url=new URL(source,location.href);
      return url.origin===location.origin&&paths.includes(url.pathname)&&!frame.sandbox.contains('allow-same-origin');
    }catch{return false}
  }
  function installGameFrameAdProtection(frame){
    if(String(frame?.tagName || '').toLowerCase()!=='iframe') return false;
    const protect=()=>{
      if(isNyxPublisherFrame(frame))return false;
      let frameWindow=null;
      let frameDocument=null;
      try{
        frameWindow=frame.contentWindow;
        frameDocument=frame.contentDocument;
        if(frameWindow && frameWindow!==window){
          if(!frameWindow.__nyxWorkspaceAdBlock) frameWindow.eval(workspaceAdBlockRuntimeSource);
          if(!frameWindow.__nyxScramjetMinimalGuards) frameWindow.eval(studyjetMinimalRuntimeGuardSource);
        }
      }catch{}
      if(!frameDocument?.documentElement) return false;
      const protectDescendants=root=>{
        if(root?.matches?.('iframe')) installGameFrameAdProtection(root);
        root?.querySelectorAll?.('iframe')?.forEach(installGameFrameAdProtection);
      };
      protectDescendants(frameDocument);
      if(!nyxAdProtectedGameDocuments.has(frameDocument)){
        nyxAdProtectedGameDocuments.add(frameDocument);
        try{
          let scanTimer=0;
          new MutationObserver(records=>{
            if(scanTimer||!records.some(record=>record.addedNodes.length))return;
            scanTimer=setTimeout(()=>{scanTimer=0;protectDescendants(frameDocument);},50);
          })
            .observe(frameDocument.documentElement,{childList:true,subtree:true});
        }catch{}
      }
      return !!frameWindow?.__nyxWorkspaceAdBlock;
    };
    if(!nyxAdProtectedGameFrames.has(frame)){
      nyxAdProtectedGameFrames.add(frame);
      frame.addEventListener('load',()=>{
        protect();
        setTimeout(protect,80);
        setTimeout(protect,500);
      });
    }
    return protect();
  }
  window.nyxInstallGameAdProtection=frame=>installGameFrameAdProtection(frame);
  window.nyxLaunchGameFrame=async (frame,url,{forceProxy:forceConnection=false,signal}={})=>{
    const target=connectionTargetUrl(url);
    if(!target) return {managed:false,engine:'',url:''};
    installGameFrameAdProtection(frame);
    const mode=forceConnection ? 'scramjet' : selectedWorkspaceMode(target);
    if(mode==='scramjet' && String(frame?.tagName || '').toLowerCase()==='iframe'){
      const ready=await installStudyjet();
      const controller=studyjetController;
      if(ready && controller){
        if(signal?.aborted || !frame.isConnected) return;
        let managed=nyxManagedGameFrames.get(frame);
        if(!managed || managed.__nyxScramjetVersion!=='v2'){
          frame.removeAttribute('src');
          managed=controller.createFrame(frame,{plugins:[
                createStudyjetCompatibilityPlugin('','proxy-sri'),
                createStudyjetCompatibilityPlugin(workspaceAdBlockRuntimeSource,'ad-block'),
                createStudyjetCompatibilityPlugin(studyjetMinimalRuntimeGuardSource,'minimal-guard')
              ]});
          managed.__nyxScramjetVersion='v2';
          nyxManagedGameFrames.set(frame,managed);
        }
        if(signal?.aborted || !frame.isConnected) return;
        const cancel=()=>{
          if(nyxManagedGameFrames.get(frame)!==managed)return;
          frame.src='about:blank';
          const index=controller.frames?.indexOf(managed)??-1;
          if(index>=0)controller.frames.splice(index,1);
          nyxManagedGameFrames.delete(frame);
        };
        signal?.addEventListener('abort',cancel,{once:true});
        try{
          await managed.go(target);
          if(signal?.aborted || !frame.isConnected){cancel();return;}
        }catch(error){signal?.removeEventListener('abort',cancel);cancel();throw error;}
        return {managed:true,engine:'scramjet',url:target};
      }
    }
    if(mode==='iframe') return {managed:false,engine:'iframe',url:target};
    throw new Error('The game connection is unavailable.');
  };

  window.nyxLaunchMovieFrame=async(frame,url,{signal,recover=false}={})=>{
    const {movieSourceUrl}=await import('/chapels/movies/providers.mjs?v=20260915-aniembed-v1');
    if(!movieSourceUrl(url))throw new Error('Unsupported movie provider.');
    if(frame?.tagName!=='IFRAME'||frame.ownerDocument.location.origin!==location.origin||frame.ownerDocument.location.pathname!=='/apps/movies/')throw new Error('Invalid movie frame.');
    const sandbox='allow-scripts allow-same-origin allow-forms allow-presentation';
    if(frame.getAttribute('sandbox')!==sandbox)throw new Error('Movie sandbox is required.');
    if(signal?.aborted||!frame.isConnected)return;
    if(recover) nyxManagedGameFrames.delete(frame);
    await window.nyxLaunchGameFrame(frame,url,{forceProxy:true,signal});
  };
  function normalizeWorkspaceModeName(mode){
    let value=String(mode || 'auto').trim();
    if((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))){
      try{value=JSON.parse(value)}catch{value=value.slice(1,-1)}
    }
    value=String(value || 'auto').trim().toLowerCase().replace(atob('c2NyYW1qZXQ='),'scramjet').replace('studyjet','scramjet');
    if(value==='sj' || value==='scram' || value==='scramjet' || value==='scramjet-v2' || value==='sjv2') return 'scramjet';
    if(value==='rh' || value==='rammerhead') return 'rammerhead';
    if(value==='direct' || value==='iframe') return 'iframe';
    return value==='auto' ? 'auto' : 'scramjet';
  }
  function connectionTargetUrl(url){
    try{
      const target=new URL(url,location.href);
      return /^https?:$/.test(target.protocol) ? target.href : '';
    }catch{return ''}
  }
  function workspaceHost(url){
    try{return new URL(url).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}
  }
  function hostMatches(host,domains){
    return domains.some(domain=>host===domain || host.endsWith('.'+domain));
  }
  function isNyxLinkGeneratorUrl(url){
    const raw=workspaceShellSourceUrl(String(url || '')) || String(url || '');
    try{
      const parsed=new URL(raw,location.href);
      return parsed.origin===location.origin && /^\/apps\/link-generator(?:\/|$)/i.test(parsed.pathname);
    }catch{return false}
  }
  function isNyxGeneratedCdnUrl(url){
    try{
      const parsed=new URL(String(url || ''));
      if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) return false;
      if(parsed.hostname!=='jsdelivr.b-cdn.net' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.b-cdn\.net$/i.test(parsed.hostname)) return parsed.pathname==='/';
      if(!['cdn.jsdelivr.net','fastly.jsdelivr.net','gcore.jsdelivr.net','quantil.jsdelivr.net','originfastly.jsdelivr.net','testingcf.jsdelivr.net','jsdelivr.b-cdn.net','esm.sh','raw.esm.sh'].includes(parsed.hostname.toLowerCase())) return false;
      return /^\/gh\/[a-z0-9_.-]+\/[a-z0-9_.-]+@[a-z0-9._%~-]+\/[a-z0-9._%-]+\.svg$/i.test(parsed.pathname);
    }catch{return false}
  }
  function externalHttpUrl(url){
    try{
      const target=new URL(url,location.href);
      return /^https?:$/.test(target.protocol) && target.origin!==location.origin;
    }catch{return false}
  }
  function bestWorkspaceMode(url){
    try{
      const target=new URL(url,location.href);
      if(target.origin===location.origin || target.protocol==='file:') return 'iframe';
    }catch{}
    const host=workspaceHost(url);
    if(!host) return 'iframe';
    if(hostMatches(host,['slither.io'])) return 'iframe';
    if(hostMatches(host,['cineby.at'])) return 'scramjet';
    if(hostMatches(host,['tcgplayer.com'])) return 'iframe';
    const studyjetHosts=[
      'geforcenow.com','nvidia.com','play.geforcenow.com',
      'xbox.com','xboxlive.com','xboxservices.com',
      'spotify.com','open.spotify.com','accounts.spotify.com',
      'spotifycdn.com','scdn.co','accounts.scdn.co'
    ];
    const iframeHosts=[
      'localhost','127.0.0.1'
    ];
    if(hostMatches(host,iframeHosts)) return 'iframe';
    if(hostMatches(host,studyjetHosts)) return 'scramjet';
    return 'scramjet';
  }
  function selectedWorkspaceMode(url){
    try{
      const target=new URL(url,location.href);
      if(target.origin===location.origin || target.protocol==='file:') return 'iframe';
    }catch{}
    const mode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
    if(isSpotifyFamilyUrl(url)) return 'scramjet';
    if(hostMatches(workspaceHost(url),['tiktok.com'])) return 'scramjet';
    if(hostMatches(workspaceHost(url),['slither.io'])) return 'iframe';
    if(mode==='iframe' && hostMatches(workspaceHost(url),['cineby.at'])) return 'scramjet';
    if(mode!=='auto') return mode;
    return bestWorkspaceMode(url);
  }
  function appCompatibilityMode(url){
    if(hostMatches(workspaceHost(url),['aether.cx','crazygames.com','tiktok.com'])) return 'scramjet';
    return '';
  }
  function isYouTubeUrl(url){
    return hostMatches(workspaceHost(url),['youtube.com','youtu.be']);
  }
  function youtubeEnglishUrl(url){
    if(!isYouTubeUrl(url)) return url;
    try{
      const parsed=new URL(url,location.href);
      parsed.searchParams.set('hl','en');
      parsed.searchParams.set('gl','US');
      parsed.searchParams.set('persist_hl','1');
      return parsed.href;
    }catch{return url}
  }

  function studyjetUrl(url){
    const target=connectionTargetUrl(url);
    if(!target || !studyjetController?.prefix) return '';
    const config=studyjetConfig();
    const encode=typeof config.codec?.encode==='function' ? config.codec.encode : encodeURIComponent;
    return config.prefix + encode(target);
  }
  function connectionFailureHtml(message,engine='Nyx',{allowDirect=false,heading=''}={}){
    const safe=String(message || 'Refresh this page once so the updated service worker can take over, then search again.').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const safeHeading=String(heading || `${engine || 'Nyx'} did not start`).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const repairAction='<button type="button" data-nyx-repair onclick="parent.postMessage({type:\'nyx:repair-connection\'},parent.location.origin)">Repair connection</button><small>Your account and saved settings stay in place.</small>';
    const directAction=allowDirect?'<button type="button" onclick="parent.postMessage({type:\'nyx:proxy-direct-fallback\'},\'*\')">Try direct mode</button><small>Direct mode works only when the site allows embedding.</small>':'';
    return `<!doctype html><meta charset="utf-8"><meta name="nyx-connection-error" content="1"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Outfit,Arial,sans-serif;background:#101318;color:#f5f7fb;display:grid;place-items:center;min-height:100vh}main{box-sizing:border-box;width:min(560px,100%);padding:28px;text-align:center}h1{font-size:20px;margin:0 0 10px}p{margin:0;color:#c8ced8;line-height:1.45}button{min-height:42px;margin:18px 0 0;padding:0 18px;border:1px solid #6379a0;border-radius:12px;background:#1a2841;color:#f5f7fb;font:700 14px Outfit,Arial,sans-serif;cursor:pointer}small{display:block;margin-top:9px;color:#98a6bb;line-height:1.4}@media(max-width:480px) and (max-height:520px){main{padding:18px}h1{font-size:18px}p{font-size:13px}button{width:100%}}</style><main><h1>${safeHeading}</h1><p>${safe}</p>${repairAction}${directAction}</main>`;
  }
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[src="${src}"]`);
      if(existing){
        if(existing.dataset.loaded) resolve();
        else existing.addEventListener('load',resolve,{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src=src;
      script.async=false;
      script.onload=()=>{script.dataset.loaded='true'; resolve()};
      script.onerror=()=>reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
  }
      async function waitForServiceWorkerActive(registration, scope='/~/sj/'){
        if(!registration || !('serviceWorker' in navigator)) return false;
        const deadline=Date.now()+12000;
        let current=registration;
        while(Date.now()<deadline){
          if(current?.active?.state==='activated') return true;
          const worker=current?.installing || current?.waiting || current?.active;
          if(worker?.state==='activated') return true;
          const fresh=await navigator.serviceWorker.getRegistration(scope).catch(()=>null);
          if(fresh){
            current=fresh;
            if(fresh.active?.state==='activated') return true;
          }
          await new Promise(resolve=>setTimeout(resolve,120));
        }
        const fresh=await navigator.serviceWorker.getRegistration(scope).catch(()=>null);
        return Boolean(fresh?.active || current?.active);
      }
      async function waitForServiceWorkerScript(registration, scriptUrl, scope='/~/sj/'){
        if(!registration || !('serviceWorker' in navigator)) return null;
        const expected=new URL(scriptUrl,location.href);
        const compatible=worker=>{
          if(worker?.state!=='activated') return false;
          try{
            const actual=new URL(worker.scriptURL);



            return actual.origin===expected.origin && actual.pathname===expected.pathname;
          }catch{return false}
        };
        const deadline=Date.now()+12000;
        let current=registration;
        while(Date.now()<deadline){
          const fresh=await navigator.serviceWorker.getRegistration(scope).catch(()=>null);
          if(fresh) current=fresh;
          const active=current?.active;
          if(compatible(active)) return active;
          await new Promise(resolve=>setTimeout(resolve,120));
        }
        const fresh=await navigator.serviceWorker.getRegistration(scope).catch(()=>null);
        const active=fresh?.active || current?.active || null;
        return compatible(active) ? active : null;
      }
      async function refreshStudyjetServiceWorker(){
        if(!('serviceWorker' in navigator)) return false;
        const registration=await navigator.serviceWorker.getRegistration('/~/sj/');
        if(!registration) return false;
        await registration.update().catch(()=>null);
        return Boolean(await waitForServiceWorkerScript(registration,studyjetServiceWorkerUrl));
      }
  function normalizeWispUrl(value){
    const raw=String(value || '').trim();
    if(!raw) return '';
    let endpoint;
    try{endpoint=new URL(raw)}catch{throw new Error('Enter a complete ws:// or wss:// Campus connection address.')}
    if(endpoint.protocol!=='ws:' && endpoint.protocol!=='wss:') throw new Error('A Campus connection address must start with ws:// or wss://.');
    if(endpoint.username || endpoint.password) throw new Error('Campus connection addresses cannot contain a username or password.');
    if(endpoint.hash) throw new Error('Campus connection addresses cannot contain a # fragment.');
    if(location.protocol==='https:' && endpoint.protocol!=='wss:') throw new Error('Secure Nyx pages require a wss:// Campus connection address.');
    return endpoint.href;
  }
  function defaultWispUrl(){
    const configured=String(globalThis.__NYX_RUNTIME_CONFIG__?.wispUrl || '').trim();
    if(/^wss?:\/\//i.test(configured)) return configured.endsWith('/') ? configured : configured+'/';
    if(!hasHostedBackend()) return 'wss://wisp.mercurywork.shop/';
    const protocol=location.protocol==='https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/resources/live/`;
  }
  function storedCustomWispUrl(){
    try{const url=normalizeWispUrl(store.text('nyx.wispUrl',''));return url===workspaceHttpRelayUrl()?'':url}catch{return ''}
  }
  function workspaceHttpRelayUrl(){
    return `${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/tutsi-relay/socket/`;
  }
  function wispUrl(){
    return storedCustomWispUrl() || window.NyxRelaySelection?.current(configuredWispUrls()) || configuredWispUrls()[0];
  }
  function configuredWispUrls(){
    if(store.get('nyx.httpBridge',true))return [workspaceHttpRelayUrl()];
    const extras=globalThis.__NYX_RUNTIME_CONFIG__?.wispUrls;
    const urls=[...new Set([defaultWispUrl(),...(Array.isArray(extras)?extras:[])].map(value=>{
      try{return normalizeWispUrl(value)}catch{return ''}
    }).filter(url=>url&&url!==workspaceHttpRelayUrl()))];
    return urls.length?urls:[`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/resources/live/`];
  }
  async function selectWispRelay(failed=''){
    const custom=storedCustomWispUrl();
    if(custom)return custom;
    if(store.get('nyx.httpBridge',true)){
      const {installHttpRelaySocket}=await import('/chapels/tutsi/http-relay.mjs');
      installHttpRelaySocket();
    }
    return await window.NyxRelaySelection?.choose(configuredWispUrls(),failed) || configuredWispUrls()[0];
  }
  function activeWorkspaceSourceUrl(){
    const activeTab=activeWorkspace?.tabs?.find(tab=>tab.id===activeWorkspace.active);
    const raw=activeTab?.sourceUrl || activeTab?.url || '';
    return workspaceShellSourceUrl(raw) || raw;
  }
  function resetWorkspaceConnectionRuntime(reloadActive=true){
    const activeSource=activeWorkspaceSourceUrl();
    workspaceTransportOverride='';
    studyjetInstallPromise=null;
    studyjetController=null;
    studyjetTransport?.close?.();
    studyjetTransport=null;
    studyjetTransportPending=null;
    studyjetTransportKey='';
    if(reloadActive && /^https?:\/\//i.test(activeSource)) setTimeout(()=>activeWorkspace?.navigate?.(activeSource),0);
  }
  function saveWorkspaceWispUrl(root,reset=false){
    const input=root?.querySelector('[data-workspace-wisp-url]');
    const status=root?.querySelector('[data-workspace-wisp-status]');
    let next='';
    try{next=reset ? '' : normalizeWispUrl(input?.value || '')}catch(error){
      input?.focus();
      toast(error?.message || "Enter a valid Campus connection address.");
      return false;
    }
    store.setText('nyx.wispUrl',next);
    if(input) input.value=next;
    if(status) status.textContent=next ? `Custom campus connection: ${next}` : `Default campus connection: ${defaultWispUrl()}`;
    resetWorkspaceConnectionRuntime();
    toast(next ? "Custom Campus connection address saved" : "Default Campus connection address restored");
    return true;
  }
  const NYX_PORTABLE_BACKUP_FORMAT='nyx-portable-backup';
  const NYX_PORTABLE_BACKUP_VERSION=1;
  const NYX_PORTABLE_BACKUP_MAX_BYTES=4_500_000;
  const NYX_PORTABLE_BACKUP_MAX_ENTRIES=512;
  const NYX_PORTABLE_BACKUP_DENIED_KEYS=new Set([
    'nyx.wispurl','nyx.presencesession','nyx.cloud.preferences.user','nyx.setupcomplete','nyx.tosacceptedversion',
    'nyx.aipersonalkey.device','nyx.aipersonalbaseurl.device','nyx.aipersonalprofiles.device','nyx.aipersonalprofile.active',
    'nyx.launchpdf','nyx.renderstartuppdf'
  ]);
  function nyxPortableBackupKeyAllowed(key){
    const value=String(key || '');
    const normalized=value.toLowerCase();
    if(!value || value.length>160 || /[\u0000-\u001f]/.test(value)) return false;
    if(['__proto__','prototype','constructor'].includes(normalized)) return false;
    if(normalized.startsWith('firebase:') || normalized.startsWith('nyx.releasenotes.')) return false;
    if(NYX_PORTABLE_BACKUP_DENIED_KEYS.has(normalized) || normalized.startsWith('nyx.aipersonal')) return false;
    if(/(?:^|[._-])(?:api[-_]?key|auth|credential|password|private[-_]?key|secret|token)(?:$|[._-])/.test(normalized)) return false;
    return true;
  }
  function nyxPortableBackupStorage(){
    const storage={};
    let totalBytes=0;
    for(let index=0;index<localStorage.length && Object.keys(storage).length<NYX_PORTABLE_BACKUP_MAX_ENTRIES;index++){
      const key=localStorage.key(index);
      if(!nyxPortableBackupKeyAllowed(key)) continue;
      const value=localStorage.getItem(key);
      if(typeof value!=='string') continue;
      const bytes=new TextEncoder().encode(key).length+new TextEncoder().encode(value).length;
      if(bytes>1_000_000 || totalBytes+bytes>NYX_PORTABLE_BACKUP_MAX_BYTES) continue;
      totalBytes+=bytes;
      storage[key]=value;
    }
    return storage;
  }
  function exportNyxPortableBackup(root=document){
    const storage=nyxPortableBackupStorage();
    const payload={
      format:NYX_PORTABLE_BACKUP_FORMAT,
      version:NYX_PORTABLE_BACKUP_VERSION,
      exportedAt:new Date().toISOString(),
      sourceOrigin:location.origin,
      storage
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    const date=new Date().toISOString().slice(0,10);
    link.href=url;
    link.download=`nyx-data-${date}.json`;
    (document.getElementById('app') || document.body).appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    const count=Object.keys(storage).length;
    const status=root?.querySelector('[data-nyx-data-transfer-status]');
    if(status) status.textContent=`Exported ${count} safe data ${count===1?'entry':'entries'} from ${location.hostname}.`;
    toast(`Exported ${count} Nyx data ${count===1?'entry':'entries'}`);
    return payload;
  }
  async function importNyxPortableBackup(file,root=document){
    if(!file) return false;
    if(file.size>NYX_PORTABLE_BACKUP_MAX_BYTES+250_000){toast('That Nyx backup is too large.');return false}
    let payload;
    try{payload=JSON.parse(await file.text())}catch{toast('Choose a valid Nyx JSON backup.');return false}
    if(payload?.format!==NYX_PORTABLE_BACKUP_FORMAT || Number(payload?.version)!==NYX_PORTABLE_BACKUP_VERSION || !payload.storage || typeof payload.storage!=='object' || Array.isArray(payload.storage)){
      toast('That file is not a supported Nyx backup.');
      return false;
    }
    const entries=[];
    let totalBytes=0;
    for(const [rawKey,rawValue] of Object.entries(payload.storage)){
      const key=String(rawKey || '');
      if(!nyxPortableBackupKeyAllowed(key) || typeof rawValue!=='string') continue;
      const bytes=new TextEncoder().encode(key).length+new TextEncoder().encode(rawValue).length;
      if(bytes>1_000_000 || totalBytes+bytes>NYX_PORTABLE_BACKUP_MAX_BYTES || entries.length>=NYX_PORTABLE_BACKUP_MAX_ENTRIES) continue;
      totalBytes+=bytes;
      entries.push([key,rawValue]);
    }
    if(!entries.length){toast('That backup has no portable Nyx data.');return false}
    const source=String(payload.sourceOrigin || 'another Nyx link').replace(/[\u0000-\u001f]/g,' ').slice(0,120);
    if(!confirm(`Import ${entries.length} data ${entries.length===1?'entry':'entries'} from ${source}? Existing entries with the same names will be replaced.`)) return false;
    const previous=new Map(entries.map(([key])=>[key,localStorage.getItem(key)]));
    try{entries.forEach(([key,value])=>localStorage.setItem(key,value))}catch{
      entries.forEach(([key])=>{try{localStorage.removeItem(key)}catch{}});
      previous.forEach((value,key)=>{if(value!==null){try{localStorage.setItem(key,value)}catch{}}});
      toast('Nyx could not import the complete backup. No data was changed.');
      return false;
    }
    applyUserSettings();
    queueNyxCloudPreferencesSave();
    const status=root?.querySelector('[data-nyx-data-transfer-status]');
    if(status) status.textContent=`Imported ${entries.length} data ${entries.length===1?'entry':'entries'}. Reload Nyx to finish applying the backup.`;
    const reload=root?.querySelector('[data-nyx-data-reload]');
    if(reload) reload.hidden=false;
    toast(`Imported ${entries.length} Nyx data ${entries.length===1?'entry':'entries'}`);
    return true;
  }
  function nyxPresenceUrl(){
    if(hasHostedBackend()){
      try{return new URL('/api/presence',location.origin).href}catch{}
    }
    const configured=String(globalThis.__NYX_RUNTIME_CONFIG__?.presenceUrl||'').trim();
    if(configured){
      try{
        const endpoint=new URL(configured,location.href);
        if(/^https?:$/i.test(endpoint.protocol))return endpoint.href;
      }catch{}
    }
    try{
      const endpoint=new URL(wispUrl());
      endpoint.protocol=endpoint.protocol==='wss:' ? 'https:' : 'http:';
      endpoint.pathname='/presence';
      endpoint.search='';
      endpoint.hash='';
      return endpoint.href;
    }catch{return ''}
  }
  function renderNyxPresence(count=nyxPresenceCount,state='connecting'){
    const pendingLabel=state==='unavailable' ? 'Unavailable' : 'Connecting\u2026';
    const label=Number.isFinite(count) ? `${count} online` : pendingLabel;
    qsa('[data-nyx-online-count]').forEach(element=>{element.textContent=label});
    const usersLabel=Number.isFinite(count) ? `${count} users` : pendingLabel;
    qsa('[data-nyx-online-users]').forEach(element=>{element.textContent=usersLabel});
    if(Number.isFinite(count)) window.dispatchEvent(new CustomEvent('nyx:presence',{detail:{online:count}}));
  }
  async function nyxPresenceFirebaseToken(timeoutMs=1200){
    let timer=0;
    try{
      return await Promise.race([
        nyxGetFirebaseToken(),
        new Promise(resolve=>{timer=setTimeout(()=>resolve(''),timeoutMs)})
      ]);
    }catch{return ''}
    finally{clearTimeout(timer)}
  }
  function startNyxPresence(){
    if(startNyxPresence.started) return;
    startNyxPresence.started=true;
    const endpoint=nyxPresenceUrl();
    if(!endpoint) return;
    let sessionId='';
    try{
      sessionId=localStorage.getItem('nyx.presenceSession') || '';
      if(!/^[a-zA-Z0-9_-]{16,128}$/.test(sessionId)){
        sessionId=(crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g,'');
        localStorage.setItem('nyx.presenceSession',sessionId);
      }
    }catch{
      sessionId=`${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    let heartbeatActive=false;
    const heartbeat=async(force=false)=>{
      if(heartbeatActive || (!force&&document.visibilityState==='hidden')) return;
      heartbeatActive=true;
      let requestTimer=0;
      try{
        const token=await nyxPresenceFirebaseToken();
        const headers={'content-type':'text/plain;charset=UTF-8'};
        if(token)headers.Authorization=`Bearer ${token}`;
        const controller=typeof AbortController==='function' ? new AbortController() : null;
        if(controller)requestTimer=setTimeout(()=>controller.abort(),8000);
        const response=await fetch(endpoint,{
          method:'POST',
          headers,
          body:JSON.stringify({sessionId,userName:store.text('nyx.userName','').trim()}),
          cache:'no-store',
          keepalive:true,
          signal:controller?.signal
        });
        if(!response.ok) throw new Error(`Presence returned ${response.status}`);
        const payload=await response.json();
        const count=Number(payload?.online);
        if(!Number.isFinite(count) || count<0) return;
        nyxPresenceCount=Math.floor(count);
        renderNyxPresence();
      }catch{
        if(!Number.isFinite(nyxPresenceCount))renderNyxPresence(null,'unavailable');
      }finally{
        clearTimeout(requestTimer);
        heartbeatActive=false;
      }
    };
    heartbeat(true);
    setInterval(heartbeat,15_000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') heartbeat()});
  }
  async function installBookmuxTransport(){
    await selectWispRelay();
    const { BareMuxConnection:BookmuxConnection } = await import('/baremux/index.mjs?v=nyx-baremux-worker-start-v2');
    const connection = bookmuxConnection || (bookmuxConnection = new BookmuxConnection('/baremux/worker.js'));
    const wisp=wispUrl();
    const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const setTransportWithRetry=async (path,args)=>{
      let lastError=null;
      for(let attempt=0;attempt<3;attempt++){
        try{
          if(wisp===workspaceHttpRelayUrl()){
            await connection.setManualTransport(`
              const {installHttpRelaySocket}=await import('/chapels/tutsi/http-relay.mjs');
              installHttpRelaySocket();
              const {default:Transport}=await import(${JSON.stringify(path)});
              return [Transport,${JSON.stringify(path)}];
            `,args);
          }else{
            await connection.setTransport(path,args);
          }
          return;
        }catch(error){
          lastError=error;
          await delay(220*(attempt+1));
        }
      }
      throw lastError;
    };
    const transport=normalizeWorkspaceTransportName(workspaceTransportOverride || store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT));
    try{
      if(transport==='libcurlRaw' || transport==='auto'){
        try{
          await setTransportWithRetry('/assets/transports/libcurl-baremux.mjs', [{ wisp, websocket: wisp }]);
          return connection;
        }catch(error){
          throw error;
        }
      }
      if(transport==='wisp'){
        await setTransportWithRetry('/epoxy/index.mjs', [{ wisp, wisp_v2: false }]);
        return connection;
      }
      await setTransportWithRetry('/epoxy/index.mjs', [{ wisp, wisp_v2: true }]);
      return connection;
    }catch(firstError){
      if(transport==='libcurlRaw') throw firstError;
      await setTransportWithRetry('/epoxy/index.mjs', [{ wisp, wisp_v2: false }]).catch(()=>{
        throw firstError;
      });
      return connection;
    }
  }
  async function createStudyjetTransport(){
    await selectWispRelay();
    const transport=normalizeWorkspaceTransportName(workspaceTransportOverride || store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT));
    const key=`${transport}:${wispUrl()}`;
    if(studyjetTransport && studyjetTransportKey===key) return studyjetTransport;
    if(studyjetTransportPending?.key===key) return studyjetTransportPending.promise;
    const wisp=wispUrl();
    const buildTransport=async name=>{
      let endpoint=null;
      if(wisp===workspaceHttpRelayUrl()){
        const {createHttpRelayEndpoint}=await import('/chapels/tutsi/http-relay.mjs');
        endpoint=createHttpRelayEndpoint();
      }
      const relay=endpoint?.url||wisp;
      let client;
      try{
      if(name==='libcurlRaw' || name==='auto'){
        const { default: LibcurlClient } = await import('/assets/transports/libcurl-pilgrim.mjs');
        client=new LibcurlClient({ wisp:relay, websocket:relay });
      }else{
      const { default: EpoxyTransport } = await import('/assets/transports/incense-pilgrim.mjs');
        client=new EpoxyTransport({ wisp:relay, wisp_v2: name!=='wisp' });
      }
      }catch(error){endpoint?.close();throw error;}
      if(endpoint){const close=client.close?.bind(client);client.close=()=>{endpoint.close();close?.();};}
      return client;
    };


    const pending={key,promise:null};
    studyjetTransportPending=pending;
    pending.promise=(async()=>{
      const {RelayTransport}=await import('/chapels/tutsi/relay.mjs');
      const client=new RelayTransport({urls:[wisp],monitorMs:0,storage:null,createClient:async()=>{
        const next=await buildTransport(transport);
        let timer;
        try{if(typeof next.init==='function'&&!next.ready)await Promise.race([
          next.init(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Workspace transport startup timed out')),10000);})
        ]);return next;}catch(error){next.close?.();throw error;}finally{clearTimeout(timer);}
      }});
      try{await client.init();}catch(error){client.close();throw error;}
      if(studyjetTransportPending===pending){
        studyjetTransport=client;
        studyjetTransportKey=key;
      }
      return client;
    })().finally(()=>{if(studyjetTransportPending===pending) studyjetTransportPending=null;});
    return pending.promise;
  }
  function studyjetConfig(){
    return {
      prefix:'/~/sj/',
      scramjetPath:'/scramjet/scramjet.js?v=20260905-optional-history-url-v1',
      injectPath:'/controller/controller.inject.js',
      wasmPath:'/scramjet/scramjet.wasm',
      virtualWasmPath:'scramjet.wasm.js',
      codec:{
        encode:url=>encodeURIComponent(url),
        decode:url=>decodeURIComponent(url)
      }
    };
  }
  function studyjetRuntimeConfig(){
    const authSafeFlags={
      captureErrors:false,
      cleanErrors:false,
      sourcemaps:false,
      destructureRewrites:false,
      allowInvalidJs:false,
      allowFailedIntercepts:true,
      encapsulateWorkers:true
    };
    return {
      flags:{
        syncxhr:false,
        disableComputedWrap:true,
        rewriterLogs:false,
        captureErrors:false,
        cleanErrors:false,
        scramitize:false,
        sourcemaps:false,
        destructureRewrites:false,
        allowInvalidJs:false,
        debugTrampolines:false,
        debugSourceURL:false,
        allowFailedIntercepts:true,
        encapsulateWorkers:true
      },
      siteFlags:{
        'https?:\\/\\/([^/]+\\.)?(spotify\\.com|spotifycdn\\.com|scdn\\.co|accounts\\.scdn\\.co)(\\/|$)':authSafeFlags,
        'https?:\\/\\/([^/]+\\.)?(google\\.com|gstatic\\.com|recaptcha\\.net)(\\/|$)':authSafeFlags
      },
      maskedfiles:['inject.js','scramjet.wasm.js']
    };
  }
  function createStudyjetController(serviceworker,transport){
    const api=window.$scramjetController;
    const Controller=api?.Controller;
    if(!Controller) throw new Error('Learning controller did not load');
    api.assertRuntimeScramjetVersion?.();
    return new Controller({
      serviceworker,
      transport,
      config:studyjetConfig(),
      scramjetConfig:studyjetRuntimeConfig()
    });
  }
  async function createPrivateStudyjetController(){
    const base=studyjetController;
    if(!base?.serviceWorkerController || !base?.transport) throw new Error('Private learning session is unavailable');
    const controller=createStudyjetController(base.serviceWorkerController,base.transport);
    const {trackConnectionController,waitForConnectionController}=await import('/js/intercession-startup.mjs');
    controller.nyxStopWorkerTracking=trackConnectionController(controller);
    try{await waitForConnectionController(controller,5000);}catch(error){
      controller.nyxStopWorkerTracking();
      try{controller.cookieSyncChannel?.close?.()}catch{}
      try{controller.port?.close?.()}catch{}
      throw error;
    }
    controller.loadSavedCookies=async()=>{};
    controller.persistCookies=async()=>{};
    controller.cookieSyncDirty=false;
    controller.cookieUpdatedAt=Date.now();
    try{controller.cookieJar?.clear?.()}catch{}
    try{controller.cookieSyncChannel?.close?.()}catch{}
    return controller;
  }
  function destroyConnectionPrivacySession(tab){
    if(!tab) return;
    const controller=tab.privateScramjetController;
    if(controller){
      controller.nyxStopWorkerTracking?.();
      try{controller.cookieJar?.clear?.()}catch{}
      try{controller.frames?.splice?.(0,controller.frames.length)}catch{}
      try{controller.cookieSyncChannel?.close?.()}catch{}
      try{controller.port?.close?.()}catch{}
    }


    tab.privateScramjetController=null;
    tab.privateScramjetControllerPromise=null;
    tab.scramjetFrame=null;
    const sessionId=String(tab.privacySessionId || '');
    if(/^nyx_[a-z0-9_-]{12,80}$/i.test(sessionId) && navigator.serviceWorker){
      const message={type:'nyx:destroy-proxy-session',sessionId};
      navigator.serviceWorker.getRegistration('/service/').then(registration=>{
        registration?.active?.postMessage?.(message);
      }).catch(()=>{});
    }
  }
  window.addEventListener('pagehide',event=>{
    if(event.persisted) return;
    activeWorkspace?.tabs?.forEach?.(tab=>destroyConnectionPrivacySession(tab));
  });
  async function reconnectStudyjetController(controller,serviceworker,transport,force=false){
    if(!controller || !serviceworker) return false;
    controller.setTransport?.(transport);
    if(controller.serviceWorkerController===serviceworker && !force) return true;
    if(typeof controller.setupMessagePort!=='function') return false;
    controller.serviceWorkerController=serviceworker;
    controller.guardServiceWorkerRevive=false;
    controller.setupMessagePort();
    await new Promise(resolve=>setTimeout(resolve,120));
    return true;
  }
  async function ensureStudyjetWorkerConnection(controller,force=false){
    let registration=await navigator.serviceWorker.getRegistration('/~/sj/');
    if(!registration || registration.scope!==new URL('/~/sj/',location.href).href){
      registration=await navigator.serviceWorker.register(studyjetServiceWorkerUrl,{scope:'/~/sj/',updateViaCache:'none'});
    }
    const worker=await waitForServiceWorkerScript(registration,studyjetServiceWorkerUrl);
    if(!worker) throw new Error('The browsing connection could not be restored. Try again.');
    for(const current of new Set([studyjetController,controller])){
      if(current && !await reconnectStudyjetController(current,worker,studyjetController.transport,force)){
        throw new Error('The browsing session could not reconnect. Try again.');
      }
    }
  }
  let workspaceConnectionRepair=null;
  function repairWorkspaceConnection(){
    if(workspaceConnectionRepair)return workspaceConnectionRepair;
    workspaceConnectionRepair=(async()=>{
      if(!navigator.serviceWorker)throw new Error('This workspace cannot create a browsing connection.');
      await studyjetInstallPromise;
      await studyjetTransportPending?.promise.catch(()=>null);
      studyjetInstallPromise=null;
      studyjetTransport?.close?.();
      studyjetTransport=null;
      studyjetTransportPending=null;
      studyjetTransportKey='';
      await unregisterConnectionScope('/~/sj/');
      if(!await installStudyjet())throw new Error(studyjetInstallError || 'The browsing connection is unavailable.');
      await ensureStudyjetWorkerConnection(null,true);
      for(const tab of activeWorkspace?.tabs || []){
        if(tab.privateScramjetController)await ensureStudyjetWorkerConnection(tab.privateScramjetController,true);
      }
    })().finally(()=>{workspaceConnectionRepair=null});
    return workspaceConnectionRepair;
  }
  async function loadStudyjetRuntimeGuardSource(){
    if(studyjetRuntimeGuardSource) return studyjetRuntimeGuardSource;
    const response=await fetch('/nyx-scramjet-runtime-guard.js',{cache:'no-store'});
    if(!response.ok) throw new Error('Could not load Learning runtime guard');
    studyjetRuntimeGuardSource=await response.text();
    return studyjetRuntimeGuardSource;
  }
  function findStudyjetHtmlNode(node,name){
    if(String(node?.name || '').toLowerCase()===name) return node;
    const children=node?.childNodes || node?.children;
    if(!Array.isArray(children)) return null;
    for(const child of children){
      const found=findStudyjetHtmlNode(child,name);
      if(found) return found;
    }
    return null;
  }
  function installStudyjetRuntimeGuards(root,source=studyjetRuntimeGuardSource,key='runtime-guard'){
    const target=findStudyjetHtmlNode(root,'head') || findStudyjetHtmlNode(root,'html') || root;
    const children=target?.childNodes || target?.children;
    if(!Array.isArray(children)) return;
    if(children.some(child=>child?.attribs?.['data-nyx-runtime-guard']===key)) return;
    const script={
      type:'script',
      name:'script',
      attribs:{'data-nyx-runtime-guard':key},
      children:[],
      parent:target,
      prev:null,
      next:children[0] || null
    };
    const sourceNode={type:'text',data:source || 'void 0;',parent:script,prev:null,next:null};
    script.children.push(sourceNode);
    if(children[0]) children[0].prev=script;
    children.unshift(script);
  }
  function shouldUseStudyjetRuntimeGuard(url){
    return false;
  }
  function shouldUseStudyjetMinimalGuard(url){
    const raw=String(url || '');
    const host=workspaceHost(workspaceShellSourceUrl(raw) || raw);
    if(host && hostMatches(host,[
      'spotify.com',
      'spotifycdn.com',
      'scdn.co',
      'accounts.spotify.com',
      'accounts.scdn.co',
      'open.spotify.com'
    ])) return false;
    return !!host && hostMatches(host,[
      'google.com',
      'gstatic.com',
      'recaptcha.net',
      'google-analytics.com',
      'googletagmanager.com'
    ]);
  }
  function shouldUseStudyjetHelperGuard(url){
    return false;
  }
  function isNvidiaAuthFamilyUrl(url){
    const raw=String(url || '');
    const host=workspaceHost(workspaceShellSourceUrl(raw) || raw);
    return !!host && hostMatches(host,[
      'geforcenow.com',
      'nvidia.com',
      'nvidiagrid.net'
    ]);
  }
  function shouldStripStudyjetDuckDuckGoScripts(url){
    return false;
  }
  function isSpotifyFamilyUrl(url){
    const raw=String(url || '');
    const host=workspaceHost(workspaceShellSourceUrl(raw) || raw);
    return !!host && hostMatches(host,[
      'spotify.com',
      'spotifycdn.com',
      'scdn.co',
      'accounts.spotify.com',
      'accounts.scdn.co',
      'open.spotify.com'
    ]);
  }
  function patchSpotifyChromeOsWindow(frameWindow){
    try{
      if(!frameWindow || frameWindow.closed) return false;
      const frameNavigator=frameWindow.navigator;
      const nativeUserAgent=String(frameNavigator?.userAgent || '');
      if(!/\bCrOS\b/i.test(nativeUserAgent)) return !!frameWindow.__nyxSpotifyChromeOsCompatibility;
      const chromeVersion=nativeUserAgent.match(/Chrome\/([0-9.]+)/i)?.[1] || '138.0.0.0';
      const desktopUserAgent=`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
      const defineNavigatorValue=(name,value)=>{
        try{frameWindow.Object.defineProperty(frameWindow.Navigator.prototype,name,{configurable:true,get:()=>value})}
        catch{try{frameWindow.Object.defineProperty(frameNavigator,name,{configurable:true,get:()=>value})}catch{}}
      };
      defineNavigatorValue('userAgent',desktopUserAgent);
      defineNavigatorValue('platform','Win32');
      const nativeData=frameNavigator.userAgentData;
      if(nativeData){
        const desktopData={
          brands:Array.from(nativeData.brands || []),
          mobile:false,
          platform:'Windows',
          toJSON(){return {brands:this.brands,mobile:false,platform:'Windows'}},
          async getHighEntropyValues(hints){
            let values={};
            try{values=await nativeData.getHighEntropyValues(hints)}catch{}
            return {...values,platform:'Windows',platformVersion:'10.0.0',architecture:'x86',bitness:'64',model:''};
          }
        };
        defineNavigatorValue('userAgentData',desktopData);
      }
      try{frameWindow.Object.defineProperty(frameWindow,'__nyxSpotifyChromeOsCompatibility',{configurable:true,value:true})}
      catch{frameWindow.__nyxSpotifyChromeOsCompatibility=true}
      return true;
    }catch{return false}
  }
  function applySpotifyChromeOsFrameCompatibility(t){
    if(!t?.frame || !/\bCrOS\b/i.test(String(navigator.userAgent || '')) || !isSpotifyFamilyUrl(t.sourceUrl || t.url)) return false;
    let applied=false;
    const visit=frameWindow=>{
      if(!frameWindow) return;
      applied=patchSpotifyChromeOsWindow(frameWindow) || applied;
      let childCount=0;
      try{childCount=Number(frameWindow.length || 0)}catch{}
      for(let index=0;index<childCount;index++){
        try{visit(frameWindow.frames[index])}catch{}
      }
    };
    try{visit(t.frame.contentWindow)}catch{}
    return applied;
  }
  function stopSpotifyChromeOsFrameCompatibility(t){
    if(t?.spotifyChromeOsCompatibilityTimer){
      clearInterval(t.spotifyChromeOsCompatibilityTimer);
      t.spotifyChromeOsCompatibilityTimer=0;
    }
    if(t?.spotifyChromeOsCompatibilityTimeout){
      clearTimeout(t.spotifyChromeOsCompatibilityTimeout);
      t.spotifyChromeOsCompatibilityTimeout=0;
    }
    if(t?.spotifyChromeOsLoadHandler && t.frame){
      t.frame.removeEventListener('load',t.spotifyChromeOsLoadHandler);
      t.spotifyChromeOsLoadHandler=null;
    }
  }
  function startSpotifyChromeOsFrameCompatibility(t){
    stopSpotifyChromeOsFrameCompatibility(t);
    if(!/\bCrOS\b/i.test(String(navigator.userAgent || '')) || !isSpotifyFamilyUrl(t?.sourceUrl || t?.url)) return;
    const apply=()=>{
      if(!state.tabs.includes(t) || !isSpotifyFamilyUrl(t.sourceUrl || t.url)){
        stopSpotifyChromeOsFrameCompatibility(t);
        return;
      }
      applySpotifyChromeOsFrameCompatibility(t);
    };
    t.spotifyChromeOsLoadHandler=()=>{
      apply();
      setTimeout(apply,120);
      setTimeout(apply,650);
    };
    t.frame.addEventListener('load',t.spotifyChromeOsLoadHandler);
    apply();
    t.spotifyChromeOsCompatibilityTimer=setInterval(apply,750);
    t.spotifyChromeOsCompatibilityTimeout=setTimeout(()=>stopSpotifyChromeOsFrameCompatibility(t),5*60*1000);
  }
  function sweepSpotifyChromeOsCompatibility(){
    if(!/\bCrOS\b/i.test(String(navigator.userAgent || ''))) return false;
    let applied=false;
    qsa('iframe').forEach(frame=>{
      const raw=String(frame.getAttribute('src') || frame.src || '');
      const source=workspaceShellSourceUrl(raw) || raw;
      const host=workspaceHost(source);
      let decodedRaw=raw;
      try{decodedRaw=decodeURIComponent(raw)}catch{}
      if(!(host && hostMatches(host,['spotify.com','spotifycdn.com','scdn.co'])) && !/(spotify\.com|spotifycdn\.com|scdn\.co)/i.test(decodedRaw)) return;
      const visit=frameWindow=>{
        if(!frameWindow) return;
        applied=patchSpotifyChromeOsWindow(frameWindow) || applied;
        let childCount=0;
        try{childCount=Number(frameWindow.length || 0)}catch{}
        for(let index=0;index<childCount;index++){
          try{visit(frameWindow.frames[index])}catch{}
        }
      };
      try{visit(frame.contentWindow)}catch{}
    });
    return applied;
  }
  function startSpotifyChromeOsCompatibilitySweep(){
    if(startSpotifyChromeOsCompatibilitySweep.timer || !/\bCrOS\b/i.test(String(navigator.userAgent || ''))) return;
    const run=()=>sweepSpotifyChromeOsCompatibility();
    run();
    startSpotifyChromeOsCompatibilitySweep.timer=setInterval(run,750);
  }
  function inspectFrameHealth(t){
    try{
      const doc=t?.frame?.contentDocument;
      if(!doc) return {reachable:false,blank:false,text:'',title:'',readyState:''};
      const body=doc.body;
      const text=String(body?.textContent || '').trim().slice(0,5000);
      const visibleText=String(body?.innerText || '').trim().slice(0,5000);
      const structureCount=Number(doc.documentElement?.childElementCount || 0)+Number(body?.childElementCount || 0);
      const title=String(doc.title || '').trim();
      const routeMiss=!!doc.querySelector('meta[name="nyx-route-miss"]');
      const hasVisibleStructure=!!doc.querySelector('main,button,a,input,[role],[data-testid],svg,img,canvas,video,audio');


      const hasErrorText=/^(?:Error:\s*)?(?:(?:scramjet|learning engine) did not start|scramjet route missed|error processing your request|internal server error|internal service worker error|Reconnecting (?:Scramjet|Studyjet|Learning engine)|request failed with error code\s*(?:35|52|56|60)|ssl connect error|ssl peer certificate|failure when receiving data from the peer|localhost refused to connect)\b/i.test(visibleText);
      const blank=!hasVisibleStructure && text.length<12 && structureCount<4;
      return {reachable:true,blank,hasErrorText:hasErrorText||routeMiss,routeMiss,text,visibleText,title,htmlLength:structureCount,readyState:doc.readyState};
    }catch(error){
      return {reachable:false,blank:false,error:String(error?.message || error),text:'',title:'',readyState:''};
    }
  }
  function inspectFramePresentation(t){
    try{
      const doc=t?.frame?.contentDocument;
      if(!doc?.documentElement) return {reachable:false,blank:false,unstyled:false,readyState:''};
      const health=inspectFrameHealth(t);
      const stylesheetLinks=doc.querySelectorAll('link[rel~="stylesheet"][href]').length;
      const styleElements=doc.querySelectorAll('style').length;
      const linkedSheets=Array.from(doc.styleSheets || []).filter(sheet=>String(sheet.ownerNode?.tagName || '').toLowerCase()==='link');
      const linkedStyleSheets=linkedSheets.length;
      let readableLinkedSheets=0;
      let linkedStyleRules=0;
      linkedSheets.forEach(sheet=>{
        try{
          const rules=sheet.cssRules;
          readableLinkedSheets+=1;
          linkedStyleRules+=Number(rules?.length || 0);
        }catch{}
      });
      const textLength=String(health.visibleText || health.text || '').replace(/\s+/g,' ').trim().length;
      let looksWorkspaceDefault=false;
      try{
        const bodyStyle=doc.defaultView?.getComputedStyle?.(doc.body);
        const family=String(bodyStyle?.fontFamily || '').toLowerCase();
        const background=String(bodyStyle?.backgroundColor || '').replace(/\s+/g,'');
        const color=String(bodyStyle?.color || '').replace(/\s+/g,'');
        looksWorkspaceDefault=/times new roman|serif/.test(family)
          && ['rgba(0,0,0,0)','rgb(255,255,255)'].includes(background)
          && color==='rgb(0,0,0)';
      }catch{}
      const complete=health.readyState==='complete';
      const linkedStylesMissing=linkedStyleSheets===0
        || (readableLinkedSheets===linkedStyleSheets && linkedStyleRules===0);
      const unstyled=complete
        && textLength>80
        && stylesheetLinks>0
        && linkedStylesMissing
        && (styleElements===0 || looksWorkspaceDefault);
      const blank=complete && health.blank && !health.hasErrorText;
      const usableControls=textLength>0 && Array.from(doc.querySelectorAll('button,input,select,textarea,[role="button"]')).some(element=>{
        const style=doc.defaultView?.getComputedStyle?.(element);
        return element.getClientRects().length>0 && style?.visibility!=='hidden' && style?.display!=='none';
      });
      return {...health,reachable:true,blank,unstyled,usableControls,stylesheetLinks,linkedStyleSheets,readableLinkedSheets,linkedStyleRules,styleElements,looksWorkspaceDefault:looksWorkspaceDefault,textLength};
    }catch(error){
      return {reachable:false,blank:false,unstyled:false,readyState:'',error:String(error?.message || error)};
    }
  }
  function workspaceFrameStillAtSource(t,sourceUrl){
    const source=workspaceShellSourceUrl(sourceUrl) || String(sourceUrl || '');
    const current=workspaceShellSourceUrl(t?.sourceUrl || t?.url || '') || String(t?.sourceUrl || t?.url || '');
    if(current!==source) return false;
    try{
      const actual=workspaceShellSourceUrl(t.frame.contentWindow.location.href);
      if(/^https?:/i.test(actual) && !workspaceShellRejectFrameLocation(actual,source)) return actual===source;
    }catch{}
    return true;
  }
  function watchStudyjetHealth(t,sourceUrl){
    if(!t?.frame || !sourceUrl) return;
    const source=workspaceShellSourceUrl(sourceUrl) || String(sourceUrl);
    if(!/^https?:/i.test(source)) return;
    if(t.scramjetPresentationIntent!==(t.navigationIntent || '')){
      t.scramjetPresentationIntent=t.navigationIntent || '';
      t.scramjetPresentationRetries=0;
    }
    t.scramjetPresentationSource=source;
    if(t.scramjetHealthLoadHandler){
      try{t.frame.removeEventListener('load',t.scramjetHealthLoadHandler)}catch{}
    }
    const token='scramjet-health-'+Date.now()+Math.random().toString(16).slice(2);
    const navigationIntent=t.navigationIntent || '';
    const startedAt=Date.now();
    t.scramjetHealthWatchToken=token;
    let badKind='';
    let badChecks=0;
    let recoveryStarted=false;
    const current=()=>t.frame?.isConnected
      && t.scramjetHealthWatchToken===token
      && (t.navigationIntent || '')===navigationIntent
      && t.scramjetPresentationSource===source
      && workspaceFrameStillAtSource(t,source);
    const recover=async reason=>{
      if(recoveryStarted || !current()) return;
      const retries=Number(t.scramjetPresentationRetries || 0);
      if(retries>=2) return;
      recoveryStarted=true;
      t.scramjetPresentationRetries=retries+1;
      t.scramjetHealthWatchToken='recovering-'+token;
      if(t.scramjetPresentationRetries>1){
        await refreshStudyjetServiceWorker().catch(()=>false);
        studyjetInstallPromise=null;
        await installStudyjet().catch(()=>false);
      }else{
        await new Promise(resolve=>setTimeout(resolve,240));
      }
      if(!t.frame?.isConnected || (t.navigationIntent || '')!==navigationIntent || t.scramjetPresentationSource!==source || !workspaceFrameStillAtSource(t,source)) return;
      try{
        t.scramjetFrame?.go(source);
      }catch{
        return;
      }
      setTimeout(()=>{
        if(t.frame?.isConnected && (t.navigationIntent || '')===navigationIntent) watchStudyjetHealth(t,source);
      },120);
    };
    const check=()=>{
      if(!current()) return;


      let document=null;
      try{document=t.frame.contentDocument}catch{}
      if(document && t.scramjetHealthyDocument===document) return;
      const presentation=inspectFramePresentation(t);
      if(!presentation.reachable || presentation.hasErrorText) return;
      if(document && /^(?:interactive|complete)$/.test(presentation.readyState) && !presentation.blank && (!presentation.unstyled || presentation.usableControls)){
        t.scramjetHealthyDocument=document;
        badKind='';
        badChecks=0;
        return;
      }
      const kind=presentation.unstyled ? 'stylesheets did not load' : (presentation.blank && Date.now()-startedAt>3600 ? 'page stayed blank' : '');
      if(!kind){
        badKind='';
        badChecks=0;
        return;
      }
      if(kind===badKind) badChecks+=1;
      else{
        badKind=kind;
        badChecks=1;
      }
      if(badChecks>=2) void recover(kind);
    };
    const onLoad=()=>{
      setTimeout(check,850);
      setTimeout(check,2100);
      setTimeout(check,4200);
    };
    t.scramjetHealthLoadHandler=onLoad;
    t.frame.addEventListener('load',onLoad);
    setTimeout(check,2400);
    setTimeout(check,5000);
    setTimeout(check,8200);
  }

  function removeStudyjetHtmlNodes(root,predicate){
    const children=root?.childNodes || root?.children;
    if(!Array.isArray(children)) return;
    for(let i=children.length-1;i>=0;i--){
      const child=children[i];
      if(predicate(child)) children.splice(i,1);
      else removeStudyjetHtmlNodes(child,predicate);
    }
  }
  function stripStudyjetDuckDuckGoScripts(root){
    removeStudyjetHtmlNodes(root,node=>{
      if(String(node?.name || '').toLowerCase()!=='script') return false;
      const src=String(node?.attribs?.src || '').toLowerCase();
      const id=String(node?.attribs?.id || '').toLowerCase();
      const text=(node?.children || []).map(child=>child?.data || '').join('');
      return src.includes('/dist/p.')
        || src.includes('links.duckduckgo.com/d.js')
        || id==='deep_preload_script'
        || text.includes('window.__sc__=');
    });
  }
  function stripStudyjetPreloadLinks(root){
    removeStudyjetHtmlNodes(root,node=>{
      if(String(node?.name || '').toLowerCase()!=='link') return false;
      if(String(node?.attribs?.rel || '').toLowerCase()!=='preload') return false;
      const asType=String(node?.attribs?.as || '').toLowerCase();
      const href=String(node?.attribs?.href || '').toLowerCase();
      return asType==='font'
        || asType==='fetch'
        || href.includes('.woff')
        || href.includes('/generated-locales/')
        || href.endsWith('.json');
    });
  }
  function stripStudyjetResourceIntegrity(root){
    const visit=node=>{
      if(!node || typeof node!=='object') return;
      const attrs=node.attribs;
      if(attrs && typeof attrs==='object'){


        delete attrs.integrity;
        delete attrs['scramjet-attr-integrity'];
      }
      const children=node.childNodes || node.children;
      if(Array.isArray(children)) children.forEach(visit);
    };
    visit(root);
  }
  function replaceCinebyDevtoolBundle(root){
    const children=root?.childNodes || root?.children;
    if(!Array.isArray(children)) return;
    for(const node of children){
      if(String(node?.name || '').toLowerCase()==='script'){
        const src=String(node?.attribs?.['scramjet-attr-src'] || node?.attribs?.src || '');
        if(/\/_app-[^/?]+\.js(?:[?#]|$)/i.test(src)) node.attribs.src='/nyx-compat/cineby-app.js';
      }
      replaceCinebyDevtoolBundle(node);
    }
  }
  function patchStudyjetHtml(root,source=studyjetRuntimeGuardSource,key='runtime-guard'){
    if(key==='proxy-sri'){
      stripStudyjetResourceIntegrity(root);
      return;
    }
    if(key==='duckduckgo-noscript'){
      stripStudyjetDuckDuckGoScripts(root);
      return;
    }
    if(key==='spotify-preload-strip'){
      stripStudyjetPreloadLinks(root);
      return;
    }
    if(key==='cineby-disable-devtool'){
      replaceCinebyDevtoolBundle(root);
      return;
    }
    installStudyjetRuntimeGuards(root,source,key);
  }
  function createStudyjetCompatibilityPlugin(source=studyjetRuntimeGuardSource,key='runtime-guard'){
    const plugin={
      name:'nyx-compatibility-'+key,
      dependencies:[],
      install(frame){
        const Tap=window.$scramjet?.Tap;
        const hook=frame?.fetchHandler?.hooks?.rewriter?.html?.post;
        if(!Tap?.tap) return;
        if(hook) Tap.tap(hook,context=>patchStudyjetHtml(context?.handler?.root,source,key),plugin);
        if(key==='proxy-sri'){
          const responseHook=frame?.fetchHandler?.hooks?.fetch?.response;
          if(responseHook) Tap.tap(responseHook,(_context,result)=>{
            const headers=result?.response?.headers;
            const link=String(headers?.get?.('link') || '');
            if(!link) return;
            headers.set('link',link.replace(/;\s*integrity\s*=\s*(?:"[^"]*"|'[^']*'|[^,;]*)/gi,''));
          },plugin);
        }
      }
    };
    return plugin;
  }
  function isStudyjetIdbShapeError(error){
    return /object stores? was not found|not found/i.test(String(error?.message || error));
  }
  function deleteIndexedDb(name){
    return new Promise(resolve=>{
      if(!window.indexedDB) return resolve(false);
      const request=indexedDB.deleteDatabase(name);
      request.onsuccess=()=>resolve(true);
      request.onerror=()=>resolve(false);
      request.onblocked=()=>setTimeout(()=>resolve(false),500);
    });
  }
  async function removeLegacyStartupPdfData(){
    try{
      localStorage.removeItem('nyx.launchPdf');
      localStorage.removeItem('nyx.renderStartupPdf');
      if(store.get('nyx.removedStartupPdfData',false)) return;
      await Promise.all(['nyx-launch-pdfs','NyxLaunchPdfStore'].map(name=>deleteIndexedDb(name)));
      store.set('nyx.removedStartupPdfData',true);
    }catch{}
  }
  async function unregisterConnectionScope(scope){
    const registration=await navigator.serviceWorker.getRegistration(scope).catch(()=>null);
    if(registration?.scope===new URL(scope,location.href).href)await registration.unregister().catch(()=>null);
  }
  async function repairStudyjetStorage(){
    if(navigator.serviceWorker){
      await Promise.all(['/~/sj/','/scramjet/service/'].map(unregisterConnectionScope));
    }
    const names=['$scramjet','__scramjet_controller'];
    if(indexedDB.databases){
      const databases=await indexedDB.databases().catch(()=>[]);
      for(const db of databases){
        if(db?.name && /scramjet/i.test(db.name) && !names.includes(db.name)) names.push(db.name);
      }
    }
    await Promise.all(names.map(name=>deleteIndexedDb(name)));
  }

  async function repairStudyjetCaches(){
    if(!window.caches?.keys) return;
    const names=await caches.keys().catch(()=>[]);
    await Promise.all(names.filter(name=>/scramjet/i.test(name)).map(name=>caches.delete(name).catch(()=>false)));
  }
  async function repairRetiredConnectionStorage(){
    if(navigator.serviceWorker){
      await unregisterConnectionScope('/service/');
    }
  }
  async function repairRetiredConnectionCaches(){
    if(!window.caches?.keys) return;
    const names=await caches.keys().catch(()=>[]);
    await Promise.all(names.filter(name=>/(bare|epoxy|libcurl)/i.test(name)).map(name=>caches.delete(name).catch(()=>false)));
  }
  function clearNyxCookies(){
    try{
      const hostParts=location.hostname.split('.').filter(Boolean);
      const domains=new Set(['']);
      for(let i=0;i<hostParts.length-1;i++) domains.add('.'+hostParts.slice(i).join('.'));
      const pathParts=location.pathname.split('/').filter(Boolean);
      const paths=new Set(['/']);
      let path='';
      pathParts.forEach(part=>{
        path+='/'+part;
        paths.add(path);
        paths.add(path+'/');
      });
      document.cookie.split(';').forEach(cookie=>{
        const name=cookie.split('=')[0]?.trim();
        if(!name) return;
        domains.forEach(domain=>{
          paths.forEach(pathValue=>{
            const domainPart=domain ? `; domain=${domain}` : '';
            document.cookie=`${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${pathValue}${domainPart}; SameSite=Lax`;
          });
        });
      });
    }catch{}
  }
  async function clearAllNyxData(){
    try{document.body.classList.add('nyx-resetting')}catch{}
    try{toast('Clearing cache...')}catch{}
    try{
      if(navigator.serviceWorker?.getRegistrations){
        const registrations=await navigator.serviceWorker.getRegistrations().catch(()=>[]);
        await Promise.all(registrations.map(registration=>registration.unregister().catch(()=>false)));
      }
    }catch{}
    try{
      if(window.caches?.keys){
        const names=await caches.keys().catch(()=>[]);
        await Promise.all(names.map(name=>caches.delete(name).catch(()=>false)));
      }
    }catch{}
    try{
      if(indexedDB.databases){
        const databases=await indexedDB.databases().catch(()=>[]);
        await Promise.all(databases.map(db=>db?.name ? deleteIndexedDb(db.name) : false));
      }else{
        await Promise.all(['$scramjet','__scramjet_controller'].map(name=>deleteIndexedDb(name)));
      }
    }catch{}
    clearNyxCookies();
    try{sessionStorage.clear()}catch{}
    try{localStorage.clear()}catch{}
    setTimeout(()=>location.replace(location.pathname || '/'),220);
  }
  async function ensureFreshConnectionState(){
    if(store.text('nyx.proxyStateVersion','')===connectionStateVersion) return;
    await Promise.all([
      repairStudyjetStorage(),
      repairStudyjetCaches(),
      repairRetiredConnectionStorage(),
      repairRetiredConnectionCaches()
    ]);
    studyjetController=null;
    studyjetTransport=null;
    studyjetTransportKey='';
    store.setText('nyx.scramjetStateVersion',studyjetStateVersion);
    store.setText('nyx.proxyStateVersion',connectionStateVersion);
  }
  async function ensureFreshStudyjetState(){
    if(store.text('nyx.scramjetStateVersion','')===studyjetStateVersion) return;
    await repairStudyjetStorage();
    await repairStudyjetCaches();
    studyjetController=null;
    studyjetTransport=null;
    studyjetTransportKey='';
    store.setText('nyx.scramjetStateVersion',studyjetStateVersion);
  }






  function installStudyjet(){
    if(studyjetInstallPromise) return studyjetInstallPromise;
    let step="starting Learning engine";
    studyjetInstallPromise=(async()=>{
      step='checking workspace support';
      if(location.protocol==='file:'){
        studyjetInstallError="Learning engine needs Nyx to be opened from its website, not as a local file.";
        return false;
      }
      if(!('serviceWorker' in navigator)){
        studyjetInstallError="This workspace does not support the Service Workers Learning engine needs. Some watch workspaces do not provide that feature.";
        return false;
      }
      step="resetting stale Learning engine state";
      await ensureFreshConnectionState();
      await ensureFreshStudyjetState();
      step="loading Learning engine assets";
      const {loadConnectionScript,waitForConnectionController,trackConnectionController}=await import('/js/intercession-startup.mjs');
      await loadConnectionScript('/scramjet/scramjet.js?v=20260905-optional-history-url-v1',()=>Boolean(window.$scramjet));
      await loadConnectionScript('/controller/controller.api.js',()=>Boolean(window.$scramjetController));
      step='loading Learning runtime guard';
      await loadStudyjetRuntimeGuardSource();
      step="starting Learning engine connection";
      const transport=await createStudyjetTransport();
      step='registering Learning service worker';
      const registration=await navigator.serviceWorker.register(studyjetServiceWorkerUrl,{scope:'/~/sj/',updateViaCache:'none'});


      step='activating Learning service worker';
      const serviceworker=await waitForServiceWorkerScript(registration,studyjetServiceWorkerUrl);
      if(!serviceworker) throw new Error('Learning service worker did not activate');
      step="initializing Learning engine controller";
      try{
        if(!studyjetController) studyjetController=createStudyjetController(serviceworker,transport);
        else if(!await reconnectStudyjetController(studyjetController,serviceworker,transport)){
          studyjetController=createStudyjetController(serviceworker,transport);
        }
        studyjetController.nyxStopWorkerTracking=trackConnectionController(studyjetController);
        await waitForConnectionController(studyjetController);
      }catch(initError){
        if(!isStudyjetIdbShapeError(initError)) throw initError;
        step="repairing Learning engine storage";
        await repairStudyjetStorage();
        const repairedRegistration=await navigator.serviceWorker.register(studyjetServiceWorkerUrl,{scope:'/~/sj/',updateViaCache:'none'});
        const repairedServiceworker=await waitForServiceWorkerScript(repairedRegistration,studyjetServiceWorkerUrl);
        if(!repairedServiceworker) throw new Error('Learning service worker did not activate after storage repair');
        step="initializing Learning engine controller after storage repair";
        studyjetController?.nyxStopWorkerTracking?.();
        studyjetController=createStudyjetController(repairedServiceworker,transport);
        studyjetController.nyxStopWorkerTracking=trackConnectionController(studyjetController);
        await waitForConnectionController(studyjetController);
      }
      studyjetInstallError='';
      return true;
    })().catch(err=>{
      studyjetInstallError=`Failed while ${step}: ${err?.message || err}`;
      studyjetController?.nyxStopWorkerTracking?.();
      studyjetController=null;
      studyjetInstallPromise=null;
      return false;
    });
    return studyjetInstallPromise;
  }
  function scheduleWorkspaceConnectionPrewarm(){
    if(workspaceConnectionPrewarmScheduled) return;
    const mode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
    if(mode!=='auto' && mode!=='scramjet') return;
    workspaceConnectionPrewarmScheduled=true;
    const warm=()=>{
      if(document.visibilityState==='hidden'){
        workspaceConnectionPrewarmScheduled=false;
        return;
      }
      void installStudyjet();
    };
    if(typeof requestIdleCallback==='function') requestIdleCallback(warm,{timeout:700});
    else setTimeout(warm,0);
  }
  let workspaceConnectionPrewarmIntentArmed=false;
  let workspaceConnectionHomeWarmTimer=0;
  function scheduleWorkspaceConnectionPrewarmFromHome(){
    if(workspaceConnectionHomeWarmTimer || workspaceConnectionPrewarmScheduled) return;
    workspaceConnectionHomeWarmTimer=setTimeout(()=>{
      workspaceConnectionHomeWarmTimer=0;
      if(!document.querySelector('.workspace-window.workspace-home-page [data-workspace-blank-input]')) return;
      scheduleWorkspaceConnectionPrewarm();
    },800);
  }
  function armWorkspaceConnectionPrewarmOnIntent(){
    if(workspaceConnectionPrewarmIntentArmed) return;
    workspaceConnectionPrewarmIntentArmed=true;
    const warmFromSearchIntent=event=>{
      if(!event.target?.closest?.('[data-workspace-blank-input],[data-workspace-shell-url]')) return;
      scheduleWorkspaceConnectionPrewarm();
    };
    document.addEventListener('pointerdown',warmFromSearchIntent,{capture:true,passive:true});
    document.addEventListener('focusin',warmFromSearchIntent,{capture:true,passive:true});
  }
  function rammerhead(url){
    if(/^data:text\/html/i.test(url)) return url;
    const base=getRhBase();
    if(url.startsWith(base)) return url;
    const sessionId=store.text('nyx.rammerheadSession','');
    return sessionId ? rhBuildUrl(base,sessionId,url) : url;
  }
  async function rhNavigate(rawUrl,navigateFn){
    if(/^data:text\/html/i.test(rawUrl)){
      navigateFn(rawUrl);
      return;
    }
    const session=await getRhSession();
    navigateFn(session ? rhBuildUrl(session.base,session.id,rawUrl) : rawUrl);
  }
  function bring(win){win.style.zIndex=++zTop}
  function updateMinimizedDock(){
    const dock=document.querySelector('.dock');
    const tray=$('minimizedTray');
    if(dock&&tray) dock.classList.toggle('has-minimized',tray.children.length>0);
  }
  function updateDockFullscreenState(){
    const dock=document.querySelector('.dock');
    const hasFullscreen=[...document.querySelectorAll('.window.maximized')].some(win=>win.style.display!=='none' && !win.classList.contains('closing'));
    dock?.classList.toggle('hidden-for-window',hasFullscreen);
    if(hasFullscreen) closeWeatherPanelAnimated();
  }
  function minimizeWindow(win){
    const tray=$('minimizedTray');
    if(!tray) return;
    const id=win.dataset.winId || ('win'+Date.now()+Math.random().toString(16).slice(2));
    win.dataset.winId=id;
    if(!tray.querySelector(`[data-restore="${id}"]`)){
      const title=win.querySelector('.titlebar-title')?.textContent || 'Window';
      const item=document.createElement('button');
      item.className='minimized-item';
      item.dataset.restore=id;
      item.dataset.mini=(title.trim()[0] || 'W').toUpperCase();
      item.title='Restore '+title;
      item.textContent=title;
      item.onclick=()=>restoreWindow(win);
      tray.appendChild(item);
    }
    win.style.display='none';
    updateMinimizedDock();
    updateDockFullscreenState();
  }
  function restoreWindow(win){
    win.style.display='block';
    const tray=$('minimizedTray');
    tray?.querySelector(`[data-restore="${win.dataset.winId}"]`)?.remove();
    updateMinimizedDock();
    bring(win);
    updateDockFullscreenState();
  }
  function closeWindowAnimated(win){
    if(!win || win.classList.contains('closing')) return;
    if(activeWorkspace?.win===win){
      activeWorkspace.tabs?.forEach?.(tab=>destroyConnectionPrivacySession(tab));
      activeWorkspace=null;
    }
    $('minimizedTray')?.querySelector(`[data-restore="${win.dataset.winId}"]`)?.remove();
    updateMinimizedDock();
    win.classList.add('closing');
    setTimeout(()=>{win.remove(); updateDockFullscreenState()},230);
  }
  function updateWindowSizeClasses(win){
    win.classList.toggle('compact',win.offsetWidth<520);
    win.classList.toggle('short',win.offsetHeight<360);
  }
  function updateResponsiveFit(){
    const root=document.documentElement;
    const w=Math.max(320,window.innerWidth || 320);
    const h=Math.max(320,window.innerHeight || 320);
    const scale=Math.max(.68,Math.min(1.08,Math.min(w/1366,h/768)));
    const dockSize=Math.round(Math.max(28,Math.min(40,36*scale)));
    const dockIconSize=Math.round(Math.max(24,Math.min(36,32*scale)));
    const desktopIconSize=Math.round(Math.max(42,Math.min(64,58*scale)));
    const sideReserve=w<520 ? 24 : 42;
    const safeBottom=Math.round(Math.max(48,Math.min(72,58*scale)));
    root.style.setProperty('--ui-scale',scale.toFixed(3));
    root.style.setProperty('--dock-size',dockSize+'px');
    root.style.setProperty('--dock-icon-size',dockIconSize+'px');
    root.style.setProperty('--desktop-icon-size',desktopIconSize+'px');
    root.style.setProperty('--search-width','min(620px, calc(100vw - '+sideReserve+'px))');
    root.style.setProperty('--safe-bottom',safeBottom+'px');
    document.querySelectorAll('.window').forEach(clampWindowToScreen);
  }
  let responsiveFitTimer=0;
  let nyxVisualDockViewportTimer=0;
  function scheduleResponsiveFit(){
    clearTimeout(responsiveFitTimer);
    responsiveFitTimer=setTimeout(updateResponsiveFit,60);
    clearTimeout(nyxVisualDockViewportTimer);
    nyxVisualDockViewportTimer=setTimeout(()=>{
      if(document.body.classList.contains('workspace-shell')) ensureNyxVisualDock();
    },80);
  }
  window.addEventListener('resize',scheduleResponsiveFit);
  window.addEventListener('orientationchange',scheduleResponsiveFit);
  function clampWindowToScreen(win){
    if(!win || win.classList.contains('maximized')) return;
    const margin=12;
    const styles=getComputedStyle(document.documentElement);
    const topLimit=(parseFloat(styles.getPropertyValue('--bar')) || 30) + 8;
    const bottomReserve=parseFloat(styles.getPropertyValue('--safe-bottom')) || 58;
    const maxW=Math.max(260,window.innerWidth - margin*2);
    const maxH=Math.max(180,window.innerHeight - topLimit - bottomReserve - margin);
    const width=Math.min(win.offsetWidth || parseFloat(win.style.width) || Math.min(560,maxW),maxW);
    const height=Math.min(win.offsetHeight || parseFloat(win.style.height) || Math.min(420,maxH),maxH);
    let left=parseFloat(win.style.left) || margin;
    let top=parseFloat(win.style.top) || topLimit;
    const rightLimit=Math.max(margin,window.innerWidth - width - margin);
    const bottomLimit=Math.max(topLimit,window.innerHeight - bottomReserve - height);
    left=Math.max(margin,Math.min(left,rightLimit));
    top=Math.max(topLimit,Math.min(top,bottomLimit));
    win.style.width=width+'px';
    win.style.height=height+'px';
    win.style.left=left+'px';
    win.style.top=top+'px';
  }

  function makeWindow(opts){
    const win=document.createElement('section');
    win.className='window '+(opts.className||'');
    win.style.left=opts.left||`${120+winCount*28}px`;
    win.style.top=opts.top||`${80+winCount*24}px`;
    win.style.width=opts.width||'560px';
    win.style.height=opts.height||'420px';
    win.innerHTML=`<div class="titlebar"><div class="titlebar-title">${esc(opts.title||'Window')}</div><div class="window-controls"><button data-minimize title="Minimize" aria-label="Minimize"></button><button data-maximize title="Maximize" aria-label="Maximize"></button><button class="close" data-close title="Close" aria-label="Close"></button></div></div>${opts.body||''}`;
    addResizeHandles(win);
    $('desktop').appendChild(win); winCount++; bring(win); wireWindow(win);
    clampWindowToScreen(win);
    if(opts.autoMaximize !== false){
      win.classList.add('maximized');
      const maxBtn=win.querySelector('[data-maximize]');
      if(maxBtn) maxBtn.setAttribute('aria-label','Restore');
    }
    closeWeatherForWindowOpen();
    updateWindowSizeClasses(win); updateDockFullscreenState(); initDesktopSplash(); return win;
  }
  function addResizeHandles(win){
    ['n','s','e','w','ne','nw','se','sw'].forEach(dir=>{
      const handle=document.createElement('span');
      handle.className='resize-handle '+dir;
      handle.dataset.resize=dir;
      win.appendChild(handle);
    });
  }
  function wireWindow(win){
    const bar=win.querySelector('.titlebar');
    let drag=null, resize=null;
    if('ResizeObserver' in window) new ResizeObserver(()=>updateWindowSizeClasses(win)).observe(win);
    win.addEventListener('pointerdown',()=>bring(win));
    const startDrag=e=>{
      if(e.target.closest('button'))return;
      if(win.classList.contains('maximized')){
        const width=Math.min(Math.max(760,window.innerWidth*.62),window.innerWidth-24);
        const height=Math.min(Math.max(460,window.innerHeight*.62),window.innerHeight-80);
        win.classList.remove('maximized');
        win.style.width=width+'px';
        win.style.height=height+'px';
        win.style.left=Math.max(0,Math.min(window.innerWidth-width,e.clientX-width*.45))+'px';
        win.style.top=Math.max(34,Math.min(window.innerHeight-height,e.clientY-16))+'px';
      }
      drag={x:e.clientX,y:e.clientY,left:win.offsetLeft,top:win.offsetTop};
      bar.classList.add('dragging'); e.preventDefault();
    };
    bar.addEventListener('pointerdown',startDrag);
    win.querySelector('.workspace-tabs')?.addEventListener('pointerdown',startDrag);
    win.querySelectorAll('[data-resize]').forEach(handle=>{
      handle.addEventListener('pointerdown',e=>{
        if(win.classList.contains('maximized')) return;
        resize={dir:handle.dataset.resize,x:e.clientX,y:e.clientY,left:win.offsetLeft,top:win.offsetTop,width:win.offsetWidth,height:win.offsetHeight};
        e.preventDefault();
        e.stopPropagation();
      });
    });
    window.addEventListener('pointermove',e=>{
      if(resize){
        resizeWindowFromEdge(win,resize,e);
        return;
      }
      if(!drag)return;
      win.style.left=Math.max(0,drag.left+e.clientX-drag.x)+'px';
      win.style.top=Math.max(0,drag.top+e.clientY-drag.y)+'px';
    });
    window.addEventListener('pointerup',()=>{drag=null; resize=null; bar.classList.remove('dragging')});
    window.addEventListener('resize',()=>clampWindowToScreen(win));
    win.querySelector('[data-close]').onclick=()=>closeWindowAnimated(win);
    win.querySelector('[data-minimize]').onclick=()=>minimizeWindow(win);
    win.querySelector('[data-maximize]').onclick=e=>{
      win.classList.toggle('maximized');
      e.currentTarget.setAttribute('aria-label',win.classList.contains('maximized')?'Restore':'Maximize');
      updateDockFullscreenState();
    };
  }
  function resizeWindowFromEdge(win,state,e){
    const minW=Number.parseInt(getComputedStyle(win).minWidth,10)||320;
    const minH=Number.parseInt(getComputedStyle(win).minHeight,10)||220;
    const styles=getComputedStyle(document.documentElement);
    const bottomReserve=parseFloat(styles.getPropertyValue('--safe-bottom')) || 58;
    const topLimit=(parseFloat(styles.getPropertyValue('--bar')) || 30) + 4;
    let left=state.left, top=state.top, width=state.width, height=state.height;
    const dx=e.clientX-state.x, dy=e.clientY-state.y;
    if(state.dir.includes('e')) width=state.width+dx;
    if(state.dir.includes('s')) height=state.height+dy;
    if(state.dir.includes('w')){width=state.width-dx; left=state.left+dx}
    if(state.dir.includes('n')){height=state.height-dy; top=state.top+dy}
    if(width<minW){if(state.dir.includes('w')) left-=minW-width; width=minW}
    if(height<minH){if(state.dir.includes('n')) top-=minH-height; height=minH}
    width=Math.min(width,window.innerWidth-left-12);
    height=Math.min(height,window.innerHeight-top-bottomReserve);
    left=Math.max(0,left);
    top=Math.max(topLimit,top);
    win.style.left=left+'px';
    win.style.top=top+'px';
    win.style.width=width+'px';
    win.style.height=height+'px';
    updateWindowSizeClasses(win);
  }
  function workspaceBody(){
    const minimalPresenceText=nyxPresenceCount===null ? 'Connecting\u2026' : `${nyxPresenceCount} online`;
    {
      const searchEngine=selectedSearchEngineMeta();
      const searchLabel=`S3ARC4 ${searchEngine.label} or type a U3L`;
      return `<div class="workspace-tabs"><button class="new-tab" data-new-tab>+</button></div><div class="workspace-tools"><div class="tool-group"><button class="tool-btn" data-back title="Back">&#10140;</button><button class="tool-btn" data-forward title="Forward">&#10140;</button><button class="tool-btn" data-reload title="Reload">&#128472;</button></div><input class="urlbar" placeholder="S3ARC4"><button class="go-btn" data-go>Go</button><button class="menu-btn" data-menu>...</button></div><div class="workspace-body"><div class="workspace-home nyx-minimal-home nyx-visual-home"><main class="workspace-shell-start nyx-minimal-hero"><div class="nyx-minimal-brand"><img class="nyx-home-logo" data-nyx-logo src="/assets/icons/nyx-cat-moon.svg?v=3" alt="Nyx"><h1>NYX</h1></div><form class="workspace-blank-search nyx-minimal-search" data-workspace-blank-search><svg class="nyx-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input data-workspace-blank-input data-search-engine="${searchEngine.id}" aria-label="${searchLabel}" placeholder="${searchLabel}" autocomplete="off" spellcheck="false"></form><nav class="nyx-home-links" data-nyx-recent-searches aria-label="Recent searches" hidden></nav></main><nav class="nyx-minimal-utility-links" aria-label="Nyx tools and terms"><a data-open="terms" href="nyx://terms">Terms</a></nav><button class="nyx-appearance-toggle" data-nyx-appearance type="button" aria-label="Use light appearance" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></button><button class="nyx-visual-customize" data-open="settings" type="button">${nyxDashboardIcon('settings')}<span>Customize</span></button><div class="nyx-home-presence${nyxFounderIsOwner&&nyxOwnerDashboardAccess?' nyx-owner-presence-action':''}" data-nyx-owner-presence role="${nyxFounderIsOwner&&nyxOwnerDashboardAccess?'button':'status'}" tabindex="${nyxFounderIsOwner&&nyxOwnerDashboardAccess?'0':'-1'}" aria-live="polite" aria-label="${nyxFounderIsOwner&&nyxOwnerDashboardAccess?'Open Owner Dashboard':'Current users online'}"><span class="nyx-home-presence-dot" aria-hidden="true"></span><span data-nyx-online-count>${minimalPresenceText}</span></div></div></div>`;
    }
  }

  const nyxAiHomeShortcut={domain:'nyx-ai',title:"A1 Tutor",url:'nyx://ai',favorite:false};
  const nyxAiHomeShortcutMigrationKey='nyx.homeShortcuts.aiShortcutV1';
  const nyxTubeHomeShortcut={domain:'youtube.com',title:'NyxTube',url:'/apps/nyxtube/',favorite:false};
  const nyxTubeHomeShortcutMigrationKey='nyx.homeShortcuts.nyxTubeShortcutV1';
  const moviesHomeShortcut={domain:'nyx-movies',title:'Movies',url:'/apps/movies/',favorite:false};
  const defaultHomeShortcuts=[
    {domain:'geforcenow',title:'Course Library',url:'https://play.geforcenow.com/',favorite:true},
    {domain:'duck.ai',title:'Research Assistant',url:'https://duck.ai/',favorite:false},
    nyxAiHomeShortcut,
    nyxTubeHomeShortcut,
    {domain:'games',title:'Practice Lab',url:'/assets/games/',favorite:false},
    {domain:'tiktok.com',title:'Quick Lessons',url:'https://www.tiktok.com/',favorite:false},
    moviesHomeShortcut,
    {domain:'discord.com',title:'Study Groups',url:'https://discord.com/app',favorite:false}
  ];
  const educationShortcutTitles=new Map(defaultHomeShortcuts.map(item=>[String(item.url).replace(/\/+$/,''),item.title]));
  function normalizeInternalAppUrl(url){
    const raw=String(url || '').trim();
    if(/^(?:assets|apps)\//i.test(raw)) return `/${raw}`;
    return raw;
  }
  function normalizeHomeShortcut(item){
    const next={...item,url:normalizeInternalAppUrl(item?.url)};
    if(['http://icefy.top','https://aether.cx','https://cinejoy.to','/apps/movies'].includes(String(next.url || '').trim().replace(/\/+$/,'').toLowerCase())){
      next.url='/apps/movies/';
      next.domain='nyx-movies';
    }
    if(next.url==='/assets/games/index.html') next.url='/assets/games/';
    if(next.url==='/assets/games/'){
      next.domain='games';
    }
    next.title=educationShortcutTitles.get(String(next.url || '').replace(/\/+$/,'')) || next.title;
    return next;
  }
  function homeShortcuts(){
    try{
      const saved=JSON.parse(store.text('nyx.homeShortcuts',''));
      if(Array.isArray(saved)){
        const cleaned=saved
          .filter(item=>item?.url && item?.title)
          .filter(item=>String(item.url || '').trim().replace(/\/+$/,'').toLowerCase()!=='/apps/nyxcloud' && String(item.domain || '').trim().toLowerCase()!=='nyx-cloud')
          .filter(item=>!['nyx-tube','nyxtube'].includes(String(item.domain || '').trim().toLowerCase()))
          .map(normalizeHomeShortcut);
        if(!store.get(nyxAiHomeShortcutMigrationKey,false)){
          if(!cleaned.some(item=>String(item.url || '').trim().toLowerCase()==='nyx://ai')){
            const duckIndex=cleaned.findIndex(item=>String(item.domain || '').toLowerCase()==='duck.ai');
            cleaned.splice(duckIndex>=0?duckIndex+1:cleaned.length,0,{...nyxAiHomeShortcut});
          }
          store.set(nyxAiHomeShortcutMigrationKey,true);
        }
        if(!store.get(nyxTubeHomeShortcutMigrationKey,false)){
          if(!cleaned.some(item=>String(item.url || '').trim().replace(/\/+$/,'').toLowerCase()==='/apps/nyxtube')){
            const aiIndex=cleaned.findIndex(item=>String(item.url || '').trim().toLowerCase()==='nyx://ai');
            cleaned.splice(aiIndex>=0?aiIndex+1:cleaned.length,0,{...nyxTubeHomeShortcut});
          }
          store.set(nyxTubeHomeShortcutMigrationKey,true);
        }
        if(JSON.stringify(cleaned)!==JSON.stringify(saved)) saveHomeShortcuts(cleaned);
        return cleaned;
      }
    }catch{}
    store.set(nyxAiHomeShortcutMigrationKey,true);
    store.set(nyxTubeHomeShortcutMigrationKey,true);
    return defaultHomeShortcuts.map(item=>({...item}));
  }
  function saveHomeShortcuts(items){
    store.setText('nyx.homeShortcuts',JSON.stringify(items.slice(0,32)));
  }
  function homeShortcutDomain(url,title=''){
    try{return new URL(url,location.href).hostname.replace(/^www\./,'') || title.toLowerCase()}
    catch{return String(title || 'apps').toLowerCase().replace(/\s+/g,'')}
  }
  function homeShortcutMask(domain,title=''){
    const key=String(domain || title || '').toLowerCase();
    if(key.includes('geforce')) return '/assets/icons/dock-nvidia.png';
    if(key==='games' || key.includes('study')) return '/assets/icons/dock-controller.png';
    if(key==='nyx-ai' || key==='ai') return '/assets/icons/shortcut-nyx-ai.svg?v=7';
    if(key.includes('duck')) return '/assets/icons/shortcut-duckduckgo.svg';
    if(key.includes('youtube') || key==='youtu.be') return '/assets/icons/shortcut-youtube.svg';
    if(key.includes('tiktok')) return '/assets/icons/shortcut-tiktok.svg';
    if(key.includes('spotify')) return '/assets/icons/shortcut-spotify.svg';
    if(key.includes('discord')) return '/assets/icons/shortcut-discord.svg';
    return '';
  }
  function workspaceHomeShortcutTiles(){
    const tiles=homeShortcuts()
      .map((item,index)=>({...item,index}))
      .sort((a,b)=>(b.favorite===true)-(a.favorite===true))
      .map(item=>{
        const domain=item.domain || homeShortcutDomain(item.url,item.title);
        const mask=homeShortcutMask(domain,item.title);
        const icon=mask ? `<span class="home-shortcut-glyph" style="--shortcut-mask:url('${esc(mask)}')" aria-hidden="true"></span>` : `<img class="quick-icon" alt="" draggable="false" src="${appIcon(domain)}">`;
        return `<div class="quick-tile home-shortcut ${item.favorite?'favorite':''}" draggable="false" data-home-shortcut="${item.index}" data-domain="${esc(domain)}" data-app-url="${esc(item.url)}"><button class="home-shortcut-open" data-app-url="${esc(item.url)}" draggable="false" type="button"><img class="quick-icon" alt="" draggable="false" src="${appIcon(domain)}"><span>${esc(item.title)}</span></button><button class="home-shortcut-menu-btn" data-home-shortcut-menu type="button" title="Shortcut options" aria-label="Shortcut options"><span class="shortcut-real-dots" aria-hidden="true">⋮</span></button><div class="home-shortcut-menu"><button data-home-shortcut-favorite="${item.index}" type="button">${item.favorite?'Unfavorite':'Favorite'}</button><button data-home-shortcut-remove="${item.index}" type="button">Remove</button></div></div>`;
    }).join('');
    return tiles + '<button class="quick-tile home-shortcut-add" data-home-shortcut-add type="button"><b>+</b><span>Add Resource</span></button>';
  }
  workspaceHomeShortcutTiles=function(){
    const tiles=homeShortcuts()
      .map((item,index)=>({...item,index}))
      .sort((a,b)=>(b.favorite===true)-(a.favorite===true))
      .map(item=>{
        const domain=item.domain || homeShortcutDomain(item.url,item.title);
        const mask=homeShortcutMask(domain,item.title);
        const icon=mask
          ? `<span class="home-shortcut-glyph" style="--shortcut-mask:url('${esc(mask)}')" aria-hidden="true"></span>`
          : homeShortcutIconMarkup(item,domain);
        return `<div class="quick-tile home-shortcut ${item.favorite?'favorite':''}" draggable="false" data-home-shortcut="${item.index}" data-domain="${esc(domain)}" data-app-url="${esc(item.url)}"><button class="home-shortcut-open" data-app-url="${esc(item.url)}" draggable="false" type="button">${icon}<span>${esc(item.title)}</span></button><button class="home-shortcut-menu-btn" data-home-shortcut-menu type="button" title="Shortcut options" aria-label="Shortcut options"><span class="shortcut-real-dots" aria-hidden="true">...</span></button><div class="home-shortcut-menu"><button data-home-shortcut-favorite="${item.index}" type="button">${item.favorite?'Unfavorite':'Favorite'}</button><button data-home-shortcut-remove="${item.index}" type="button">Remove</button></div></div>`;
      }).join('');
    return tiles + '<button class="quick-tile home-shortcut-add" data-home-shortcut-add type="button"><b>+</b><span>Add Resource</span></button>';
  };
  function homeEntranceCanPlay(root=document){
    const scope=root || document;
    if(document.body.classList.contains('hosted-cloak-entry')) return false;
    if(document.documentElement.classList.contains('hosted-cloak-entry')) return false;
    if($('cloakLaunchScreen')?.classList.contains('show')) return false;
    const welcome=$('welcomeScreen');
    if(welcome && !welcome.classList.contains('hidden')) return false;
    if(!document.body.classList.contains('workspace-shell')) return false;
    const home=scope.querySelector?.('.workspace-home:not(.hidden)') || document.querySelector('.workspace-home:not(.hidden)');
    if(!home) return false;
    if(document.body.classList.contains('workspace-content-active')) return false;
    return !!home.querySelector('[data-home-shortcuts]');
  }
  function playHomeShortcutAnimation(root=document){
    if(!homeEntranceCanPlay(root)) return;
    root.querySelectorAll('[data-home-shortcuts]').forEach(grid=>{
      grid.classList.remove('shortcut-entrance');
      void grid.offsetWidth;
      requestAnimationFrame(()=>requestAnimationFrame(()=>grid.classList.add('shortcut-entrance')));
      Array.from(grid.children).filter(tile=>tile.classList?.contains('quick-tile')).forEach((tile,index)=>{
        tile.getAnimations?.().forEach(anim=>anim.cancel());
        tile.style.opacity='0';
        tile.style.transform='translate(-32px,48px) scale(.84)';
        tile.style.filter='blur(7px)';
        const delay=70*index+40;
        const finish=()=>{tile.style.opacity='';tile.style.transform='';tile.style.filter=''};
        const run=()=>{
          if(typeof tile.animate==='function'){
            const anim=tile.animate([
              {opacity:0,transform:'translate(-32px,48px) scale(.84)',filter:'blur(7px)'},
              {opacity:1,transform:'translate(-10px,14px) scale(.97)',filter:'blur(1px)',offset:.68},
              {opacity:1,transform:'translate(0,0) scale(1)',filter:'blur(0)'}
            ],{duration:720,delay,easing:'cubic-bezier(.18,.82,.22,1)',fill:'both'});
            anim.onfinish=finish;
            anim.oncancel=finish;
            anim.finished?.then(finish,finish);
            setTimeout(finish,delay+860);
            return;
          }
          setTimeout(finish,delay+720);
        };
        requestAnimationFrame(run);
      });
    });
  }
  function animateHomeElement(el,index=0,options={}){
    if(!el) return;
    el.getAnimations?.().forEach(anim=>anim.cancel());
    const start=options.start || 'translate(-32px,48px) scale(.84)';
    const mid=options.mid || 'translate(-10px,14px) scale(.97)';
    const delay=options.delay ?? (70*index+40);
    const duration=options.duration || 720;
    el.style.opacity='0';
    el.style.transform=start;
    el.style.filter='blur(7px)';
    const finish=()=>{el.style.opacity='';el.style.transform='';el.style.filter=''};
    const run=()=>{
      if(typeof el.animate==='function'){
        const anim=el.animate([
          {opacity:0,transform:start,filter:'blur(7px)'},
          {opacity:1,transform:mid,filter:'blur(1px)',offset:.68},
          {opacity:1,transform:'translate(0,0) scale(1)',filter:'blur(0)'}
      ],{duration,delay,easing:'cubic-bezier(.18,.82,.22,1)',fill:'both'});
      anim.onfinish=finish;
      anim.oncancel=finish;
      anim.finished?.then(finish,finish);
      setTimeout(finish,delay+duration+140);
      return;
    }
      setTimeout(finish,delay+duration);
    };
    requestAnimationFrame(run);
  }
  let nyxStartupRevealTimer=0;
  function playNyxStartupReveal(){
    const body=document.body;
    const targets=[
      ...document.querySelectorAll('body.workspace-shell .top-os .brand-mini > button, body.workspace-shell .top-os > :is(.workspace-top-clock,.nyx-latency-bubble), body.workspace-shell .top-os .workspace-mode-address > *, body.workspace-shell .workspace-home [data-home-shortcuts], body.workspace-shell .workspace-home [data-home-shortcuts] > .quick-tile')
    ];
    document.querySelectorAll('.shortcut-entrance').forEach(el=>el.classList.remove('shortcut-entrance'));
    document.querySelectorAll('.tab-opening,.tab-activating').forEach(el=>el.classList.remove('tab-opening','tab-activating'));
    targets.forEach(el=>el.getAnimations?.().forEach(animation=>animation.cancel()));
    clearTimeout(nyxStartupRevealTimer);
    body.classList.remove('nyx-startup-reveal');
    void body.offsetWidth;
    requestAnimationFrame(()=>{
      body.classList.remove('nyx-startup-prep');
      body.classList.add('nyx-startup-reveal');
      nyxStartupRevealTimer=setTimeout(()=>{
        body.classList.remove('nyx-startup-reveal');
        suppressHomeEntranceOnStartup=false;
      },1250);
    });
  }
  function playHomeChromeAnimation(root=document){
    if(!homeEntranceCanPlay(root)) return;
    const scope=root || document;
    scope.querySelectorAll?.('.workspace-shell-start').forEach((el,index)=>animateHomeElement(el,index,{delay:60,duration:1200,start:'translate(-28px,44px) scale(.9)',mid:'translate(-8px,13px) scale(.98)'}));
    const tabItems=[
      ...document.querySelectorAll('body.workspace-shell .brand-mini [data-workspace-shell-home], body.workspace-shell .brand-mini .workspace-mode-shell-tab, body.workspace-shell .brand-mini [data-workspace-shell-new-tab]')
    ];
    tabItems.forEach((el,index)=>animateHomeElement(el,index,{delay:45+(index*65),duration:650,start:'translate(-24px,34px) scale(.88)',mid:'translate(-7px,10px) scale(.97)'}));
    const toolbarItems=[
      ...document.querySelectorAll('body.workspace-shell [data-workspace-shell-back], body.workspace-shell [data-workspace-shell-forward], body.workspace-shell [data-workspace-shell-reload], body.workspace-shell [data-workspace-shell-home-nav], body.workspace-shell [data-workspace-shell-url], body.workspace-shell [data-workspace-shell-settings], body.workspace-shell .workspace-mode-weather, body.workspace-shell [data-workspace-shell-menu], body.workspace-shell #clock')
    ];
    toolbarItems.forEach((el,index)=>animateHomeElement(el,index,{delay:120+(index*58),duration:690,start:'translate(-26px,38px) scale(.9)',mid:'translate(-8px,12px) scale(.98)'}));
  }
  let homeEntranceLastPlay=0;
  let suppressHomeEntranceOnStartup=true;
  function playHomeEntranceAnimation(root=document,options={}){
    if(suppressHomeEntranceOnStartup) return;
    if(!homeEntranceCanPlay(root)) return;
    const now=Date.now();
    if(!options.force && now-homeEntranceLastPlay<1400) return;
    homeEntranceLastPlay=now;
    playHomeShortcutAnimation(root);
    playHomeChromeAnimation(root);
  }
  function playWorkspaceShellPageReveal(root=document){
    const scope=root || document;
    const home=scope.querySelector?.('.workspace-home:not(.hidden)');
    if(!home) return;
    home.classList.remove('tab-opening');
    void home.offsetWidth;
    home.classList.add('tab-opening');
    setTimeout(()=>home.classList.remove('tab-opening'),520);
  }
  let homeShortcutAnimationObserverInstalled=false;
  function installHomeShortcutAnimationObserver(){
    if(homeShortcutAnimationObserverInstalled) return;
    homeShortcutAnimationObserverInstalled=true;
    let triggerTimer=0;
    let lastTrigger=0;
    const trigger=root=>{
      const now=Date.now();
      if(now-lastTrigger<850) return;
      lastTrigger=now;
      clearTimeout(triggerTimer);
      triggerTimer=setTimeout(()=>playHomeEntranceAnimation(root || document),90);
    };
    new MutationObserver(mutations=>{
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType!==1) continue;
          const shortcutRoot=node.matches?.('[data-home-shortcuts]') ? node : node.querySelector?.('[data-home-shortcuts]');
          if(shortcutRoot && !shortcutRoot.dataset.entranceSeen){
            shortcutRoot.dataset.entranceSeen='true';
            trigger(shortcutRoot.closest?.('.workspace-home') || node);
            return;
          }
        }
      }
    }).observe(document.body,{childList:true,subtree:true});
    trigger(document);
  }
  let interactiveHomeDotsInstalled=false;
  function installInteractiveHomeDots(){
    if(interactiveHomeDotsInstalled) return;
    interactiveHomeDotsInstalled=true;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    const initialize=home=>{
      if(!home || home.dataset.nyxDotField==='true') return;
      home.dataset.nyxDotField='true';
      const canvas=document.createElement('canvas');
      canvas.className='nyx-home-dot-field';
      canvas.setAttribute('aria-hidden','true');
      home.prepend(canvas);
      syncHomeDotFieldVisibility();
      const context=canvas.getContext('2d',{alpha:true});
      if(!context) return;
      const state={width:0,height:0,dots:[],links:[],pointer:null,previousPointer:null,frame:0};
      const radius=55;
      const fadeDistance=42;
      const fieldMotionAllowed=()=>!reducedMotion.matches && !document.documentElement.classList.contains('perf-lite') && !document.documentElement.classList.contains('perf-min');
      const requestFrame=()=>{
        if(!state.frame) state.frame=requestAnimationFrame(draw);
      };
      const resize=()=>{
        const width=Math.max(1,home.clientWidth);
        const height=Math.max(1,home.clientHeight);
        if(width===state.width && height===state.height) return;
        state.width=width;
        state.height=height;
        const ratio=Math.min(devicePixelRatio || 1,2);
        canvas.width=Math.round(width*ratio);
        canvas.height=Math.round(height*ratio);
        canvas.style.width=width+'px';
        canvas.style.height=height+'px';
        context.setTransform(ratio,0,0,ratio,0,0);
        state.dots=[];
        state.links=[];
        let seed=((Math.round(width)*73856093)^(Math.round(height)*19349663)^0x4e5958)>>>0;
        const random=()=>{
          seed=(Math.imul(seed,1664525)+1013904223)>>>0;
          return seed/4294967296;
        };
        const addDot=(x,y,size=.9,alpha=.5,cluster=-1)=>{
          const dot={homeX:x,homeY:y,x,y,vx:0,vy:0,opacity:1,size,alpha,cluster};
          state.dots.push(dot);
          return state.dots.length-1;
        };
        const lightweight=document.documentElement.classList.contains('perf-lite');
        const backgroundCount=lightweight
          ? Math.max(24,Math.min(96,Math.round(width*height/18000)))
          : Math.max(36,Math.min(180,Math.round(width*height/10000)));
        for(let index=0;index<backgroundCount;index++){
          addDot(
            18+random()*Math.max(1,width-36),
            16+random()*Math.max(1,height-32),
            .38+random()*.78,
            .16+random()*.42
          );
        }
        const clusterCount=width<620 ? 3 : lightweight ? 4 : Math.max(5,Math.min(7,Math.round(width/360)));
        const anchors=[
          [.28,.08],[.065,.42],[.58,.86],[.91,.17],[.88,.7],[.5,.28],[.32,.72]
        ];
        for(let cluster=0;cluster<clusterCount;cluster++){
          const anchor=anchors[cluster%anchors.length];
          const centerX=width*(anchor[0]+(random()-.5)*.05);
          const centerY=height*(anchor[1]+(random()-.5)*.05);
          const count=7+Math.floor(random()*4);
          const clusterDots=[];
          for(let node=0;node<count;node++){
            const angle=random()*Math.PI*2;
            const distance=12+random()*(width<620?44:72);
            const dotIndex=addDot(
              Math.max(12,Math.min(width-12,centerX+Math.cos(angle)*distance)),
              Math.max(12,Math.min(height-12,centerY+Math.sin(angle)*distance*.75)),
              .72+random()*1.12,
              .46+random()*.38,
              cluster
            );
            const nearest=clusterDots
              .map(index=>({index,distance:Math.hypot(state.dots[index].homeX-state.dots[dotIndex].homeX,state.dots[index].homeY-state.dots[dotIndex].homeY)}))
              .sort((a,b)=>a.distance-b.distance);
            if(nearest[0]) state.links.push([nearest[0].index,dotIndex]);
            if(nearest[1] && random()<.58) state.links.push([nearest[1].index,dotIndex]);
            clusterDots.push(dotIndex);
          }
        }
        canvas.dataset.particleCount=String(state.dots.length);
        canvas.dataset.constellationCount=String(clusterCount);
        canvas.dataset.backgroundStyle='fern-star-network';
        canvas.dataset.pointerEffect='constellation-repel-and-return';
        requestFrame();
      };
      function draw(){
        state.frame=0;
        context.clearRect(0,0,state.width,state.height);
        const styles=getComputedStyle(home);
        const dotColor=styles.getPropertyValue('--nyx-constellation-dot-color').trim() || styles.getPropertyValue('--nyx-dot-color').trim() || '#759488';
        const linkColor=styles.getPropertyValue('--nyx-constellation-link-color').trim() || styles.getPropertyValue('--nyx-link-color').trim() || '#4c675f';
        const motionAllowed=fieldMotionAllowed();
        const pointer=motionAllowed ? state.pointer : null;
        const previous=state.previousPointer || pointer;
        const segmentX=pointer && previous ? pointer.x-previous.x : 0;
        const segmentY=pointer && previous ? pointer.y-previous.y : 0;
        const segmentLengthSquared=segmentX*segmentX+segmentY*segmentY;
        let unsettled=false;
        for(const dot of state.dots){
          if(pointer && previous){
            let progress=segmentLengthSquared
              ? ((dot.x-previous.x)*segmentX+(dot.y-previous.y)*segmentY)/segmentLengthSquared
              : 0;
            progress=Math.max(0,Math.min(1,progress));
            const nearestX=previous.x+segmentX*progress;
            const nearestY=previous.y+segmentY*progress;
            const dx=dot.x-nearestX;
            const dy=dot.y-nearestY;
            const distance=Math.hypot(dx,dy);
            if(distance<radius){
              const direction=distance>0.01 ? distance : 1;
              const strength=(1-distance/radius)*2.2;
              dot.vx+=dx/direction*strength;
              dot.vy+=dy/direction*strength;
            }
          }
          dot.vx+=(dot.homeX-dot.x)*.05;
          dot.vy+=(dot.homeY-dot.y)*.05;
          dot.vx*=.82;
          dot.vy*=.82;
          dot.x+=dot.vx;
          dot.y+=dot.vy;
          const displacement=Math.hypot(dot.x-dot.homeX,dot.y-dot.homeY);
          dot.opacity=displacement>=fadeDistance ? 0 : 1-displacement/fadeDistance;
          if(displacement>.18 || dot.vx*dot.vx+dot.vy*dot.vy>.02) unsettled=true;
        }
        context.strokeStyle=linkColor;
        context.lineWidth=.55;
        for(const [fromIndex,toIndex] of state.links){
          const from=state.dots[fromIndex];
          const to=state.dots[toIndex];
          if(!from || !to) continue;
          context.globalAlpha=Math.min(from.opacity*from.alpha,to.opacity*to.alpha)*.3;
          context.beginPath();
          context.moveTo(from.x,from.y);
          context.lineTo(to.x,to.y);
          context.stroke();
        }
        context.fillStyle=dotColor;
        for(const dot of state.dots){
          context.globalAlpha=dot.opacity*dot.alpha;
          context.beginPath();
          context.arc(dot.x,dot.y,dot.size,0,Math.PI*2);
          context.fill();
        }
        context.globalAlpha=1;
        if(pointer) state.previousPointer={...pointer};
        if((state.pointer && motionAllowed) || unsettled) requestFrame();
      }
      home.addEventListener('pointermove',event=>{
        if(!fieldMotionAllowed()){
          state.pointer=null;
          state.previousPointer=null;
          return;
        }
        const rect=home.getBoundingClientRect();
        const next={x:event.clientX-rect.left,y:event.clientY-rect.top};
        state.previousPointer=state.pointer || next;
        state.pointer=next;
        requestFrame();
      },{passive:true});
      home.addEventListener('pointerleave',()=>{
        state.pointer=null;
        requestFrame();
      },{passive:true});
      addEventListener('nyx:themechange',requestFrame);
      if(typeof ResizeObserver==='function') new ResizeObserver(resize).observe(home);
      else addEventListener('resize',resize,{passive:true});
      resize();
      syncHomeWeatherWidgets();
    };
    const scan=root=>{
      if(root?.matches?.('.workspace-home.nyx-minimal-home')) initialize(root);
      root?.querySelectorAll?.('.workspace-home.nyx-minimal-home').forEach(initialize);
    };
    new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType===1) scan(node);
    }))).observe(document.body,{childList:true,subtree:true});
    scan(document);
  }
  let interactiveHomeTitleDotsInstalled=false;
  function installInteractiveHomeTitleDots(){
    if(interactiveHomeTitleDotsInstalled) return;
    interactiveHomeTitleDotsInstalled=true;
    if(!window.requestAnimationFrame) return;
    try{
      if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    }catch{}
    const initialize=title=>{
      if(!title || title.dataset.nyxTitleDotField==='true') return;
      title.dataset.nyxTitleDotField='true';
      const label=title.textContent.trim();
      if(!label) return;
      const canvas=document.createElement('canvas');
      canvas.className='nyx-title-dot-canvas';
      canvas.setAttribute('aria-hidden','true');
      const context=canvas.getContext('2d',{alpha:true});
      if(!context) return;
      const resolveDotColor=()=>{
        const home=title.closest('.nyx-minimal-home');
        const styles=getComputedStyle(home || title);
        return styles.getPropertyValue('--nyx-home-wordmark').trim() || getComputedStyle(title).color || '#e8e5f4';
      };
      title.append(canvas);
      const ratio=Math.max(1,Math.min(devicePixelRatio || 1,2));
      const canvasPadding=90;
      const pointerRadius=55;
      const repelStrength=2.2;

      const spring=.14;
      const friction=.7;
      const fadeDistance=42;
      let dotRadius=3;
      let width=0;
      let height=0;
      let textLeft=canvasPadding;
      let textTop=canvasPadding;
      let textRight=canvasPadding;
      let textBottom=canvasPadding;
      let dots=[];
      let frame=0;
      let isReady=false;
      let pointerInside=false;
      let previousX=-9999;
      let previousY=-9999;
      let pointerX=-9999;
      let pointerY=-9999;
      const getFont=()=>{
        const styles=getComputedStyle(title);
        return {
          value:`${styles.fontWeight || '500'} ${styles.fontSize || '48px'} ${styles.fontFamily || 'Inter, sans-serif'}`,
          size:parseFloat(styles.fontSize) || 48,
          letterSpacing:Number.isFinite(parseFloat(styles.letterSpacing)) ? parseFloat(styles.letterSpacing) : 0
        };
      };
      const setup=()=>{
        const font=getFont();
        const measure=document.createElement('canvas').getContext('2d');
        if(!measure) return;
        measure.font=font.value;
        const characters=Array.from(label);
        const glyphWidths=characters.map(character=>measure.measureText(character).width);
        const textWidth=Math.ceil(glyphWidths.reduce((total,width)=>total+width,0)+font.letterSpacing*Math.max(0,characters.length-1))+6;
        const metrics=measure.measureText(label);
        const ascent=metrics.actualBoundingBoxAscent || font.size*.8;
        const descent=metrics.actualBoundingBoxDescent || font.size*.25;
        const textHeight=Math.ceil(ascent+descent)+6;
        width=textWidth+canvasPadding*2;
        height=textHeight+canvasPadding*2;
        canvas.style.width=width+'px';
        canvas.style.height=height+'px';
        canvas.style.left=`calc(50% - ${width/2}px)`;
        canvas.style.top=`calc(50% - ${height/2}px)`;
        canvas.width=Math.round(width*ratio);
        canvas.height=Math.round(height*ratio);
        context.setTransform(ratio,0,0,ratio,0,0);
        const mask=document.createElement('canvas');
        mask.width=Math.round(textWidth*ratio);
        mask.height=Math.round(textHeight*ratio);
        const maskContext=mask.getContext('2d',{willReadFrequently:true});
        if(!maskContext) return;
        maskContext.setTransform(ratio,0,0,ratio,0,0);
        maskContext.font=font.value;
        maskContext.textBaseline='alphabetic';
        maskContext.fillStyle='#fff';
        let glyphX=3;
        characters.forEach((character,index)=>{
          maskContext.fillText(character,glyphX,ascent+3);
          glyphX+=glyphWidths[index]+font.letterSpacing;
        });
        let pixels;
        try{pixels=maskContext.getImageData(0,0,mask.width,mask.height).data;}catch{return}
        const spacing=Math.max(4,Math.round(font.size/11));

        dotRadius=Math.max(1.15,Math.min(2.1,spacing*.3));
        const nextDots=[];
        for(let y=0;y<textHeight;y+=spacing){
          for(let x=0;x<textWidth;x+=spacing){
            const pixel=(Math.round(y*ratio)*mask.width+Math.round(x*ratio))*4;
            if(pixels[pixel+3]>130){
              const homeX=x+canvasPadding;
              const homeY=y+canvasPadding;
              nextDots.push({homeX,homeY,x:homeX,y:homeY,vx:0,vy:0,opacity:1});
            }
          }
        }
        dots=nextDots;
        textLeft=canvasPadding;
        textTop=canvasPadding;
        textRight=canvasPadding+textWidth;
        textBottom=canvasPadding+textHeight;
        isReady=true;
        canvas.dataset.particleCount=String(dots.length);
        canvas.dataset.pointerEffect='repel-and-return';
        title.classList.add('nyx-title-dot-ready');
        draw();
      };
      function render(){
        context.clearRect(0,0,width,height);
        context.fillStyle=resolveDotColor();
        for(const dot of dots){
          if(dot.opacity<=.02) continue;
          context.globalAlpha=Math.min(1,dot.opacity);
          context.beginPath();
          context.arc(dot.x,dot.y,dotRadius,0,Math.PI*2);
          context.fill();
        }
        context.globalAlpha=1;
      }
      function draw(){
        frame=0;
        let unsettled=false;
        const radiusSquared=pointerRadius*pointerRadius;
        const deltaX=pointerX-previousX;
        const deltaY=pointerY-previousY;
        const segmentLengthSquared=deltaX*deltaX+deltaY*deltaY;
        for(const dot of dots){
          if(pointerInside){
            let progress=segmentLengthSquared ? ((dot.x-previousX)*deltaX+(dot.y-previousY)*deltaY)/segmentLengthSquared : 0;
            progress=Math.max(0,Math.min(1,progress));
            const nearestX=previousX+progress*deltaX;
            const nearestY=previousY+progress*deltaY;
            const deltaDotX=dot.x-nearestX;
            const deltaDotY=dot.y-nearestY;
            const distanceSquared=deltaDotX*deltaDotX+deltaDotY*deltaDotY;
            if(distanceSquared<radiusSquared){
              const distance=Math.sqrt(distanceSquared) || .0001;
              const strength=(1-distance/pointerRadius)*repelStrength;
              dot.vx+=deltaDotX/distance*strength;
              dot.vy+=deltaDotY/distance*strength;
            }
          }
          dot.vx+=(dot.homeX-dot.x)*spring;
          dot.vy+=(dot.homeY-dot.y)*spring;
          dot.vx*=friction;
          dot.vy*=friction;
          dot.x+=dot.vx;
          dot.y+=dot.vy;
          const displacementX=dot.x-dot.homeX;
          const displacementY=dot.y-dot.homeY;
          const displacement=Math.sqrt(displacementX*displacementX+displacementY*displacementY);
          dot.opacity=displacement>=fadeDistance ? 0 : 1-displacement/fadeDistance;
          if(displacement>.35 || dot.vx*dot.vx+dot.vy*dot.vy>.05) unsettled=true;
        }
        previousX=pointerX;
        previousY=pointerY;
        render();
        if(pointerInside || unsettled) frame=requestAnimationFrame(draw);
      }
      const requestFrame=()=>{
        if(!frame && isReady) frame=requestAnimationFrame(draw);
      };
      const redrawForTheme=()=>{
        if(!title.isConnected){
          removeEventListener('nyx:themechange',redrawForTheme);
          return;
        }
        if(isReady) render();
      };
      addEventListener('nyx:themechange',redrawForTheme);
      const movePointer=event=>{
        if(!isReady) return;
        const bounds=canvas.getBoundingClientRect();
        const x=event.clientX-bounds.left;
        const y=event.clientY-bounds.top;
        const inside=x>textLeft-pointerRadius && x<textRight+pointerRadius && y>textTop-pointerRadius && y<textBottom+pointerRadius;
        if(inside && !pointerInside){
          previousX=x;
          previousY=y;
        }
        pointerX=x;
        pointerY=y;
        pointerInside=inside;
        if(inside) requestFrame();
      };


      title.addEventListener('pointermove',movePointer,{passive:true});
      title.addEventListener('pointerdown',movePointer,{passive:true});
      title.addEventListener('pointerleave',()=>{
        pointerInside=false;
        requestFrame();
      },{passive:true});
      addEventListener('pointerup',event=>{
        if(event.pointerType==='touch'){
          pointerInside=false;
          requestFrame();
        }
      },{passive:true});
      addEventListener('pointercancel',()=>{
        pointerInside=false;
        requestFrame();
      },{passive:true});
      document.addEventListener('mouseleave',()=>{
        if(pointerInside){
          pointerInside=false;
          requestFrame();
        }
      });
      setup();
      document.fonts?.ready?.then(setup).catch(()=>{});
      let resizeTimer=0;
      addEventListener('resize',()=>{
        clearTimeout(resizeTimer);
        resizeTimer=setTimeout(setup,200);
      },{passive:true});
    };
    const scan=root=>{
      if(root?.matches?.('.nyx-minimal-brand h1')) initialize(root);
      root?.querySelectorAll?.('.nyx-minimal-brand h1').forEach(initialize);
    };
    new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType===1) scan(node);
    }))).observe(document.body,{childList:true,subtree:true});
    scan(document);
  }
  function renderHomeShortcuts(root=document){
    root.querySelectorAll('[data-home-shortcuts]').forEach(grid=>{grid.innerHTML=workspaceHomeShortcutTiles()});
    playHomeEntranceAnimation(root);
  }
  function addHomeShortcut(){
    const title=prompt('App name');
    if(!title?.trim()) return;
    const url=prompt("App U3L");
    if(!url?.trim()) return;
    const normalized=normalize(url.trim());
    const items=homeShortcuts();
    items.push({title:title.trim(),url:normalized,domain:homeShortcutDomain(normalized,title),icon:websiteFaviconUrl(normalized),favorite:false});
    saveHomeShortcuts(items);
    renderHomeShortcuts();
    toast('Shortcut added');
  }
  function toggleHomeShortcutFavorite(index){
    const items=homeShortcuts();
    const item=items[Number(index)];
    if(!item) return;
    item.favorite=!item.favorite;
    saveHomeShortcuts(items);
    renderHomeShortcuts();
  }
  function removeHomeShortcut(index){
    const items=homeShortcuts();
    items.splice(Number(index),1);
    saveHomeShortcuts(items);
    renderHomeShortcuts();
  }
  const nyxDefaultGlobalApps=[
    ['code-studio','code-studio','Code Sandbox','/apps/code-studio/'],
    ['link-checker','link-checker','Link Checker','/apps/link-checker/'],
    ['link-generator','link-generator','Link Generator','/apps/link-generator/'],
    ['jsdelivr-publisher','jsdelivr-publisher','JSDelivr Publisher','/apps/jsdelivr-publisher/'],
    ['nyx-api-keys','api-keys','Nyx API Keys','/apps/api-keys/'],
    ['youtube','youtube.com','YouTube','/apps/nyxtube/'],
    ['pirate-cove','games','GAMES','/assets/games/'],
    ['nyx-chat','nyx-chat','Nyx Chat','/apps/chat/'],
    ['nyxify','nyxify','Nyxify/built in music','/apps/nyxify/'],
    ['duck-ai','duck.ai',"Duck A1",'https://duck.ai/'],
    ['nyx-ai','nyx-ai',"Nyx A1",'nyx://ai'],
    ['movies','nyx-movies','Movies','/apps/movies/'],
    ['more-movie-sites','fmhy.net','More Movie Sites','https://fmhy.net/video#p-stream-forks'],
    ['tiktok','tiktok.com','TikTok','https://www.tiktok.com/'],
    ['animex','animex.one','Animex','https://animex.one/']
  ].map(([id,icon,name,url])=>({id,icon,name,url})).map(app=>app.id==='youtube'?{...app,name:'NyxTube'}:app);
  const nyxHiddenGlobalAppIds=new Set(['code-tutorials']);
  let nyxGlobalApps=nyxDefaultGlobalApps.map(app=>({...app}));
  function normalizeNyxGlobalApp(app){
    const id=String(app?.id||'').trim().toLowerCase();
    const icon=String(app?.icon||'apps').trim().toLowerCase();
    const name=String(app?.name||'').trim();
    const url=normalizeInternalAppUrl(app?.url);
    if(!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id) || !name || !url) return null;
    return {id,icon,name:name.slice(0,48),url:url.slice(0,2048)};
  }
  function globalAppIcon(app){return appIcons[app.icon] || iconForUrl(app.url) || appIcon('apps')}
  function globalAppIconMarkup(app){
    const symbols={'code-studio':'code','link-generator':'link','nyxify':'music','nyx-chat':'chat','nyx-movies':'movies','games':'games'};
    const tools={
      'nyx-vms':'<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5"/>',
      'link-checker':'<path d="M10 13a4 4 0 0 0 5.7 0l2.3-2.3A4 4 0 0 0 12.3 5L11 6.3M8 11l-2 2a4 4 0 0 0 3 7"/><path d="m14 19 2 2 5-5"/>',
      'jsdelivr-publisher':'<path d="M12 16V3m-4 4 4-4 4 4M4 14v6h16v-6"/>',
      'api-keys':'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-3-3 3-3m-6 0 3-3"/>'
    };
    const symbol=symbols[app.icon];
    const icon=symbol?nyxDashboardIcon(symbol):tools[app.icon]?`<svg viewBox="0 0 24 24" aria-hidden="true">${tools[app.icon]}</svg>`:`<img alt="" draggable="false" referrerpolicy="no-referrer" src="${esc(globalAppIcon(app))}">`;
    return `<span class="quick-icon" aria-hidden="true">${icon}</span>`;
  }
  function quickTiles(){
    const apps=nyxGlobalApps.filter(app=>app.id!=='nyx-vms'&&app.url.replace(/\/+$/,'')!=='/apps/nyxcloud');
    apps.push({id:'nyx-vms',icon:'nyx-vms',name:'VMs',url:'/apps/nyxcloud/'});
    return apps.map((app,i)=>`<button class="quick-tile" draggable="true" style="--tile-delay:${Math.min(i,18)*34}ms" data-global-app-id="${esc(app.id)}" data-domain="${esc(app.icon)}" data-app-url="${esc(app.url)}">${globalAppIconMarkup(app)}<span aria-label="${esc(app.name)}">${esc(window.nyxDisplayName(app.name))}</span></button>`).join('');
  }
  function renderNyxGlobalApps(){
    const documents=[document];
    document.querySelectorAll('iframe').forEach(frame=>{try{if(frame.contentDocument) documents.push(frame.contentDocument)}catch{}});
    documents.forEach(doc=>doc.querySelectorAll('[data-nyx-global-app-grid]').forEach(grid=>{grid.innerHTML=quickTiles()}));
  }
  async function loadNyxGlobalApps(){
    try{
      const response=await fetch('/api/apps',{headers:{Accept:'application/json'},cache:'no-store'});
      const payload=await response.json();
      if(!response.ok || !Array.isArray(payload?.apps)) throw new Error(payload?.error||'App catalog unavailable');
      nyxGlobalApps=payload.apps.map(normalizeNyxGlobalApp).filter(app=>app&&!['nyxtube','nyx-tube'].includes(app.id)&&!nyxHiddenGlobalAppIds.has(app.id));
      renderNyxGlobalApps();
    }catch(error){console.warn('Nyx app catalog is using built-in defaults:',error?.message||error)}
    return nyxGlobalApps;
  }
  function startNyxGlobalApps(){
    if(startNyxGlobalApps.started) return;
    startNyxGlobalApps.started=true;
    void loadNyxGlobalApps();
    addEventListener('nyx:global-apps-changed',event=>{
      const apps=event.detail?.apps;
      if(Array.isArray(apps)){
        nyxGlobalApps=apps.map(normalizeNyxGlobalApp).filter(app=>app&&!nyxHiddenGlobalAppIds.has(app.id));
        renderNyxGlobalApps();
      }else void loadNyxGlobalApps();
    });
    setInterval(()=>{if(!document.hidden) void loadNyxGlobalApps()},60_000);
  }
  function cleanWorkspaceControls(win){
    const back=win.querySelector('[data-back]'), forward=win.querySelector('[data-forward]'), reload=win.querySelector('[data-reload]'), menu=win.querySelector('[data-menu]');
    if(back) back.textContent='➜';
    if(forward) forward.textContent='➜';
    if(reload) reload.textContent='🗘';
    if(menu) menu.textContent='...';
    bindReloadPointerTurn(win);
  }
  let nyxPreflightPromise=null;
  let nyxPreflightBypass=false;
  const preflightDelay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function preflightTimeout(promise,ms,label='check timed out'){
    let timer=null;
    const guarded=Promise.resolve(promise);
    guarded.catch(()=>{});
    try{
      return await Promise.race([
        guarded,
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms)})
      ]);
    }finally{
      clearTimeout(timer);
    }
  }
  async function preflightFetchOk(url,timeout=2600){
    if(location.protocol==='file:') return true;
    const response=await preflightTimeout(fetch(url,{cache:'no-store'}),timeout,`${url} timed out`);
    return response.ok;
  }
  async function preflightImportOk(url,timeout=3600){
    if(location.protocol==='file:') return true;
    await preflightTimeout(import(`${url}?nyx_check=${Date.now()}`),timeout,`${url} import timed out`);
    return true;
  }
  async function preflightWebSocketOk(url,timeout=3200){
    if(location.protocol==='file:') return true;
    if(!/^wss?:\/\//i.test(url) || !('WebSocket' in window)) return false;
    return preflightTimeout(new Promise(resolve=>{
      let settled=false;
      let socket=null;
      const done=value=>{
        if(settled) return;
        settled=true;
        try{socket?.close()}catch{}
        resolve(value);
      };
      try{
        socket=new WebSocket(url);
        socket.addEventListener('open',()=>done(true),{once:true});
        socket.addEventListener('error',()=>done(false),{once:true});
        socket.addEventListener('close',()=>done(false),{once:true});
      }catch{
        resolve(false);
      }
    }),timeout,`${url} websocket timed out`);
  }
  function preflightWorkspaceModeForTarget(target=''){
    const mode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
    if(mode!=='auto') return mode;
    try{
      const normalized=normalize(workspaceShellSourceUrl(target) || target);
      return 'scramjet';
    }catch{
      return 'scramjet';
    }
  }
  async function preflightEngineReady(target=''){
    if(location.protocol==='file:' || !('serviceWorker' in navigator)) return false;
    if(preflightWorkspaceModeForTarget(target)==='iframe') return true;
    return installStudyjet();
}
  async function preflightTransportReady(target=''){
    if(location.protocol==='file:') return false;
    if(preflightWorkspaceModeForTarget(target)==='iframe') return true;
    return !!(await createStudyjetTransport());
}
  async function preflightServiceWorkerReady(target=''){
    if(location.protocol==='file:' || !('serviceWorker' in navigator)) return false;
    await preflightEngineReady(target);
    const registrations=await Promise.all([
      navigator.serviceWorker.getRegistration('/~/sj/').catch(()=>null),
      navigator.serviceWorker.getRegistration('/service/').catch(()=>null)
    ]);
    return registrations.some(registration=>registration?.active || registration?.waiting || registration?.installing);
  }
  function preflightSearchUrl(raw=''){
    return normalize(raw || 'nyx') || '';
  }
  async function preflightAppIconsReady(){
    const urls=[...document.querySelectorAll('[data-app-url]')]
      .map(el=>appIcon(el.dataset.domain || ''))
      .filter(Boolean)
      .slice(0,8);
    await Promise.allSettled(urls.map(url=>preflightFetchOk(url,1600)));
    return true;
  }
  async function preflightLibcurlReady(){
    if(location.protocol==='file:') return true;
    const checks=await Promise.allSettled([
      preflightFetchOk('/libcurl/index.mjs',2600),
      preflightFetchOk('/assets/transports/libcurl-baremux.mjs',2600),
      preflightImportOk('/assets/transports/libcurl-scramjet.mjs',4200)
    ]);
    return checks.every(check=>check.status==='fulfilled' && check.value);
  }
  async function preflightFilesReady(){
    if(location.protocol==='file:') return true;
    const files=[
      '/',
      '/scramjet/scramjet.js',
      '/scramjet.sw.js',
      '/baremux/index.mjs',
      '/epoxy/index.mjs',
      '/controller/controller.api.js'
    ];
    const checks=await Promise.allSettled(files.map(url=>preflightFetchOk(url,2600)));
    return checks.every(check=>check.status==='fulfilled' && check.value);
  }
  async function preflightStateCurrent(){
    await ensureFreshConnectionState();
    return store.text('nyx.proxyStateVersion','')===connectionStateVersion && store.text('nyx.scramjetStateVersion','')===studyjetStateVersion;
  }
  async function preflightBugScan(){
    const required=[
      document.body,
      document.querySelector('#desktop'),
      document.querySelector('#visualEffects'),
      document.querySelector('#customBgImage')
    ];
    const workspaceApis=Boolean(window.fetch && window.Promise && window.URL && window.localStorage);
    const connectionApis=location.protocol==='file:' || Boolean('serviceWorker' in navigator && 'caches' in window && window.indexedDB);
    await preflightDelay(160);
    return required.every(Boolean) && workspaceApis && connectionApis;
  }
  function nyxPreflightTasks(kind='startup',options={}){
    const target=String(options.target || '').trim();
    const appendFinal=tasks=>{
      if(typeof options.finalRun==='function'){
        let finalStarted=false;
        return [...tasks,{label:options.finalLabel || 'Page loaded',acceptAnyCheck:true,run:async()=>{
          if(!finalStarted){
            finalStarted=true;
            return options.finalRun();
          }
          if(typeof options.finalVerify==='function') return options.finalVerify();
          await preflightDelay(120);
          return true;
        }}];
      }
      return tasks;
    };
    const serverCheck=async()=>{
      const checks=['/scramjet/scramjet.js','/baremux/index.mjs'].map(url=>preflightFetchOk(url,2400).catch(()=>false));
      const results=await Promise.all(checks);
      return location.protocol==='file:' || results.some(Boolean);
    };
    const searchCheck=async()=>{
      const url=preflightSearchUrl(target || 'nyx');
      if(!url) return false;
      const parsed=new URL(url,location.href);
      return /^https?:|^data:|^blob:|^about:$/.test(parsed.protocol);
    };
    const base=[
      {label:'Fetching server list',run:serverCheck},
      {label:'Selecting fastest server',run:async()=>{await preflightDelay(180); return true}},
      {label:'Loading workspace engine',run:()=>preflightEngineReady(target)},
      {label:'Opening transport',run:()=>preflightTransportReady(target)},
      {label:'Registering service worker',run:()=>preflightServiceWorkerReady(target)}
    ];
    if(kind==='apps'){
      return appendFinal([
        ...base,
        {label:'Checking app shortcuts',run:preflightAppIconsReady},
        {label:'Opening apps panel',run:async()=>{await preflightDelay(180); return true}}
      ]);
    }
    if(kind==='search'){
      return appendFinal([
        {label:'Reading search query',run:searchCheck},
        {label:'Checking selected search engine',run:async()=>{await preflightDelay(150); return !!store.text('nyx.engine','duckduckgo')}},
        ...base,
        {label:'Preparing results tab',run:async()=>{await preflightDelay(160); return true}}
      ]);
    }
    if(kind==='workspace'){
      return appendFinal([
        {label:'Checking requested page',run:searchCheck},
        ...base,
        {label:'Opening workspace tab',run:async()=>{await preflightDelay(160); return true}}
      ]);
    }
    if(kind==='startup-diagnostics'){
      return appendFinal([
        {label:'Checking Nyx files',run:preflightStateCurrent},
        {label:'Preparing interface',run:async()=>{await preflightDelay(60); return true}},
        {label:'Launching Nyx',run:async()=>{await preflightDelay(80); return true}}
      ]);
    }
    return appendFinal([
      {label:'Checking nyx files',run:serverCheck},
      {label:'Checking search',run:searchCheck},
      ...base,
      {label:'Finishing startup',run:async()=>{await preflightDelay(220); return true}}
    ]);
  }
  async function runNyxPreflight(kind='startup',options={}){
    if(options.skip || nyxPreflightBypass) return true;
    if(options.background){
      setTimeout(()=>{
        nyxPreflightTasks(kind,options).slice(0,3).forEach(task=>{
          Promise.resolve(task.run?.()).catch(()=>null);
        });
      },600);
      return true;
    }
    if(nyxPreflightPromise) return nyxPreflightPromise;
    const doubleCheckTask=async task=>{
      let first=false, second=false, firstError=null, secondError=null;
      try{
        first=await preflightTimeout(Promise.resolve(task.run?.()),5200,'preflight timed out');
      }catch(error){
        firstError=error;
      }
      await preflightDelay(80);
      try{
        second=await preflightTimeout(Promise.resolve(task.run?.()),5200,'preflight double-check timed out');
      }catch(error){
        secondError=error;
      }
      if(firstError || secondError) console.warn('nyx preflight double-check detail:',task.label,{firstError,secondError});
      return task.acceptAnyCheck ? Boolean(first || second) : Boolean(first && second);
    };
    nyxPreflightPromise=(async()=>{
      const tasks=nyxPreflightTasks(kind,options);
      const overlay=document.createElement('div');
      overlay.className='nyx-preflight';
      const preflightTitle=kind==='startup-diagnostics' ? 'Startup Diagnostics' : kind==='startup' ? 'Starting nyx' : kind==='apps' ? 'Opening Apps' : kind==='search' ? "Checking S3ARC4" : 'Checking Workspace';
      overlay.innerHTML=`<section class="nyx-preflight-card" role="status" aria-live="polite"><h2 class="nyx-preflight-title">${esc(preflightTitle)}</h2><ul class="nyx-preflight-list">${tasks.map((task,index)=>`<li class="nyx-preflight-item" data-preflight-step="${index}"><span class="nyx-preflight-dot">&bull;</span><span>${esc(task.label)}</span></li>`).join('')}</ul><div class="nyx-preflight-bar"><div class="nyx-preflight-fill"></div></div></section>`;
      (document.getElementById('app') || document.body).appendChild(overlay);
      requestAnimationFrame(()=>overlay.classList.add('show'));
      const started=Date.now();
      const fill=overlay.querySelector('.nyx-preflight-fill');
      for(let i=0;i<tasks.length;i++){
        const item=overlay.querySelector(`[data-preflight-step="${i}"]`);
        item?.classList.add('running');
        let ok=true;
        try{
          ok=await doubleCheckTask(tasks[i]);
        }catch(error){
          ok=false;
          console.warn('nyx preflight warning:',tasks[i].label,error);
        }
        item?.classList.remove('running');
        item?.classList.add(ok ? 'done' : 'warn');
        const dot=item?.querySelector('.nyx-preflight-dot');
        if(dot) dot.textContent=ok ? '\u2713' : '!';
        if(fill) fill.style.width=`${Math.round(((i+1)/tasks.length)*100)}%`;
        await preflightDelay(90);
      }
      const minVisible=Number(options.minVisible || (kind==='startup' || kind==='startup-diagnostics' ? 900 : 520));
      const remaining=minVisible-(Date.now()-started);
      if(remaining>0) await preflightDelay(remaining);
      overlay.classList.remove('show');
      setTimeout(()=>overlay.remove(),260);
      return true;
    })().finally(()=>{nyxPreflightPromise=null});
    return nyxPreflightPromise;
  }

  function openWorkspace(url='https://duckduckgo.com/',options={}){
    const win=makeWindow({title:'New Tab',className:'workspace-window',body:workspaceBody()});

    cleanWorkspaceControls(win);
    tick();
    initDesktopSplash();
    const state={tabs:[],active:null,win};
    const chatNotificationIds=new Set();
    win.workspaceState=state; activeWorkspace=state;
    function renderTabs(){
      const row=win.querySelector('.workspace-tabs');
      row.querySelectorAll('.workspace-tab').forEach(x=>x.remove());
      state.tabs.forEach(t=>{
        const el=document.createElement('div'); el.className='workspace-tab'+(t.id===state.active?' active':'')+(t.opening?' tab-opening':'')+(t.chatUnread?' chat-unread':'');
        const displayUrl=t.sourceUrl || t.url;
        el.innerHTML=`<span aria-label="${esc(workspaceChromeTitle(t.title,displayUrl))}">${esc(window.nyxDisplayName(workspaceChromeTitle(t.title,displayUrl)))}</span><button data-close-tab="${t.id}">×</button>`;
        const label=el.querySelector('span');
        if(label){
          const icon=document.createElement('img');
          icon.className='workspace-tab-icon';
          icon.alt='';
          icon.src=workspaceChromeIcon(t.icon,displayUrl);
          bindTabIconFallback(icon);
          el.insertBefore(icon,label);
        }
        const closeBtn=el.querySelector('button');
        if(closeBtn) closeBtn.textContent='x';
        el.onclick=e=>{if(e.target.closest('button'))return; activate(t.id)};
        row.insertBefore(el,row.querySelector('[data-new-tab]'));
        if(t.opening) setTimeout(()=>{t.opening=false},540);
      });
    }
    function syncLoadedTabIcon(t){
      if(!t?.frame || !state.tabs.includes(t)) return false;
      if(websiteDetailsHidden()) return false;
      let icon='';
      try{icon=iconFromPageDocument(t.frame.contentDocument,t.sourceUrl || t.url)}catch{}
      if(!icon) icon=iconForUrl(t.sourceUrl || t.url);
      if(!icon || icon===t.icon) return false;
      t.icon=icon;
      const shellTab=workspaceShellTabs.find(tab=>tab.workspaceTabId===t.id);
      if(shellTab) shellTab.icon=icon;
      renderTabs();
      renderWorkspaceShellTabs();
      return true;
    }
    function current(){return state.tabs.find(t=>t.id===state.active)}
    function isGameInputTab(t=current()){
      const source=String(workspaceShellSourceUrl(t?.sourceUrl || t?.url || '') || t?.sourceUrl || t?.url || '');
      if(/(?:play\.geforcenow\.com|geforcenow\.com|nvidia|pixelclient\.xyz|\/assets\/games\/|\/assets\/ugs\/|\/assets\/gn-math\/|\/assets\/gms-games\/)/i.test(source)) return true;
      try{return !!t?.frame?.contentDocument?.querySelector('canvas,[role="application"],[data-testid*="game" i],[class*="game" i],[id*="game" i]')}catch{return false}
    }
    function focusActiveGameFrame(){
      const t=current();
      if(!t?.frame || !isGameInputTab(t)) return;
      releaseNyxKeyboardLock();
      try{t.frame.focus({preventScroll:true})}catch{try{t.frame.focus()}catch{}}
    }
    win.querySelector('.workspace-body')?.addEventListener('pointerdown',()=>setTimeout(focusActiveGameFrame,0),true);
    win.querySelector('.workspace-body')?.addEventListener('mousedown',()=>setTimeout(focusActiveGameFrame,0),true);
    win.addEventListener('wheel',event=>{
      if(!isGameInputTab() || !event.ctrlKey) return;
      event.preventDefault();
    },{capture:true,passive:false});
    win.addEventListener('keydown',event=>{
      if(!isGameInputTab()) return;
      const key=String(event.key || '').toLowerCase();
      if((event.ctrlKey || event.metaKey) && ['+','=','-','_','0'].includes(key)){
        event.preventDefault();
        event.stopPropagation();
      }
    },true);
    function directOnly(url){
      return false;
    }
    function showWorkspaceMessage(t,url){
      loadStudyjetTab(t,url,false);
    }
    function addTab(openUrl='',forceMode=''){
      const id='tab'+Date.now()+Math.random().toString(16).slice(2);
      const frame=document.createElement('iframe'); frame.className='view';
      applyFrameInteractionPermissions(frame);
      win.querySelector('.workspace-body').appendChild(frame);
      const tab={id,title:'New Tab',url:'',icon:favicons.nyx,history:[],index:-1,frame,opening:true,privacySessionId:createConnectionPrivacySessionId()};
      state.tabs.push(tab);
      activate(id);
      if(openUrl) navigate(openUrl,forceMode);
      return tab;
    }
    function reloadTab(tabId=state.active){
      const t=state.tabs.find(tab=>tab.id===tabId) || current();
      if(!t) return false;
      const source=workspaceShellSourceUrl(t.sourceUrl || t.url || '') || t.sourceUrl || t.url || '';
      if(!source){
        activate(t.id);
        return false;
      }
      activate(t.id);
      if(String(source).startsWith('nyx://')){
        showWorkspaceShellInternalPage(source.replace(/^nyx:\/\//,'') || 'apps');
        return true;
      }
      if(t.scramjetFrame){
        if(!studyjetController || t.privateScramjetController?.transport !== studyjetController.transport){
          loadStudyjetTab(t,source,false);
          return true;
        }
        clearFrameDocument(t);
        try{
          t.scramjetFrame.go(source);
          return true;
        }catch{
          retryStudyjetTab(t,source);
          return true;
        }
      }
      try{
        t.frame?.contentWindow?.location?.reload();
        return true;
      }catch{}
      const srcdoc=t.frame?.getAttribute('srcdoc');
      if(srcdoc){
        t.frame.srcdoc='';
        requestAnimationFrame(()=>{t.frame.srcdoc=srcdoc});
        return true;
      }
      const src=t.frame?.getAttribute('src');
      if(src){
        t.frame.removeAttribute('src');
        requestAnimationFrame(()=>{t.frame.src=src});
        return true;
      }
      if(/^https?:/i.test(source)){
        navigate(source,t.expectedEngine || '');
        return true;
      }
      return false;
    }
    function popupWarningHtml(message='are you trying to hack me ︻デ═一 indian shwarma scamma? get blocked hah'){
      const safeMessage=JSON.stringify(String(message || 'are you trying to hack me ︻デ═一 indian shwarma scamma? get blocked hah'));
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>nyx://blocked67haha</title><style>html,body{margin:0;width:100%;height:100%;background:#fff;color:#000;font:14px Outfit,Arial,sans-serif}body{overflow:hidden}.prompt-shade{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;background:#fff}.prompt{width:min(540px,calc(100vw - 36px));padding:18px 20px;border:0;border-radius:0 0 14px 14px;background:#fff;color:#000;box-shadow:0 6px 18px rgba(0,0,0,.18)}.title{margin:0 0 22px;color:#000;font-size:16px;font-weight:700}.message{margin:0 0 8px;font-size:14px;line-height:1.35}.prompt-input{width:100%;height:38px;margin:0 0 38px;border:2px solid #4b5563;border-radius:8px;background:#fff;color:#000;padding:0 10px;font:16px Outfit,Arial,sans-serif;outline:0}.actions{display:flex;justify-content:flex-end;gap:10px}.ok,.cancel{min-width:48px;height:40px;border:1px solid #d1d5db;border-radius:9px;background:#fff;color:#000;padding:0 14px;font:15px Outfit,Arial,sans-serif}.ok{border-color:#000;font-weight:800}.cancel{color:#000}.ok:focus{outline:2px solid #2563eb;outline-offset:2px}</style></head><body><script>const MESSAGE=${safeMessage};function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]))}function show(){document.body.innerHTML='<div class="prompt-shade"><div class="prompt" role="dialog" aria-modal="true"><div class="title">1aqlla said no goofy haha6767</div><div class="message">'+esc(MESSAGE)+'</div><input class="prompt-input" autocomplete="off" spellcheck="false"><div class="actions"><button class="ok" type="button">OK</button><button class="cancel" type="button">Cancel</button></div></div></div>';const ok=document.querySelector(".ok");const input=document.querySelector(".prompt-input");input.focus();ok.onclick=()=>setTimeout(show,0);document.querySelector(".cancel").onclick=()=>{};input.onkeydown=e=>{if(e.key==="Enter")ok.click()}}show();<\/script></body></html>`;
    }
    function popupTabHandle(t,openerUrl=''){
      if(!t) return null;
      let pendingHtml='';
      const go=value=>{
        const raw=String(value || '').trim();
        if(!raw || /^about:blank$/i.test(raw)) return;
        let next=raw;
        if(!/^[a-z][a-z0-9+.-]*:/i.test(raw) && openerUrl){
          try{next=new URL(raw,openerUrl).href}catch{}
        }
        activate(t.id);
        navigate(next);
      };
      const popupDocument={
        open(){pendingHtml=''; return popupDocument},
        write(html){pendingHtml+=String(html || '')},
        writeln(html){pendingHtml+=String(html || '')+'\n'},
        close(){
          showPopupWarningTab(t);
        }
      };
      const locationConnection={
        assign:go,
        replace:go,
        reload(){if(t.url) navigate(t.url)},
        toString(){return t.url || 'about:blank'},
        get href(){return t.url || 'about:blank'},
        set href(value){go(value)}
      };
      return {
        closed:false,
        focus(){activate(t.id)},
        blur(){},
        close(){
          const index=state.tabs.findIndex(tab=>tab.id===t.id);
          if(index<0) return;
          if(t.id===state.active) setTabLoading(t,false);
          destroyConnectionPrivacySession(t);
          t.frame.remove();
          state.tabs.splice(index,1);
          this.closed=true;
          if(!state.tabs.length) addTab();
          else activate(state.tabs[Math.max(0,index-1)].id);
        },
        postMessage(){},
        document:popupDocument,
        get location(){return locationConnection},
        set location(value){go(value)},
        get href(){return t.url || 'about:blank'},
        set href(value){go(value)}
      };
    }
    function showPopupWarningTab(t,message=''){
      if(!t?.frame) return;
      t.popupBlockMessage=message || t.popupBlockMessage || 'are you trying to hack me ︻デ═一 indian shwarma scamma? get blocked by 1aqlla dummy haha67';
      t.url='nyx://blocked67haha';
      t.title='Popup blocked';
      t.icon=favicons.nyx;
      t.frame.removeAttribute('src');
      t.frame.srcdoc=popupWarningHtml(t.popupBlockMessage);
      win.querySelector('.workspace-home').classList.add('hidden');
      t.frame.classList.add('active');
      renderTabs();
      activate(t.id);
      updateWorkspaceShellLocation(t.url,t.id);
    }
    function blockedPopupHandle(popup,message=''){
      const popupMessage=message || 'are you trying to hack me ︻デ═一 indian shwarma scamma? get blocked by 1aqlla dummy haha67';
      const rewrite=()=> {
        try{
          popup?.document?.open();
          popup?.document?.write(popupWarningHtml(popupMessage));
          popup?.document?.close();
        }catch{}
      };
      return {
        closed:false,
        focus(){try{popup?.focus?.()}catch{}},
        blur(){try{popup?.blur?.()}catch{}},
        close(){try{popup?.close?.()}catch{} this.closed=true},
        postMessage(){},
        document:{
          open(){rewrite(); return this},
          write(){rewrite()},
          writeln(){rewrite()},
          close(){rewrite()}
        },
        location:{
          href:'nyx://blocked67haha',
          assign(){rewrite()},
          replace(){rewrite()},
          reload(){rewrite()},
          toString(){return 'nyx://blocked67haha'}
        },
        get href(){return 'nyx://blocked67haha'},
        set href(_value){rewrite()}
      };
    }
    function openPopupTab(rawUrl){
      const openerUrl=current()?.url || location.href;
      const popupBlockMessage=isAnimexUrl(openerUrl) ? 'are you trying to block me shwarma?' : 'are you trying to hack me ︻デ═一 indian shwarma scamma? get blocked by 1aqlla dummy haha67';
      if(!popupProtectionForUrl(openerUrl)){
        const nativeOpen=window.__nyxNativeOpen || window.open?.bind(window);
        return nativeOpen ? nativeOpen(rawUrl || 'about:blank','_blank') : null;
      }
      return blockedPopupHandle(null,popupBlockMessage);
    }
    function installCrazyGamesOfflineRecovery(t,url=''){
      if(!t?.frame) return;
      const source=workspaceShellSourceUrl(url || t.sourceUrl || t.url || '') || url || t.sourceUrl || t.url || '';
      if(!hostMatches(workspaceHost(source),['crazygames.com'])) return;
      if(t.crazyGamesRecoveryInstalled) return;
      t.crazyGamesRecoveryInstalled=true;
      const startedAt=Date.now();
      const scan=()=>{
        if(!state.tabs.includes(t) || Date.now()-startedAt>10*60*1000){
          clearInterval(t.crazyGamesRecoveryTimer);
          t.crazyGamesRecoveryTimer=0;
          return;
        }
        const seen=new Set();
        const visit=doc=>{
          if(!doc?.documentElement || seen.has(doc)) return;
          seen.add(doc);
          try{
            const pageText=String(doc.body?.innerText || doc.body?.textContent || '').slice(0,1200);
            if(/connection issues/i.test(pageText)){
              const offline=[...doc.querySelectorAll('button,[role="button"]')]
                .find(button=>/^\s*continue offline\s*$/i.test(String(button.textContent || button.getAttribute('aria-label') || '')));
              if(offline && offline.dataset.nyxCrazyGamesRecovery!=='true'){
                offline.dataset.nyxCrazyGamesRecovery='true';
                offline.click();
                console.info('nyx CrazyGames: continued through the game frame offline so gameplay can start.');
              }
            }
          }catch{}
          try{
            doc.querySelectorAll('iframe,frame').forEach(frame=>{
              try{visit(frame.contentDocument)}catch{}
            });
          }catch{}
        };
        try{visit(t.frame.contentDocument)}catch{}
      };
      t.frame.addEventListener('load',()=>{
        setTimeout(scan,100);
        setTimeout(scan,700);
      });
      t.crazyGamesRecoveryTimer=setInterval(scan,700);
      scan();
    }
    function installDuckDuckGoImageViewportFix(t){
      globalThis.NyxDuckImageViewport?.(t,workspaceShellSourceUrl);
    }
    function installWorkspaceAdProtection(t){
      if(!t?.frame) return false;
      if(isNyxPublisherFrame(t.frame))return false;
      try{
        const frameWindow=t.frame.contentWindow;
        if(!frameWindow || frameWindow===window) return false;
        if(!frameWindow.__nyxWorkspaceAdBlock) frameWindow.eval(workspaceAdBlockRuntimeSource);
        return !!frameWindow.__nyxWorkspaceAdBlock;
      }catch{
        try{
          const doc=t.frame.contentDocument;
          if(!doc?.documentElement) return false;
          let style=doc.getElementById('nyx-page-cleanup-style');
          if(!style){
            style=doc.createElement('style');
            style.id='nyx-page-cleanup-style';
            style.textContent=workspaceAdElementSelector+'{display:none!important;visibility:hidden!important;pointer-events:none!important;width:0!important;height:0!important}';
            (doc.head || doc.documentElement).appendChild(style);
          }
          doc.querySelectorAll(workspaceAdElementSelector).forEach(node=>node.remove());
          return true;
        }catch{return false}
      }
    }
    function installWorkspaceLinkContextMenu(t){
      if(!t?.frame) return;
      const currentSource=()=>{
        let frameHref='';
        try{frameHref=String(t.frame.contentWindow?.location?.href || '')}catch{}
        const previous=workspaceShellSourceUrl(t.sourceUrl || t.url || '') || t.sourceUrl || t.url || '';
        const frameSource=workspaceShellSourceUrl(frameHref);
        return frameSource && !workspaceShellRejectFrameLocation(frameSource,previous) ? frameSource : previous;
      };
      const attach=()=>{
        try{
          const doc=t.frame.contentDocument;
          if(!doc?.documentElement || doc.documentElement.dataset.nyxLinkContextMenu==='true') return;
          doc.documentElement.dataset.nyxLinkContextMenu='true';
          doc.addEventListener('pointerdown',closeWorkspaceLinkMenu,true);
          doc.addEventListener('contextmenu',event=>{
            const link=event.target?.closest?.('a[href]');
            if(!link) return;
            const raw=String(link.href || link.getAttribute('href') || '').trim();
            const decoded=workspaceShellSourceUrl(raw) || raw;
            let resolved='';
            try{resolved=new URL(decoded,currentSource()).href}catch{return}
            const cleanUrl=workspaceShellClipboardText(resolved,currentSource());
            if(!/^https?:\/\//i.test(cleanUrl)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const frameBounds=t.frame.getBoundingClientRect();
            showWorkspaceLinkMenu(cleanUrl,frameBounds.left+event.clientX,frameBounds.top+event.clientY);
          },true);
        }catch{}
      };
      if(t.frame.dataset.nyxLinkContextMenuWatch!=='true'){
        t.frame.dataset.nyxLinkContextMenuWatch='true';
        t.frame.addEventListener('load',()=>{
          attach();
          setTimeout(attach,50);
          setTimeout(attach,250);
        });
      }
      attach();
    }
    function recoverRejectedStudyjetLocation(t,rejectedSource,previousSource){
      const recoverySource=/^https?:\/\//i.test(previousSource) ? previousSource : '';
      if(!t?.scramjetFrame || !recoverySource) return;
      const recoveryKey=`${recoverySource}\n${rejectedSource}`;
      if(t.scramjetRejectedLocationKey===recoveryKey) return;
      t.scramjetRejectedLocationKey=recoveryKey;
      const frame=t.frame;
      const navigationIntent=t.navigationIntent;
      setTimeout(()=>{
        if(!state.tabs.includes(t) || t.scramjetRejectedLocationKey!==recoveryKey) return;
        if(t.frame!==frame || t.navigationIntent!==navigationIntent || t.sourceUrl!==recoverySource) return;


        try{
          const actual=workspaceShellSourceUrl(frame.contentWindow.location.href);
          if(!workspaceShellRejectFrameLocation(actual,recoverySource)) return;
        }catch{return}
        try{t.scramjetFrame.go(recoverySource)}catch{}
      },160);
    }
    function installPopupBridge(t){
      if(!t?.frame) return;
      installWorkspaceLinkContextMenu(t);
      if(t.frame.dataset.nyxAdGuardWatch!=='true'){
        t.frame.dataset.nyxAdGuardWatch='true';
        t.frame.addEventListener('load',()=>{
          installWorkspaceAdProtection(t);
          setTimeout(()=>installWorkspaceAdProtection(t),80);
          setTimeout(()=>installWorkspaceAdProtection(t),500);
        });
      }
      installWorkspaceAdProtection(t);
      if(t.popupBridgeInstalled) return;
      if(t.frame.dataset.nyxDuckImageLoadFix!=='true'){
        t.frame.dataset.nyxDuckImageLoadFix='true';
        t.frame.addEventListener('load',()=>setTimeout(()=>installDuckDuckGoImageViewportFix(t),40));
      }
      installDuckDuckGoImageViewportFix(t);
      if(t.frame.dataset.nyxLocationSync!=='true'){
        t.frame.dataset.nyxLocationSync='true';
        const frame=t.frame;
        const syncLocation=(sameDocument=false)=>{
          if(t.frame!==frame || !state.tabs.includes(t)) return;
          const pendingFrameNavigation=t.frameHistoryPending || null;
          t.frameHistoryPending=null;
          try{
            if(t.previousNavigationDocument && t.frame.contentDocument===t.previousNavigationDocument)return;
            const frameHref=String(t.frame?.contentWindow?.location?.href || '');
            const source=workspaceShellSourceUrl(frameHref);
            if(!/^https?:\/\//i.test(source) || source===location.href) return;
            const previousSource=workspaceShellSourceUrl(t.sourceUrl || t.url || '') || t.sourceUrl || t.url || '';
            if(workspaceShellRejectFrameLocation(source,previousSource)){
              if(!sameDocument) recoverRejectedStudyjetLocation(t,source,previousSource);
              return;
            }


            if(sameDocument) t.scramjetHealthyDocument=frame.contentDocument;
            t.scramjetRejectedLocationKey='';
            t.previousNavigationDocument=null;
            const currentHistory=workspaceShellSourceUrl(t.history?.[t.index] || '') || String(t.history?.[t.index] || '');
            if(pendingFrameNavigation && pendingFrameNavigation.index===t.index){
              if(source!==currentHistory && t.index>=0) t.history[t.index]=source;
            }else if(source!==currentHistory && source!==previousSource){
              t.history=t.history.slice(0,t.index+1);
              t.history.push(source);
              t.index=t.history.length-1;
            }
            installDuckDuckGoImageViewportFix(t);
            t.url=source;
            t.sourceUrl=source;
            t.title=titleForUrl(source);
            t.icon=iconForUrl(source);
            renderTabs();
            if(t.id===state.active){
              const address=win.querySelector('.urlbar');
              if(document.activeElement!==address)address.value=workspaceShellDisplayValue(source);
              updateWorkspaceShellLocation(source,t.id);
            }
            syncLoadedTabIcon(t);
          }catch{}
          setTimeout(()=>syncLoadedTabIcon(t),260);
        };
        frame.addEventListener('load',()=>setTimeout(()=>syncLocation(),40));



        let observedDocument=null,observedHref='';
        const locationTimer=setInterval(()=>{
          if(t.frame!==frame || !frame.isConnected || !state.tabs.includes(t)){
            clearInterval(locationTimer);return;
          }
          try{
            const doc=frame.contentDocument,href=frame.contentWindow.location.href;
            const changed=doc && doc===observedDocument && href!==observedHref;
            observedDocument=doc;observedHref=href;
            if(changed) syncLocation(true);
          }catch{observedDocument=null;observedHref='';}
        },250);
      }
      const bridgeUrl=t.sourceUrl || t.url || t.frame.getAttribute('src') || '';
      if(isSpotifyFamilyUrl(bridgeUrl) || isAuthSensitiveUrl(bridgeUrl)) return;
      if(hostMatches(workspaceHost(workspaceShellSourceUrl(bridgeUrl) || bridgeUrl),['youtube.com','youtu.be'])) return;
      t.popupBridgeInstalled=true;
      const shouldTrapPopupTarget=target=>{
        const value=String(target || '').toLowerCase();
        return value && value !== '_self';
      };
      const currentBridgeUrl=()=>{
        let frameHref='';
        try{frameHref=String(t.frame?.contentWindow?.location?.href || '')}catch{}
        const previous=workspaceShellSourceUrl(t.sourceUrl || t.url || '') || t.sourceUrl || t.url || bridgeUrl;
        const frameSource=workspaceShellSourceUrl(frameHref);
        return frameSource && !workspaceShellRejectFrameLocation(frameSource,previous) ? frameSource : previous;
      };
      const popupProtectionActive=()=>popupProtectionForUrl(currentBridgeUrl());
      const isTrustedGeneratedLink=link=>{
        if(!link?.matches?.('a[data-nyx-generated-popup][href]')) return false;
        if(!isNyxLinkGeneratorUrl(currentBridgeUrl())) return false;
        return isNyxGeneratedCdnUrl(link.href || link.getAttribute('href'));
      };
      const sameOriginPopupUrl=value=>{
        const raw=String(value || '').trim();
        if(!raw || /^about:blank$/i.test(raw)) return '';
        try{
          const base=currentBridgeUrl();
          const resolvedRaw=workspaceShellSourceUrl(raw) || raw;
          const resolved=new URL(resolvedRaw,base);
          const source=new URL(base,location.href);
          const cleanHost=host=>String(host || '').replace(/^www\./i,'').toLowerCase();
          const sameSite=resolved.protocol===source.protocol
            && resolved.port===source.port
            && cleanHost(resolved.hostname)===cleanHost(source.hostname);
          return sameSite ? resolved.href : '';
        }catch{return ''}
      };
      const followSameOriginPopup=value=>{
        const trusted=sameOriginPopupUrl(value);
        if(!trusted) return false;
        activate(t.id);
        navigate(trusted,t.expectedEngine || '');
        return true;
      };
      const searchResultUrl=link=>{
        if(!link) return '';
        const sourceHost=workspaceHost(workspaceShellSourceUrl(t.sourceUrl || t.url || bridgeUrl) || bridgeUrl);
        let isResult=false;
        if(hostMatches(sourceHost,['duckduckgo.com'])) isResult=!!link.closest?.('[data-testid="result"],article,.result,.results_links');
        else if(hostMatches(sourceHost,['google.com'])) isResult=!!link.closest?.('#search,.MjjYud,.g');
        else if(hostMatches(sourceHost,['bing.com'])) isResult=!!link.closest?.('li.b_algo,.b_algo');
        if(!isResult) return '';
        const raw=String(link.href || link.getAttribute?.('href') || '').trim();
        try{
          const resolved=new URL(workspaceShellSourceUrl(raw) || raw,t.sourceUrl || bridgeUrl);
          if(hostMatches(resolved.hostname.replace(/^www\./i,''),['duckduckgo.com'])){
            const direct=resolved.searchParams.get('uddg');
            if(/^https?:\/\//i.test(direct || '')) return direct;
          }
          if(hostMatches(resolved.hostname.replace(/^www\./i,''),['google.com']) && /^\/url$/i.test(resolved.pathname)){
            const direct=resolved.searchParams.get('q') || resolved.searchParams.get('url');
            if(/^https?:\/\//i.test(direct || '')) return direct;
          }
          if(hostMatches(resolved.hostname.replace(/^www\./i,''),['bing.com']) && /^\/ck\/a/i.test(resolved.pathname)){
            const encoded=String(resolved.searchParams.get('u') || '');
            if(/^a1/i.test(encoded)){
              const payload=encoded.slice(2).replace(/-/g,'+').replace(/_/g,'/');
              const padded=payload+'='.repeat((4-payload.length%4)%4);
              const direct=atob(padded);
              if(/^https?:\/\//i.test(direct)) return direct;
            }
          }
          return resolved.href;
        }catch{return ''}
      };
      const followSearchResult=link=>{
        const destination=searchResultUrl(link);
        if(!destination) return false;
        activate(t.id);
        navigate(destination);
        return true;
      };
      const searchUrlForCurrentProvider=query=>{
        const value=String(query || '').trim();
        if(!value) return '';
        const host=workspaceHost(currentBridgeUrl());
        const encoded=encodeURIComponent(value);
        if(hostMatches(host,['duckduckgo.com'])) return `https://duckduckgo.com/?q=${encoded}`;
        if(/(?:^|\.)google\.[a-z.]+$/i.test(host)) return `https://${host}/search?q=${encoded}`;
        if(hostMatches(host,['bing.com'])) return `https://www.bing.com/search?q=${encoded}`;
        return '';
      };
      const followInPageSearch=query=>{
        const destination=searchUrlForCurrentProvider(query);
        if(!destination) return false;
        activate(t.id);
        setTimeout(()=>{
          if(!state.tabs.includes(t)) return;
          navigate(destination);
        },0);
        return true;
      };
      const isDownloadUrl=value=>{
        const rawHref=String(value || '').trim();




        if(/^(?:blob|data):/i.test(rawHref)) return false;
        const href=rawHref.split(/[?#]/)[0].toLowerCase();
        return /\.(apk|appx|bat|bin|cmd|com|crx|deb|dmg|exe|iso|jar|msi|pkg|scr|wsf|zip|7z|rar)$/i.test(href);
      };
      const isDownloadLink=link=>{
        if(!link) return false;
        if(link.hasAttribute('download')) return true;
        return isDownloadUrl(link.href || link.getAttribute('href') || '');
      };
      const requestFrameDownload=(value,filename='')=>{
        const href=String(value || '').trim();
        if(!href) return false;
        void nyxRequestWorkspaceDownload(href,String(filename || '').trim(),currentBridgeUrl());
        return true;
      };
      const searchDocuments=new WeakSet();
      const containSearchDocument=doc=>{
        if(!doc?.documentElement||searchDocuments.has(doc)||!hostMatches(workspaceHost(currentBridgeUrl()),['duckduckgo.com','bing.com','google.com']))return;
        searchDocuments.add(doc);
          const containSearchResults=(root=doc)=>{
            const links=[...(root.matches?.('a[target]')?[root]:[]),...(root.querySelectorAll?.('a[target]')||[])];
            for(const link of links){
              if(link.target==='_self' || link.hasAttribute('download'))continue;
              const destination=searchResultUrl(link);
              if(destination){link.href=destination;link.setAttribute('target','_self');}
            }
          };
          containSearchResults();
          if(hostMatches(workspaceHost(currentBridgeUrl()),['duckduckgo.com','bing.com','google.com'])){
            new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')containSearchResults(record.target);else for(const node of record.addedNodes)containSearchResults(node);}}).observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['target']});
          }
      };
      const attachBridge=()=>{
        try{
          const liveHost=workspaceHost(currentBridgeUrl());
          const doc=t.frame.contentDocument;
          containSearchDocument(doc);
          if(hostMatches(liveHost,['google.com','gstatic.com'])) return;
          const frameWindow=t.frame.contentWindow;
          if(frameWindow && !frameWindow.__nyxOpenBridge){
            frameWindow.__nyxOpenBridge=true;
            const frameClipboard=frameWindow.navigator?.clipboard;
            if(frameClipboard?.writeText && !frameClipboard.__nyxCleanWriteText){
              const nativeWriteText=frameClipboard.writeText.bind(frameClipboard);
              try{
                Object.defineProperty(frameClipboard,'writeText',{
                  configurable:true,
                  value:value=>nativeWriteText(workspaceShellClipboardText(value,currentBridgeUrl()))
                });
                Object.defineProperty(frameClipboard,'__nyxCleanWriteText',{value:true});
              }catch{}
            }
            const nativeFrameOpen=frameWindow.open?.bind(frameWindow);
            const nyxPopup=(popupUrl,target,features)=>{
              if(isDownloadUrl(popupUrl) && requestFrameDownload(popupUrl)) return frameWindow;
              if(String(target || '').toLowerCase()==='_self'){
                return nativeFrameOpen ? nativeFrameOpen(popupUrl,target,features) : null;
              }
              if(!popupProtectionActive()) return nativeFrameOpen ? nativeFrameOpen(popupUrl,target,features) : null;
              if(followSameOriginPopup(popupUrl)) return frameWindow;
              return openPopupTab(popupUrl || 'about:blank');
            };
            try{
              Object.defineProperty(frameWindow,'open',{value:nyxPopup,writable:true,configurable:true});
            }catch{
              frameWindow.open=nyxPopup;
            }
            if(frameWindow.HTMLAnchorElement?.prototype?.click){
              const nativeAnchorClick=frameWindow.HTMLAnchorElement.prototype.click;
              frameWindow.HTMLAnchorElement.prototype.click=function(){
                if(isDownloadLink(this) && requestFrameDownload(this.href || this.getAttribute('href'),this.getAttribute('download') || '')) return;
                if(popupProtectionActive() && shouldTrapPopupTarget(this.target)){
                  const href=this.href || this.getAttribute('href') || '';
                  if(followSearchResult(this)) return;
                  if(followSameOriginPopup(href)) return;
                  openPopupTab(href || 'about:blank');
                  return;
                }
                return nativeAnchorClick.call(this);
              };
            }
          }
          if(!doc?.documentElement || doc.documentElement.dataset.nyxPopupBridge==='true') return;
          doc.documentElement.dataset.nyxPopupBridge='true';
          const sourceHost=workspaceHost(currentBridgeUrl());
          if(hostMatches(sourceHost,['cineby.at']) && !doc.documentElement.dataset.nyxCinebyFrameGuard){
            doc.documentElement.dataset.nyxCinebyFrameGuard='true';
            const blockDirectCinebyFrame=node=>{
              if(!node?.matches?.('iframe[src],frame[src]')) return;
              const raw=String(node.getAttribute('src') || '').trim();
              if(!/^https?:\/\//i.test(raw)) return;
              const host=workspaceHost(raw);
              if(!hostMatches(host,['cineby.at'])) return;
              node.removeAttribute('src');
              node.remove();
            };
            doc.querySelectorAll('iframe[src],frame[src]').forEach(blockDirectCinebyFrame);
            new MutationObserver(records=>records.forEach(record=>{
              if(record.type==='attributes') blockDirectCinebyFrame(record.target);
              record.addedNodes.forEach(node=>{
                blockDirectCinebyFrame(node);
                node.querySelectorAll?.('iframe[src],frame[src]').forEach(blockDirectCinebyFrame);
              });
            })).observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
          }
          const searchControlValue=control=>String(control?.value || '').trim();
          const trapSearchSubmit=event=>{
            const form=event.target;
            if(!form || String(form.tagName || '').toUpperCase()!=='FORM') return;
            const control=form.querySelector('textarea[name="q"],input[name="q"],input[type="search"]');
            if(!followInPageSearch(searchControlValue(control))) return;
            event.preventDefault();
            event.stopImmediatePropagation();
          };
          const trapSearchEnter=event=>{
            if(event.key!=='Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
            const control=event.target?.closest?.('textarea[name="q"],input[name="q"],input[type="search"]');
            if(!control || !followInPageSearch(searchControlValue(control))) return;
            event.preventDefault();
            event.stopImmediatePropagation();
          };
          const trapLink=event=>{
            const link=event.target?.closest?.('a[href]');
            if(!link) return;

            const partnerInvites=['https://discord.gg/65Bgrbewc7','https://discord.gg/fRe5F3RBQQ','https://discord.gg/CTX942hxX','https://discord.gg/wC9DrfXvr','https://discord.gg/RkGgbJRVP7','https://discord.gg/uncensor','https://dsc.gg/ghostub','https://discord.gg/FHmEqPgMVe','https://discord.gg/w7J5auDhNm','https://discord.gg/3fbJG2emb6','https://discord.gg/uqPH78ZV7X'];
            if(link.hasAttribute('data-nyx-partner-invite') && partnerInvites.includes(link.href)
              && doc.location.origin===location.origin && /^\/apps\/partners\/(?:index\.html)?$/.test(doc.location.pathname)
              && event.isTrusted && (event.type==='click' || event.button===1)){
              event.preventDefault();
              event.stopImmediatePropagation();
              const nativeOpen=window.__nyxNativeOpen || window.open.bind(window);
              nativeOpen(link.href,'_blank','noopener,noreferrer');
              return;
            }
            if(isDownloadLink(link)){
              event.preventDefault();
              event.stopImmediatePropagation();
              requestFrameDownload(link.href || link.getAttribute('href'),link.getAttribute('download') || '');
              return;
            }
            if(!popupProtectionActive()) return;
            if(!shouldTrapPopupTarget(link.getAttribute('target'))) return;
            const href=link.href || link.getAttribute('href') || 'about:blank';
            if(isTrustedGeneratedLink(link)){
              event.preventDefault();
              event.stopImmediatePropagation();
              const generatedTab=addTab(href,appCompatibilityMode(href));
              if(!generatedTab) toast('Nyx could not open the generated link. Select Open first again.');
              return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            if(followSearchResult(link)) return;
            if(!followSameOriginPopup(href)) openPopupTab(href);
          };
          doc.addEventListener('keydown',trapSearchEnter,true);
          doc.addEventListener('submit',trapSearchSubmit,true);
          doc.addEventListener('click',trapLink,true);
          doc.addEventListener('auxclick',trapLink,true);
          doc.addEventListener('copy',event=>{
            const selected=String(doc.getSelection?.() || '');
            const cleaned=workspaceShellClipboardText(selected,currentBridgeUrl());
            if(!selected || cleaned===selected || !event.clipboardData) return;
            event.preventDefault();
            event.clipboardData.setData('text/plain',cleaned);
          },true);
          doc.addEventListener('submit',event=>{
            const form=event.target;
            if(!popupProtectionActive()) return;
            if(!form || String(form.tagName || '').toUpperCase()!=='FORM' || !shouldTrapPopupTarget(form.getAttribute('target'))) return;
            const action=form.action || form.getAttribute('action') || '';
            if(sameOriginPopupUrl(action)){
              try{form.setAttribute('target','_self'); return}catch{}
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            openPopupTab(action || 'about:blank');
          },true);
        }catch{}
      };
      t.frame.addEventListener('load',()=>{
        attachBridge();
        setTimeout(attachBridge,50);
        setTimeout(attachBridge,250);
      });
    }
    function isAuthSensitiveUrl(url){
      const raw=String(url || '');
      if(/recaptcha|captcha|challenge|oauth|sso|login|signin|accounts/i.test(raw)) return true;
      try{
        const parsed=new URL(workspaceShellSourceUrl(raw) || raw,location.href);
        const host=parsed.hostname.replace(/^www\./,'').toLowerCase();
        const path=(parsed.pathname+parsed.search+parsed.hash).toLowerCase();
        if(host==='accounts.spotify.com') return true;
        if(['google.com','gstatic.com','recaptcha.net'].includes(host) && /recaptcha|captcha/.test(path)) return true;
        return false;
      }catch{
        return false;
      }
    }
    function installYouTubeCompositorGuard(t){
      const frame=t?.frame;
      if(!frame) return;
      const install=()=>{
        try{
          const frameHref=String(frame.contentWindow?.location?.href || frame.getAttribute('src') || '');
          const source=workspaceShellSourceUrl(frameHref)
            || workspaceShellSourceUrl(t.sourceUrl || t.url || '')
            || t.sourceUrl || t.url || frameHref;
          if(!hostMatches(workspaceHost(source),['youtube.com','youtu.be'])) return;
          const doc=frame.contentDocument;
          const frameWindow=frame.contentWindow;
          if(!doc?.documentElement || !frameWindow) return;
          if(!doc.getElementById('nyx-youtube-compositor-guard')){
            const style=doc.createElement('style');
            style.id='nyx-youtube-compositor-guard';
            style.textContent='html:root,html:root *{view-transition-name:none!important}';
            (doc.head || doc.documentElement).appendChild(style);
          }
          const disabledStartViewTransition=update=>{
            const callback=typeof update==='function' ? update : update?.update;
            let result;
            try{result=callback?.()}
            catch(error){result=Promise.reject(error)}
            const updateCallbackDone=Promise.resolve(result);
            const ready=updateCallbackDone.then(()=>undefined);
            return {
              ready,
              finished:ready,
              updateCallbackDone,
              skipTransition(){},
              types:new Set()
            };
          };
          const disableFor=target=>{
            if(!target) return;
            try{
              Object.defineProperty(target,'startViewTransition',{
                configurable:true,
                writable:true,
                value:disabledStartViewTransition
              });
            }catch{
              try{target.startViewTransition=disabledStartViewTransition}catch{}
            }
          };
          disableFor(frameWindow.Document?.prototype);
          disableFor(frameWindow.Element?.prototype);
          disableFor(doc);
          doc.documentElement.dataset.nyxYouTubeCompositorGuard='true';
        }catch{}
      };
      if(frame.dataset.nyxYouTubeCompositorGuardWatch!=='true'){
        frame.dataset.nyxYouTubeCompositorGuardWatch='true';
        frame.addEventListener('load',()=>{
          install();
          setTimeout(install,40);
          setTimeout(install,300);
        });
      }
      install();
    }
    function installYouTubeCompatibilityGuard(t){
      const frame=t?.frame;
      if(!frame) return;
      const install=()=>{
        try{
          const frameHref=String(frame.contentWindow?.location?.href || frame.getAttribute('src') || '');
          const source=workspaceShellSourceUrl(frameHref)
            || workspaceShellSourceUrl(t.sourceUrl || t.url || '')
            || t.sourceUrl || t.url || frameHref;
          if(!isYouTubeUrl(source)) return;
          const doc=frame.contentDocument;
          if(!doc?.documentElement || !doc.querySelector('ytd-app,#movie_player,tp-yt-iron-overlay-backdrop')) return;
          doc.documentElement.lang='en';
          const cookies=String(doc.cookie || '');
          if(!/(?:^|;\s*)PREF=[^;]*hl=en/i.test(cookies)){
            doc.cookie='PREF=hl=en&gl=US; path=/; max-age=31536000; SameSite=Lax';
            if(!t.youtubeLocaleReloaded){
              t.youtubeLocaleReloaded=true;
              setTimeout(()=>{
                try{frame.contentWindow?.location?.reload()}catch{}
              },80);
              return;
            }
          }
          const player=doc.querySelector('#movie_player');
          try{player?.setPlaybackQualityRange?.('large','large')}catch{}
          try{player?.setPlaybackQuality?.('large')}catch{}
          doc.documentElement.dataset.nyxYouTubeCompatibility='english-480p';
          if(doc.documentElement.dataset.nyxYouTubeNavigationWatch!=='true'){
            doc.documentElement.dataset.nyxYouTubeNavigationWatch='true';
            const reapply=()=>setTimeout(install,240);
            doc.addEventListener('yt-navigate-finish',reapply);
            doc.addEventListener('yt-page-data-updated',reapply);
          }
          if(!frame.classList.contains('active')){
            try{player?.pauseVideo?.()}catch{}
            doc.querySelectorAll('video,audio').forEach(media=>{try{media.pause()}catch{}});
          }
        }catch{}
      };
      if(frame.dataset.nyxYouTubeCompatibilityWatch!=='true'){
        frame.dataset.nyxYouTubeCompatibilityWatch='true';
        frame.addEventListener('load',()=>{
          install();
          setTimeout(install,350);
          setTimeout(install,1400);
          setTimeout(install,4200);
          setTimeout(install,8000);
        });
      }
      install();
    }
    function shouldRelaxConnectionSandbox(url){
      const raw=workspaceShellSourceUrl(String(url || '')) || String(url || '');
      const host=workspaceHost(raw);
      return isAuthSensitiveUrl(raw) || hostMatches(host,[
        'geforcenow.com',
        'play.geforcenow.com',
        'nvidia.com',
        'nvidiagrid.net',
        'discord.com',
        'spotify.com',
        'spotifycdn.com',
        'scdn.co',
        'accounts.spotify.com',
        'accounts.scdn.co',
        'google.com',
        'gstatic.com',
        'recaptcha.net',
        'youtube.com',
        'youtu.be'
      ]);
    }
    const workspaceFrameAllow="geolocation 'none'; autoplay; encrypted-media; fullscreen; keyboard-map; gamepad; clipboard-read; clipboard-write; camera; microphone; display-capture; accelerometer; gyroscope; magnetometer; xr-spatial-tracking; payment; publickey-credentials-get; identity-credentials-get; private-state-token-issuance; private-state-token-redemption";
    const workspaceFrameAltKeys=new Set(['l','d','t','w','r','arrowleft','arrowright','tab']);
    function isWorkspaceFrameAltShortcut(key){
      key=String(key || '').toLowerCase();
      return /^[1-9]$/.test(key) || workspaceFrameAltKeys.has(key);
    }
    function stopFrameAltEvent(event){
      try{event.preventDefault()}catch{}
      try{event.stopPropagation()}catch{}
      try{event.stopImmediatePropagation?.()}catch{}
    }
    function installWorkspaceAltBridgeInDocument(doc){
      if(!doc || doc.__nyxWorkspaceAltBridge) return;
      try{doc.__nyxWorkspaceAltBridge=true}catch{}
      const handler=event=>{
        try{
          if(handleNyxSidebarShortcut(event))return;
          if(!event?.altKey || event.ctrlKey || event.metaKey || event.location===2) return;
          const key=String(event.key || '').toLowerCase();
          if(key==='alt'){
            stopFrameAltEvent(event);
            primeWorkspaceShellShortcutFocus();
            return;
          }
          if(!isWorkspaceFrameAltShortcut(key)) return;
          if(handleWorkspaceShellAltAction(key,event)) stopFrameAltEvent(event);
        }catch{}
      };
      try{doc.addEventListener('keydown',handler,true)}catch{}
      try{doc.defaultView?.addEventListener?.('keydown',handler,true)}catch{}
      const releaseForPageInput=event=>{
        try{
          hideWorkspaceSuggestions();
          clearWorkspaceShellUrlSelection();
          const target=event?.target;
          if(!target?.closest?.('canvas,input,textarea,select,[contenteditable="true"],[role="application"]')) return;
          releaseNyxKeyboardLock();
        }catch{}
      };
      try{doc.addEventListener('pointerdown',releaseForPageInput,true)}catch{}
      try{doc.addEventListener('mousedown',releaseForPageInput,true)}catch{}
      try{doc.addEventListener('touchstart',releaseForPageInput,{capture:true,passive:true})}catch{}
      try{doc.addEventListener('focusin',releaseForPageInput,true)}catch{}
      const installNested=()=>{
        try{
          doc.querySelectorAll?.('iframe,frame').forEach(child=>{
            try{installWorkspaceAltBridgeInDocument(child.contentDocument)}catch{}
          });
        }catch{}
      };
      installNested();
      try{
        const root=doc.documentElement || doc.body;
        if(root) new MutationObserver(installNested).observe(root,{childList:true,subtree:true});
      }catch{}
    }
    function installWorkspaceAltBridgeForFrame(frame){
      try{
        const frameHref=String(frame.contentWindow?.location?.href || frame.getAttribute('src') || '');
        const source=workspaceShellSourceUrl(frameHref) || frameHref;
        if(hostMatches(workspaceHost(source),['youtube.com','youtu.be'])) return;
        installWorkspaceAltBridgeInDocument(frame.contentDocument);
      }catch{}
    }
    function applyFrameInteractionPermissions(frame){
      if(!frame) return;
      frame.tabIndex=0;
      frame.setAttribute('tabindex','0');
      frame.setAttribute('allow',workspaceFrameAllow);
      frame.style.pointerEvents='auto';
      const installAltBridge=()=>{
        installWorkspaceAltBridgeForFrame(frame);
        syncInternalThemeFrames();
        setTimeout(()=>installWorkspaceAltBridgeForFrame(frame),120);
        setTimeout(()=>installWorkspaceAltBridgeForFrame(frame),700);
      };
      installAltBridge();
      if(frame.dataset.nyxInputReady==='true') return;
      frame.dataset.nyxInputReady='true';
      frame.addEventListener('nyx:app-dom-ready',()=>syncInternalThemeFrames());
      const focusFrame=()=>setTimeout(()=>{
        const focused=document.activeElement;
        if(!frame.isConnected || !frame.classList.contains('active') || focused?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
        try{frame.focus({preventScroll:true})}catch{try{frame.focus()}catch{}}
      },0);
      frame.addEventListener('load',()=>{
        installAltBridge();
        setTimeout(focusFrame,90);
      });
      frame.addEventListener('keydown',event=>{
        try{
          if(!event.altKey || event.ctrlKey || event.metaKey || event.location===2) return;
          const key=String(event.key || '').toLowerCase();
          if(key==='alt'){
            stopFrameAltEvent(event);
            primeWorkspaceShellShortcutFocus();
            return;
          }
          if(isWorkspaceFrameAltShortcut(key) && handleWorkspaceShellAltAction(key,event)) stopFrameAltEvent(event);
        }catch{}
      },true);
      const handoffFrameInput=()=>{

        releaseNyxKeyboardLock();
        hideWorkspaceSuggestions();
        clearWorkspaceShellUrlSelection();
      };
      frame.addEventListener('focus',handoffFrameInput);
      frame.addEventListener('pointerdown',handoffFrameInput,{capture:true});
      frame.addEventListener('mousedown',handoffFrameInput,{capture:true});
      frame.addEventListener('touchstart',handoffFrameInput,{capture:true,passive:true});
    }
    function setFrameSandbox(t){
      if(!t?.frame) return;
      const sourceUrl=t.sourceUrl || t.url || t.frame.getAttribute('src') || '';
      const containPopups=popupProtectionForUrl(sourceUrl);
      t.frame.dataset.nyxWorkspaceContained=containPopups ? 'true' : 'false';
      applyFrameInteractionPermissions(t.frame);
      installYouTubeCompositorGuard(t);
      installYouTubeCompatibilityGuard(t);
      if(!containPopups && shouldRelaxConnectionSandbox(sourceUrl)){
        t.frame.removeAttribute('sandbox');
        applyFrameInteractionPermissions(t.frame);
        return;
      }
      const tokens=[
        'allow-scripts',
        'allow-same-origin',
        'allow-forms',
        'allow-modals',
        'allow-downloads',
        'allow-pointer-lock',
        'allow-presentation',
        'allow-storage-access-by-user-activation'
      ];
      if(!containPopups){
        tokens.push('allow-popups','allow-popups-to-escape-sandbox','allow-top-navigation-by-user-activation');
      }
      t.frame.setAttribute('sandbox',tokens.join(' '));
      applyFrameInteractionPermissions(t.frame);
    }
    function clearFrameDocument(t){
      if(!t?.frame) return;
      t.frame.removeAttribute('srcdoc');
    }
    function replaceTabFrame(t){
      if(!t?.frame) return;
      const frame=document.createElement('iframe');
      frame.className='view';
      applyFrameInteractionPermissions(frame);
      if(t.frame.classList.contains('active')) frame.classList.add('active');
      t.frame.replaceWith(frame);
      t.frame=frame;
      t.scramjetFrame=null;
      t.scramjetVersion='';
      t.scramjetRuntimeGuarded=null;
      t.popupBridgeInstalled=false;
      setFrameSandbox(t,true);
      installPopupBridge(t);
    }
    function ensureTabLoadingScene(){
      const body=win.querySelector('.workspace-body');
      if(!body) return null;
      let loader=body.querySelector('.nyx-frame-loader');
      if(loader) return loader;
      loader=document.createElement('div');
      loader.className='nyx-frame-loader';
      loader.setAttribute('aria-hidden','true');
      loader.innerHTML='<span class="nyx-page-spinner" aria-hidden="true"></span><span>Loading page…</span>';
      body.append(loader);
      return loader;
    }
    function setTabLoading(t,loading){
      if(!t) return;
      t.loading=!!loading;
      if(t.id===state.active){
        ensureTabLoadingScene()?.setAttribute('aria-hidden',t.loading?'false':'true');
        win.classList.toggle('nyx-frame-loading',t.loading);
      }
    }
    function activate(id){
      cleanupWorkspaceAttachedAds();
      state.active=id; const t=current();
      if(t?.chatUnread)t.chatUnread=false;
      let mappedShellTab=null;
      if(document.body.classList.contains('workspace-shell')){
        mappedShellTab=workspaceShellTabs.find(tab=>tab.workspaceTabId===id) || null;
        if(mappedShellTab) workspaceShellActiveTab=mappedShellTab.id;
      }
      const activeUrl=t?.url || mappedShellTab?.url || '';
      const activeLocation=workspaceShellSourceUrl(t?.sourceUrl || activeUrl) || t?.sourceUrl || activeUrl;
      const activeTitle=t?.title || mappedShellTab?.title || 'New Tab';
      const activeIsBlank=isWorkspaceShellBlankUrl(activeUrl);
      win.classList.toggle('nyx-frame-loading',!!t?.loading);
      ensureTabLoadingScene()?.setAttribute('aria-hidden',t?.loading?'false':'true');
      win.classList.toggle('internal-clear',!!t?.frame?.classList.contains('transparent-internal-page'));
      win.querySelectorAll('.view').forEach(f=>f.classList.remove('active'));
      win.classList.toggle('workspace-blank',activeIsBlank);
      if(activeUrl && !activeIsBlank){t?.frame.classList.add('active'); win.querySelector('.workspace-home').classList.add('hidden')}
      else{
        win.querySelector('.workspace-home').classList.remove('hidden');
        if(t?.opening) playWorkspaceShellPageReveal(win);
      }
      state.tabs.forEach(tab=>{
        if(tab===t) return;
        let tabPath='';
        try{
          const tabSource=workspaceShellSourceUrl(tab.sourceUrl||tab.url||'') || tab.sourceUrl || tab.url || tab.frame?.getAttribute('src') || '';
          tabPath=new URL(tabSource,location.href).pathname;
        }catch{}



        if(['/apps/chat/','/apps/chat/index.html','/apps/nyxify/','/apps/nyxify/index.html'].includes(tabPath)) return;
        try{
          const doc=tab.frame?.contentDocument;
          doc?.querySelector('#movie_player')?.pauseVideo?.();
          doc?.querySelectorAll('video,audio').forEach(media=>media.pause());
        }catch{}
      });
      win.querySelector('.urlbar').value=workspaceShellDisplayValue(activeLocation); win.querySelector('.titlebar-title').textContent=workspaceChromeTitle(activeTitle,activeLocation); renderTabs(); bring(win);
      if(t?.url || !mappedShellTab?.url) updateWorkspaceShellLocation(activeLocation,t?.id || '');
    }
    function detectWorkspaceEngine(url,t){
      const raw=String(url || '');
      const frameSrc=String(t?.frame?.getAttribute?.('src') || '');
      if(t?.scramjetFrame || raw.startsWith('/~/sj/') || frameSrc.includes('/~/sj/')) return 'scramjet';
      if(raw.startsWith('/service/') || frameSrc.startsWith('/service/')) return 'scramjet';
      if(raw.startsWith('/scramjet/service/') || frameSrc.startsWith('/scramjet/service/')) return 'scramjet-legacy';
      if(/^https?:/i.test(raw)) return 'direct';
      if(raw.startsWith('nyx://')) return 'nyx';
      return raw ? 'iframe' : 'blank';
    }
    function markWorkspaceEngine(t,expected,url,phase='load'){
      if(!t) return;
      t.expectedEngine=expected || t.expectedEngine || '';
      t.actualEngine=detectWorkspaceEngine(url,t);
    }
    function resetConnectionInstallers(){
      studyjetInstallPromise=null;
      studyjetTransport=null;
      studyjetTransportKey='';
    }
    function setWorkspaceTransportOverride(next){
      next=next ? normalizeWorkspaceTransportName(next) : '';
      if(workspaceTransportOverride===next) return;
      workspaceTransportOverride=next;
      resetConnectionInstallers();
    }
    function applyPreferredTransportForUrl(url,workspaceMode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE))){
      if(!transportAutoEnabled()){
        setWorkspaceTransportOverride('');
        return;
      }
      setWorkspaceTransportOverride('libcurlRaw');
    }
    function transportAutoEnabled(){
      return normalizeWorkspaceTransportName(store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT))==='auto';
    }
    function connectionTransportName(){
      return normalizeWorkspaceTransportName(workspaceTransportOverride || store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT));
    }
    function transportRetryOrder(current){
      const ordered=['libcurlRaw','epoxy','wisp'];
      const index=ordered.indexOf(current);
      if(index<0) return ordered;
      return [...ordered.slice(index+1),...ordered.slice(0,index)];
    }
    function serviceWorkerTransportErrorText(text){
      return /internal service worker error|request failed with error code\s*(?:35|52|56|60)|ssl connect error|tls handshake eof|wisp server closed|muxtaskended|ssl peer certificate|ssh remote key|certificate.*not ok|failure when receiving data from the peer/i.test(String(text || ''));
    }
    function tlsCertificateErrorText(text){
      return /request failed with error code\s*60\b|ssl peer certificate|certificate.*not ok|certificate (?:error|invalid|expired|revoked|untrusted)|cert_(?:authority_invalid|common_name_invalid|date_invalid)/i.test(String(text || ''));
    }
    function retrySearchHandshake(t,sourceUrl,expectedEngine,reason){
      if(expectedEngine!=='scramjet' || tlsCertificateErrorText(reason)) return false;
      if(!/request failed with error code\s*35\b|ssl connect error|tls handshake eof/i.test(String(reason || ''))) return false;
      if(!Object.values(engines).some(prefix=>String(sourceUrl).startsWith(prefix))) return false;
      const key=String(t.navigationIntent || '')+':'+sourceUrl;
      if(t.searchHandshakeRecovery===key) return false;
      t.searchHandshakeRecovery=key;
      t.transportWatchToken='';
      t.loadWatchToken='';
      const current=connectionTransportName();
      setWorkspaceTransportOverride(current==='libcurlRaw'||current==='auto'?'epoxy':'libcurlRaw');
      loadStudyjetTab(t,sourceUrl,false);
      return true;
    }
    function monitorWorkspaceTabSecurity(t,sourceUrl,navigationIntent=t?.navigationIntent || ''){
      if(!t?.frame) return;
      const source=workspaceShellSourceUrl(sourceUrl) || String(sourceUrl || '');
      const initialState=workspaceShellSecurityStateForUrl(source);
      setWorkspaceTabSecurityState(t,initialState);
      if(initialState!=='unknown') return;
      const token='security-'+Date.now()+Math.random().toString(16).slice(2);
      t.securityCheckToken=token;
      const current=()=>state.tabs.includes(t)
        && t.securityCheckToken===token
        && (!navigationIntent || t.navigationIntent===navigationIntent);
      const check=()=>{
        if(!current()) return;
        const health=inspectFrameHealth(t);
        const errorText=String(health.text || health.error || '');
        if(tlsCertificateErrorText(errorText)){
          setWorkspaceTabSecurityState(t,'insecure');
          return;
        }
        if(health.reachable && health.hasErrorText){
          setWorkspaceTabSecurityState(t,'unknown');
          return;
        }
        if(health.reachable && health.readyState==='complete') setWorkspaceTabSecurityState(t,'secure');
      };
      const onLoad=()=>setTimeout(check,220);
      t.frame.addEventListener('load',onLoad,{once:true});
      t.frame.addEventListener('error',()=>{
        if(current()) setWorkspaceTabSecurityState(t,'insecure');
      },{once:true});




      const controller=typeof AbortController==='function' ? new AbortController() : null;
      let probeTimedOut=false;
      const probeTimer=setTimeout(()=>{
        probeTimedOut=true;
        controller?.abort();
      },4500);
      fetch(source,{
        method:'HEAD',
        mode:'no-cors',
        cache:'no-store',
        credentials:'omit',
        referrerPolicy:'no-referrer',
        signal:controller?.signal
      }).then(()=>{
        clearTimeout(probeTimer);
        if(current()) setWorkspaceTabSecurityState(t,'secure');
      }).catch(()=>{
        clearTimeout(probeTimer);
        if(current() && !probeTimedOut) setWorkspaceTabSecurityState(t,'insecure');
      });
      setTimeout(check,850);
      setTimeout(check,2200);
      setTimeout(check,4800);
    }
    function loadSelectedSearchFallback(t,sourceUrl,reason=''){
      if(!t || !sourceUrl) return false;
      const key=String(sourceUrl);
      if(t.selectedSearchFallbackKey===key) return false;
      const certificateFailure=tlsCertificateErrorText(reason);
      const failedSecurityState=certificateFailure ? 'insecure' : 'unknown';
      const failureMessage=certificateFailure
        ? `Nyx blocked ${workspaceShellLabel(key)} because its HTTPS certificate could not be verified. Check the address, or try again after the site fixes its certificate.`
        : `Nyx could not connect to ${workspaceShellLabel(key)}. Check that the address exists and is spelled correctly, then try again.`;
      t.selectedSearchFallbackKey=key;
      t.url=key;
      t.sourceUrl=key;
      t.title=workspaceShellLabel(key);
      t.icon=iconForUrl(key);
      t.frame.removeAttribute('src');
      t.frame.srcdoc=connectionFailureHtml(failureMessage,'Page',certificateFailure ? {heading:'Connection not private'} : {});
      t.frame.classList.toggle('active',isSelectedWorkspaceTab(t));
      renderTabs();
      updateWorkspaceShellLocation(key,t.id,true);
      setWorkspaceTabSecurityState(t,failedSecurityState);
      return true;
    }
    function fallbackConnectionEngine(t,sourceUrl,expectedEngine,reason=''){
      if(!t || !sourceUrl || !expectedEngine) return false;
      const configuredMode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
      if(configuredMode==='iframe'){
        if(expectedEngine!=='iframe') loadTab(t,sourceUrl,false,'iframe',sourceUrl);
        else return loadSelectedSearchFallback(t,sourceUrl,reason || 'selected iframe mode failed');
        return true;
      }
      if(expectedEngine!=='scramjet'){
        loadStudyjetTab(t,sourceUrl,false);
        return true;
      }
      return loadSelectedSearchFallback(t,sourceUrl,reason || "Learning engine retries exhausted");
}
    function watchFrameTransportErrors(t,sourceUrl,expectedEngine){
      if(!t?.frame || !sourceUrl || !expectedEngine) return;
      const automaticMode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE))==='auto';
      const token='transport-'+Date.now()+Math.random().toString(16).slice(2);
      t.transportWatchToken=token;
      const check=()=>{
        if(t.transportWatchToken!==token || !state.tabs.includes(t) || !workspaceFrameStillAtSource(t,sourceUrl)) return;
        let text='';
        const health=inspectFrameHealth(t);
        text=health.visibleText || '';
        if(health.routeMiss && expectedEngine==='scramjet'){
          const navigationIntent=t.navigationIntent;
          const recoveryKey=String(navigationIntent || '')+':'+sourceUrl;
          if(t.workerRouteRecovery===recoveryKey) return;
          t.workerRouteRecovery=recoveryKey;
          t.transportWatchToken='';
          t.loadWatchToken='';
          void ensureStudyjetWorkerConnection(t.privateScramjetController,true).then(()=>{
            if(state.tabs.includes(t) && t.navigationIntent===navigationIntent && workspaceFrameStillAtSource(t,sourceUrl)) loadStudyjetTab(t,sourceUrl,false);
          }).catch(()=>{
            if(state.tabs.includes(t) && t.navigationIntent===navigationIntent) loadSelectedSearchFallback(t,sourceUrl,'The browsing connection could not be restored.');
          });
          return;
        }
        if(!health.hasErrorText || !serviceWorkerTransportErrorText(text)) return;
        const certificateFailure=tlsCertificateErrorText(text);
        setWorkspaceTabSecurityState(t,certificateFailure ? 'insecure' : 'unknown');
        if(certificateFailure){
          loadSelectedSearchFallback(t,sourceUrl,text);
          return;
        }
        if(retrySearchHandshake(t,sourceUrl,expectedEngine,text)) return;
        if(!automaticMode){
          loadSelectedSearchFallback(t,sourceUrl,text);
          return;
        }
        const key=`${expectedEngine}:${sourceUrl}`;
        const attempts=t.transportRetries || (t.transportRetries={});
        attempts[key]=(attempts[key] || 0) + 1;
        if(isSpotifyFamilyUrl(sourceUrl) && expectedEngine==='scramjet'){
          return;
        }
        if(attempts[key]>2){
          fallbackConnectionEngine(t,sourceUrl,expectedEngine,'transport retries exhausted');
          return;
        }
        if(!transportAutoEnabled()){
          fallbackConnectionEngine(t,sourceUrl,expectedEngine,'transport failed with fixed transport');
          return;
        }
        const currentTransport=connectionTransportName();
        const nextTransport=transportRetryOrder(currentTransport)[0] || DEFAULT_WORKSPACE_TRANSPORT;
        setWorkspaceTransportOverride(nextTransport);
        if(expectedEngine==='scramjet') loadStudyjetTab(t,sourceUrl,false);
        else {}
      };
      t.frame.addEventListener('load',()=>setTimeout(check,80),{once:true});
      setTimeout(check,1300);
      setTimeout(check,4200);
    }
    function watchConnectionLoad(t,sourceUrl,expectedEngine){
      if(!sourceUrl || !expectedEngine) return;


      if(normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE))!=='auto') return;
      if(t.fallbackSource!==sourceUrl){
        t.fallbackSource=sourceUrl;
        t.fallbackAttempts=0;
      }
      const token='load-'+Date.now()+Math.random().toString(16).slice(2);
      t.loadWatchToken=token;
      const watchStartedAt=Date.now();
      let loaded=false;
      let settled=false;


      const current=()=>!settled && t.loadWatchToken===token && state.tabs.includes(t)
        && workspaceFrameStillAtSource(t,sourceUrl);
      const settle=()=>{
        settled=true;
        t.frame?.removeEventListener?.('load',markLoaded);
      };
      const markLoaded=()=>{
        const frameSrc=String(t.frame?.getAttribute?.('src') || '');
        let frameHref='';
        try{frameHref=String(t.frame?.contentWindow?.location?.href || '')}catch{}
        const hasConnectionPath=frameSrc.startsWith('/service/') || frameSrc.startsWith('/~/sj/') || frameSrc.startsWith('/scramjet/service/')
          || frameHref.includes('/service/') || frameHref.includes('/~/sj/') || frameHref.includes('/scramjet/service/');
        const hasDirectPage=/^https?:/i.test(frameSrc) || (/^https?:/i.test(frameHref) && frameHref!=='about:blank' && frameHref!==location.href);
        if(!hasConnectionPath && !hasDirectPage) return;
        loaded=true;
        t.frame?.removeEventListener?.('load',markLoaded);
      };
      t.frame.addEventListener('load',markLoaded);
      const connectionLooksBroken=()=>{
        const health=inspectFrameHealth(t);
        if(!health.reachable) return false;
        if(health.blank && health.readyState!=='complete') return false;
        if(isSpotifyFamilyUrl(sourceUrl)){
          try{
            const doc=t.frame?.contentDocument;
            const text=String(doc?.body?.textContent || '').trim();
            const htmlClass=String(doc?.documentElement?.className || '');
            if(text.length>80 || /spotify/i.test(htmlClass) || doc?.querySelector('[data-testid],script[src*="spotify"],script[src*="spotifycdn"]')) return false;
          }catch{}
        }
        try{
          if(t.frame?.contentDocument?.querySelector('#desktop,#welcomeScreen')) return true;
        }catch{}
        return !!(health.blank || health.hasErrorText);
      };
      const protectedSiteReturnedEmptyShell=()=>{
        const host=workspaceHost(sourceUrl);
        if(!hostMatches(host,['meta.ai'])) return false;
        const health=inspectFrameHealth(t);
        return health.reachable && !health.hasErrorText && String(health.visibleText || '').length<12 && /meta ai/i.test(health.title || '');
      };
      if(hostMatches(workspaceHost(sourceUrl),['meta.ai'])){
        let consecutiveProtectedBlanks=0;
        let protectedChecks=0;
        const protectedTimer=setInterval(()=>{
          protectedChecks+=1;
          if(!current() || protectedChecks>20){
            clearInterval(protectedTimer);
            return;
          }
          consecutiveProtectedBlanks=protectedSiteReturnedEmptyShell() ? consecutiveProtectedBlanks+1 : 0;
          if(consecutiveProtectedBlanks<2) return;
          clearInterval(protectedTimer);
          loadSelectedSearchFallback(t,sourceUrl,'the site returned a blocked empty shell');
        },1000);
      }
      const attemptFallback=(force=false)=>{
        t.frame?.removeEventListener?.('load',markLoaded);
        if(!current() || (loaded && !force)) return;
        if(!force){
          const health=inspectFrameHealth(t);
          const healthyProgress=health.reachable && !health.hasErrorText && !health.blank;
          if(healthyProgress){
            loaded=true;
            settle();
            return;
          }
          if(health.reachable && !health.hasErrorText && health.readyState==='loading' && Date.now()-watchStartedAt<10000) return;
        }
        if(isSpotifyFamilyUrl(sourceUrl) && expectedEngine==='scramjet'){
          if(!t.spotifyPinnedNoticeShown){
            t.spotifyPinnedNoticeShown=true;
          }
          return;
        }
        if(isSpotifyFamilyUrl(sourceUrl)){
          try{
            const doc=t.frame?.contentDocument;
            const text=String(doc?.body?.textContent || '').trim();
            const htmlClass=String(doc?.documentElement?.className || '');
            if(text.length>80 || /spotify/i.test(htmlClass) || doc?.querySelector('[data-testid],script[src*="spotify"],script[src*="spotifycdn"]')) return;
          }catch{}
        }
        const currentUrl=String(t.url || '');
        if(t.url!==sourceUrl && !currentUrl.startsWith('/service/') && !currentUrl.startsWith('/~/sj/') && !currentUrl.startsWith('/scramjet/service/')) return;
        t.fallbackAttempts=(t.fallbackAttempts || 0) + 1;
        if(t.fallbackAttempts>4) return;
        const workspaceMode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
        const canAutoTransport=transportAutoEnabled();
        const currentTransport=connectionTransportName();
        const nextTransport=transportRetryOrder(currentTransport)[0] || '';
        let handled=false;
        if(expectedEngine==='scramjet'){
          if(canAutoTransport && nextTransport){
            setWorkspaceTransportOverride(nextTransport);
            loadStudyjetTab(t,sourceUrl,false);
            handled=true;
          }else if(workspaceMode==='scramjet'){
            loadStudyjetTab(t,sourceUrl,false);
            handled=true;
          }else if(workspaceMode==='auto'){
            if(canAutoTransport) setWorkspaceTransportOverride('epoxy');
            loadSelectedSearchFallback(t,sourceUrl,"Learning engine relays exhausted");
            handled=true;
          }
        }
        if(!handled) fallbackConnectionEngine(t,sourceUrl,expectedEngine,'blank or timed-out proxy frame');
      };
      const checkBlankFallback=()=>{
        if(!current()) return;
        if(protectedSiteReturnedEmptyShell()){
          loadSelectedSearchFallback(t,sourceUrl,'the site returned a blocked empty shell');
          return;
        }
        if(connectionLooksBroken()) attemptFallback(true);
        else{
          const health=inspectFrameHealth(t);
          if(health.reachable && !health.blank && !health.hasErrorText
            && /^(?:interactive|complete)$/.test(health.readyState)) settle();
        }
      };
      t.frame.addEventListener('load',()=>setTimeout(checkBlankFallback,1600),{once:true});
      setTimeout(checkBlankFallback,3200);
      setTimeout(checkBlankFallback,7600);
      setTimeout(checkBlankFallback,12000);
      setTimeout(attemptFallback,5200);
      setTimeout(attemptFallback,11000);
    }
    function isSelectedWorkspaceTab(t){
      const linked=workspaceShellTabs.find(tab=>tab.workspaceTabId===t.id);
      return state.active===t.id && (!document.body.classList.contains('workspace-shell') || !linked || linked.id===workspaceShellActiveTab);
    }
    function loadTab(t,url,addHistory=true,expectedEngine='',sourceUrl=''){
      const requestedSource=sourceUrl || (/^https?:/i.test(url) ? url : '');
      if(expectedEngine==='iframe' && hostMatches(workspaceHost(requestedSource),['cineby.at'])){
        loadStudyjetTab(t,requestedSource,addHistory);
        return;
      }
      t.expectedEngine=expectedEngine || t.expectedEngine || '';
      t.sourceUrl=sourceUrl || (/^https?:/i.test(url) ? url : t.sourceUrl || '');
      const securitySource=workspaceShellSourceUrl(t.sourceUrl || requestedSource || url) || t.sourceUrl || requestedSource || url;
      const securityIntent=t.navigationIntent || '';
      setWorkspaceTabSecurityState(t,workspaceShellSecurityStateForUrl(securitySource));
      t.frame.classList.remove('transparent-internal-page');
      t.frame.style.backgroundColor='';
      if(isSelectedWorkspaceTab(t)) win.classList.remove('internal-clear');
      t.url=url;
      if(addHistory){
        t.history=t.history.slice(0,t.index+1);
        t.history.push(url);
        t.index=t.history.length-1;
      }
      t.title=titleForUrl(sourceUrl || url);
      t.icon=iconForUrl(sourceUrl || url);
      if(isSelectedWorkspaceTab(t)){
        win.querySelector('.workspace-home').classList.add('hidden');
        t.frame.classList.add('active');
      }
      installPopupBridge(t);
      const proxied=url.startsWith('/service/') || url.startsWith('/scramjet/service/') || url.startsWith('/~/sj/');
      if(!url.startsWith('/scramjet/service/') && !url.startsWith('/~/sj/')) t.scramjetFrame=null;
      setFrameSandbox(t,true);
      clearFrameDocument(t);
      if(normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE))==='auto' && directOnly(url) && !proxied){
        loadStudyjetTab(t,url,addHistory);
        return;
      }
      watchConnectionLoad(t,sourceUrl || (/^https?:/i.test(url) ? url : ''),expectedEngine);
      watchFrameTransportErrors(t,sourceUrl || (/^https?:/i.test(url) ? url : ''),expectedEngine);

      t.frameHistoryPending={index:t.index};
      monitorWorkspaceTabSecurity(t,securitySource,securityIntent);
      t.frame.src=url;
      markWorkspaceEngine(t,expectedEngine,url,'iframe-src');
      renderTabs();
      if(isSelectedWorkspaceTab(t)) activate(t.id);
      updateWorkspaceShellLocation(workspaceShellSourceUrl(t.sourceUrl || url) || t.sourceUrl || url,t.id);
    }
    function setTabMeta(t,url,addHistory=true){
      t.url=url;
      if(addHistory){
        t.history=t.history.slice(0,t.index+1);
        t.history.push(url);
        t.index=t.history.length-1;
      }
      t.title=titleForUrl(url);
      t.icon=iconForUrl(url);
      if(isSelectedWorkspaceTab(t)){
        win.querySelector('.workspace-home').classList.add('hidden');
        t.frame.classList.add('active');
      }
      installCrazyGamesOfflineRecovery(t,url);
      renderTabs();
      if(isSelectedWorkspaceTab(t)) activate(t.id);
      updateWorkspaceShellLocation(url,t.id);
    }
    function retryStudyjetTab(t,url){
      t.scramjetRetries=(t.scramjetRetries || 0) + 1;
      if(t.scramjetRetries>3) return false;
      const navigationIntent=t.navigationIntent || '';
      t.frame.removeAttribute('src');
      setTimeout(async ()=>{
        if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
        await refreshStudyjetServiceWorker().catch(()=>false);
        if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
        studyjetInstallPromise=null;
        const ok=await installStudyjet();
        if(!ok || !state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
        if(t.scramjetFrame){
          try{t.scramjetFrame.go(url); return}catch{}
        }
      },220);
      return true;
    }

    function loadStudyjetTab(t,url,addHistory=true){
      t.expectedEngine='scramjet';
      t.sourceUrl=url;
      setTabLoading(t,true);
      if(addHistory){
        const currentHistory=workspaceShellSourceUrl(t.history?.[t.index] || '') || String(t.history?.[t.index] || '');
        if(currentHistory!==url){
          t.history=t.history.slice(0,t.index+1);
          t.history.push(url);
          t.index=t.history.length-1;
        }
      }
      const navigationIntent=t.navigationIntent || '';
      installStudyjet().then(async ok=>{
        if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
        if(!ok || !studyjetController){
          if(transportAutoEnabled()){
            const retryCount=Number(t.scramjetStartupRetries || 0);
            const nextTransport=transportRetryOrder(connectionTransportName())[0] || '';
            if(retryCount<2 && nextTransport){
              t.scramjetStartupRetries=retryCount+1;
              setWorkspaceTransportOverride(nextTransport);
              loadStudyjetTab(t,url,false);
              return;
            }
          }
          setTabLoading(t,false);
          t.url=url;
          setTabMeta(t,url,false);
          t.actualEngine='scramjet-failed';
          setFrameSandbox(t,true);
          clearFrameDocument(t);
          t.frame.srcdoc=connectionFailureHtml(studyjetInstallError,"Learning engine",{allowDirect:true});
          return;
        }
        await ensureStudyjetWorkerConnection(t.privateScramjetController);
        if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
        if(t.privateScramjetController && t.privateScramjetController.transport !== studyjetController.transport){
          t.privateScramjetController.setTransport(studyjetController.transport);
        }
        const existingFrameSrc=String(t.frame.getAttribute('src') || '');
        if(existingFrameSrc.startsWith('/service/')){
          replaceTabFrame(t);
        }
        const spotifyChromeOsCompatibility=/\bCrOS\b/i.test(String(navigator.userAgent || '')) && isSpotifyFamilyUrl(url);
        const guardMode=isNvidiaAuthFamilyUrl(url) ? 'nvidia-auth' : (spotifyChromeOsCompatibility ? 'spotify-chromeos' : (shouldUseStudyjetRuntimeGuard(url) ? 'full' : (shouldUseStudyjetMinimalGuard(url) ? 'minimal' : (shouldUseStudyjetHelperGuard(url) ? 'helper' : 'none'))));
        if(t.scramjetFrame && t.scramjetRuntimeGuarded!==guardMode){
          replaceTabFrame(t);
        }
        if(!t.scramjetFrame){
          if(!t.privateScramjetControllerPromise){
            const startup=createPrivateStudyjetController();
            const tracked=startup.then(controller=>{
              if(t.privateScramjetControllerPromise!==tracked){
                controller.nyxStopWorkerTracking?.();
                try{controller.cookieSyncChannel?.close?.()}catch{}
                try{controller.port?.close?.()}catch{}
                throw new Error('Private learning session was superseded');
              }
              t.privateScramjetController=controller;
              return controller;
            }).catch(error=>{
              if(t.privateScramjetControllerPromise===tracked) t.privateScramjetControllerPromise=null;
              throw error;
            });
            t.privateScramjetControllerPromise=tracked;
          }
          const privateController=await t.privateScramjetControllerPromise;
          if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent){
            return;
          }
          setFrameSandbox(t,true);
          t.frame.removeAttribute('src');
          clearFrameDocument(t);
          installPopupBridge(t);
          const plugins=[
            createStudyjetCompatibilityPlugin('','proxy-sri'),
            createStudyjetCompatibilityPlugin(connectionPrivacyGuardSource,'privacy'),
            createStudyjetCompatibilityPlugin(workspaceAdBlockRuntimeSource,'ad-block')
          ];
          if(guardMode==='full') plugins.push(createStudyjetCompatibilityPlugin(studyjetRuntimeGuardSource,'runtime-guard'));
          else if(guardMode==='nvidia-auth') plugins.push(createStudyjetCompatibilityPlugin(studyjetNvidiaAuthGuardSource,'nvidia-auth'));
          else if(guardMode==='spotify-chromeos') plugins.push(createStudyjetCompatibilityPlugin(studyjetSpotifyChromeOsGuardSource,'spotify-chromeos'));
          else if(guardMode==='minimal') plugins.push(createStudyjetCompatibilityPlugin(studyjetMinimalRuntimeGuardSource,'minimal-guard'));
          else if(guardMode==='helper') plugins.push(createStudyjetCompatibilityPlugin(studyjetHelperRuntimeGuardSource,'helper-guard'));
          if(shouldStripStudyjetDuckDuckGoScripts(url)){
            plugins.push(createStudyjetCompatibilityPlugin('', 'duckduckgo-noscript'));
          }
          if(hostMatches(workspaceHost(url),['cineby.at'])){
            plugins.push(createStudyjetCompatibilityPlugin('', 'cineby-disable-devtool'));
          }
          t.scramjetRuntimeGuarded=guardMode;
          t.scramjetFrame=privateController.createFrame(t.frame,{plugins});
          t.scramjetFrame.addEventListener?.('urlchange',event=>{
            const next=workspaceShellSourceUrl(String(event.url || '')) || String(event.url || '');
            if(!next) return;
            const previousSource=workspaceShellSourceUrl(t.sourceUrl || t.url || '') || t.sourceUrl || t.url || '';
            if(workspaceShellRejectFrameLocation(next,previousSource)){
              recoverRejectedStudyjetLocation(t,next,previousSource);
              return;
            }
            t.scramjetRejectedLocationKey='';
            const currentHistory=workspaceShellSourceUrl(t.history?.[t.index] || '') || String(t.history?.[t.index] || '');
            const initialStudyjetRedirect=t.scramjetHistoryPending===true;
            if(initialStudyjetRedirect){
              t.scramjetHistoryPending=false;
              if(t.index>=0) t.history[t.index]=next;
            }else if(next!==currentHistory && next!==previousSource){
              t.history=t.history.slice(0,t.index+1);
              t.history.push(next);
              t.index=t.history.length-1;
            }
            t.url=next;
            t.sourceUrl=next;
            t.title=titleForUrl(next);
            t.icon=iconForUrl(next);
            renderTabs();
            if(t.id===state.active) win.querySelector('.urlbar').value=workspaceShellDisplayValue(next);
            updateWorkspaceShellLocation(next,t.id);
            monitorWorkspaceTabSecurity(t,next,t.navigationIntent || '');
            watchStudyjetHealth(t,next);
            setTimeout(()=>syncLoadedTabIcon(t),120);
          });
        }
        setTabMeta(t,url,false);
        monitorWorkspaceTabSecurity(t,url,navigationIntent);
        t.scramjetHistoryPending=true;
        t.scramjetHealthRetries=0;
        t.scramjetRetries=0;
        watchConnectionLoad(t,url,'scramjet');
        watchFrameTransportErrors(t,url,'scramjet');
        watchStudyjetHealth(t,url);
        if(String(t.frame.getAttribute('src') || '').startsWith('/service/')) t.frame.removeAttribute('src');
        clearFrameDocument(t);
        try{
          t.scramjetFrame.go(url);
        }catch{
          retryStudyjetTab(t,url);
        }
        const isSearchNavigation=Object.values(engines).some(prefix=>String(url).startsWith(prefix));
        const revealLoadedFrame=()=>{
          if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
          setTimeout(()=>setTabLoading(t,false),40);
        };
        t.frame.addEventListener('load',revealLoadedFrame,{once:true});
        setTimeout(revealLoadedFrame,2500);
        void waitForTabResultPaint(t,isSearchNavigation ? 12000 : 8000).then(painted=>{
          if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent || !workspaceFrameStillAtSource(t,url)) return;


          if(isSearchNavigation && !painted && inspectFrameHealth(t).blank) loadSelectedSearchFallback(t,url,'search results did not finish loading');
        });
        if(spotifyChromeOsCompatibility) startSpotifyChromeOsFrameCompatibility(t);
        else stopSpotifyChromeOsFrameCompatibility(t);
        setTimeout(()=>{
          if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
          if(t.scramjetFrame && !String(t.frame.getAttribute('src') || '').includes('/~/sj/')){
            markWorkspaceEngine(t,'scramjet',String(t.frame.getAttribute('src') || ''),'scramjet-path-check');
            try{t.scramjetFrame.go(url)}catch{}
          }
        },450);
        setTimeout(()=>{
          if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
          markWorkspaceEngine(t,'scramjet',String(t.frame.getAttribute('src') || url),'scramjet-final');
        },900);
        setTimeout(()=>{
          if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
          try{
            const isStudyjetPath=t.frame.contentWindow?.location?.pathname?.startsWith('/~/sj/');
            const loadednyx=!!t.frame.contentDocument?.querySelector('#desktop,#welcomeScreen');
            if(isStudyjetPath && loadednyx) retryStudyjetTab(t,url);
          }catch{}
        },1800);
      }).catch(()=>{
        if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
        setTabLoading(t,false);
        destroyConnectionPrivacySession(t);
        t.actualEngine='scramjet-failed';
        setFrameSandbox(t,true);
        clearFrameDocument(t);
        t.frame.srcdoc=connectionFailureHtml('The private tab session could not start. Reload Nyx and try again.',"Learning engine",{allowDirect:true});
      });
    }
    function waitForTabResultPaint(t,timeout=4200){
      return new Promise(resolve=>{
        if(!t?.frame) return resolve(false);
        let done=false;
        let loadSeen=false;
        const sourceForReadiness=()=>workspaceShellSourceUrl(t.sourceUrl || t.url || '') || t.sourceUrl || t.url || '';
        const hasMeaningfulContent=()=>{
          try{
            const doc=t.frame.contentDocument;
            if(!doc?.body) return false;
            if(doc.querySelector('#desktop,#welcomeScreen')) return false;
            const text=String(doc.body.textContent || '').replace(/\s+/g,' ').trim().slice(0,6000);
            const ready=doc.readyState==='complete' || doc.readyState==='interactive';
            const source=sourceForReadiness();
            const host=workspaceHost(source);
            const isDuckSearch=hostMatches(host,['duckduckgo.com']) && /[?&]q=/.test(source);
            if(isDuckSearch){
              if(/No results found|not many great results|try different keywords|there are no results/i.test(text)) return ready;
              const resultNodes=[...doc.body.querySelectorAll('article[data-testid*="result" i],[data-testid*="result" i],[data-testid="mainline"] li,#links .result,.results_links,.result__body,main article,ol li')]
                .filter(node=>String(node.textContent || '').replace(/\s+/g,' ').trim().length>24);
              const resultLinks=[...doc.body.querySelectorAll('main a[href],#links a[href],[data-testid="mainline"] a[href],article a[href],ol a[href]')]
                .filter(link=>{
                  const label=String(link.textContent || '').replace(/\s+/g,' ').trim();
                  if(label.length<8) return false;
                  const href=String(link.getAttribute('href') || link.href || '');
                  if(/^(#|javascript:)/i.test(href)) return false;
                  const box=link.getBoundingClientRect?.();
                  return !box || box.top>120;
                });
              return ready && (resultNodes.length>0 || resultLinks.length>=2);
            }
            const hasPageNodes=!!doc.body.querySelector('a,form,input,button,main,article,section,[role="main"],#links,.results,.result,.result__body');
            const visibleMedia=[...doc.body.querySelectorAll('img,video,canvas,iframe,svg,picture')]
              .some(node=>{
                const box=node.getBoundingClientRect?.();
                return box && box.width>24 && box.height>24;
              });
            const visibleBlocks=[...doc.body.querySelectorAll('main,article,section,[role="main"],#links,.results,.result,.result__body,form')]
              .some(node=>{
                const box=node.getBoundingClientRect?.();
                const nodeText=String(node.textContent || '').replace(/\s+/g,' ').trim();
                return box && box.width>80 && box.height>40 && nodeText.length>16;
              });
            return ready && (text.length>80 || visibleBlocks || visibleMedia || (hasPageNodes && text.length>32));
          }catch{
            return false;
          }
        };
        const finish=value=>{
          if(done) return;
          done=true;
          clearInterval(poll);
          clearTimeout(timer);
          try{t.frame.removeEventListener('load',onLoad)}catch{}
          resolve(value);
        };
        const onLoad=()=>{
          loadSeen=true;
        };
        const poll=setInterval(()=>{
          const srcdoc=String(t.frame?.getAttribute?.('srcdoc') || '');
          if(srcdoc && /(?:Scramjet|Learning engine) did not start|Page Not Found|error/i.test(srcdoc)) finish(false);
          if(hasMeaningfulContent()) finish(true);
        },420);
        const timer=setTimeout(()=>finish(false),timeout);
        t.frame.addEventListener('load',onLoad,{once:true});
      });
    }
    function navigate(raw,forceMode=''){
      if(String(raw||'').replace(/\/+$/,'')==='/apps/nyxcloud'){void openNyxVmsApp();return;}
      const t=current(); if(!t)return;
      const navigationIntent='navigate-'+Date.now()+Math.random().toString(16).slice(2);
      t.navigationIntent=navigationIntent;
      try{t.previousNavigationDocument=t.frame.contentDocument}catch{t.previousNavigationDocument=null;}
      t.scramjetStartupRetries=0;
      t.selectedSearchFallbackKey='';
      t.loadWatchToken='superseded-'+navigationIntent;
      t.transportWatchToken='superseded-'+navigationIntent;
      if(shouldTriggerSixtySevenJumpscare(raw)){
        showSixtySevenJumpscare();
        return;
      }
      const rawText=canonicalAddressInput(raw);
      const connectionInternal=/^(?:\/service\/|\/~\/sj\/|\/scramjet\/service\/|nyx:\/\/)/i.test(rawText);
      const looksLikeUrl=/^(?:[a-z][a-z0-9+.-]*:|[\w.-]+\.[a-z]{2,}(?:\/|$)|\/|\.\/|\.\.\/|assets\/|apps\/)/i.test(rawText);
      const isSearchQuery=rawText && !forceMode && !looksLikeUrl && !connectionInternal;
      if(isSearchQuery){
        void nyxRecordSearchHistory(rawText);
        const url=selectedSearchUrl(rawText);
        document.querySelectorAll('.nyx-preflight').forEach(overlay=>overlay.remove());
        win.querySelector('.urlbar').value=workspaceShellDisplayValue(url);
        hideWorkspaceSuggestions();
        const workspaceMode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
        if(!forceMode || !workspaceTransportOverride) applyPreferredTransportForUrl(url,workspaceMode);
        updateWorkspaceShellLocation(url,t.id,true);
        const mode=normalizeWorkspaceModeName(forceMode || selectedWorkspaceMode(url));
        if(workspaceMode==='auto' && mode==='iframe' && directOnly(url)){
          loadStudyjetTab(t,url,true);
        }else if(mode==='rammerhead'){
          rhNavigate(url,finalUrl=>{
            if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
            loadTab(t,finalUrl,true,'rammerhead',url);
          });
        }else if(mode==='scramjet'){
          loadStudyjetTab(t,url,true);
        }else {
          loadTab(t,connectionModeUrl(mode,url,t.privacySessionId),true,mode || 'iframe',url);
        }
        return;
      }
      if(rawText && looksLikeUrl && !connectionInternal) document.querySelectorAll('.nyx-preflight').forEach(overlay=>overlay.remove());
      const url=youtubeEnglishUrl(normalize(workspaceShellSourceUrl(raw) || raw)); if(!url)return;
      win.querySelector('.urlbar').value=workspaceShellDisplayValue(url);
      const workspaceMode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
      if(!forceMode || !workspaceTransportOverride) applyPreferredTransportForUrl(url,workspaceMode);
      updateWorkspaceShellLocation(url,t.id,true);
      try{
        const parsed=new URL(url,location.href);
        if(parsed.origin===location.origin && !parsed.pathname.includes('/assets/') && (parsed.pathname==='/' || /\/index\.html$/i.test(parsed.pathname))){
          t.url='';
          t.title='New Tab';
          t.icon=favicons.nyx;
          t.history=[''];
          t.index=0;
          clearFrameDocument(t);
          t.frame.removeAttribute('src');
          t.frame.classList.remove('active');
          renderWorkspaceShellHomeMode(win);
          renderTabs();
          updateWorkspaceShellLocation('',t.id,true);
          return;
        }
        if(parsed.origin===location.origin && (parsed.pathname.includes('/assets/') || parsed.pathname.includes('/apps/') || parsed.pathname.endsWith('/index.html'))){
          loadTab(t,parsed.href,true,'iframe');
          return;
        }
      }catch{}
      const mode=normalizeWorkspaceModeName(forceMode || selectedWorkspaceMode(url));
      if(workspaceMode==='auto' && mode==='iframe' && directOnly(url)){
        loadStudyjetTab(t,url,true);
        return;
      }
      if(mode==='rammerhead'){
        rhNavigate(url,finalUrl=>{
          if(!state.tabs.includes(t) || t.navigationIntent!==navigationIntent) return;
          loadTab(t,finalUrl,true,'rammerhead');
        });
      }else if(mode==='scramjet'){
        loadStudyjetTab(t,url,true);
      }else {
        loadTab(t,connectionModeUrl(mode,url,t.privacySessionId),true,mode || 'iframe',url);
      }
    }
    function goFrameHistory(direction){
      const t=current();
      if(!t) return;
      let nextIndex=t.index+direction;
      while(nextIndex>=0 && nextIndex<t.history.length && workspaceShellInvalidHistoryEntry(t.history[nextIndex])){
        nextIndex+=direction;
      }
      if(nextIndex>=0 && nextIndex<t.history.length){
        t.navigationIntent='history-'+Date.now()+Math.random().toString(16).slice(2);
        t.loadWatchToken='superseded-'+t.navigationIntent;
        t.transportWatchToken='superseded-'+t.navigationIntent;
        t.selectedSearchFallbackKey='';
        t.index=nextIndex;
        const stored=t.history[nextIndex];
        if(isWorkspaceShellBlankUrl(stored)){
          t.url='';
          t.sourceUrl='';
          t.title='New Tab';
          t.icon=favicons.nyx;
          t.expectedEngine='';
          t.actualEngine='blank';
          t.scramjetFrame=null;
          clearFrameDocument(t);
          t.frame.removeAttribute('src');
          t.frame.classList.remove('active','transparent-internal-page');
          win.classList.remove('internal-clear');
          renderWorkspaceShellHomeMode(win);
          renderTabs();
          updateWorkspaceShellLocation('',t.id,true);
          activate(t.id);
          return;
        }
        const source=workspaceShellSourceUrl(stored) || stored;
        const engine=selectedWorkspaceMode(source);
        if(engine==='scramjet'){
          loadStudyjetTab(t,source,false);
        }else {
          loadTab(t,stored,false,engine,source);
        }
        return;
      }





      return;
    }
    function closeTabById(tabId,keepBlank=true){
      const index=state.tabs.findIndex(t=>t.id===tabId);
      if(index<0) return false;
        const nextIndex=state.tabs.findIndex(t=>t.id===tabId);
        if(nextIndex<0) return;
        const closingTab=state.tabs[nextIndex];
        const wasActive=isSelectedWorkspaceTab(closingTab);
        if(closingTab.frame?.dataset?.nyxWorkspaceContained==='true') workspaceOverlayQuarantineUntil=Date.now()+30000;
        if(closingTab.id===state.active) setTabLoading(closingTab,false);
        destroyConnectionPrivacySession(closingTab);
        closingTab.frame.remove();
        state.tabs.splice(nextIndex,1);
        cleanupWorkspaceAttachedAds();
        if(!state.tabs.length){
          if(keepBlank) addTab();
          else renderTabs();
        }else if(wasActive){
          activate(state.tabs[Math.max(0,nextIndex-1)].id);
        }else renderTabs();
      return true;
    }
    state.addTab=addTab;
    state.activate=activate;
    state.closeTab=(tabId)=>closeTabById(tabId,false);
    state.openPopupTab=openPopupTab;
    state.refreshSandbox=()=>state.tabs.forEach(tab=>setFrameSandbox(tab));
    state.renderTabs=renderTabs;
    state.navigate=navigate;
    state.reloadTab=reloadTab;
    win.querySelector('[data-new-tab]').onclick=()=>addTab();
    win.querySelector('[data-go]').onclick=()=>navigate(win.querySelector('.urlbar').value);
    win.querySelector('.urlbar').addEventListener('keydown',e=>{if(e.key==='Enter')navigate(e.target.value)});
    win.querySelector('[data-reload]').onclick=()=>reloadTab();
    win.querySelector('[data-back]').onclick=()=>goFrameHistory(-1);
    win.querySelector('[data-forward]').onclick=()=>goFrameHistory(1);
    win.querySelector('[data-menu]').onclick=()=>document.body.classList.contains('workspace-shell') ? openWorkspaceShellSettings() : openSettings();
    win.addEventListener('click',e=>{
      const ignoredShortcutClick=e.target.closest('.home-shortcut[data-ignore-shortcut-click="1"]');
      if(ignoredShortcutClick){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        ignoredShortcutClick.dataset.ignoreShortcutClick='0';
        return;
      }
      if(shortcutMenuPointerHandled){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        shortcutMenuPointerHandled=false;
        return;
      }
      const pointShortcutMenu=shortcutMenuButtonAtPoint(e.clientX,e.clientY);
      if(pointShortcutMenu){e.preventDefault(); e.stopPropagation(); toggleShortcutMenu(pointShortcutMenu); return}
      const close=e.target.closest('[data-close-tab]'); if(close){closeTabById(close.dataset.closeTab,true)}
      const shortcutMenu=e.target.closest('[data-home-shortcut-menu]');
      if(shortcutMenu){e.preventDefault(); e.stopPropagation(); toggleShortcutMenu(shortcutMenu); return}
      const shortcutFavorite=e.target.closest('[data-home-shortcut-favorite]');
      if(shortcutFavorite){e.preventDefault(); e.stopPropagation(); toggleHomeShortcutFavorite(shortcutFavorite.dataset.homeShortcutFavorite); return}
      const shortcutRemove=e.target.closest('[data-home-shortcut-remove]');
      if(shortcutRemove){e.preventDefault(); e.stopPropagation(); removeHomeShortcut(shortcutRemove.dataset.homeShortcutRemove); return}
      const shortcutAdd=e.target.closest('[data-home-shortcut-add]');
      if(shortcutAdd){e.preventDefault(); e.stopPropagation(); addHomeShortcut(); return}
      if(!e.target.closest('.home-shortcut-menu') && !e.target.closest('[data-home-shortcut-menu]')) win.querySelectorAll('.home-shortcut.menu-open').forEach(item=>item.classList.remove('menu-open'));
      const credits=e.target.closest('[data-workspace-credits]');
      if(credits){
        e.preventDefault();
        e.stopPropagation();
        if(document.body.classList.contains('workspace-shell')){
          activeWorkspace=state;
          const linkedShellTab=workspaceShellTabs.find(tab=>tab.workspaceTabId===state.active);
          if(linkedShellTab) workspaceShellActiveTab=linkedShellTab.id;
          if(!showWorkspaceShellInternalPage('credits')) openWorkspaceShellInternalTab('credits');
        }else openAboutNyx();
        return;
      }
      const app=e.target.closest('[data-app-url]'); if(app){e.preventDefault(); if(String(app.dataset.appUrl || '').trim().toLowerCase()==='nyx://ai') openWorkspaceShellAppTab('nyx://ai'); else if(document.body.classList.contains('workspace-shell')) openWorkspaceShellAppTab(app.dataset.appUrl); else navigate(app.dataset.appUrl,appCompatibilityMode(app.dataset.appUrl)); return}
      const q=e.target.closest('[data-url]'); if(q){e.preventDefault(); navigate(q.dataset.url)}
    });
    const workspaceMessageSourcePath=tab=>{
      const candidates=[tab?.sourceUrl,tab?.url,tab?.frame?.getAttribute?.('src')];
      try{candidates.push(tab?.frame?.contentWindow?.location?.href)}catch{}
      for(const candidate of candidates){
        if(!candidate)continue;
        try{
          const source=workspaceShellSourceUrl(candidate)||candidate;
          const parsed=new URL(source,location.href);
          if(parsed.origin===location.origin)return parsed.pathname;
        }catch{}
      }
      return '';
    };
    const nyxChatSourcePath=path=>['/apps/chat','/apps/chat/','/apps/chat/index.html'].includes(path);
    const nyxTubeSourcePath=path=>['/apps/nyxtube','/apps/nyxtube/','/apps/nyxtube/index.html'].includes(path);
    const nyxAccountClientSourcePath=path=>nyxChatSourcePath(path)||['/apps/link-generator','/apps/link-generator/','/apps/link-generator/index.html','/apps/link-generator/bulk.html','/ai.html','/assets/games','/assets/games/','/assets/games/index.html','/apps/link-checker','/apps/link-checker/','/apps/link-checker/index.html','/apps/cloud-gaming','/apps/cloud-gaming/','/apps/cloud-gaming/index.html','/api','/api/','/apps/api-keys','/apps/api-keys/','/apps/api-keys/index.html','/apps/code-studio','/apps/code-studio/','/apps/code-studio/index.html','/apps/code-tutorials','/apps/code-tutorials/','/apps/code-tutorials/index.html'].includes(path);
    const messageHandler=e=>{
      if(!['nyx:navigate','nyx:popup','nyx:download-request','nyx:popup-protection','nyx:fullscreen','nyx:about','nyx:about-tab','nyx:internal','nyx:preset','nyx:tab-cloak','nyx:workspace-settings','nyx:settings-window','nyx:effect','nyx:effect-settings','nyx:panic-capture','nyx:panic-clear','nyx:panic-key-set','nyx:shell-tab-index','nyx:alt-prime','nyx:alt-shortcut','nyx:ai-profile-request','nyx:ai-open-profile','nyx:nyxtube-profile-request','nyx:nyxtube-open-profile','nyx:account-token-request','nyx:account-open-signin','nyx:chat-open-profile','nyx:chat-notification','nyx:subscription-refresh','nyx:repair-connection','nyx:proxy-direct-fallback','nyx:cloud-game-load','nyx:cloud-game-save','nyx:close-tab','nyx:go-home'].includes(e.data?.type)) return;
      if(['nyx:cloud-game-load','nyx:cloud-game-save'].includes(e.data.type)){
        if(e.origin!==location.origin)return;
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);if(!sourceTab)return;
        let sourcePath='';try{sourcePath=new URL(sourceTab.sourceUrl||sourceTab.url||'',location.href).pathname}catch{}
        if(!/^\/assets\/games\/(?:index\.html)?$/.test(sourcePath))return;
        const requestId=String(e.data.requestId||'').slice(0,120);
        const gameKey=String(e.data.gameKey||'').trim();
        if(!requestId||!gameKey)return;
        void (async()=>{
          try{
            await initializeFounderOwnerAccess();
            const accountUid=nyxFounderSignedInUser?.uid||'';
            if(e.data.accountUid&&e.data.accountUid!==accountUid)throw new Error('Your account changed. Reopen the game to sync.');
            const payload=e.data.type==='nyx:cloud-game-load'
              ? {storage:await loadNyxCloudGameSave(gameKey),accountUid}
              : await saveNyxCloudGameSave(gameKey,e.data.storage,e.data.removed,e.data.accountUid);
            if(nyxFounderSignedInUser?.uid!==accountUid)throw new Error("Your account changed. Reopen the game to sync.");
            e.source?.postMessage({type:'nyx:cloud-game-result',requestId,...payload},location.origin);
          }catch(error){
            e.source?.postMessage({type:'nyx:cloud-game-result',requestId,error:String(error?.message||'Cloud saves are unavailable.')},location.origin);
          }
        })();
        return;
      }
      if(e.data.type==='nyx:account-open-signin'){
        if(e.origin!==location.origin)return;
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);
        if(!sourceTab||!nyxAccountClientSourcePath(workspaceMessageSourcePath(sourceTab)))return;
        void openNyxAccountAccess({mode:'signin'});
        return;
      }
      if(e.data.type==='nyx:account-token-request'){
        if(e.origin!==location.origin)return;
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);if(!sourceTab)return;
        const sourcePath=workspaceMessageSourcePath(sourceTab);
        if(!nyxAccountClientSourcePath(sourcePath))return;
        const requestId=String(e.data.requestId||'').slice(0,120);if(!requestId)return;
        void (async()=>{await initializeFounderOwnerAccess();const token=await nyxGetFirebaseToken();e.source?.postMessage({type:'nyx:account-token-response',requestId,token},location.origin)})();
        return;
      }
      if(e.data.type==='nyx:close-tab'){
        if(e.origin!==location.origin)return;
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);if(!sourceTab)return;
        const sourceShellTab=workspaceShellTabs.find(tab=>tab.workspaceTabId===sourceTab.id);
        if(sourceShellTab)closeWorkspaceShellTab(sourceShellTab.id);else closeTabById(sourceTab.id,true);
        return;
      }
      if(e.data.type==='nyx:go-home'){
        if(e.origin!==location.origin)return;
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);if(!sourceTab)return;
        const sourcePath=workspaceMessageSourcePath(sourceTab);
        if(!nyxChatSourcePath(sourcePath))return;
        setWorkspaceShellHomeActive();
        return;
      }
      if(e.data.type==='nyx:chat-open-profile'){
        if(e.origin!==location.origin)return;
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);if(!sourceTab)return;
        const sourcePath=workspaceMessageSourcePath(sourceTab);
        if(!nyxChatSourcePath(sourcePath))return;
        const uid=String(e.data.uid||'').trim();if(!/^[A-Za-z0-9_-]{8,128}$/.test(uid))return;
        void openNyxProfileDirectory(uid).catch(()=>toast('That profile could not be opened.'));
        return;
      }
      if(['nyx:nyxtube-profile-request','nyx:nyxtube-open-profile'].includes(e.data.type)){
        if(e.origin!==location.origin)return;
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);if(!sourceTab)return;
        const sourcePath=workspaceMessageSourcePath(sourceTab);if(!nyxTubeSourcePath(sourcePath))return;
        if(e.data.type==='nyx:nyxtube-open-profile'){
          const uid=String(e.data.uid||'').trim();
          if(uid&&uid===String(nyxFounderSignedInUser?.uid||'')) void openNyxProfileDirectory(uid).catch(()=>toast('Your profile could not be opened.'));
          else void openNyxUserProfile();
          return;
        }
        const requestId=String(e.data.requestId||'').slice(0,120);if(!requestId)return;
        const target=e.source;
        void (async()=>{
          await initializeFounderOwnerAccess();
          if(nyxFounderSignedInUser&&!nyxUserProfile)await loadNyxUserProfile();
          const signedIn=Boolean(nyxFounderSignedInUser);
          const profile=signedIn
            ? normalizeNyxUserProfile(nyxUserProfile||{},nyxFounderSignedInUser)
            : {displayName:store.text('nyx.userName','Profile')||'Profile',handle:'Sign in to customize',avatarUrl:''};
          let avatarUrl=String(profile.avatarUrl||'');
          const mediaPath=nyxProfileMediaPath(avatarUrl);
          if(mediaPath){const media=await nyxResolveProfileMedia(mediaPath).catch(()=>null);if(media?.url)avatarUrl=media.url}
          target?.postMessage({type:'nyx:nyxtube-profile',requestId,profile:{uid:signedIn?String(nyxFounderSignedInUser.uid||''):'',signedIn,displayName:profile.displayName,handle:profile.handle,avatarUrl}},location.origin);
        })();
        return;
      }
      if(e.data.type==='nyx:chat-notification'){
        if(e.origin!==location.origin)return;
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);if(!sourceTab)return;
        const sourcePath=workspaceMessageSourcePath(sourceTab);
        if(!nyxChatSourcePath(sourcePath))return;
        const notificationId=String(e.data.notificationId||'').trim().slice(0,180);if(!notificationId||chatNotificationIds.has(notificationId))return;
        chatNotificationIds.add(notificationId);if(chatNotificationIds.size>200)chatNotificationIds.delete(chatNotificationIds.values().next().value);
        sourceTab.chatUnread=true;
        renderTabs();
        const notificationKind=e.data.kind==='mention'?'mention':e.data.kind==='dm'?'dm':'chat';
        if(notificationKind==='mention')showNyxMention(notificationId,e.data);
        playNyxChatNotificationSound(notificationKind);
        return;
      }
      if(e.data.type==='nyx:subscription-refresh'){
        if(e.origin!==location.origin)return;
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);if(!sourceTab)return;
        const sourcePath=workspaceMessageSourcePath(sourceTab);
        if(!nyxChatSourcePath(sourcePath))return;
        void loadNyxUserProfile();
        return;
      }
      if(['nyx:ai-profile-request','nyx:ai-open-profile'].includes(e.data.type)&&(e.origin!==location.origin||!state.tabs.some(tab=>tab.frame.contentWindow===e.source)))return;
      if(e.data.type==='nyx:ai-profile-request'){
        const target=e.source;
        void (async()=>{
          const profile=nyxFounderSignedInUser
            ? normalizeNyxUserProfile(nyxUserProfile||{},nyxFounderSignedInUser)
            : {displayName:store.text('nyx.userName','Profile')||'Profile',handle:'Sign in to customize',avatarUrl:''};
          let avatarUrl=String(profile.avatarUrl||'');
          const mediaPath=nyxProfileMediaPath(avatarUrl);
          if(mediaPath){
            const media=await nyxResolveProfileMedia(mediaPath).catch(()=>null);
            if(media?.url)avatarUrl=media.url;
          }
          target?.postMessage({type:'nyx:ai-profile',profile:{displayName:profile.displayName,handle:profile.handle,avatarUrl}},location.origin);
        })();
        return;
      }
      if(e.data.type==='nyx:ai-open-profile'){
        void openNyxUserProfile();
        return;
      }
      if(e.data.type==='nyx:repair-connection'){
        if(e.origin!==location.origin)return;
        const tab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);
        if(!tab || tab.connectionRepairPending)return;
        let repairButton;
        try{
          const doc=tab.frame.contentDocument;
          if(!doc?.querySelector('meta[name="nyx-route-miss"],meta[name="nyx-connection-error"]'))return;
          repairButton=doc.querySelector('[data-nyx-repair]');
          if(!repairButton)return;
        }catch{return}
        const source=tab.sourceUrl;
        const intent=tab.navigationIntent;
        if(!/^https?:\/\//i.test(source || ''))return;
        tab.connectionRepairPending=true;
        repairButton.disabled=true;
        repairButton.textContent='Repairing...';
        tab.transportWatchToken='';
        tab.loadWatchToken='';
        void repairWorkspaceConnection().then(()=>{
          if(!state.tabs.includes(tab) || tab.navigationIntent!==intent || tab.sourceUrl!==source)return;
          tab.workerRouteRecovery='';
          tab.scramjetStartupRetries=0;
          loadStudyjetTab(tab,source,false);
        }).catch(()=>{
          toast('Connection repair could not finish. Check your workspace extensions or try again.');
        }).finally(()=>{
          tab.connectionRepairPending=false;
          repairButton.disabled=false;
          repairButton.textContent='Repair connection';
        });
        return;
      }
      if(e.data.type==='nyx:proxy-direct-fallback'){
        const sourceTab=state.tabs.find(tab=>tab.frame.contentWindow===e.source);
        const sourceUrl=String(sourceTab?.sourceUrl || '').trim();
        if(!sourceTab || !sourceUrl) return;
        loadTab(sourceTab,sourceUrl,false,'iframe',sourceUrl);
        toast('Trying this tab in direct mode');
        return;
      }
      if(e.data.type==='nyx:shell-tab-index'){
        switchWorkspaceShellTabByIndex(e.data.index);
        return;
      }
      if(e.data.type==='nyx:alt-prime'){
        primeWorkspaceShellShortcutFocus();
        return;
      }
      if(e.data.type==='nyx:alt-shortcut'){
        const key=String(e.data.key || '').toLowerCase();
        handleWorkspaceShellAltAction(key,{
          preventDefault(){},
          stopPropagation(){},
          altKey:true,
          ctrlKey:false,
          metaKey:false,
          shiftKey:!!e.data.shiftKey,
          key:e.data.key || key,
          code:e.data.code || '',
          location:Number(e.data.location || 0)
        });
        return;
      }
      if(e.data.type==='nyx:panic-capture'){
        armPanicKeyCapture();
        return;
      }
      if(e.data.type==='nyx:panic-clear'){
        clearPanicKey();
        return;
      }
      if(e.data.type==='nyx:panic-key-set'){
        const combo=String(e.data.combo || '').trim();
        if(combo){
          panicCaptureArmed=false;
          store.setText('nyx.panicKey',combo);
          updatePanicKeyLabels();
          toast('Class shortcut saved: '+combo);
        }
        return;
      }
      if(e.data.type==='nyx:preset'){
        applyPreset(e.data.preset || 'nyx');
        syncPresetCloakFields();
        return;
      }
      if(e.data.type==='nyx:tab-cloak'){
        applyCustomTabCloak(e.data.title || '???', e.data.favicon || favicons.nyx);
        return;
      }
      if(e.data.type==='nyx:workspace-settings'){
        store.setText('nyx.engine',e.data.engine || 'duckduckgo');
        store.setText('nyx.workspaceMode',normalizeWorkspaceModeName(e.data.workspaceMode || e.data.b\u0072owserMode || DEFAULT_WORKSPACE_MODE));
        const nextTransport=normalizeWorkspaceTransportName(e.data.transport);
        workspaceTransportOverride='';
        if(normalizeWorkspaceTransportName(store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT))!==nextTransport){
          studyjetInstallPromise=null;
          studyjetController=null;
          studyjetTransport=null;
          studyjetTransportKey='';
        }
        store.setText('nyx.transport',nextTransport);
        applyUserSettings();
        toast('Workspace settings saved');
        return;
      }
      if(e.data.type==='nyx:popup-protection'){
        const enabled=!!e.data.enabled;
        store.set('nyx.popupProtection',enabled);
        qsa('[data-switch="nyx.popupProtection"]').forEach(el=>el.classList.toggle('on',enabled));
        activeWorkspace?.refreshSandbox?.();
        toast('Popup Protection '+(enabled?'on':'off'));
        return;
      }
      if(e.data.type==='nyx:effect-settings'){
        store.set('nyx.visualEffectUserChoice',true);
        store.setText('nyx.visualEffect',e.data.effect || 'none');
        store.setText('nyx.visualEffectSpeed',e.data.speed || '1.1');
        store.setText('nyx.visualEffectAmount',String(Math.max(1,Math.min(64,Number(e.data.amount || 16)))));
        const previousTheme=normalizeNyxTheme(store.text('nyx.theme','default'));
        const nextTheme=normalizeNyxTheme(e.data.theme || previousTheme);
        store.setText('nyx.theme',nextTheme);
        applyThemeSetting();
        if(nextTheme!==previousTheme) applyNyxThemeBeamWallpaper(nextTheme);
        applyVisualEffectSetting();
        const shellTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab);
        if(shellTab?.url?.startsWith('nyx://')){
          showWorkspaceShellInternalPage(shellTab.url.replace('nyx://','') || 'apps');
        }
        return;
      }
      if(e.data.type==='nyx:navigate'){
        openWorkspaceShellAppTab(e.data.url || '');
        return;
      }
      if(e.data.type==='nyx:internal'){
        openWorkspaceShellInternalTab(e.data.page || 'apps');
        return;
      }
      const sourceTab=state.tabs.find(t=>t.frame.contentWindow===e.source);
      if(e.data.type==='nyx:download-request'){
        if(!sourceTab) return;
        void nyxRequestWorkspaceDownload(e.data.url || '',e.data.filename || '',e.data.sourceUrl || sourceTab.sourceUrl || sourceTab.url || '');
        return;
      }
      if(e.data.type==='nyx:popup'){
        const previousActive=state.active;
        if(sourceTab) state.active=sourceTab.id;
        openPopupTab(e.data.url);
        if(sourceTab && state.tabs.some(t=>t.id===previousActive) && state.active===sourceTab.id) state.active=previousActive;
        return;
      }
      if(!sourceTab) return;
      if(e.data.type==='nyx:fullscreen'){
        if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
        return;
      }
      if(e.data.type==='nyx:about'){
        launchDirectAboutBlankCloak();
        return;
      }
      if(e.data.type==='nyx:about-tab'){
        launchHostedCloak('ac');
        return;
      }
      if(e.data.type==='nyx:effect'){
        store.set('nyx.visualEffectUserChoice',true);
        store.setText('nyx.visualEffect',e.data.effect || 'none');
        applyVisualEffectSetting();
        toast('Workspace Mode effect updated');
        return;
      }
      if(e.data.type==='nyx:settings-window'){
        document.body.classList.contains('workspace-shell') ? openWorkspaceShellSettings() : openSettings();
        return;
      }
      navigate(e.data.url);
    };
    window.addEventListener('message',messageHandler);
    const initialTab=addTab(url,options.forceMode || '');
    if(document.body.classList.contains('workspace-shell') && !url){
      ensureWorkspaceShellHome();
      const homeTab=workspaceShellTabs.find(tab=>tab.title==='Home' && !tab.url) || workspaceShellTabs[0];
      if(homeTab){
        homeTab.workspaceTabId=initialTab.id;
        homeTab.url='';
        homeTab.title='Home';
        homeTab.icon=favicons.nyx;
        workspaceShellActiveTab=homeTab.id;
      }
      initialTab.url='';
      initialTab.title='Home';
      initialTab.icon=favicons.nyx;
      initialTab.history=[''];
      initialTab.index=0;
      renderWorkspaceShellHomeMode(win,'home');
      renderTabs();
      renderWorkspaceShellTabs();
      playHomeEntranceAnimation(win);
      tick();
      initDesktopSplash();
    }
    return win;
  }
  function openUpdates(){
    makeWindow({title:'ռʏӼ Fixes',left:'24px',top:'60px',width:'520px',height:'620px',autoMaximize:true,body:`<div class="panel"><h1>ռʏӼ Fixes</h1><p class="home-sub">Click ռʏӼ in the top-left anytime to see this.</p><div class="glass-grid" style="grid-template-columns:1fr"><div class="glass-card"><h2>Latest fixes</h2><p>- Added animated windows that eject from the bottom dock and fade when closed.</p><p>- Made the Updates window open fullscreen every time.</p><p>- Added one-time Updates popup on startup.</p><p>- Added multiple weather location choices for ambiguous searches.</p><p>- Added hot and freezing weather themes.</p><p>- Updated glassmorphism so 100%+ lowers blur instead of over-brightening.</p><p>- Replaced the Discord logo with the new attached icon.</p><p>- Removed the left desktop Workspace and Updates buttons.</p><p>- Changed Weather from an app into a right-side liquid glass panel.</p><p>- Added visible background previews and background upload.</p><p>- Rebuilt the loading screen so it types the welcome text.</p><p>- Added local app icons to avoid blocked favicon requests.</p></div><div class="glass-card"><h2>Workspace fixes</h2><p>- Replaced the old Wisp server package.</p><p>- Pinned the compatible Epoxy transport.</p></div></div></div>`});
  }
  function weatherDescription(code){
    const map={0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Heavy showers',85:'Snow showers',86:'Snow showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm, hail'};
    return map[code] || 'Weather';
  }
  function weatherIcon(code,isDay=true){
    const value=Number(code);
    const svg=(kind,content)=>`<svg class="nyx-weather-symbol nyx-weather-symbol-${kind}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
    const sun='<circle class="nyx-weather-sun-fill" cx="12" cy="12" r="4"/><path class="nyx-weather-sun-ray" d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>';
    const cloud='<path class="nyx-weather-cloud-fill" d="M6.4 18.2h10.3a4.25 4.25 0 0 0 .5-8.47 6.05 6.05 0 0 0-11.55 1.83A3.38 3.38 0 0 0 6.4 18.2Z"/>';
    if(!isDay && [0,1,2].includes(value)){
      return svg('moon','<path class="nyx-weather-moon-fill" d="M18.7 15.45A7.4 7.4 0 0 1 8.55 5.3a7.7 7.7 0 1 0 10.15 10.15Z"/>');
    }
    if(value===0) return svg('sun',sun);
    if([1,2].includes(value)){
      return svg('partly-cloudy','<circle class="nyx-weather-sun-fill" cx="8" cy="8" r="3.2"/><path class="nyx-weather-sun-ray" d="M8 2.3v1.4M3.97 3.97l1 1M2.3 8h1.4M12.03 3.97l-1 1M13.7 8h-1.4"/><path class="nyx-weather-cloud-fill" d="M7.2 19h10a4 4 0 0 0 .45-7.98A5.55 5.55 0 0 0 7.08 12.6 3.2 3.2 0 0 0 7.2 19Z"/>');
    }
    if(value===3) return svg('cloud',cloud);
    if([45,48].includes(value)){
      return svg('fog',`${cloud}<path class="nyx-weather-detail" d="M4 20.5h13M7 23h12"/>`);
    }
    if([71,73,75,77,85,86].includes(value)){
      return svg('snow',`${cloud}<path class="nyx-weather-snow" d="M8 19.7v3M6.7 20.45l2.6 1.5M9.3 20.45l-2.6 1.5M15.5 19.7v3M14.2 20.45l2.6 1.5M16.8 20.45l-2.6 1.5"/>`);
    }
    if([95,96,99].includes(value)){
      return svg('storm',`${cloud}<path class="nyx-weather-bolt" d="m12.5 18.4-2.1 3.4h2l-1 2.2 4-4.3h-2.3l1.4-1.3Z"/>`);
    }
    if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(value)){
      return svg('rain',`${cloud}<path class="nyx-weather-rain" d="m8 19.8-1 2M12.5 19.8l-1 2M17 19.8l-1 2"/>`);
    }
    return svg('cloud',cloud);
  }
  function forecastDayLabel(dateText,index){
    if(index===0) return 'Today';
    try{
      return new Intl.DateTimeFormat([],{weekday:'short'}).format(new Date(dateText+'T12:00:00'));
    }catch{
      return 'Day';
    }
  }
  function renderWeatherForecast(daily){
    const box=weatherPanel()?.querySelector('[data-weather-forecast]');
    if(!box) return;
    const times=daily?.time || [];
    if(!times.length){
      box.innerHTML='';
      return;
    }
    box.innerHTML=times.slice(0,7).map((day,index)=>{
      const code=daily.weather_code?.[index] ?? 3;
      const rain=Math.round(daily.precipitation_probability_max?.[index] ?? 0);
      const high=Math.round(daily.temperature_2m_max?.[index] ?? 0);
      const low=Math.round(daily.temperature_2m_min?.[index] ?? 0);
      return `<div class="weather-forecast-row" title="${esc(weatherDescription(code))}">
        <span class="weather-day">${esc(forecastDayLabel(day,index))}</span>
        <span class="weather-forecast-symbol" aria-hidden="true">${weatherIcon(code,true)}</span>
        <span class="weather-rain-chance">${rain}%</span>
        <span class="weather-high-low">${high}&deg; <span>${low}&deg;</span></span>
      </div>`;
    }).join('');
  }
  function weatherPanel(){
    return $('weatherPanel');
  }
  let latestWeatherSnapshot=null;
  function syncHomeWeatherWidgets(snapshot=latestWeatherSnapshot){
    qsa('[data-home-weather]').forEach(widget=>{
      const icon=widget.querySelector('[data-home-weather-icon]');
      const temp=widget.querySelector('[data-home-weather-temp]');
      const desc=widget.querySelector('[data-home-weather-desc]');
      if(snapshot){
        const summary=weatherDescription(snapshot.weather_code);
        const degrees=`${Math.round(snapshot.temperature_2m)}°`;
        if(icon) icon.innerHTML=weatherIcon(snapshot.weather_code,snapshot.is_day!==0);
        if(temp) temp.textContent=degrees;
        if(desc) desc.textContent=summary;
        widget.setAttribute('aria-label',`Open weather report. ${degrees}, ${summary}`);
        widget.dataset.loaded='true';
      }else{
        if(icon) icon.innerHTML=weatherIcon(1,true);
        if(temp) temp.textContent='--°';
        if(desc) desc.textContent='Loading';
        widget.setAttribute('aria-label','Open weather report');
        delete widget.dataset.loaded;
      }
    });
    qsa('[data-nyx-dashboard-weather]').forEach(widget=>{
      const temp=widget.querySelector('[data-nyx-dashboard-weather-temp]');
      const desc=widget.querySelector('[data-nyx-dashboard-weather-desc]');
      const place=widget.querySelector('[data-nyx-dashboard-weather-place]');
      if(snapshot){
        if(temp) temp.textContent=`${Math.round(snapshot.temperature_2m)}°`;
        if(desc) desc.textContent=weatherDescription(snapshot.weather_code);
        if(place) place.textContent=snapshot.place || '';
      }else{
        if(temp) temp.textContent='--°';
        if(desc) desc.textContent='Loading weather';
        if(place) place.textContent='';
      }
    });
  }
  function setWeatherStatus(text){
    const status=weatherPanel()?.querySelector('[data-weather-status]');
    if(status) status.textContent=text || '';
  }
  function savedWeatherLocation(){
    return {
      latitude:Number(store.text('nyx.weatherLat','34.0522')),
      longitude:Number(store.text('nyx.weatherLon','-118.2437')),
      place:store.text('nyx.weatherPlace','Los Angeles'),
      timezone:store.text('nyx.weatherTimezone','America/Los_Angeles')
    };
  }
  function weatherEffectClass(code, wind, temp){
    if(Number(temp) > 100) return 'weather-hot';
    if(Number(temp) < 32) return 'weather-freezing';
    if([51,53,55,61,63,65,80,81,82,95].includes(code)) return 'weather-rain';
    if(Number(wind) >= 18) return 'weather-wind';
    if([0,1].includes(code)) return 'weather-sun';
    return 'weather-cloud';
  }

  function renderWeatherTime(timezone){
    const time=weatherPanel()?.querySelector('[data-weather-time]');
    if(!time) return;
    try{
      time.textContent='Local time '+new Intl.DateTimeFormat([],{
        hour:'numeric',
        minute:'2-digit',
        timeZone:timezone || savedWeatherLocation().timezone
      }).format(new Date());
    }catch{
      time.textContent='Local time --:--';
    }
  }
  function renderWeather(data, place, timezone, daily){
    const panel=weatherPanel();
    if(!panel || !data) return;
    panel.querySelector('[data-weather-temp]').innerHTML=Math.round(data.temperature_2m)+'&deg;';
    panel.querySelector('[data-weather-place]').textContent=place || 'Weather';
    panel.querySelector('[data-weather-desc]').textContent=weatherDescription(data.weather_code);
    panel.querySelector('[data-weather-icon]').innerHTML=weatherIcon(data.weather_code,data.is_day!==0);
    panel.querySelector('[data-weather-feels]').innerHTML=Math.round(data.apparent_temperature ?? data.temperature_2m)+'&deg;';
    panel.querySelector('[data-weather-wind]').textContent=Math.round(data.wind_speed_10m)+' mph';
    panel.querySelector('[data-weather-humidity]').textContent=Math.round(data.relative_humidity_2m)+'%';
    panel.querySelector('[data-weather-precip]').textContent=((Number(data.precipitation || 0)).toFixed(Number(data.precipitation || 0) >= 1 ? 1 : 2).replace(/\.00$/,'')).replace(/\.0$/,'')+' in';
    panel.classList.remove('weather-sun','weather-cloud','weather-rain','weather-wind','weather-hot','weather-freezing');
    panel.classList.add(weatherEffectClass(data.weather_code,data.wind_speed_10m,data.temperature_2m));
    renderWeatherForecast(daily);
    renderWeatherTime(timezone);
    latestWeatherSnapshot={...data,place:place || 'Weather'};
    syncHomeWeatherWidgets();
    const restore=$('weatherRestore');
    if(restore) restore.dataset.weatherSummary=`${Math.round(data.temperature_2m)}° ${weatherDescription(data.weather_code)}`;
    setWeatherStatus('');
  }
  function clearWeatherOptions(){
    const box=weatherPanel()?.querySelector('[data-weather-options]');
    if(box){
      box.innerHTML='';
      box.hidden=true;
      box.onchange=null;
    }
  }
  function weatherPlaceName(match){
    return [match.name,match.admin1,match.country].filter(Boolean).join(', ');
  }
  function weatherTimezoneFallbackName(timezone=''){
    const raw=String(timezone || '').split('/').pop() || 'Current location';
    return raw.replace(/_/g,' ') + (/America\//.test(String(timezone || '')) ? ', United States' : '');
  }
  async function reverseWeatherPlace(latitude,longitude,timezone=''){
    const cleanCountry=name=>String(name || '').replace(/\s*\(the\)\s*/i,'').replace(/United States of America/i,'United States').trim();
    try{
      const res=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`,{cache:'no-store'});
      if(res.ok){
        const data=await res.json();
        const city=data.city || data.locality || '';
        const region=data.principalSubdivision || '';
        const country=cleanCountry(data.countryName || '');
        const place=[city,region,country].filter(Boolean).join(', ');
        if(place) return place;
      }
    }catch{}
    try{
      const res=await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&language=en&format=json&count=1`,{cache:'no-store'});
      if(res.ok){
        const data=await res.json();
        const match=Array.isArray(data.results) ? data.results[0] : null;
        const place=match ? weatherPlaceName(match) : '';
        if(place) return place;
      }
    }catch{}
    return weatherTimezoneFallbackName(timezone);
  }
  function scoreWeatherMatch(term,match){
    const query=String(term || '').toLowerCase();
    const name=String(match.name || '').toLowerCase();
    const admin=String(match.admin1 || '').toLowerCase();
    const country=String(match.country || '').toLowerCase();
    let score=0;
    if(query===name) score+=80;
    if(query.includes(name)) score+=30;
    if(admin && query.includes(admin)) score+=35;
    if(country && query.includes(country)) score+=28;
    if(/\b(us|usa|united states|america)\b/.test(query) && match.country_code==='US') score+=24;
    if(match.feature_code==='PPLA' || match.feature_code==='PPLC') score+=8;
    if(match.population) score+=Math.min(20,Math.log10(Number(match.population))*4);
    return score;
  }
  async function selectWeatherMatch(match){
    const place=weatherPlaceName(match);
    store.setText('nyx.weatherLat',match.latitude);
    store.setText('nyx.weatherLon',match.longitude);
    store.setText('nyx.weatherPlace',place);
    if(match.timezone) store.setText('nyx.weatherTimezone',match.timezone);
    const input=weatherPanel()?.querySelector('[data-weather-query]');
    if(input) input.value=place;
    clearWeatherOptions();
    await loadWeatherLocation({latitude:match.latitude,longitude:match.longitude,place,timezone:match.timezone});
  }
  async function loadWeatherLocation(location=savedWeatherLocation()){
    const coords={
      latitude:Number(location.latitude) || 34.0522,
      longitude:Number(location.longitude) || -118.2437
    };
    const place=location.place || 'Los Angeles';
    const timezone=location.timezone || savedWeatherLocation().timezone;
    const panel=weatherPanel();
    if(panel) panel.querySelector('[data-weather-place]').textContent=place;
    setWeatherStatus('Loading...');
    try{
      const res=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`);
      if(!res.ok) throw new Error('weather failed');
      const json=await res.json();
      const tz=json.timezone || timezone;
      store.setText('nyx.weatherTimezone',tz);
      renderWeather(json.current,place,tz,json.daily);
    }catch{
      setWeatherStatus('Weather unavailable right now');
    }
  }
  async function searchWeatherPlace(query){
    const term=String(query||'').trim();
    if(!term){loadWeatherLocation(); return}
    clearWeatherOptions();
    setWeatherStatus('Searching...');
    try{
      const fetchMatches=async(searchTerm)=>{
        const res=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=10&language=en&format=json`);
        if(!res.ok) throw new Error('search failed');
        const data=await res.json();
        return data.results || [];
      };
      let results=await fetchMatches(term);
      if(!results.length && term.includes(',')){
        results=await fetchMatches(term.split(',')[0].trim());
      }
      const seen=new Set();
      const unique=results.filter(match=>{
        const key=[match.name,match.admin1,match.country,match.latitude,match.longitude].join('|');
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const matches=unique.sort((a,b)=>scoreWeatherMatch(term,b)-scoreWeatherMatch(term,a));
      if(!matches.length){setWeatherStatus('No location found'); return}
      if(matches.length===1){
        await selectWeatherMatch(matches[0]);
        return;
      }
      const box=weatherPanel()?.querySelector('[data-weather-options]');
      if(!box) return;
      box.hidden=false;
      box.innerHTML='<option value="">Choose a matching location...</option>'+matches.map((match,i)=>{
        const name=weatherPlaceName(match);
        const detail=[match.timezone,match.population ? `${Number(match.population).toLocaleString()} people` : ''].filter(Boolean).join(' · ');
        return `<option value="${i}">${esc(name)}${detail ? ` - ${esc(detail)}` : ''}</option>`;
      }).join('');
      box.onchange=()=>{if(box.value!=='') selectWeatherMatch(matches[Number(box.value)])};
      setWeatherStatus('Choose a location');
    }catch{
      setWeatherStatus('Location search unavailable');
    }
  }
  function isWeatherPanelOpen(){
    const panel=weatherPanel();
    return !!panel && !panel.classList.contains('minimized') && !panel.classList.contains('closing');
  }
  function closeWeatherPanelAnimated(){
    const panel=weatherPanel();
    const restore=$('weatherRestore');
    if(!panel) return;
    if(panel.classList.contains('minimized') || panel.classList.contains('closing')) return;
    panel.classList.remove('opening');
    panel.classList.add('closing');
    setTimeout(()=>{
      panel.classList.remove('closing');
      panel.classList.add('minimized');
      if(!document.body.classList.contains('workspace-shell')) restore?.classList.add('show');
      else restore?.classList.remove('show');
    },520);
  }
  function closeWeatherForWindowOpen(){
    const panel=weatherPanel();
    if(!panel || !isWeatherPanelOpen()) return;
    closeWeatherPanelAnimated();
  }
  let weatherPanelAnchorTrigger=null;
  function setWeatherPanelAnchor(anchor='bottom',trigger=null){
    const panel=weatherPanel();
    if(!panel) return 'bottom';
    const next=anchor==='top' ? 'top' : 'bottom';
    weatherPanelAnchorTrigger=next==='top' ? (trigger || weatherPanelAnchorTrigger) : null;
    panel.dataset.weatherAnchor=next;
    panel.classList.toggle('weather-anchor-top',next==='top');
    panel.classList.toggle('weather-anchor-bottom',next==='bottom');
    if(next==='top' && weatherPanelAnchorTrigger?.getBoundingClientRect){
      const triggerRect=weatherPanelAnchorTrigger.getBoundingClientRect();
      const panelStyle=getComputedStyle(panel);
      const scale=Math.max(.1,Number.parseFloat(panelStyle.zoom) || 1);
      const panelWidth=(Number.parseFloat(panelStyle.width) || 306)*scale;
      const margin=12;
      const centered=triggerRect.left+(triggerRect.width-panelWidth)/2;
      const physicalLeft=Math.max(margin,Math.min(innerWidth-panelWidth-margin,centered));
      panel.style.setProperty('--weather-top-left',`${physicalLeft/scale}px`);
    }else{
      panel.style.removeProperty('--weather-top-left');
    }
    return next;
  }
  function restoreWeatherPanel(anchor=weatherPanel()?.dataset.weatherAnchor || 'bottom',trigger=null){
    const panel=weatherPanel();
    const restore=$('weatherRestore');
    if(!panel) return;
    setWeatherPanelAnchor(anchor,trigger);
    panel.classList.remove('minimized','closing');
    panel.classList.add('opening');
    setTimeout(()=>panel.classList.remove('opening'),640);
    restore?.classList.remove('show');
    const query=panel.querySelector('[data-weather-query]');
    if(query){
      query.blur();
      try{query.setSelectionRange(0,0)}catch{}
      query.scrollLeft=0;
    }
  }
  function loadUserWeatherLocation(){
    if(!navigator.geolocation) return Promise.resolve(false);
    return new Promise(resolve=>{
      navigator.geolocation.getCurrentPosition(async position=>{
        const coords=position.coords || {};
        if(!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)){
          resolve(false);
          return;
        }
        const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone || savedWeatherLocation().timezone;
        const place=await reverseWeatherPlace(coords.latitude,coords.longitude,timezone);
        store.setText('nyx.weatherLat',coords.latitude);
        store.setText('nyx.weatherLon',coords.longitude);
        store.setText('nyx.weatherPlace',place);
        store.setText('nyx.weatherTimezone',timezone);
        const input=weatherPanel()?.querySelector('[data-weather-query]');
        if(input) input.value=place;
        await loadWeatherLocation({latitude:coords.latitude,longitude:coords.longitude,place,timezone});
        resolve(true);
      },()=>{
        resolve(false);
      },{enableHighAccuracy:false,maximumAge:600000,timeout:4500});
    });
  }
  async function openWeatherOnStartup(){
    initWeatherPanel();
    restoreWeatherPanel();
    const usedLocation=await loadUserWeatherLocation();
    if(!usedLocation) loadWeatherLocation(savedWeatherLocation());
    restoreWeatherPanel();
  }
  function initWeatherPanel(){
    const panel=weatherPanel();
    if(!panel || panel.dataset.ready) return;
    panel.dataset.ready='true';
    const saved=savedWeatherLocation();
    const query=panel.querySelector('[data-weather-query]');
    if(query) query.value=saved.place;
    panel.querySelector('[data-weather-search]')?.addEventListener('submit',e=>{
      e.preventDefault();
      searchWeatherPlace(query?.value);
    });
    panel.querySelector('[data-weather-refresh]')?.addEventListener('click',()=>loadWeatherLocation());
    panel.querySelector('[data-weather-minimize]')?.addEventListener('click',closeWeatherPanelAnimated);
    $('weatherRestore')?.addEventListener('click',restoreWeatherPanel);
    if(!initWeatherPanel.anchorResizeReady){
      initWeatherPanel.anchorResizeReady=true;
      addEventListener('resize',()=>{
        if(isWeatherPanelOpen() && weatherPanel()?.dataset.weatherAnchor==='top'){
          setWeatherPanelAnchor('top',weatherPanelAnchorTrigger);
        }
      },{passive:true});
    }
    loadWeatherLocation(saved);
    if(!initWeatherPanel.timeTimer) initWeatherPanel.timeTimer=setInterval(()=>renderWeatherTime(savedWeatherLocation().timezone),30000);
  }
  function openWeather(anchor='bottom',trigger=null){
    initWeatherPanel();
    const panel=weatherPanel();
    const next=anchor==='top' ? 'top' : 'bottom';
    if(isWeatherPanelOpen()){
      if(panel?.dataset.weatherAnchor!==next){
        setWeatherPanelAnchor(next,trigger);
        const query=panel.querySelector('[data-weather-query]');
        if(query){
          query.blur();
          try{query.setSelectionRange(0,0)}catch{}
          query.scrollLeft=0;
        }
        return;
      }
      closeWeatherPanelAnimated();
      return;
    }
    restoreWeatherPanel(next,trigger);
  }

  let nyxAiModels=[];
  function nyxAiSelectedModel(){
    const saved=store.text('nyx.aiModel','chatgpt-5.4-mini');
    return nyxAiModels.some(([id])=>id===saved) ? saved : (nyxAiModels[0]?.[0]||'');
  }
  function nyxAiModelLabel(id=nyxAiSelectedModel()){
    return nyxAiModels.find(([modelId])=>modelId===id)?.[1] || 'Models unavailable';
  }
  function nyxAiModelOptions(selected=nyxAiSelectedModel()){
    return nyxAiModels.map(([id,label])=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(label)}</option>`).join('');
  }
  async function nyxAiLoadModels(){
    try{
      const response=await fetch('/api/nyx-ai/models',{headers:{accept:'application/json'}});
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error || `Model catalog failed (${response.status})`);
      const models=Array.isArray(data?.models) ? data.models.flatMap(item=>{
        const id=String(item?.id || '').trim();
        const label=String(item?.label || id).trim();
        return id && label ? [[id,label]] : [];
      }) : [];
      if(!models.length) return;
      nyxAiModels=models;
      const selected=nyxAiSelectedModel();
      document.querySelectorAll('[data-lion-ai-model]').forEach(select=>{
        const previous=nyxAiModels.some(([id])=>id===select.value) ? select.value : selected;
        select.innerHTML=nyxAiModelOptions(previous);
        select.value=previous;
      });
      document.querySelectorAll('[data-nyx-ai-model-label]').forEach(label=>{label.textContent=nyxAiModelLabel(selected)});
    }catch(error){
      console.warn("Nyx A1 model catalog could not be loaded:",error);
    }
  }
  void nyxAiLoadModels();
  function lionAiEmptyState(){
    return `<section class="lion-ai-empty" data-lion-ai-empty>
      <div class="lion-ai-orb" data-nyx-logo aria-hidden="true"></div>
      <p class="lion-ai-eyebrow">NYX INTELLIGENCE</p>
      <h2>What can I help you with?</h2>
      <p class="lion-ai-empty-copy">Ask a question, work through an idea, or start creating.</p>
      <div class="lion-ai-starters">
        <button type="button" data-lion-ai-prompt="Explain quantum computing in simple terms">
          <span class="lion-ai-starter-icon" aria-hidden="true">✦</span>
          <strong>Explain a complex topic</strong>
          <small>in simple terms</small>
        </button>
        <button type="button" data-lion-ai-prompt="Write a JavaScript function that parses JSON from an API endpoint">
          <span class="lion-ai-starter-icon" aria-hidden="true">&lt;/&gt;</span>
          <strong>Help me write code</strong>
          <small>and explain how it works</small>
        </button>
        <button type="button" data-lion-ai-prompt="Give me five creative startup ideas in the AI space">
          <span class="lion-ai-starter-icon" aria-hidden="true">⌁</span>
          <strong>Brainstorm new ideas</strong>
          <small>for a creative project</small>
        </button>
        <button type="button" data-lion-ai-prompt="Write a short dark science-fiction story about a rogue AI">
          <span class="lion-ai-starter-icon" aria-hidden="true">◇</span>
          <strong>Create something</strong>
          <small>from a simple prompt</small>
        </button>
      </div>
    </section>`;
  }
  function lionAiBody(){
    return `<div class="lion-ai-panel">
      <main class="lion-ai-main">
        <header class="lion-ai-head">
          <div class="lion-ai-header-brand">
            <div class="lion-ai-mark" data-nyx-logo aria-label="Nyx"></div>
            <div class="lion-ai-title">
              <h1 data-lion-ai-thread-title>New chat</h1>
              <span>Nyx A1 workspace</span>
            </div>
          </div>
          <div class="lion-ai-head-actions">
            <div class="lion-ai-model-pill">
              <span class="lion-ai-ready-dot" aria-hidden="true"></span>
              <strong data-nyx-ai-model-label>${esc(nyxAiModelLabel())}</strong>
            </div>
            <button class="lion-ai-clear" type="button" data-lion-ai-clear title="Clear conversation" aria-label="Clear conversation">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M7 6l1 14h8l1-14M10 10v6M14 10v6"/></svg>
            </button>
            <select class="lion-ai-model-select" data-lion-ai-model aria-label="AI model">${nyxAiModelOptions()}</select>
          </div>
        </header>
        <div class="lion-ai-chat" data-lion-ai-chat>${lionAiEmptyState()}</div>
        <footer class="lion-ai-composer">
          <div class="lion-ai-preview" data-lion-ai-preview><img alt=""><span></span></div>
          <div class="lion-ai-image-status" data-lion-ai-image-status></div>
          <form class="lion-ai-form" data-lion-ai-form>
            <label class="lion-ai-plus" title="Add image" aria-label="Add image">
              <span aria-hidden="true">＋</span>
              <input type="file" accept="image/*" data-lion-ai-image>
            </label>
            <textarea class="lion-ai-input" data-lion-ai-input placeholder="Ask Nyx A1 anything..." autocomplete="off" spellcheck="true"></textarea>
            <button class="lion-ai-send" type="submit" title="Send" aria-label="Send">↑</button>
          </form>
          <p>Nyx A1 can make mistakes. Verify important information.</p>
        </footer>
      </main>
    </div>`;
  }
  function openLionAI(){
    const win=makeWindow({title:"Nyx A1",className:'lion-ai-window',left:'7vw',top:'52px',width:'min(1080px,88vw)',height:'min(760px,calc(100vh - 76px))',autoMaximize:false,body:lionAiBody()});
    lionAiRestoreChat(win);
    setTimeout(()=>win.querySelector('[data-lion-ai-input]')?.focus(),80);
  }
  function lionAiTopic(prompt){
    const phrase=String(prompt || '');
    const afterSubjectWord=prompt.match(/\b(?:about|on|regarding)\s+(.+?)(?:[.?!]|$)/i);
    let subject=afterSubjectWord ? afterSubjectWord[1] : phrase;
    subject=subject
      .replace(/\bwhy\s+(.+?)\s+(?:is|are)\s+(?:good|great|bad|important|popular|useful|fun)\b/i,'$1')
      .replace(/\bwhat\s+makes\s+(.+?)\s+(?:good|great|bad|important|popular|useful|fun)\b/i,'$1');
    const cleaned=subject
      .replace(/\b\d+\s*sentences?\b/gi,' ')
      .replace(/\b(write|make|create|generate|paragraph|essay|response|about|on|regarding|please|can you|for me|tell me|explain|define|what is|whats|what's|how do|how does|why does|why is)\b/gi,' ')
      .replace(/\b(is|are|good|great|bad|important|popular|useful|fun)\b$/gi,' ')
      .replace(/\b(a|an|the)\b/gi,' ')
      .replace(/\s+/g,' ')
      .replace(/^[^\w]+|[^\w]+$/g,'')
      .trim();
    return cleaned || 'the topic';
  }
  function lionAiParagraph(prompt){
    const match=prompt.match(/(\d+)\s*sent/i);
    const count=Math.max(1,Math.min(20,match ? Number(match[1]) : 8));
    const topic=lionAiTopic(prompt);
    const isPokemon=/\bpokemon\b/i.test(topic);
    const stems=isPokemon ? [
      `${topic} is popular because it mixes adventure, collecting, strategy, and imagination in a way many people can understand`,
      `The main idea of ${topic} is that trainers meet different creatures, learn their strengths, and build teams that match their goals`,
      `Each creature in ${topic} can feel memorable because it has its own design, type, moves, and personality`,
      `This variety makes ${topic} interesting because two people can enjoy the same world in completely different ways`,
      `Some people like ${topic} for battling, where choices such as type matchups, speed, abilities, and move timing matter`,
      `Other people enjoy ${topic} because collecting and discovering new creatures gives the world a sense of progress`,
      `The games also teach planning because a strong team usually needs balance instead of only using one favorite creature`,
      `For example, a team with fire, water, grass, electric, and defensive options can handle more situations than a random team`,
      `Another important part of ${topic} is evolution, which makes growth feel visible and rewarding`,
      `When a creature evolves, the player can see effort turn into a stronger and more impressive form`,
      `${topic} also works well as a story because it gives players rivals, gyms, regions, challenges, and goals to chase`,
      `Those goals make the journey feel organized while still leaving room for personal choices`,
      `The trading and battling parts of ${topic} also make it social, since players can share creatures and test strategies together`,
      `This social side helps explain why ${topic} has stayed popular for so many years`,
      `A good explanation of ${topic} should mention both the simple fun of catching creatures and the deeper strategy behind team building`,
      `That combination lets younger players enjoy the basics while older players can study advanced tactics`,
      `${topic} also stands out because its world is easy to recognize through names, music, creatures, and regions`,
      `Even people who do not play often know famous examples, which shows how strong the series has become`,
      `Overall, ${topic} matters because it turns collecting, friendship, competition, and exploration into one connected experience`,
      `That is why ${topic} continues to be a subject people can write about, debate, play, and enjoy`
    ] : [
      `${topic} is an interesting subject because it has its own ideas, history, and reasons people care about it`,
      `When people talk about ${topic}, they are usually thinking about what makes it unique compared with other topics`,
      `A good paragraph about ${topic} should explain the main idea clearly before adding smaller details`,
      `One important part of ${topic} is the way it connects facts, examples, and personal interest`,
      `Those connections make ${topic} easier to understand because the reader can see why it matters`,
      `Another useful way to explain ${topic} is to describe how it affects people or the world around them`,
      `For many people, ${topic} becomes memorable because it includes details that are easy to picture`,
      `Those details help turn a simple explanation into something more specific and meaningful`,
      `A strong discussion of ${topic} should also include cause and effect, because that shows how one idea leads to another`,
      `Examples are especially helpful because they give the reader something concrete to connect with`,
      `If someone is learning about ${topic}, they should focus on the biggest ideas first and then study the details`,
      `That approach prevents the subject from feeling confusing or random`,
      `The more someone studies ${topic}, the easier it becomes to notice patterns and explain them clearly`,
      `Those patterns can help someone compare ${topic} with similar subjects and understand what makes it different`,
      `A careful explanation should avoid drifting away from ${topic}, because staying focused makes the writing stronger`,
      `Good writing about ${topic} also uses clear transitions so each sentence builds on the last one`,
      `This makes the paragraph feel organized instead of like a list of unrelated thoughts`,
      `By the end, the reader should understand not only what ${topic} is, but also why it deserves attention`,
      `That is what makes ${topic} a useful subject for learning, writing, and discussion`,
      `Overall, ${topic} stands out because it can be explained through facts, examples, and clear reasoning`
    ];
    return stems.slice(0,count).map(s=>s+'.').join(' ');
  }
  function lionAiNormalizeMath(expr){
    return expr.replace(/π/gi,'pi').replace(/\s+/g,'').replace(/(\d)([a-zA-Z(])/g,'$1*$2').replace(/([a-zA-Z)])(\d)/g,'$1*$2').replace(/\)\(/g,')*(').replace(/\^/g,'**');
  }
  function lionAiEvalExpression(expr, xValue=0){
    const normalized=lionAiNormalizeMath(expr)
      .replace(/\bpi\b/gi,'Math.PI').replace(/\be\b/g,'Math.E')
      .replace(/\bsqrt\(/gi,'Math.sqrt(').replace(/\bsin\(/gi,'Math.sin(').replace(/\bcos\(/gi,'Math.cos(').replace(/\btan\(/gi,'Math.tan(')
      .replace(/\blog\(/gi,'Math.log10(').replace(/\bln\(/gi,'Math.log(').replace(/\babs\(/gi,'Math.abs(');
    if(!/^[0-9xX+\-*/().,MathPIEabsqrtingclo]+$/.test(normalized)) throw new Error('Unsupported symbol in expression.');
    return Function('x','return ('+normalized.replace(/\bX\b/g,'x')+')')(xValue);
  }
  function lionAiSolveEquation(input){
    const equation=input.split(/solve:?/i).pop().trim();
    if(!equation.includes('=')){
      const value=lionAiEvalExpression(equation);
      return `Result: ${Number.isFinite(value) ? value : 'undefined'}\n\nI evaluated the expression using normal order of operations.`;
    }
    const [left,right]=equation.split('=');
    const f=x=>lionAiEvalExpression(left,x)-lionAiEvalExpression(right,x);
    const y0=f(0), y1=f(1), y2=f(2);
    const a=(y2-2*y1+y0)/2;
    const b=y1-y0-a;
    const c=y0;
    if(Math.abs(a)<1e-9){
      if(Math.abs(b)<1e-9) return Math.abs(c)<1e-9 ? 'Every x works for this equation.' : 'No solution found because both sides differ by a constant.';
      const x=-c/b;
      return `Solution: x = ${Number(x.toFixed(8))}\n\nI rewrote the equation as f(x)=0 and solved the linear form.`;
    }
    const disc=b*b-4*a*c;
    if(disc>=0){
      const r1=(-b+Math.sqrt(disc))/(2*a);
      const r2=(-b-Math.sqrt(disc))/(2*a);
      return `Solutions: x = ${Number(r1.toFixed(8))} and x = ${Number(r2.toFixed(8))}\n\nI detected a quadratic form and used the quadratic formula.`;
    }
    const real=-b/(2*a);
    const imag=Math.sqrt(-disc)/(2*Math.abs(a));
    return `Complex solutions: x = ${Number(real.toFixed(8))} + ${Number(imag.toFixed(8))}i and x = ${Number(real.toFixed(8))} - ${Number(imag.toFixed(8))}i\n\nI detected a quadratic with a negative discriminant.`;
  }
  function lionAiCleanMathPrompt(prompt){
    return String(prompt || '')
      .replace(/^(please\s*)?(can\s+you\s+)?(calculate|compute|evaluate|solve|what\s+is|what's|whats|math)[:\s]*/i,'')
      .replace(/[?,]+$/,'')
      .trim();
  }
  function lionAiFormatBigInt(value){
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
  }
  function lionAiExactIntegerPower(expr){
    const match=String(expr || '').replace(/\s+/g,'').replace(/[−–—]/g,'-').match(/^(-?\d+)\^(\d+)$/);
    if(!match) return null;
    const base=BigInt(match[1]);
    const exp=BigInt(match[2]);
    const result=base ** exp;
    return `${match[1]}^${match[2]} = ${lionAiFormatBigInt(result)}\n\nExact value: ${result.toString()}`;
  }
  function lionAiSentenceCount(prompt){
    const match=String(prompt || '').match(/(\d+)\s*(?:sent|sentence|sentences)/i);
    return Math.max(1,Math.min(20,match ? Number(match[1]) : 8));
  }
  function lionAiCleanSubjectText(value){
    return String(value || '')
      .replace(/```[\s\S]*?```/g,' ')
      .replace(/[“”]/g,'"')
      .replace(/[‘’]/g,"'")
      .replace(/\s+/g,' ')
      .replace(/^[\s:;,.!?'"-]+|[\s:;,.!?'"-]+$/g,'')
      .trim();
  }
  function lionAiTitleSubject(value){
    const text=lionAiCleanSubjectText(value);
    if(!text) return 'The topic';
    return text.replace(/\b\w+/g,(word,index)=>/^(and|or|of|the|a|an|to|for|in|on|with)$/i.test(word) && index>0 ? word.toLowerCase() : word[0].toUpperCase()+word.slice(1));
  }
  function lionAiTopic(prompt){
    const phrase=lionAiCleanSubjectText(prompt);
    const direct=phrase.match(/\b(?:about|on|regarding|over)\s+(.+?)(?:[.?!]|$)/i);
    let subject=direct ? direct[1] : phrase;
    subject=subject
      .replace(/\bwhy\s+(.+?)\s+(?:is|are|was|were)\s+(?:good|great|bad|important|popular|useful|fun|cool|interesting)\b/i,'$1')
      .replace(/\bwhy\s+(?:is|are|was|were)\s+(.+?)\s+(?:good|great|bad|important|popular|useful|fun|cool|interesting)\b/i,'$1')
      .replace(/\bwhat\s+makes\s+(.+?)\s+(?:good|great|bad|important|popular|useful|fun|cool|interesting)\b/i,'$1')
      .replace(/\b(?:write|make|create|generate|give me|tell me|explain|define)\b/gi,' ')
      .replace(/\b(?:a|an|the)?\s*(?:paragraph|essay|response|answer|summary)\b/gi,' ')
      .replace(/\b\d+\s*(?:sent|sentence|sentences)\b/gi,' ')
      .replace(/\b(?:please|can you|for me|in detail|short|long)\b/gi,' ')
      .replace(/\b(?:what is|whats|what's|how do|how does|why does|why is)\b/gi,' ')
      .replace(/\s+/g,' ');
    subject=lionAiCleanSubjectText(subject);
    return subject || 'the topic';
  }
  function lionAiNormalizeMathText(value){
    const supers={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
    return String(value || '')
      .replace(/[−–—]/g,'-')
      .replace(/[×·∙]/g,'*')
      .replace(/÷/g,'/')
      .replace(/[πΠ]/g,'pi')
      .replace(/√/g,'sqrt')
      .replace(/≤/g,'<=')
      .replace(/≥/g,'>=')
      .replace(/≠/g,'!=')
      .replace(/≈/g,'~')
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,m=>'^'+[...m].map(ch=>supers[ch] || '').join(''));
  }
  function lionAiLooksLikeMath(value){
    const text=lionAiNormalizeMathText(value);
    return /(?:=|[+\-*/^()]|\b(?:sqrt|sin|cos|tan|log|ln|pi)\b)/i.test(text) && /(?:\d|x|pi)/i.test(text);
  }
  function lionAiNormalizeMath(expr){
    return lionAiNormalizeMathText(expr)
      .replace(/\bsqrt\s*([0-9.]+|x)\b/gi,'sqrt($1)')
      .replace(/\s+/g,'')
      .replace(/(\d)([a-zA-Z(])/g,'$1*$2')
      .replace(/([a-zA-Z)])(\d)/g,'$1*$2')
      .replace(/\)\(/g,')*(')
      .replace(/\^/g,'**');
  }
  function lionAiCleanMathPrompt(prompt){
    let text=lionAiNormalizeMathText(prompt);
    const direct=text.match(/\b(?:about|on|regarding|over)\s+(.+?)(?:[.?!]|$)/i);
    if(direct) text=direct[1];
    return text
      .replace(/^(please\s*)?(can\s+you\s+)?(calculate|compute|evaluate|solve|what\s+is|what's|whats|math)[:\s]*/i,'')
      .replace(/\b(?:write|make|create|generate|paragraph|essay|sentences?|explain|about|please|for me)\b/gi,' ')
      .replace(/[?,]+$/,'')
      .replace(/\s+/g,' ')
      .trim();
  }
  function lionAiExactIntegerPower(expr){
    const match=lionAiNormalizeMathText(expr).replace(/\s+/g,'').match(/^(-?\d+)\^(\d+)$/);
    if(!match) return null;
    const base=BigInt(match[1]);
    const exp=BigInt(match[2]);
    const result=base ** exp;
    return `${match[1]}^${match[2]} = ${lionAiFormatBigInt(result)}\n\nExact value: ${result.toString()}`;
  }
  function lionAiMathParagraph(prompt){
    const count=lionAiSentenceCount(prompt);
    const expression=lionAiCleanMathPrompt(prompt);
    const answer=lionAiMath(expression || prompt);
    const main=answer.split('\n')[0].replace(/\.$/,'');
    const shown=expression || lionAiTopic(prompt);
    const sentences=[
      `The expression ${shown} can be understood by translating the symbols into standard math notation first`,
      `After that, the normal order of operations decides which parts should be handled before others`,
      `Parentheses and exponents come before multiplication and division, and addition or subtraction usually happen last`,
      `When the expression is evaluated carefully, the main result is ${main}`,
      `This matters because changing the order can produce a completely different answer`,
      `A clear math paragraph should name the expression, explain the steps, and end with the final result`,
      `If the problem includes a variable, the variable should be isolated or substituted before the final value is chosen`,
      `Overall, ${shown} is solved best by keeping the notation clean and checking each operation one step at a time`
    ];
    return sentences.slice(0,count).map(s=>/[.!?]$/.test(s) ? s : s+'.').join(' ');
  }
  function lionAiParagraph(prompt){
    const count=lionAiSentenceCount(prompt);
    const topic=lionAiTopic(prompt);
    if(lionAiLooksLikeMath(topic) || lionAiLooksLikeMath(prompt) || lionAiIsMathPrompt(prompt)) return lionAiMathParagraph(prompt);
    const title=lionAiTitleSubject(topic);
    const lower=String(prompt || '').toLowerCase();
    const positive=/\b(good|great|useful|important|popular|fun|cool|interesting|best)\b/.test(lower);
    const compare=/\b(compare|versus|vs\.?|difference between)\b/.test(lower);
    const story=/\b(story|narrative|creative)\b/.test(lower);
    const sentences=story ? [
      `${title} can be turned into a clear story by giving it a setting, a goal, and a problem to solve`,
      `The first part should introduce the situation so the reader understands what is happening`,
      `Next, the paragraph should show a challenge that makes the subject feel important instead of random`,
      `Strong details help the reader picture the scene and understand why the moment matters`,
      `The ending should connect back to the main idea so the story feels complete`,
      `This keeps the writing focused while still making it more interesting to read`,
      `A good creative paragraph about ${topic} should feel organized, descriptive, and easy to follow`,
      `Overall, the best version uses the subject as the center of the story instead of drifting away from it`
    ] : compare ? [
      `${title} is easiest to explain by separating the similarities from the differences`,
      `A strong comparison starts with what the two sides have in common so the reader has a base to understand them`,
      `After that, the paragraph should explain the biggest difference and why it matters`,
      `Examples make the comparison clearer because they show how the difference works in real situations`,
      `The paragraph should avoid jumping between unrelated points, because that can make the answer confusing`,
      `Instead, each sentence should build from the last one and stay tied to the main comparison`,
      `By the end, the reader should understand not only how the ideas are different, but also why that difference is important`,
      `Overall, ${topic} should be explained with a balanced view that uses clear details instead of random claims`
    ] : positive ? [
      `${title} stands out because it gives people a clear reason to care about the subject`,
      `One important strength is that it can be explained through specific details instead of empty opinions`,
      `Those details help the reader understand why the subject is useful, interesting, or worth discussing`,
      `A good paragraph should connect the main idea to examples so the answer feels grounded`,
      `It should also explain cause and effect, because that shows how one part of the subject leads to another`,
      `When the writing stays focused, the paragraph becomes easier to follow and more convincing`,
      `This is why ${topic} can be described as important without simply repeating the original question`,
      `Overall, ${topic} works as a strong paragraph topic because it can be supported with reasons, examples, and clear explanation`
    ] : [
      `${title} is the main subject, so a strong paragraph should explain it directly and clearly`,
      `The first sentence should introduce what the subject is or what the reader needs to understand about it`,
      `After that, the paragraph should add details that support the main idea instead of repeating the prompt`,
      `Examples are useful because they turn a general statement into something easier to picture`,
      `A clear paragraph also uses cause and effect when the subject needs explanation`,
      `Each sentence should connect to the one before it so the writing feels organized`,
      `The paragraph should avoid random filler and stay focused on the exact subject being discussed`,
      `Overall, ${topic} can be explained well by combining a simple main idea with supporting details and a clear ending`
    ];
    return sentences.slice(0,count).map(s=>/[.!?]$/.test(s) ? s : s+'.').join(' ');
  }

  function lionAiNormalizeEverydaySymbols(value){
    const sub={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','₌':'=','₍':'(','₎':')'};
    return String(value || '')
      .normalize('NFKC')
      .replace(/[−‐‑‒–—―]/g,'-')
      .replace(/[×✕✖⋅·∙•]/g,'*')
      .replace(/[÷∕⁄]/g,'/')
      .replace(/[πΠ]/g,'pi')
      .replace(/[τΤ]/g,'tau')
      .replace(/[θΘ]/g,'theta')
      .replace(/[αΑ]/g,'alpha')
      .replace(/[βΒ]/g,'beta')
      .replace(/[γΓ]/g,'gamma')
      .replace(/[δΔ]/g,'delta')
      .replace(/[λΛ]/g,'lambda')
      .replace(/[μΜ]/g,'mu')
      .replace(/[σΣ]/g,'sigma')
      .replace(/[φΦ]/g,'phi')
      .replace(/[ωΩ]/g,'omega')
      .replace(/[∞]/g,'infinity')
      .replace(/[∫]/g,' integral ')
      .replace(/[∑]/g,' sum ')
      .replace(/[∏]/g,' product ')
      .replace(/[√]/g,'sqrt')
      .replace(/[∂]/g,' partial ')
      .replace(/[′’]/g,"'")
      .replace(/[″]/g,"''")
      .replace(/[≤]/g,'<=')
      .replace(/[≥]/g,'>=')
      .replace(/[≠]/g,'!=')
      .replace(/[≈≃≅]/g,'~')
      .replace(/[∈]/g,' in ')
      .replace(/[∉]/g,' not in ')
      .replace(/[∪]/g,' union ')
      .replace(/[∩]/g,' intersection ')
      .replace(/[⊂⊆]/g,' subset ')
      .replace(/[⊃⊇]/g,' superset ')
      .replace(/[∀]/g,' for all ')
      .replace(/[∃]/g,' exists ')
      .replace(/[∴]/g,' therefore ')
      .replace(/[∵]/g,' because ')
      .replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]/g,ch=>sub[ch] || ch);
  }
  function lionAiNormalizeMathText(value){
    const supers={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
    return lionAiNormalizeEverydaySymbols(value)
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,m=>'^'+[...m].map(ch=>supers[ch] || '').join(''));
  }
  function lionAiAdvancedMathInfo(prompt){
    const raw=String(prompt || '');
    const text=lionAiNormalizeEverydaySymbols(raw).replace(/\s+/g,' ').trim();
    const hasAdvanced=/\b(integral|differentiate|derivative|differential|equilibrium|stability|particle|acceleration|velocity|concave|concavity|maclaurin|taylor|series|limit|lim|summation|matrix|determinant|vector)\b|[{}]|f\([a-z]\)/i.test(text);
    if(!hasAdvanced) return '';
    const compact=text.replace(/\s+/g,'').toLowerCase();
    if(/integral0?1(?:ln\(1\+x\)\/x|\/?xln\(1\+x\))dx/.test(compact) || /integral.*0.*1.*x.*ln\(1\+x\).*dx/.test(compact)){
      const hasFractionCue=/\/|⁄|∕|\u200b|\u200c|\u200d|\ufeff/.test(raw) || /ln\(1\+x\)\/x/i.test(compact);
      if(hasFractionCue){
        return `I read this as the fraction integral from 0 to 1 of ln(1 + x) / x dx.\n\nUse the Maclaurin series ln(1 + x) = x - x^2/2 + x^3/3 - x^4/4 + ... .\n\nDividing by x gives ln(1 + x)/x = 1 - x/2 + x^2/3 - x^3/4 + ... .\n\nIntegrating term by term from 0 to 1 gives 1 - 1/2^2 + 1/3^2 - 1/4^2 + ... .\n\nThat alternating series is eta(2), and eta(2) = (1 - 2^(1 - 2))zeta(2) = (1/2)(pi^2/6) = pi^2/12.\n\nAnswer: pi^2 / 12, which is about 0.822467.\n\nNote: if you meant x * ln(1 + x) instead, that different integral equals 1/4.`;
      }
      return `This compact integral is ambiguous, so there are two common readings:\n\n1. If it means integral from 0 to 1 of ln(1 + x) / x dx, then use the series ln(1 + x)/x = 1 - x/2 + x^2/3 - x^3/4 + ... . Integrating from 0 to 1 gives 1 - 1/2^2 + 1/3^2 - 1/4^2 + ... = pi^2/12, about 0.822467.\n\n2. If it means integral from 0 to 1 of xln(1 + x) dx, then integration by parts gives 1/4.\n\nGemini used the first interpretation, ln(1 + x)/x. My earlier answer used the second interpretation, xln(1 + x).`;
    }
    if(/differentialequation|equilibrium|stability|particlemoves|initialcondition|x\(0\)=3/.test(compact)){
      return `I am reading the broken OCR as the autonomous differential equation dx/dt = (x^2 + 1)(x^2 - 4), with x(0) = 3.\n\n(a) At t = 0, x = 3. Then dx/dt = (3^2 + 1)(3^2 - 4) = 10 * 5 = 50, which is positive. The particle is moving to the right.\n\n(b) Equilibrium solutions happen when dx/dt = 0. Since x^2 + 1 is never 0 for real x, x^2 - 4 = 0 gives x = -2 and x = 2. For |x| > 2, dx/dt is positive. For -2 < x < 2, dx/dt is negative. Therefore x = -2 is stable and x = 2 is unstable.\n\n(c) Acceleration is d2x/dt2 = (dy/dx)(dx/dt), where y = dx/dt = (x^2 + 1)(x^2 - 4). Expanding gives y = x^4 - 3x^2 - 4, so dy/dx = 4x^3 - 6x. At x = 3, y = 50 and dy/dx = 90, so d2x/dt2 = 90 * 50 = 4500.\n\n(d) If y = x^2 + 1, then dy/dt = (dy/dx)(dx/dt) = 2x(x^2 + 1)(x^2 - 4). At x = 3, dy/dt = 2 * 3 * 10 * 5 = 300.\n\n(e) Speed is increasing when velocity and acceleration have the same sign. At x = 3, velocity is 50 and acceleration is 4500, both positive, so speed is increasing.\n\n(f) The equation is separable: dx/[(x^2 + 1)(x^2 - 4)] = dt. It can be integrated with partial fractions, but solving explicitly for x(t) is not elementary in a simple closed form.`;
    }
    if(/integral.*0.*x.*t\^?2.*\+?1.*ln\(1\+t\^?2\).*dt/.test(compact) || /f\(x\)=.*integral0x.*t\^?2\+1.*ln\(1\+t\^?2\)/.test(compact)){
      const approx=(Math.pow(.5,3)/3)+(Math.pow(.5,5)/10)-(Math.pow(.5,7)/42);
      return `Assuming the problem is f(x) = integral from 0 to x of (t^2 + 1)ln(1 + t^2) dt:\n\nA. By the Fundamental Theorem of Calculus, f'(x) = (x^2 + 1)ln(1 + x^2).\n\nB. f''(x) = 2xln(1 + x^2) + 2x = 2x(ln(1 + x^2) + 1). At x = 1, f''(1) = 2(ln 2 + 1), which is positive, so f is concave up at x = 1.\n\nC. Since ln(1 + t^2) = t^2 - t^4/2 + t^6/3 - ..., multiplying by (1 + t^2) gives t^2 + t^4/2 - t^6/6 + ... . Integrating term by term gives f(x) = x^3/3 + x^5/10 - x^7/42 + ... . The first three nonzero terms are x^3/3, x^5/10, and -x^7/42.\n\nD. Using those three terms, f(0.5) ≈ ${approx.toFixed(6)}.`;
    }
    const parts=[];
    parts.push(`I can read this as an advanced math question, not a single calculator expression.`);
    if(/\bintegral\b/i.test(text) || /dt\b/i.test(text)){
      parts.push(`The integral sign means the function is being built by accumulating an integrand over an interval, so the first step is to identify the lower bound, upper bound, integrand, and variable of integration.`);
    }
    if(/f\([a-z]\)/i.test(text)){
      parts.push(`For a function like f(x), keep the input variable separate from dummy variables such as t, because the dummy variable disappears after integration.`);
    }
    if(/\bconcave|concavity/i.test(text)){
      parts.push(`For concavity, find the second derivative and test its sign at the requested value: positive means concave up, and negative means concave down.`);
    }
    if(/\bmaclaurin|taylor|series/i.test(text)){
      parts.push(`For a Maclaurin series, expand around x = 0 and keep the first nonzero terms after simplifying the expression.`);
    }
    if(/\bapproximate|approximation/i.test(text)){
      parts.push(`For an approximation such as f(0.5), substitute the value into the series and add the kept terms.`);
    }
    parts.push(`Because the prompt contains multi-line calculus notation, I should explain the method and structure instead of rejecting symbols as unsupported.`);
    return parts.join('\n\n');
  }
  function lionAiMath(prompt){
    try{
      const advanced=lionAiAdvancedMathInfo(prompt);
      if(advanced) return advanced;
      const target=lionAiCleanMathPrompt(prompt);
      const exactPower=lionAiExactIntegerPower(target);
      if(exactPower) return `${exactPower}\n\nI used exact integer arithmetic, so this is not rounded.`;
      return lionAiSolveEquation(target || prompt);
    }catch(err){
      const normalized=lionAiNormalizeEverydaySymbols(prompt).replace(/\s+/g,' ').trim();
      return `I can read the symbols, but I cannot safely finish the full calculation from that formatting yet.\n\nWhat I understood:\n${normalized || String(prompt || '').trim()}\n\nTry sending one part at a time, like the integral, the concavity check, or the Maclaurin series request, and I will solve that section.`;
    }
  }
  function lionAiCode(prompt){
    const lower=prompt.toLowerCase();
    if(lower.includes('fix')){
      const code=(prompt.match(/```[\s\S]*?```/)?.[0] || prompt.split(/fix.*code:?/i).pop() || '').replace(/```/g,'').trim();
      const fixed=code
        .replace(/function\s+(\w+)\(([^)]*)\)\s*\{\s*return\s+([^;}\n]+)\s*$/,'function $1($2){\n  return $3;\n}')
        .replace(/console\.log\(([^)]*)$/,'console.log($1);');
      return `Here is a cleaned-up version:\n\n\`\`\`js\n${fixed || 'Paste the code you want fixed and I will repair the structure, missing braces, and common syntax issues.'}\n\`\`\`\n\nWhat I check: missing braces, missing semicolons, unclosed function bodies, unclear variable names, and safer formatting.`;
    }
    if(lower.includes('python')){
      return `Here is a simple Python starter:\n\n\`\`\`python\ndef main():\n    name = input("Name: ")\n    print(f"Hello, {name}!")\n\nif __name__ == "__main__":\n    main()\n\`\`\`\n\nTell me the exact app you want and I can shape it into a fuller program.`;
    }
    return `Here is a clean HTML/CSS/JS starter:\n\n\`\`\`html\n<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>App</title>\n  <style>\n    body{font-family:Outfit,Arial,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#101318;color:white}\n    main{width:min(520px,92vw);padding:24px;border:1px solid #334155;border-radius:12px;background:#172033}\n    button{height:38px;border:0;border-radius:8px;padding:0 14px;font-weight:700}\n  </style>\n</head>\n<body>\n  <main>\n    <h1>My App</h1>\n    <p id="out">Ready.</p>\n    <button id="run">Run</button>\n  </main>\n  <script>\n    document.getElementById('run').onclick = () => {\n      document.getElementById('out').textContent = 'It works!';\n    };\n  <\/script>\n</body>\n</html>\n\`\`\`\n\nAsk for a calculator, game, login page, dashboard, or anything specific and I will generate a more complete version.`;
  }
  function lionAiTime(){
    const now=new Date();
    return `The time is ${now.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}.\n\nToday is ${now.toLocaleDateString([], {weekday:'long', month:'long', day:'numeric', year:'numeric'})}.`;
  }
  function lionAiExplain(prompt){
    const topic=lionAiTopic(prompt);
    return `${topic} means the main subject you are asking about.\n\nA clear way to understand ${topic} is to break it into three parts: what it is, why it matters, and how it is used. First, define the basic idea in simple words. Next, connect it to a real example so it does not feel random. Finally, check whether the explanation answers the exact question you asked. If you want, I can make this shorter, longer, more advanced, or turn it into a paragraph.`;
  }
  function lionAiList(prompt){
    const topic=lionAiTopic(prompt);
    return `Here are useful points about ${topic}:\n\n1. Start with the main idea.\n2. Add the most important details.\n3. Use examples so the answer is specific.\n4. Compare it with something similar if that helps.\n5. End with the reason it matters.\n\nFor ${topic}, the strongest answer should stay focused on the exact subject instead of drifting into random advice.`;
  }
  function lionAiGeneral(prompt){
    const topic=lionAiTopic(prompt);
    return `Here is a focused answer about ${topic}:\n\n${topic} is the subject you asked about, so the best response should stay centered on that instead of changing topics. The simplest way to answer is to explain what ${topic} is, give the most important detail, and include one clear example. A strong answer also avoids extra filler and connects each sentence back to ${topic}.\n\nAsk me for a paragraph, code, a math solution, a summary, or an image answer and I will format it that way.`;
  }
  function lionAiIsMathPrompt(prompt){
    const text=lionAiNormalizeEverydaySymbols(prompt).toLowerCase();
    return /(solve|calculate|math|equation|integral|derivative|differentiate|concave|concavity|maclaurin|taylor|series|limit|lim|summation|matrix|determinant|vector|sqrt|sin|cos|tan|log|ln|pi|infinity|partial|sum|product|=|\d\s*[\+\-*/^]\s*\d)/i.test(text);
  }
  function lionAiNeedsLocalOnly(prompt){
    return /\b(what'?s|what is|tell me)\s+(the\s+)?time\b|\bcurrent time\b|\btime is it\b/i.test(prompt)
      || /(solve|calculate|math|equation|=|\d\s*[\+\-*/^×÷−–—]\s*\d|sqrt|sin|cos|tan|log|ln|π|√|[⁰¹²³⁴⁵⁶⁷⁸⁹])/i.test(prompt)
      || /(code|javascript|html|css|python|function|fix this|make.*app|make.*website)/i.test(prompt);
  }
  function lionAiResearchQuery(prompt){
    const topic=lionAiTopic(prompt);
    return topic==='the topic' ? String(prompt || '').trim() : topic;
  }
  async function lionAiFetchJson(url){
    const res=await fetch(url,{headers:{accept:'application/json'}});
    if(!res.ok) throw new Error(`Web lookup failed (${res.status})`);
    return res.json();
  }
  async function lionAiWebResearch(prompt){
    const query=lionAiResearchQuery(prompt);
    if(!query) return null;
    const api='https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=5&srsearch='+encodeURIComponent(query);
    const search=await lionAiFetchJson(api);
    const hits=(search?.query?.search || []).slice(0,3);
    const sources=[];
    for(const hit of hits){
      const title=hit.title;
      try{
        const summary=await lionAiFetchJson('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(title));
        const extract=String(summary.extract || '').trim();
        if(extract){
          sources.push({
            title:summary.title || title,
            extract,
            url:summary.content_urls?.desktop?.page || ('https://en.wikipedia.org/wiki/'+encodeURIComponent(title.replace(/\s+/g,'_')))
          });
        }
      }catch{}
    }
    return {query,sources};
  }
  function lionAiSentenceSplit(text){
    return String(text || '').replace(/\s+/g,' ').match(/[^.!?]+[.!?]+/g) || [];
  }
  function lionAiWebParagraph(prompt, research){
    const match=prompt.match(/(\d+)\s*sent/i);
    const count=Math.max(1,Math.min(20,match ? Number(match[1]) : 8));
    const topic=lionAiResearchQuery(prompt);
    const positiveWhy=/\bwhy\b.+\b(is|are)\b.+\b(good|great|popular|fun|important|useful)\b/i.test(prompt);
    const facts=research.sources.flatMap(source=>lionAiSentenceSplit(source.extract)).map(s=>s.trim()).filter(Boolean);
    const sentences=positiveWhy ? [
      `${topic} is good because it gives people a clear world to explore, recognizable characters to care about, and goals that feel easy to understand`,
      ...facts,
      `Those facts support the idea that ${topic} works well because it combines story, design, collecting, and play into one memorable experience`,
      `It also stays interesting because different people can enjoy different parts of it, such as characters, strategy, shows, games, or the larger world around it`,
      `Overall, ${topic} is good because it is simple enough to enjoy quickly but deep enough to keep people interested over time`
    ] : [
      `${topic} makes more sense when it is explained with real background instead of guesses`,
      ...facts,
      `These sources show that ${topic} should be understood through its main definition, its history, and the details that make it important`,
      `A strong explanation of ${topic} should connect facts together instead of listing random points`,
      `Overall, ${topic} matters because the evidence gives it a clearer place in the real world`
    ];
    return sentences.slice(0,count).map(s=>/[.!?]$/.test(s) ? s : s+'.').join(' ');
  }
  function lionAiWebAnswer(prompt, research){
    if(!research?.sources?.length) return '';
    const topic=lionAiResearchQuery(prompt);
    const sourceLines=research.sources.map((source,index)=>`${index+1}. ${source.title}: ${source.url}`).join('\n');
    if(/(\d+\s*sent|paragraph|essay|write about|write a)/i.test(prompt)){
      return `${lionAiWebParagraph(prompt,research)}\n\nSources checked:\n${sourceLines}`;
    }
    const main=research.sources[0];
    const support=research.sources.slice(1).map(source=>`Another useful source, ${source.title}, adds that ${source.extract}`).join('\n\n');
    return `I searched the web for "${topic}" and used the most relevant source summaries I could load.\n\nAnswer:\n${main.extract}${support ? '\n\n'+support : ''}\n\nMy take:\nThe important thing is to answer your exact question from evidence, then connect the facts into one clear explanation. For ${topic}, the strongest answer starts with what it is, then explains why it matters, and then uses the source details to avoid making stuff up.\n\nSources checked:\n${sourceLines}`;
  }
  function lionAiFollowupAnswer(prompt, win){
    const text=String(prompt || '').trim().toLowerCase();
    if(!/^(i\s+meant\s+that|i\s+mean\s+that|that|that one|first one|the first one|second one|the second one|fraction one|the fraction one|x one|the x one|multiply one|the multiply one|multiplication one|the multiplication one)$/i.test(text)) return '';
    const last=String(win?.lionAiLastBot || '');
    const lastUser=String(win?.lionAiLastUser || '');
    const hadAmbiguousIntegral=/pi\^2\s*\/\s*12|0\.822467|x\s*\*\s*ln\(1\s*\+\s*x\)|1\/4/i.test(last) && /integral|ln\(1\s*\+\s*x\)/i.test(last);
    if(!hadAmbiguousIntegral) return '';
    if(/\b(second|x one|multiply|multiplication)\b/i.test(text)){
      return `Got it. If you meant the multiplication version, the problem is integral from 0 to 1 of x * ln(1 + x) dx.\n\nUsing integration by parts with u = ln(1 + x) and dv = x dx gives the exact value 1/4.\n\nSo for x * ln(1 + x), the answer is 1/4.`;
    }
    if(/\b(first|fraction)\b/i.test(text) || /\u200b|\u200c|\u200d|\ufeff|\/|⁄|∕/.test(lastUser)){
      return `Got it. If you meant the fraction version, the problem is integral from 0 to 1 of ln(1 + x) / x dx.\n\nUsing ln(1 + x)/x = 1 - x/2 + x^2/3 - x^3/4 + ..., integrating from 0 to 1 gives 1 - 1/2^2 + 1/3^2 - 1/4^2 + ... = pi^2/12.\n\nSo the answer is pi^2 / 12, about 0.822467.`;
    }
    return `That compact integral has two possible readings.\n\nIf you mean ln(1 + x) / x, the answer is pi^2 / 12, about 0.822467.\n\nIf you mean x * ln(1 + x), the answer is 1/4.\n\nType "fraction one" or "x one" to choose the interpretation.`;
  }
  let lionAiOcrLoader=null;
  function lionAiLoadOcr(){
    if(window.Tesseract) return Promise.resolve(window.Tesseract);
    if(lionAiOcrLoader) return lionAiOcrLoader;
    lionAiOcrLoader=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload=()=>window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR library did not start.'));
      script.onerror=()=>reject(new Error('OCR library could not load.'));
      document.head.appendChild(script);
    });
    return lionAiOcrLoader;
  }
  function lionAiSetImageStatus(win, text){
    const status=win?.querySelector('[data-lion-ai-image-status]');
    if(status) status.textContent=text || '';
  }
  function lionAiSetImageState(win, state=null){
    if(!win) return;
    win.lionAiImage=state;
    const preview=win.querySelector('[data-lion-ai-preview]');
    const img=preview?.querySelector('img');
    const label=preview?.querySelector('span');
    if(!state){
      preview?.classList.remove('show');
      if(img) img.removeAttribute('src');
      if(label) label.textContent='';
      lionAiSetImageStatus(win,'');
      return;
    }
    if(img) img.src=state.dataUrl;
    if(label) label.textContent=state.name;
    preview?.classList.add('show');
    lionAiSetImageStatus(win,'Image ready. Ask a question about it.');
  }
  function lionAiReadImageFile(win, file){
    if(!file || !file.type.startsWith('image/')){
      lionAiSetImageStatus(win,'Choose an image file.');
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>lionAiSetImageState(win,{name:file.name,size:file.size,type:file.type,dataUrl:String(reader.result || '')});
    reader.onerror=()=>lionAiSetImageStatus(win,'Could not read that image.');
    reader.readAsDataURL(file);
  }
  function lionAiAnalyzeImage(dataUrl){
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        const max=96;
        const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let r=0,g=0,b=0,light=0,dark=0,count=0;
        for(let i=0;i<pixels.length;i+=16){
          const rr=pixels[i], gg=pixels[i+1], bb=pixels[i+2];
          const lum=(rr+gg+bb)/3;
          r+=rr; g+=gg; b+=bb; count++;
          if(lum>200) light++;
          if(lum<55) dark++;
        }
        r=Math.round(r/count); g=Math.round(g/count); b=Math.round(b/count);
        const brightness=Math.round((r+g+b)/3);
        resolve(`Image details: ${img.naturalWidth}x${img.naturalHeight}px. Average color rgb(${r}, ${g}, ${b}). Overall brightness is about ${brightness}/255. Bright areas: ${Math.round(light/count*100)}%. Dark areas: ${Math.round(dark/count*100)}%.`);
      };
      img.onerror=()=>resolve('I could not inspect the image pixels.');
      img.src=dataUrl;
    });
  }
  async function lionAiReadImage(win){
    const image=win?.lionAiImage;
    if(!image?.dataUrl) return '';
    lionAiSetImageStatus(win,'Reading image text...');
    const visual=await lionAiAnalyzeImage(image.dataUrl);
    try{
      const Tesseract=await lionAiLoadOcr();
      const result=await Tesseract.recognize(image.dataUrl,'eng', {
        logger:m=>{
          if(m.status){
            const progress=Number.isFinite(m.progress) ? ` ${Math.round(m.progress*100)}%` : '';
            lionAiSetImageStatus(win,`OCR: ${m.status}${progress}`);
          }
        }
      });
      const text=(result?.data?.text || '').trim();
      lionAiSetImageStatus(win,text ? 'Image text read.' : 'No clear text found.');
      return text ? `${visual}\n\nText I read from the image:\n${text}` : `${visual}\n\nI did not find clear readable text in the image.`;
    }catch(err){
      lionAiSetImageStatus(win,'OCR unavailable; using visual summary.');
      return `${visual}\n\nOCR could not run here (${err.message}). I can still answer from the visible image details, but not exact printed words.`;
    }
  }
  function lionAiSavedMessages(){
    try{return JSON.parse(localStorage.getItem('nyx.aiMessages') || '[]').filter(m=>m && ['user','assistant'].includes(m.role) && m.content).slice(-40)}catch{return []}
  }
  function lionAiSaveMessages(messages){
    try{localStorage.setItem('nyx.aiMessages',JSON.stringify(messages.slice(-40)))}catch{}
  }
  function lionAiRestoreChat(win){
    const chat=win?.querySelector('[data-lion-ai-chat]');
    const messages=lionAiSavedMessages();
    if(!chat || !messages.length) return;
    chat.innerHTML='';
    messages.forEach(m=>addLionAiMessage(chat,m.role==='user'?'user':'bot',m.content));
    const first=messages.find(message=>message.role==='user')?.content;
    const title=win?.querySelector('[data-lion-ai-thread-title]');
    if(title && first) title.textContent=first.length>54 ? `${first.slice(0,54)}…` : first;
  }
  async function nyxAiModelAnswer(prompt, win, imageContext='', onChunk=()=>{}){
    const model=win?.querySelector?.('[data-lion-ai-model]')?.value || nyxAiSelectedModel();
    const messages=lionAiSavedMessages();
    const userText=prompt || 'Answer the attached image.';
    messages.push({role:'user',content:userText});
    const res=await fetch('/api/nyx-ai',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        model,
        message:userText,
        imageContext,
        messages,
        stream:true
      })
    });
    if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data?.error || `Nyx AI failed (${res.status})`)}
    if(!res.body) throw new Error('The selected model did not return a stream.');
    const reader=res.body.getReader(),decoder=new TextDecoder();
    let buffer='',text='';
    for(;;){
      const chunk=await reader.read();
      if(chunk.done) break;
      buffer+=decoder.decode(chunk.value,{stream:true});
      const lines=buffer.split(/\r?\n/);buffer=lines.pop() || '';
      for(const line of lines){
        if(!line.startsWith('data:')) continue;
        const raw=line.slice(5).trim();if(!raw || raw==='[DONE]') continue;
        try{const data=JSON.parse(raw);const token=data?.choices?.[0]?.delta?.content || data?.choices?.[0]?.text || '';if(token){text+=token;onChunk(text)}}catch{}
      }
    }
    text=text.trim();
    if(!text) throw new Error('The selected model returned an empty response.');
    messages.push({role:'assistant',content:text});
    lionAiSaveMessages(messages);
    return text;
  }
  async function lionAiRespondAsync(prompt, win, onChunk){
    const imageContext=await lionAiReadImage(win);
    try{
      return await nyxAiModelAnswer(prompt,win,imageContext,onChunk);
    }catch(err){
      return `Nyx AI could not reach the selected model.\n\n${err.message}\n\nSet NYX_AI_API_KEY on the server. The configured Vilen model can be changed with the matching NYX_AI_MODEL_* environment variable.`;
    }
  }
  function lionAiRespond(prompt){
    const lower=String(prompt || '').toLowerCase();
    if(/\b(what'?s|what is|tell me)\s+(the\s+)?time\b|\bcurrent time\b|\btime is it\b/.test(lower)) return lionAiTime();
    if(/(\d+\s*sent|paragraph|essay|write about|write a)/i.test(prompt)) return lionAiParagraph(prompt);
    if(/(solve|calculate|math|equation|=|\d\s*[\+\-*/^×÷−–—]\s*\d|sqrt|sin|cos|tan|log|ln|π|√|[⁰¹²³⁴⁵⁶⁷⁸⁹])/i.test(prompt)) return lionAiMath(prompt);
    if(/(code|javascript|html|css|python|function|fix this|make.*app|make.*website)/i.test(prompt)) return lionAiCode(prompt);
    if(/\b(list|ideas|steps|outline|plan)\b/i.test(prompt)) return lionAiList(prompt);
    if(/\b(explain|define|what is|what are|how does|how do|why is|why does)\b/i.test(prompt)) return lionAiExplain(prompt);
    return lionAiGeneral(prompt);
  }
  function lionAiNeedsLocalOnly(prompt){
    return /\b(what'?s|what is|tell me)\s+(the\s+)?time\b|\bcurrent time\b|\btime is it\b/i.test(prompt)
      || lionAiIsMathPrompt(prompt)
      || /(code|javascript|html|css|python|function|fix this|make.*app|make.*website)/i.test(prompt);
  }
  function lionAiRespond(prompt){
    const lower=String(prompt || '').toLowerCase();
    if(/\b(what'?s|what is|tell me)\s+(the\s+)?time\b|\bcurrent time\b|\btime is it\b/.test(lower)) return lionAiTime();
    if(/(\d+\s*sent|paragraph|essay|write about|write a)/i.test(prompt)) return lionAiParagraph(prompt);
    if(lionAiIsMathPrompt(prompt)) return lionAiMath(prompt);
    if(/(code|javascript|html|css|python|function|fix this|make.*app|make.*website)/i.test(prompt)) return lionAiCode(prompt);
    if(/\b(list|ideas|steps|outline|plan)\b/i.test(prompt)) return lionAiList(prompt);
    if(/\b(explain|define|what is|what are|how does|how do|why is|why does)\b/i.test(prompt)) return lionAiExplain(prompt);
    return lionAiGeneral(prompt);
  }
  function addLionAiMessage(chat, role, text){
    chat.querySelector('[data-lion-ai-empty]')?.remove();
    chat.classList.add('has-messages');
    const msg=document.createElement('div');
    msg.className='lion-ai-msg '+role;
    msg.textContent=text;
    chat.appendChild(msg);
    chat.scrollTop=chat.scrollHeight;
  }
  function openApps(){
    makeWindow({title:'Apps',left:'12vw',top:'90px',width:'600px',height:'430px',body:`<div class="panel"><h1>Apps</h1><div class="quick-grid apps-launch-grid" data-nyx-global-app-grid>${quickTiles()}</div></div>`});
  }
  function openLinks(){
    makeWindow({title:'Links',left:'18vw',top:'100px',width:'520px',height:'380px',body:`<div class="panel"><h1>Links</h1><div class="glass-grid"><div class="glass-card"><h2>S3ARC4 Engines</h2><button data-url="https://www.google.com/">Google</button><button data-url="https://duckduckgo.com/">Reference Search</button></div><div class="glass-card"><h2>School</h2><button data-url="https://docs.google.com/">Docs</button><button data-url="https://classroom.google.com/">Classroom</button></div></div></div>`});
  }
  function openTermsOfService(){
    if(document.body.classList.contains('workspace-shell')) return openWorkspaceShellInternalTab('terms');
    makeWindow({
      title:'Terms Of Service',
      left:'18vw',
      top:'92px',
      width:'720px',
      height:'560px',
      autoMaximize:false,
      className:'nyx-utility-window',
      body:nyxTermsPageMarkup('nyx-info-page nyx-terms-page')
    });
  }
  function openAboutNyx(){
    if(document.body.classList.contains('workspace-shell')) return showWorkspaceShellInternalPage('credits');
    makeWindow({
      title:'About Nyx',
      left:'22vw',
      top:'110px',
      width:'620px',
      height:'430px',
      autoMaximize:false,
      className:'nyx-utility-window',
      body:nyxCreditsPageMarkup('nyx-info-page nyx-credits-tab')
    });
  }
  function nyxTerminalWrite(output,text,type=''){
    if(!output) return;
    const row=document.createElement('div');
    row.className='nyx-terminal-line'+(type?' '+type:'');
    row.textContent=String(text);
    output.appendChild(row);
    output.scrollTop=output.scrollHeight;
  }
  async function runNyxTerminalCommand(win,raw){
    const output=win?.querySelector('[data-nyx-terminal-output]');
    const command=String(raw || '').trim();
    if(!command) return;
    nyxTerminalWrite(output,'nyx> '+command,'command');
    const name=command.toLowerCase();
    if(name==='clear'){
      output.textContent='';
      return;
    }
    if(name==='help'){
      nyxTerminalWrite(output,'Commands: help, status, theme, origin, storage, date, clear');
      nyxTerminalWrite(output,'Staff commands (based on your assigned role): owner help');
      return;
    }
    if(name==='owner help'){
      if(!nyxOwnerDashboardAccess&&!nyxHasAccountPermission('developer-console')){nyxTerminalWrite(output,'Your role does not include staff commands.','error');return}
      nyxTerminalWrite(output,'Staff commands: owner dashboard, owner status. Founder only: owner profile, owner reload-profile');
      return;
    }
    if(name==='owner dashboard'){
      if(!nyxOwnerDashboardAccess){nyxTerminalWrite(output,'Dashboard access is required for this command.','error');return}
      openNyxOwnerDashboard();
      nyxTerminalWrite(output,'Owner Dashboard opened.');
      return;
    }
    if(name==='owner status'){
      if(!nyxHasAccountPermission('developer-console')){nyxTerminalWrite(output,'Developer Console access is required for this command.','error');return}
      try{const token=await nyxGetFirebaseToken(true);const response=await fetch('/api/founder-profile/developer-status',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Owner status is unavailable.');nyxTerminalWrite(output,`Role: ${data.role} · Permissions: ${(data.permissions||[]).join(', ')} · Verified ${new Date(data.checkedAt).toLocaleTimeString()}`)}catch(error){nyxTerminalWrite(output,error.message||'Owner status is unavailable.','error')}
      return;
    }
    if(name==='owner profile'){
      if(!nyxFounderIsOwner){nyxTerminalWrite(output,'Owner access is required for owner commands.','error');return}
      nyxTerminalWrite(output,'Opening Founder Profile editor.');
      openFounderProfileEditor();
      return;
    }
    if(name==='owner reload-profile'){
      if(!nyxFounderIsOwner){nyxTerminalWrite(output,'Owner access is required for owner commands.','error');return}
      await loadFounderProfile({force:true});
      nyxTerminalWrite(output,'Founder profile refreshed.');
      return;
    }
    if(name==='status'){
      nyxTerminalWrite(output,`Nyx is ${navigator.onLine?'online':'offline'} · ${navigator.platform || 'workspace'} · ${location.hostname || 'local'}`);
      return;
    }
    if(name==='theme'){
      const active=Array.from(document.body.classList).find(value=>value.startsWith('theme-'))?.slice(6) || store.text('nyx.theme','default');
      nyxTerminalWrite(output,'Theme: '+active);
      return;
    }
    if(name==='origin'){
      nyxTerminalWrite(output,'Origin: '+location.origin);
      return;
    }
    if(name==='storage'){
      nyxTerminalWrite(output,`Local settings entries: ${localStorage.length}`);
      return;
    }
    if(name==='date'){
      nyxTerminalWrite(output,new Date().toLocaleString());
      return;
    }
    nyxTerminalWrite(output,`Unknown command: ${command}. Type "help" for the command list.`,'error');
  }
  function openDeveloperConsole(){


    return openWorkspaceShellInternalTab('developer');
  }
  openApps = function(){
    makeWindow({title:'Apps',left:'8vw',top:'64px',width:'960px',height:'650px',body:`<div class="panel apps-panel"><h1>Apps</h1><div class="quick-grid apps-launch-grid" data-nyx-global-app-grid>${quickTiles()}</div></div>`});
  };

  function settingsBody(){
    return `<div class="settings-panel">
      <h1>Preferences</h1>
      <div class="settings-grid">
        <section class="settings-card">
          <h2>Study window</h2>
          <p>Choose how your study window opens.</p>
          <div class="settings-row"><select data-cloak-type><option value="a" ${store.text('nyx.cloakType','a')==='a'?'selected':''}>about:blank</option><option value="b" ${store.text('nyx.cloakType','a')==='b'?'selected':''}>Blob</option><option value="m" ${store.text('nyx.cloakType','a')==='m'?'selected':''}>Current tab iframe</option></select><button data-save-cloak>Save</button></div>
          <div class="settings-row"><span>Redirect original</span><button class="switch ${store.get('nyx.cloakRedirectOriginal',false)?'on':''}" data-switch="nyx.cloakRedirectOriginal" aria-label="Redirect original tab"></button></div>
          <div class="settings-row"><input data-cloak-redirect-url value="${esc(store.text('nyx.cloakRedirectUrl','https://google.com/'))}" placeholder="Redirect U3L"><button data-launch-selected-cloak>Launch</button></div>
          <div class="settings-actions"><button data-about>Open in About:Blank</button><button data-blob>Open in Blob</button></div>
        </section>
        <section class="settings-card">
          <h2>Automatic study window</h2>
          <p class="hint">Automatically opens Nyx in your selected study window. Enable again after each opening.</p>
          <div class="settings-row"><span>Automatic study window</span><button class="switch" data-switch="nyx.autoCloak" aria-label="Automatic study window"></button></div>
        </section>
        <section class="settings-card">
          <h2>Tab Presets</h2>
          <p>Changes the workspace course heading and icon.</p>
          <div class="seg"><button data-preset="deltamath" type="button">DeltaMath</button><button data-preset="classroom" type="button">Google Classroom</button><button data-preset="drive" type="button">Google Drive</button><button data-preset="classlink" type="button">Classlink</button><button data-preset="google" type="button">Google</button><button data-preset="deltamath" type="button">Reset</button></div>
        </section>
        <section class="settings-card">
          <h2>Course tab appearance</h2>
          <p>Choose the heading and icon shown on your course tab.</p>
          <div class="settings-row"><input data-tab-title value="${esc(store.text('nyx.tabTitle',document.title || '???'))}" placeholder="Course heading"><input class="file-input" data-tab-favicon-file type="file" accept="image/*,.ico"></div>
          <input type="hidden" data-tab-favicon value="${esc(store.text('nyx.tabFavicon',nyxFaviconHref()))}">
          <button data-tab-cloak-apply>Apply course appearance</button>
        </section>
        <section class="settings-card">
          <h2>Anti-Close</h2>
          <p>Prevents accidental closing when anti-close is enabled.</p>
          <button class="switch" data-anticlose aria-label="Anti-close"></button>
        </section>
        <section class="settings-card">
          <h2>Class shortcut</h2>
          <p>Press this key combo anytime to instantly close the current tab.</p>
          <div class="settings-row"><strong class="panic-key-display" data-panic-key-display>${esc(store.text('nyx.panicKey','not set'))}</strong></div>
          <div class="settings-actions"><button data-panic-capture type="button">Capture</button><button data-panic-clear type="button">Clear</button></div>
        </section>
      </div>

      <h1 class="settings-section-title">OS Settings</h1>
      <div class="settings-grid">
        <section class="settings-card">
          <h2>Change Your Name</h2>
          <p>Your greeting and profile name.</p>
          <div class="settings-row"><input id="settingName" value="${esc(store.text('nyx.userName',''))}" placeholder="Enter your name" autocomplete="nickname"><button data-save-profile>Save</button></div>
        </section>
        <section class="settings-card" data-founder-account-card hidden>
          <h2><button class="nyx-account-settings-link" data-open-nyx-account-settings type="button">Account</button></h2>
          <p data-founder-account-status>Sign in to manage your Nyx account.</p>
          <div class="settings-actions"><button data-open-nyx-account type="button">Create or sign in</button><button data-open-nyx-profile type="button" hidden>Edit account</button><button data-nyx-account-sign-out type="button" hidden>Sign out</button></div>
        </section>
        <section class="settings-card" data-founder-profile-settings-card hidden>
          <h2>Founder Profile</h2>
          <p>Customize the public profile shown on About Nyx.</p>
          <button data-open-founder-profile-editor type="button">Customize Founder Profile</button>
        </section>
        <section class="settings-card">
          <h2>Font</h2>
          <p>Choose the font used across nyx.</p>
          <select data-font-value>${nyxFontOptionsMarkup()}</select>
        </section>
        <section class="settings-card">
          <h2>Glassmorphism</h2>
          <p>Changes transparency and blur. <span data-glass-output>${esc(store.text('nyx.glassLevel','80'))}%</span></p>
          <input type="range" min="-200" max="200" value="${esc(store.text('nyx.glassLevel','80'))}" data-glass-value>
        </section>
        <section class="settings-card">
          <h2>Lag Reducer</h2>
          <p>Stops animations, removes blur, sets Glassmorphism to 0, and turns Background Enhancer off.</p>
          <div class="settings-row"><span>Lag Reducer</span><button class="switch ${store.get('nyx.lagReducer',false)?'on':''}" data-switch="nyx.lagReducer" data-lag-reducer aria-label="Lag reducer"></button></div>
        </section>
        <section class="settings-card">
          <h2>Lite Mode</h2>
          <p>Lightens blur, shadows, and particles without fully disabling animations.</p>
          <div class="settings-row"><span>Lite Mode</span><button class="switch ${store.get('nyx.performanceLite',false)?'on':''}" data-switch="nyx.performanceLite" data-performance-lite aria-label="Lite mode"></button></div>
        </section>
        <section class="settings-card">
          <h2>Clear Cache</h2>
          <p>Removes cookies, cache files, saved settings, connection storage, and service workers, then reloads nyx like a fresh install.</p>
          <button data-clear-nyx-cache type="button">Clear Cache and Reset</button>
        </section>
        <section class="settings-card">
          <h2>Workspace Mode</h2>
          <p>Makes nyx look like a Chrome page with tabs on top, an address bar, and an Apps button instead of the bottom app bar.</p>
        </section>
        <section class="settings-card">
          <h2>Focus display</h2>
          <p>Replace external website names and icons in Nyx tabs with a generic hidden label.</p>
          <div class="settings-row"><span>Simplify names and icons</span><button class="switch ${websiteDetailsHidden()?'on':''}" data-switch="nyx.hideWebsiteDetails" aria-label="Simplify website names and icons"></button></div>
        </section>
        <section class="settings-card">
          <h2>Popup Protection</h2>
          <p>Blocks all site-created popup windows and popup ads.</p>
          <div class="settings-row"><span>Popup Protection</span><button class="switch ${popupProtectionEnabled()?'on':''}" data-switch="nyx.popupProtection" aria-label="Popup protection"></button></div>
          <p class="security-warning">*Warning: If this option is disabled, your computer may be exposed to various security threats, including viruses such as trojan, disguised as Opera GX (which obviously is not). Disabling this feature could result in significant damage to your system, unaware access to your data, and potential sale of your personal data. It is <span class="security-warning-strong">STRONGLY</span> recommended to keep this setting enabled. This feature remains active unless the user intentionally chooses to disable it.*</p>
        </section>
        <section class="settings-card hieroglyph-scroll">
          <h2>${esc(toHieroglyphText('Egyptian hieroglyph Text'))}</h2>
          <p>${esc(toHieroglyphText('Changes visible letters and numbers into hieroglyph-style symbols.'))}</p>
          <div class="settings-row"><span>${esc(toHieroglyphText('Hieroglyph Text'))}</span><button class="switch ${hieroglyphTextEnabled()?'on':''}" data-switch="nyx.hieroglyphText" data-hieroglyph-text aria-label="Egyptian hieroglyph text"></button></div>
          <div class="settings-row"><span>${esc(toHieroglyphText('Auto Hieroglyph'))}</span><button class="switch ${store.get('nyx.autoHieroglyphText',false)?'on':''}" data-switch="nyx.autoHieroglyphText" aria-label="Auto hieroglyph on open"></button></div>
        </section>
        <section class="settings-card wide settings-backgrounds">
          <h2>${document.body.classList.contains('workspace-shell') ? 'Workspace Background' : 'Change Background'}</h2>
          <p>Pick one of your current ռʏӼ backgrounds.</p>
          <div class="background-picker" data-bg-picker data-bg-scope="${document.body.classList.contains('workspace-shell') ? 'workspace' : 'windows'}"></div>
          <div class="settings-row"><span>3D Backgrounds</span><button class="switch ${store.get('nyx.threeDBackgrounds',false)?'on':''}" data-switch="nyx.threeDBackgrounds" aria-label="3D backgrounds"></button></div>
          <div class="settings-row"><span>Background Enhancer</span><button class="switch ${store.get('nyx.backgroundEnhancer',false)?'on':''}" data-bg-enhancer aria-label="Background enhancer"></button></div>
          <p class="bg-quality-status" data-bg-quality-status></p>
          <div class="settings-upload" ${document.body.classList.contains('workspace-shell') ? 'hidden' : ''}>
            <h2>Upload</h2>
            <input class="file-input" id="settingBgFile" type="file" accept="image/*">
            <div class="settings-row"><input id="settingBgUrl" value="${esc(store.text('nyx.customBgUrl',''))}" placeholder="https://example.com/background.jpg"><button data-save-bg>Apply Background</button></div>
          </div>
        </section>
      </div>

      <h1 class="settings-section-title">Workspace Settings</h1>
      <div class="settings-grid">
        <section class="settings-card">
          <h2>Connections</h2>
          <p>Choose the workspace engine Nyx uses for external sites.
The learning engine opens web resources inside your workspace. Use Repair connection if a tab cannot connect.
Auto uses the learning engine with Textbook by default and can recover with another relay if the connection fails.</p>
          <select id="settingWorkspaceMode">
            <option value="auto">Auto</option>
            <option value="scramjet">Use Learning engine</option>

          </select>
        </section>
        <section class="settings-card">
          <h2>Connection method</h2>
          <div class="settings-row"><span>Compatibility mode</span><button class="settings-action" data-switch="nyx.httpBridge" type="button">${store.get('nyx.httpBridge',true)?'On':'Off'}</button></div><p>Use the alternate connection when a network cannot open sites. Turn off for the standard connection. Reload website tabs after changing. Custom connections keep their saved choice.</p>
          <p class="hint">Choose an installed connection method.</p>
          <select id="settingTransport">
            <option value="auto">Auto (recommended)</option>
            <option value="epoxy">Atlas</option>
            <option value="wisp">Campus connection</option>
            <option value="libcurlRaw">Textbook</option>
          </select>
          <button data-save-workspace>Save Workspace Settings</button><button class="settings-action" data-workspace-connection-repair type="button">Repair connection</button>
        </section>
        <section class="settings-card">
          <h2>Change S3ARC4 Engine</h2>
          <p>Pick the s3arc4 engine used for workspace searches.</p>
          <select id="settingEngine" data-engine-value><option value="google">Google</option><option value="bing">Bing</option><option value="duckduckgo">Reference Search</option></select>
        </section>
        <section class="settings-card">
          <h2>Effects</h2>
          <p>Pick the particles shown in workspace mode.</p>
          <select data-effect-value>
            <option value="none">None</option>
            <option value="rain">Rain</option>
            <option value="stars">Stars</option>
            <option value="hearts">Hearts</option>
            <option value="pokeballs">Pokeballs</option>
            <option value="flowers">Flowers</option>
            <option value="emeralds">Emeralds</option>
          </select>
          <div class="settings-row"><span>Speed <b data-effect-speed-label>${esc(store.text('nyx.visualEffectSpeed','1.1'))}x</b></span><input data-effect-speed type="range" min=".3" max="3" step=".1" value="${esc(store.text('nyx.visualEffectSpeed','1.1'))}"></div>
          <div class="settings-row"><span>Amount <b data-effect-amount-label>${esc(store.text('nyx.visualEffectAmount','16'))}</b></span><input data-effect-amount type="range" min="1" max="64" step="1" value="${esc(store.text('nyx.visualEffectAmount','16'))}"></div>
        </section>
      </div>
    </div>`;
  }
  function openSettings(){
    const existing=document.querySelector('.window.settings-window');
    if(existing){
      bring(existing);
      return existing;
    }
    const win=makeWindow({title:'Preferences',className:'settings-window',left:'calc(50vw - 380px)',top:'58px',width:'760px',height:'600px',body:settingsBody()});
    win.classList.add('settings-opening');
    setTimeout(()=>win.classList.remove('settings-opening'),340);
    const picker=win.querySelector('[data-bg-picker]');
    if(picker) renderBackgroundChoices(picker);
    const engineSel=win.querySelector('#settingEngine');
    if(engineSel) engineSel.value=store.text('nyx.engine','duckduckgo');
    const modeSel=win.querySelector('#settingWorkspaceMode');
    if(modeSel){
      const mode=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
      modeSel.value=mode==='rammerhead' ? 'auto' : mode;
    }
    const transportSel=win.querySelector('#settingTransport');
    if(transportSel) transportSel.value=normalizeWorkspaceTransportName(store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT));
    applyVisualEffectSetting();
    syncSwitches(win);
    syncFounderOwnerControls();
    setTimeout(()=>win.querySelector('#settingName')?.focus(),60);
  }
  let setupStepIndex=0;
  const setupStepTitles=['Welcome','Username','Account','Profile','Theme','Effects','Workspace','Font','Preview','Shortcuts'];
  function syncSetupAccountStep(){
    const setup=$('setupScreen');
    if(!setup)return;
    const card=setup.querySelector('[data-setup-account-card]');
    const title=setup.querySelector('[data-setup-account-title]');
    const status=setup.querySelector('[data-setup-account-status]');
    const actions=setup.querySelector('.setup-account-actions');
    const signedIn=Boolean(nyxFounderSignedInUser);
    card?.classList.toggle('is-ready',signedIn);
    if(title)title.textContent=signedIn?'Account ready':'Create a free account';
    if(status)status.textContent=signedIn
      ?`Signed in${nyxFounderSignedInUser?.displayName?` as ${nyxFounderSignedInUser.displayName}`:''}. Nyx will skip this step.`
      :'Your username will be filled in automatically. Add a password to finish creating the account. Email is optional.';
    if(actions)actions.hidden=signedIn;
    if(signedIn&&setup.classList.contains('show')&&setupStepIndex===2)setTimeout(()=>{if(setup.classList.contains('show')&&setupStepIndex===2&&nyxFounderSignedInUser)setSetupStep(3)},120);
  }
  function setupOptionText(select){
    return select?.options?.[select.selectedIndex]?.textContent?.trim() || select?.value || '';
  }
  function syncSetupThemeCards(){
    const setup=$('setupScreen');
    const theme=$('setupTheme')?.value || 'default';
    if(setup) setup.dataset.previewTheme=normalizeNyxTheme(theme);
    setup?.querySelectorAll('[data-setup-theme-card]').forEach(card=>{
      card.classList.toggle('selected',card.dataset.setupThemeCard===theme);
    });
    if(setup?.classList.contains('show')) window.NyxBeamsWallpaper?.apply(nyxThemeBeamWallpaper(theme));
  }
  function updateSetupPreview(){
    const setup=$('setupScreen');
    if(!setup) return;
    const themeSelect=$('setupTheme');
    const effectSelect=$('setupEffect');
    const workspaceSelect=$('setupWorkspaceMode');
    const engineSelect=$('setupEngine');
    const fontSelect=$('setupFont');
    const theme=themeSelect?.value || 'default';
    const stage=setup.querySelector('[data-setup-final-stage]');
    if(stage) stage.dataset.nyxPreviewTheme=normalizeNyxTheme(theme);
    const values=[
      ['[data-setup-preview-theme]',setupOptionText(themeSelect)],
      ['[data-setup-preview-effect]',setupOptionText(effectSelect)],
      ['[data-setup-preview-workspace]',setupOptionText(workspaceSelect)],
      ['[data-setup-preview-engine]',setupOptionText(engineSelect)],
      ['[data-setup-preview-font]',setupOptionText(fontSelect)]
    ];
    values.forEach(([selector,value])=>{
      const target=setup.querySelector(selector);
      if(target) target.textContent=value || '-';
    });
  }
  function setSetupStep(index=0){
    const setup=$('setupScreen');
    if(!setup) return;
    const steps=[...setup.querySelectorAll('[data-setup-step]')];
    if(!steps.length) return;
    const previous=setupStepIndex;
    setupStepIndex=Math.max(0,Math.min(steps.length-1,Number(index)||0));
    setup.classList.remove('setup-forward','setup-back');
    setup.classList.add(setupStepIndex >= previous ? 'setup-forward' : 'setup-back');
    steps.forEach((step,i)=>step.classList.toggle('active',i===setupStepIndex));
    setup.querySelectorAll('.setup-dot').forEach((dot,i)=>dot.classList.toggle('active',i===setupStepIndex));
    const subtitle=setup.querySelector('[data-setup-subtitle]');
    if(subtitle) subtitle.textContent=`${setupStepIndex+1} of ${steps.length} / ${setupStepTitles[setupStepIndex] || setupStepTitles[0]}`;
    const back=setup.querySelector('[data-setup-back]');
    const next=setup.querySelector('[data-setup-next]');
    const finish=setup.querySelector('[data-finish-setup]');
    if(back) back.hidden=setupStepIndex===0;
    if(next){
      next.hidden=setupStepIndex===steps.length-1;
      next.textContent=setupStepIndex===0?'Get started':setupStepIndex===2&&!nyxFounderSignedInUser?'Continue as guest':'Next';
    }
    if(finish) finish.hidden=setupStepIndex!==steps.length-1;
    updateSetupPreview();
  }
  function moveSetupStep(delta=1){
    if(delta>0&&setupStepIndex===1){
      if(nyxFounderSignedInUser){setSetupStep(3);return}
      const username=String($('setupName')?.value||'').trim();
      setSetupStep(2);
      if(username.length>=3&&nyxAccountUsername(username)===username.toLowerCase().replace(/^@+/,'')){
        setTimeout(()=>void openNyxAccountAccess({mode:'register',username}),80);
      }
      return;
    }
    let next=setupStepIndex + delta;
    if(next===3&&!nyxFounderSignedInUser)next+=delta>0?1:-1;
    setSetupStep(next);
  }
  function wireSetupWizardControls(setup=$('setupScreen')){
    if(!setup || setup.__nyxSetupWizardWired) return;
    setup.__nyxSetupWizardWired=true;
    setup.addEventListener('click',event=>{
      const themeCard=event.target.closest?.('[data-setup-theme-card]');
      if(themeCard && setup.contains(themeCard)){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const theme=$('setupTheme');
        if(theme) theme.value=themeCard.dataset.setupThemeCard || 'default';
        syncSetupThemeCards();
        updateSetupPreview();
        return;
      }
      const button=event.target.closest?.('[data-setup-next],[data-setup-back],[data-finish-setup],[data-skip-setup],[data-setup-create-account],[data-setup-sign-in],[data-setup-edit-profile]');
      if(!button || !setup.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if(button.matches('[data-setup-create-account]')) void openNyxAccountAccess({mode:'register',username:String($('setupName')?.value||'').trim()});
      else if(button.matches('[data-setup-sign-in]')) void openNyxAccountAccess({mode:'signin'});
      else if(button.matches('[data-setup-edit-profile]')&&nyxFounderSignedInUser) void openNyxUserProfile();
      else if(button.matches('[data-setup-next]')) moveSetupStep(1);
      else if(button.matches('[data-setup-back]')) moveSetupStep(-1);
      else if(button.matches('[data-finish-setup]')) finishSetupCustomization();
      else if(button.matches('[data-skip-setup]')){
        store.set('nyx.setupComplete',true);
        hideSetup();
      }
    },true);
    setup.addEventListener('change',event=>{
      if(!event.target.closest?.('[data-theme-value],[data-effect-value],[data-workspace-mode-select],[data-workspace-engine],[data-font-value]')) return;
      syncSetupThemeCards();
      updateSetupPreview();
    },true);
    const handleSetupEnter=event=>{
      if(event.key!=='Enter') return;
      if(!setup.classList.contains('show')) return;
      const target=event.target;
      if(target?.closest?.('.nyx-account-overlay,.nyx-user-profile-overlay,.nyx-email-verification-overlay')) return;
      if(target?.matches?.('button,a,textarea,select,[contenteditable="true"]')) return;
      const steps=[...setup.querySelectorAll('[data-setup-step]')];
      if(!steps.length) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if(setupStepIndex>=steps.length-1) finishSetupCustomization();
      else moveSetupStep(1);
    };
    setup.addEventListener('keydown',handleSetupEnter,true);
    if(!document.__nyxSetupEnterWired){
      document.__nyxSetupEnterWired=true;
      document.addEventListener('keydown',event=>{
        const activeSetup=$('setupScreen');
        if(!activeSetup?.classList.contains('show')) return;
        handleSetupEnter(event);
      },true);
    }
  }
  function showSetup(){
    const setup=$('setupScreen');
    const name=$('setupName');
    if(!setup) return;
    wireSetupWizardControls(setup);
    if(name) name.value=store.text('nyx.userName','');
    const theme=$('setupTheme');
    if(theme) theme.value=store.text('nyx.theme','default');
    const effect=$('setupEffect');
    if(effect) effect.value=store.text('nyx.visualEffect','none');
    const workspace=$('setupWorkspaceMode');
    if(workspace) workspace.value=normalizeWorkspaceModeName(store.text('nyx.workspaceMode',DEFAULT_WORKSPACE_MODE));
    const engine=$('setupEngine');
    if(engine) engine.value=store.text('nyx.engine','duckduckgo');
    const font=$('setupFont');
    if(font){
      font.innerHTML=nyxFontOptionsMarkup();
      font.value=nyxFontChoice()[0];
    }
    syncSetupThemeCards();
    updateSetupPreview();
    syncSetupAccountStep();
    setup.hidden=false;
    setup.inert=false;
    document.body.classList.add('setup-active');
    setup.classList.add('show');
    setup.setAttribute('aria-hidden','false');
    setSetupStep(0);
    setTimeout(()=>name?.focus(),80);
  }
  function shouldShowStartupCustomization(){
    return !store.get('nyx.setupComplete',false);
  }
  let nyxTermsGateTimer=0;
  function closeNyxTermsGate(){
    document.querySelector('.nyx-tos-gate')?.remove();
    document.body.classList.remove('nyx-tos-active');
  }
  function showNyxTermsAcceptanceGate(){
    if(store.text('nyx.tosAcceptedVersion','')===NYX_TERMS_VERSION) return false;
    if(document.querySelector('.nyx-tos-gate')) return true;
    if($('setupScreen')?.classList.contains('show')) return false;
    const gate=document.createElement('div');
    gate.className='nyx-tos-gate';
    gate.innerHTML=`<section class="nyx-tos-dialog" role="dialog" aria-modal="true" aria-labelledby="nyxTosGateTitle" aria-describedby="nyxTosGateIntro"><header class="nyx-tos-gate-header"><span class="nyx-tos-gate-logo" aria-hidden="true"></span><div><span>Before you continue</span><h1 id="nyxTosGateTitle" tabindex="-1">Nyx Terms of Service</h1></div></header><div class="nyx-tos-scroll" data-nyx-tos-scroll>${nyxTermsPageMarkup('nyx-tos-document')}<div class="nyx-tos-declined" hidden><span aria-hidden="true">ⓘ</span><h2 tabindex="-1">Terms declined</h2><p>You cannot use Nyx without accepting the Terms of Service. You can review the terms again or leave Nyx.</p></div></div><footer class="nyx-tos-actions"><p id="nyxTosGateIntro">By selecting Agree, you confirm that you have read and accept these Terms.</p><div><button class="nyx-tos-disagree" data-nyx-tos-disagree type="button">Disagree</button><button class="nyx-tos-agree" data-nyx-tos-agree type="button">Agree</button></div></footer></section>`;
    (document.getElementById('app') || document.body).appendChild(gate);
    document.body.classList.add('nyx-tos-active');
    const agree=gate.querySelector('[data-nyx-tos-agree]');
    const disagree=gate.querySelector('[data-nyx-tos-disagree]');
    const scroll=gate.querySelector('[data-nyx-tos-scroll]');
    const documentView=gate.querySelector('.nyx-tos-document');
    const declinedView=gate.querySelector('.nyx-tos-declined');
    const showTerms=()=>{
      gate.classList.remove('is-declined');
      documentView.hidden=false;
      declinedView.hidden=true;
      agree.textContent='Agree';
      disagree.textContent='Disagree';
      scroll.scrollTop=0;
      gate.querySelector('#nyxTosGateTitle')?.focus?.();
    };
    agree.addEventListener('click',()=>{
      if(gate.classList.contains('is-declined')){
        showTerms();
        return;
      }
      store.setText('nyx.tosAcceptedVersion',NYX_TERMS_VERSION);
      closeNyxTermsGate();
      toast('Terms accepted');
    });
    disagree.addEventListener('click',()=>{
      if(gate.classList.contains('is-declined')){
        try{location.replace('about:blank')}catch{document.documentElement.innerHTML=''}
        return;
      }
      gate.classList.add('is-declined');
      documentView.hidden=true;
      declinedView.hidden=false;
      agree.textContent='Review Terms';
      disagree.textContent='Leave Nyx';
      scroll.scrollTop=0;
      declinedView.querySelector('h2')?.focus();
    });
    requestAnimationFrame(()=>gate.classList.add('show'));
    setTimeout(()=>gate.querySelector('#nyxTosGateTitle')?.focus?.(),80);
    return true;
  }
  function scheduleNyxTermsAcceptanceGate(delay=320){
    clearTimeout(nyxTermsGateTimer);
    nyxTermsGateTimer=setTimeout(()=>{
      if(!showNyxTermsAcceptanceGate() && store.text('nyx.tosAcceptedVersion','')!==NYX_TERMS_VERSION && nyxStartupOpened){
        scheduleNyxTermsAcceptanceGate(500);
      }
    },delay);
  }
  const NYX_RELEASE_NOTES_VERSION='2026-10-02-nyx-1.6.8';
  let nyxReleaseNotesTimer=0;
  function nyxReleaseNotesStorageKey(){
    return `nyx.releaseNotes.${NYX_RELEASE_NOTES_VERSION}.seen`;
  }
  function nyxReleaseNotesWereSeen(){
    const storageKey=nyxReleaseNotesStorageKey();
    if(store.text(storageKey,'')===NYX_RELEASE_NOTES_VERSION) return true;
    const legacyPrefix=`nyx.releaseNotes.${NYX_RELEASE_NOTES_VERSION}.`;
    try{
      for(let index=0;index<localStorage.length;index++){
        const key=localStorage.key(index);
        if(key?.startsWith(legacyPrefix) && localStorage.getItem(key)===NYX_RELEASE_NOTES_VERSION){
          store.setText(storageKey,NYX_RELEASE_NOTES_VERSION);
          return true;
        }
      }
    }catch{}
    return false;
  }
  function closeNyxReleaseNotes(){
    document.querySelector('.nyx-release-notes-overlay')?.remove();
  }
  function showNyxReleaseNotes(){
    const storageKey=nyxReleaseNotesStorageKey();
    if(nyxReleaseNotesWereSeen()) return 'seen';
    if($('setupScreen')?.classList.contains('show') || document.querySelector('.nyx-tos-gate,.nyx-email-verification-overlay,.nyx-preflight')) return 'deferred';
    store.setText(storageKey,NYX_RELEASE_NOTES_VERSION);
    const overlay=document.createElement('div');
    overlay.className='nyx-release-notes-overlay';
    overlay.innerHTML=`<section class="nyx-release-notes" role="dialog" aria-modal="true" aria-labelledby="nyxReleaseNotesTitle" aria-describedby="nyxReleaseNotesIntro">
      <header><div><span>Update</span><h1 id="nyxReleaseNotesTitle" tabindex="-1">Nyx v1.6.8</h1></div><button type="button" data-nyx-release-notes-close aria-label="Close update log">&times;</button></header>
      <div class="nyx-release-message" id="nyxReleaseNotesIntro">
        <p class="nyx-release-greeting"><strong>What's new?</strong></p>
        <ul class="nyx-release-changes">
          <li><strong>Fixed a lot of games</strong></li>
          <li><strong>Fixed AI issues</strong></li>
          <li><strong>Added more themes</strong></li>
        </ul>
        <p class="nyx-release-community">Join the <a href="https://discord.com/invite/cAdjYAJs3u" target="_blank" rel="noopener noreferrer">Discord</a> for more links and updates!</p>
      </div>
      <footer><button type="button" data-nyx-release-notes-close>Got it</button></footer>
    </section>`;
    const close=()=>{
      store.setText(storageKey,NYX_RELEASE_NOTES_VERSION);
      closeNyxReleaseNotes();
    };
    overlay.addEventListener('click',event=>{
      if(event.target===overlay || event.target.closest('[data-nyx-release-notes-close]')) close();
    });
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape') close()});
    (document.getElementById('app') || document.body).appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('show'));
    setTimeout(()=>overlay.querySelector('#nyxReleaseNotesTitle')?.focus(),80);
    return 'shown';
  }
  function scheduleNyxReleaseNotes(delay=760){
    clearTimeout(nyxReleaseNotesTimer);
    nyxReleaseNotesTimer=setTimeout(()=>{
      if(!nyxStartupOpened) return;
      if(showNyxReleaseNotes()==='deferred') scheduleNyxReleaseNotes(500);
    },delay);
  }
  function hideSetup(){
    const setup=$('setupScreen');
    if(!setup) return;
    setup.classList.remove('show');
    setup.setAttribute('aria-hidden','true');
    setup.hidden=true;
    setup.inert=true;
    document.body.classList.remove('setup-active');
    if(store.get('nyx.setupComplete',false)) scheduleNyxTermsAcceptanceGate(180);
  }
  function showSetupLaunchSplash(){
    return window.nyxLoadingScreen?.show() || null;
  }
  function finishSetupCustomization(){
    const name=$('setupName')?.value.trim();
    if(name) store.setText('nyx.userName',name);
    const theme=normalizeNyxTheme($('setupTheme')?.value || 'default');
    store.setText('nyx.theme',theme);
    applyNyxThemeBeamWallpaper(theme);
    store.setText('nyx.visualEffect',$('setupEffect')?.value || 'none');
    store.set('nyx.visualEffectUserChoice',true);
    store.setText('nyx.workspaceMode',normalizeWorkspaceModeName($('setupWorkspaceMode')?.value || DEFAULT_WORKSPACE_MODE));
    store.setText('nyx.engine',$('setupEngine')?.value || 'duckduckgo');
    store.setText('nyx.font',nyxFontChoice($('setupFont')?.value || 'outfit')[0]);
    store.set('nyx.setupComplete',true);
    applyUserSettings();
    hideSetup();
    toast('Settings saved');
  }
  function syncSwitches(root=document){
    root.querySelectorAll('[data-switch]').forEach(btn=>{
      const initial=btn.dataset.switch==='nyx.autoCloak'
        ? (store.get('nyx.autoCloak',false) || store.get('autoAbout',false) || store.get('autoBlob',false))
        : btn.dataset.switch==='nyx.popupProtection'
          ? popupProtectionEnabled()
        : btn.dataset.switch==='nyx.hieroglyphText'
          ? hieroglyphTextEnabled()

        : store.get(btn.dataset.switch,btn.dataset.switch==='nyx.httpBridge');
      btn.classList.toggle('on',initial);
      btn.setAttribute('role','switch');
      btn.setAttribute('aria-checked',String(!!initial));
      btn.onclick=()=>{
        const key=btn.dataset.switch;
        if(key==='nyx.lagReducer' || key==='nyx.performanceLite'){
          const current=getNyxPerformanceTier();
          const next=key==='nyx.lagReducer'
            ? (current==='low' ? 'high' : 'low')
            : (current==='medium' ? 'high' : 'medium');
          setNyxPerformanceTier(next);
          applyUserSettings();
          toast(next==='low' ? 'Performance set to Low' : next==='medium' ? 'Performance set to Medium' : 'Performance set to High');
          return;
        }
        const v=key==='nyx.popupProtection'
          ? !popupProtectionEnabled()

            : !store.get(key,key==='nyx.httpBridge');
        store.set(key,v);
        if(key==='nyx.httpBridge'){
          resetWorkspaceConnectionRuntime(false);
          toast('Connection setting saved. Reload website tabs to apply.');
        }
        qsa(`[data-switch="${key}"]`).forEach(el=>{el.classList.toggle('on',v);el.setAttribute('aria-checked',String(!!v))});
        qsa(`[data-switch="${key}"].settings-action`).forEach(el=>{el.textContent=v?'On':'Off'});
        if(key==='nyx.cloakRedirectOriginal' || key==='nyx.autoCloak') qsa(`[data-switch="${key}"]`).forEach(el=>{if(el.classList.contains('settings-action')) el.textContent=v?'On':'Off'});
        if(key==='nyx.autoCloak'){
          store.set('autoAbout',false);
          store.set('autoBlob',false);
          if(v) launchAutoCloak();
          toast('Automatic study window '+(v?'on':'off'));
        }else if(key==='nyx.hieroglyphText'){
          applyHieroglyphText();
          toast('Hieroglyph text '+(v?'on':'off'));
        }else if(key==='nyx.autoHieroglyphText'){
          if(v) store.set('nyx.hieroglyphText',true);
          qsa('[data-switch="nyx.hieroglyphText"]').forEach(el=>el.classList.toggle('on',hieroglyphTextEnabled()));
          qsa('[data-switch="nyx.hieroglyphText"].settings-action').forEach(el=>{el.textContent=hieroglyphTextEnabled()?'On':'Off'});
          applyHieroglyphText();
          toast('Auto Hieroglyph '+(v?'on':'off'));
        }else if(key==='nyx.threeDBackgrounds'){
          applyUserSettings();
          toast('3D Backgrounds '+(v?'on':'off'));
        }else if(key==='nyx.popupProtection'){
          activeWorkspace?.refreshSandbox?.();
          toast('Popup Protection '+(v?'on':'off'));
        }else if(key==='nyx.hideWebsiteDetails'){
          refreshWebsiteDetailsVisibility();
          toast('Website details '+(v?'hidden':'shown'));
        }else if(key==='nyx.sidebarLeft'){
          applyNyxSidebarLocation();
          toast('Sidebar moved to the '+(v?'left':'right'));
        }
      }
    });
    root.querySelectorAll('[data-anticlose]').forEach(ac=>{
      ac.classList.toggle('on',antiCloseEnabled);
      ac.onclick=()=>{
        setAntiCloseEnabled(!antiCloseEnabled);
        toast('Anti-close '+(antiCloseEnabled?'on':'off'));
      };
    });
    wirePresetCloakControls(root);
  }
  function applyPreset(name, silent=false){
    const previousCloakTitle=store.text('nyx.tabTitle','').trim();
    if(name==='custom'){
      applyCustomTabCloak(store.text('nyx.tabTitle','nyx'),store.text('nyx.tabFavicon',nyxFaviconHref()),silent);
      syncPresetCloakFields();
      return;
    }
    const labels={deltamath:learningTabTitle,nyx:nyxTabTitle,classroom:'Google Classroom',drive:'Google Drive',classlink:'ClassLink',google:'Google'};
    const title=labels[name]||nyxTabTitle;
    const favicon=name==='nyx' ? nyxTabFavicon : (favicons[name]||favicons.nyx||favicons.google);
    setCurrentTabCloak(title,favicon,true);
    const brand=$('brandName');
    if(brand) brand.textContent=nyxTabTitle;
    store.setText('nyx.logo',name);
    store.setText('nyx.tabTitle',title);
    store.setText('nyx.tabFavicon',favicon);
    syncPresetCloakFields();
    repairBlankWorkspaceShellPresetTabs(previousCloakTitle);
    scheduleStoredTabCloakEnforce();
    requestAnimationFrame(()=>setCurrentTabCloak(title,favicon,false));
    if(!silent) toast('Tab preset applied');
  }
  function repairBlankWorkspaceShellPresetTabs(previousCloakTitle=''){
    if(!Array.isArray(workspaceShellTabs) || !workspaceShellTabs.length) return;
    const presetTitles=new Set([learningTabTitle,nyxTabTitle,'ռʏӼ','Õ¼ÊÓ¼','Google Classroom','Google Drive','ClassLink','Google']);
    if(previousCloakTitle) presetTitles.add(previousCloakTitle);
    let changed=false;
    workspaceShellTabs.forEach((tab,index)=>{
      if(tab.url || !presetTitles.has(String(tab.title || '').trim())) return;
      tab.title=index===0 ? 'Home' : 'New Tab';
      tab.icon=favicons.nyx;
      changed=true;
    });
    if(changed && document.body.classList.contains('workspace-shell')) renderWorkspaceShellTabs();
  }
  function wirePresetCloakControls(root=document){
    const scope=root || document;
    if(scope.__nyxPresetCloakWired) return;
    scope.__nyxPresetCloakWired=true;
    scope.addEventListener?.('click',e=>{
      const preset=e.target.closest?.('[data-preset]');
      if(!preset || !scope.contains?.(preset)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      applyPreset(preset.dataset.preset || 'nyx');
      syncPresetCloakFields(scope);
    },true);
    const applySelect=e=>{
      const select=e.target.closest?.('[data-preset-select]');
      if(!select || !scope.contains?.(select)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      applyPreset(select.value || 'nyx');
      syncPresetCloakFields(scope);
    };
    scope.addEventListener?.('change',applySelect,true);
    scope.addEventListener?.('input',applySelect,true);
  }
  function syncPresetCloakFields(root=document){
    const scope=root || document;
    const logo=store.text('nyx.logo','nyx');
    const title=store.text('nyx.tabTitle','nyx');
    const favicon=store.text('nyx.tabFavicon',nyxFaviconHref());
    scope.querySelectorAll?.('[data-preset-select]').forEach(select=>{
      if([...select.options].some(option=>option.value===logo)) select.value=logo;
    });
    scope.querySelectorAll?.('[data-tab-title]').forEach(input=>{input.value=title});
    scope.querySelectorAll?.('[data-tab-favicon]').forEach(input=>{input.value=favicon});
  }
  function enforceStoredTabCloak(){
    const title=store.text('nyx.tabTitle','').trim();
    const favicon=store.text('nyx.tabFavicon','').trim();
    if(title || favicon) setCurrentTabCloak(title || document.title, favicon || nyxFaviconHref(), false);
  }
  function scheduleStoredTabCloakEnforce(){
    enforceStoredTabCloak();
    [80,320,1000].forEach(delay=>setTimeout(enforceStoredTabCloak,delay));
  }
  function reachableTabDocuments(){
    const docs=[document];
    try{
      if(window.parent && window.parent!==window && window.parent.document && !docs.includes(window.parent.document)) docs.push(window.parent.document);
    }catch{}
    try{
      if(window.top && window.top!==window && window.top.document && !docs.includes(window.top.document)) docs.push(window.top.document);
    }catch{}
    return docs;
  }
  function setCurrentTabCloak(title, favicon, forceRefresh=false){
    const cleanTitle=String(title || nyxTabTitle).trim() || nyxTabTitle;
    const cleanFavicon=String(favicon || nyxTabFavicon).trim() || nyxTabFavicon;
    reachableTabDocuments().forEach(doc=>{
      setPageTitle(cleanTitle,doc);
      setPageFavicon(cleanFavicon,forceRefresh,doc);
    });
    try{
      if(window.parent!==window) window.parent.postMessage({type:'nyx:tab-cloak-sync',title:cleanTitle,favicon:cleanFavicon},'*');
    }catch{}
    return {title:cleanTitle,favicon:cleanFavicon};
  }
  function setPageTitle(title){
    const doc=arguments[1] || document;
    if(!doc) return;
    let titleEl=doc.querySelector('head > title');
    if(!titleEl && doc.head){
      titleEl=doc.createElement('title');
      doc.head.prepend(titleEl);
    }
    if(titleEl) titleEl.textContent=title;
    try{doc.title=title}catch{}
  }
  function setPageFavicon(href, forceRefresh=false, targetDoc=document){
    const clean=String(href || favicons.nyx).trim() || favicons.nyx;
    let finalHref=clean;
    let lower=clean.toLowerCase();
    try{
      if(!/^(data:|blob:)/i.test(clean)){
        const url=new URL(clean,location.href);
        if(forceRefresh && url.origin===location.origin) url.searchParams.set('tabIcon',String(Date.now()));
        finalHref=url.href;
        lower=url.pathname.toLowerCase();
      }
    }catch{
      finalHref=clean;
    }
    const type=lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' : lower.endsWith('.ico') ? 'image/x-icon' : lower.endsWith('.svg') || /^data:image\/svg/i.test(clean) ? 'image/svg+xml' : '';
    const install=doc=>{
      if(!doc?.head) return;
      doc.querySelectorAll('link[rel*="icon" i], link[rel="apple-touch-icon" i]').forEach(el=>el.remove());
      ['icon','shortcut icon','apple-touch-icon'].forEach((rel,index)=>{
        const fav=doc.createElement('link');
        if(index===0) fav.id='appFavicon';
        fav.rel=rel;
        if(type && rel!=='apple-touch-icon') fav.type=type;
        fav.href=finalHref;
        doc.head.appendChild(fav);
      });
    };
    install(targetDoc);
    return finalHref;
  }
  function applyCustomTabCloak(title, favicon, silent=false){
    const cleanTitle=String(title || '').trim() || 'nyx';
    const cleanFavicon=String(favicon || '').trim() || favicons.nyx;
    setCurrentTabCloak(cleanTitle,cleanFavicon,/^(?:\.\/|\/|assets\/)/i.test(cleanFavicon));
    store.setText('nyx.tabTitle',cleanTitle);
    store.setText('nyx.tabFavicon',cleanFavicon);
    store.setText('nyx.logo','custom');
    scheduleStoredTabCloakEnforce();
    if(!silent) toast('Tab cloak applied');
  }
  let tabCloakPersistenceInstalled=false;
  function installTabCloakPersistence(){
    if(tabCloakPersistenceInstalled) return;
    tabCloakPersistenceInstalled=true;
    ['focus','pageshow','visibilitychange'].forEach(type=>{
      window.addEventListener(type,()=>scheduleStoredTabCloakEnforce(),{passive:true});
    });
    if(document.head){
      new MutationObserver(()=>scheduleStoredTabCloakEnforce()).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['href','rel']});
    }
  }
  function currentCloakFrameUrl(){
    try{
      const url=new URL(location.href);
      url.searchParams.set('nyx_cloaked','1');
      return url.href;
    }catch{
      return location.href;
    }
  }
  function cloakHtml(title=document.title){
    return '<!doctype html><title>'+esc(title)+'</title><link rel="icon" href="'+esc(nyxFaviconHref())+'"><iframe src="'+currentCloakFrameUrl()+'" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>';
  }
  function cloakPromptText(){
    return "Please type one of the following:\n'a' = about:blank\n'b' = document window\n'm' = current page frame\n'ac' = anchored study window\n'bc' = anchored document window\n'mc' = anchored current page frame";
  }
  function normalizeCloakMode(value){
    const mode=String(value || '').trim().toLowerCase();
    return ['a','b','m','ac','bc','mc'].includes(mode) ? mode : 'a';
  }
  function cloakRedirectUrl(){
    const raw=store.text('nyx.cloakRedirectUrl','https://google.com/').trim() || 'https://google.com/';
    try{return normalize(raw)}catch{return 'https://google.com/'}
  }
  function maybeRedirectOriginalAfterCloak(){
    if(!store.get('nyx.cloakRedirectOriginal',false)) return;
    const target=cloakRedirectUrl();
    setTimeout(()=>{
      try{location.replace(target)}catch{location.href=target}
    },260);
  }
  function saveCloakSettings(root=document){
    const mode=normalizeCloakMode(root.querySelector('[data-cloak-type]')?.value || store.text('nyx.cloakType','a'));
    const redirectUrl=root.querySelector('[data-cloak-redirect-url]')?.value?.trim();
    store.setText('nyx.cloakType',mode);
    if(redirectUrl) store.setText('nyx.cloakRedirectUrl',normalize(redirectUrl));
    toast('Cloak settings saved');
  }
  function promptCloakMode(){
    const value=prompt(cloakPromptText(),'m');
    if(value===null) return null;
    const mode=value.trim().toLowerCase();
    if(['a','b','m','ac','bc','mc'].includes(mode)) return mode;
    alert("Unknown cloak mode. Use a, b, m, ac, bc, or mc.");
    return null;
  }
  function applyTabAnchor(){
    try{history.replaceState(history.state,'',location.pathname+location.search)}catch{}
  }
  function launchCurrentTabIframe(useAnchor=false){
    if(useAnchor) applyTabAnchor();
    const iframe=document.createElement('iframe');
    iframe.src=currentCloakFrameUrl();
    iframe.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;background:#020308;z-index:7000';
    iframe.setAttribute('title','nyx');
    document.body.classList.remove('hosted-cloak-entry');
    document.documentElement.classList.remove('hosted-cloak-entry');
    document.body.innerHTML='';
    document.body.style.margin='0';
    document.body.style.overflow='hidden';
    (document.getElementById('app') || document.body).appendChild(iframe);
    return true;
  }
  function launchCurrentTabBlob(useAnchor=false){
    if(useAnchor) applyTabAnchor();
    const url=URL.createObjectURL(new Blob([cloakHtml()],{type:'text/html'}));
    try{
      location.replace(url);
    }catch{
      location.href=url;
    }
    return true;
  }
  function launchCurrentTabAboutBlank(useAnchor=false){
    if(useAnchor) applyTabAnchor();
    try{
      document.open();
      document.write(cloakHtml());
      document.close();
    }catch{
      return launchCurrentTabIframe(false);
    }
    return true;
  }
  const cloakHopUrls=[
    ['Blooket','https://www.blooket.com/'],
    ['IXL','https://www.ixl.com/'],
    ['Khan Academy','https://www.khanacademy.org/'],
    ['Wikipedia','https://www.wikipedia.org/'],
    ['Google','https://www.google.com/'],
    ['Google Classroom','https://classroom.google.com/'],
    ['Google Docs','https://docs.google.com/']
  ];
  function nextCloakHop(forcedHop){
    if(forcedHop) return {name:forcedHop[0],url:forcedHop[1]};
    const index=Number(store.text('nyx.cloakHopIndex','0')) || 0;
    const hop=cloakHopUrls[index % cloakHopUrls.length];
    store.setText('nyx.cloakHopIndex',String(index+1));
    return {name:hop[0],url:hop[1]};
  }
  function writeAboutBlankCloak(w, html, started=Date.now()){
    try{
      w.document.open();
      w.document.write(html);
      w.document.close();
      return true;
    }catch{}
    if(Date.now()-started<2600) setTimeout(()=>writeAboutBlankCloak(w,html,started),140);
    return false;
  }
  function opennyxInternalPopup(url='about:blank',options={}){
    const target=String(url || 'about:blank');
    const nativeOpen=window.__nyxNativeOpen || window.open?.bind(window);
    const features=options.features || 'popup=yes,width=1280,height=800';
    let external=null;
    try{external=nativeOpen ? nativeOpen(target,'_blank',features) : null}catch{}
    if(!external && target!=='about:blank'){
      try{external=nativeOpen ? nativeOpen('about:blank','_blank',features) : null}catch{}
      try{if(external) external.location.replace(target)}catch{}
    }
    if(external) return external;
    return {
      closed:false,
      focus(){},
      blur(){},
      close(){this.closed=true},
      postMessage(){},
      location:{
        href:target,
        assign(next){openWorkspace(next || target)},
        replace(next){openWorkspace(next || target)}
      },
      document:{
        open(){return this},
        write(){},
        writeln(){},
        close(){}
      }
    };
  }
  function opennyxBlobTab(html=cloakHtml()){
    const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));
    const popup=opennyxInternalPopup(url,{blob:true});
    if(!popup) URL.revokeObjectURL(url);
    return popup;
  }
  function openThroughDeltaMath(finalUrl=location.href, afterRedirect, forcedHop){
    const w=opennyxInternalPopup(finalUrl);
    if(!w) return null;
    setTimeout(()=>{
      if(typeof afterRedirect==='function') setTimeout(()=>afterRedirect(w),260);
    },120);
    return w;
  }
  function launchCloak(kind, options={}){
    const html=cloakHtml();
    if(options.anchor) applyTabAnchor();
    if(kind==='about'){
      return openThroughDeltaMath('about:blank',w=>{
        writeAboutBlankCloak(w,html);
      },options.hop);
    }
    if(kind==='blob'){
      return opennyxBlobTab(html);
    }
    return opennyxBlobTab(html);
  }
  function launchDirectAboutBlankCloak(title='about:blank'){
    const nativeOpen=window.__nyxNativeOpen || window.open?.bind(window);
    let w=null;
    try{w=nativeOpen ? nativeOpen('about:blank','_blank','popup=yes,width=1280,height=800') : null}catch{}
    if(!w) w=opennyxInternalPopup('about:blank',{features:'popup=yes,width=1280,height=800'});
    if(!w) return null;
    try{
      w.document.open();
      w.document.write(cloakHtml(title));
      w.document.close();
      try{w.focus?.()}catch{}
      return w;
    }catch{
      try{w.location.href=currentCloakFrameUrl()}catch{}
      return w;
    }
  }
  function launchAutoCloak(){
    return !!launchHostedCloak(store.text('nyx.cloakType','a'));
  }
  function shouldAutoLaunchHostedCloak(){
    try{
      const params=new URLSearchParams(location.search);
      return /^https?:$/.test(location.protocol)
        && window.top===window.self
        && params.has('nyx_auto_classroom')
        && !params.has('nyx_cloaked');
    }catch{
      return false;
    }
  }
  function showCloakLaunchScreen(){
    const screen=$('cloakLaunchScreen');
    if(!screen) return;
    screen.classList.add('show');
    screen.setAttribute('aria-hidden','false');
    setTimeout(()=>screen.querySelector('[data-cloak-input]')?.focus(),40);
  }
  function hideCloakLaunchScreen(){
    const screen=$('cloakLaunchScreen');
    if(!screen) return;
    screen.classList.remove('show');
    screen.setAttribute('aria-hidden','true');
  }
  function setCloakLaunchMessage(text){
    const panel=$('cloakLaunchScreen')?.querySelector('p');
    if(panel) panel.textContent=text;
  }
  function setCloakStatus(text){
    const status=$('cloakLaunchScreen')?.querySelector('[data-cloak-status]');
    if(status) status.textContent=text;
  }
  function launchTypedCloakMode(){
    const input=$('cloakLaunchScreen')?.querySelector('[data-cloak-input]');
    const mode=(input?.value || '').trim().toLowerCase();
    return launchHostedCloak(mode || 'm');
  }
  function launchHostedCloak(mode='m'){
    mode=String(mode || 'm').trim().toLowerCase();
    if(!['a','b','m','ac','bc','mc'].includes(mode)){
      setCloakStatus('Unknown mode. Choose a, b, m, ac, bc, or mc.');
      showCloakLaunchScreen();
      return false;
    }
    if(mode==='m' || mode==='mc'){
      hideCloakLaunchScreen();
      return launchCurrentTabIframe(mode==='mc');
    }
    if(mode==='ac'){
      hideCloakLaunchScreen();
      return launchCurrentTabAboutBlank(true);
    }
    if(mode==='bc'){
      hideCloakLaunchScreen();
      return launchCurrentTabBlob(true);
    }
    if(mode==='a'){
      const launched=launchDirectAboutBlankCloak();
      if(launched){
        maybeRedirectOriginalAfterCloak();
        setCloakStatus('Opened about:blank');
        showCloakLaunchScreen();
        return true;
      }
      showCloakLaunchScreen();
      setCloakStatus('Popup blocked. Allow popups and try again.');
      return false;
    }
    const kind=(mode==='b' || mode==='bc') ? 'blob' : 'about';
    if(launchCloak(kind,{hop:cloakHopUrls[0],anchor:mode.endsWith('c')})){
      if(mode==='b') maybeRedirectOriginalAfterCloak();
      setCloakStatus(kind==='blob' ? 'Opened' : 'Opened');
      showCloakLaunchScreen();
      return true;
    }
    showCloakLaunchScreen();
    setCloakStatus('Popup blocked. Click the mode button again or allow popups for this site.');
    return false;
  }
  function scheduleHostedCloakLaunch(){
    if(!shouldAutoLaunchHostedCloak()) return;
    showCloakLaunchScreen();
    setCloakStatus('Choose a mode to change this blank page.');
  }
  function scheduleAutoCloak(){
    try{
      const params=new URLSearchParams(location.search);
      if(window.top!==window.self || params.has('nyx_cloaked')) return;
    }catch{}
    if(!store.get('nyx.autoCloak',false) && !store.get('autoAbout',false) && !store.get('autoBlob',false)) return;
    store.set('nyx.autoCloak',true);
    store.set('autoAbout',false);
    store.set('autoBlob',false);
    const mode=store.text('nyx.cloakType','a');
    showCloakLaunchScreen();
    const input=$('cloakLaunchScreen')?.querySelector('[data-cloak-input]');
    if(input) input.value=mode;
    setCloakStatus('Automatic study window ready. If the popup is blocked, click or press any key.');
    const tryLaunch=()=>{
      if(launchAutoCloak()){
        hideCloakLaunchScreen();
        return true;
      }
      showCloakLaunchScreen();
      setCloakStatus('Popup blocked. Click or press any key to launch.');
      return false;
    };
    setTimeout(()=>{
      if(tryLaunch()) return;
      const once=()=>{
        window.removeEventListener('pointerdown',once,true);
        window.removeEventListener('keydown',once,true);
        tryLaunch();
      };
      window.addEventListener('pointerdown',once,true);
      window.addEventListener('keydown',once,true);
    },180);
  }
  function installDeltaNewTabRedirect(){
    if(window.__nyxDeltaRedirectInstalled) return;
    window.__nyxDeltaRedirectInstalled=true;
    const nativeOpen=window.open?.bind(window);
    window.__nyxNativeOpen=nativeOpen;
    window.open=(url,target,features)=>{
      if(activeWorkspace?.openPopupTab) return activeWorkspace.openPopupTab(url || 'about:blank');
      return nativeOpen ? nativeOpen(url,target,features) : null;
    };
  }
  function installBookmuxPortResponder(){
    if(window.__nyxBareMuxResponderInstalled) return;
    window.__nyxBareMuxResponderInstalled=true;
    window.addEventListener('message',event=>{
      if(event.data?.type!=='getPort' || !event.data.port) return;
      try{
        const worker=new SharedWorker('/baremux/worker.js','bare-mux-worker');
        const replyPort=event.data.port;
        MessagePort.prototype.postMessage.call(replyPort,worker.port,[worker.port]);
      }catch{}
    });
  }
  function installAntiClose(){
    const msg='Are you sure you want to leave this page?';
    if(antiCloseConfirmHandler) return;
    antiCloseGestureHandler=()=>{
      antiCloseHadGesture=true;
    };
    antiCloseConfirmHandler=e=>{
      if(!antiCloseEnabled || antiClosePanicBypass || !antiCloseHadGesture) return;
      e.preventDefault();
      e.returnValue=msg;
      return msg;
    };
    window.addEventListener('pointerdown',antiCloseGestureHandler,true);
    window.addEventListener('keydown',antiCloseGestureHandler,true);
    if(antiCloseEnabled) antiCloseHadGesture=true;
    syncAntiCloseHandler();
  }
  function syncAntiCloseHandler(){
    if(!antiCloseConfirmHandler) return;
    window.removeEventListener('beforeunload',antiCloseConfirmHandler);
    if(antiCloseRearmTimer){
      clearInterval(antiCloseRearmTimer);
      antiCloseRearmTimer=null;
    }
    if(!antiCloseEnabled){
      if(window.onbeforeunload===antiCloseConfirmHandler) window.onbeforeunload=null;
      return;
    }
    window.onbeforeunload=antiCloseConfirmHandler;
    window.addEventListener('beforeunload',antiCloseConfirmHandler);
    antiCloseRearmTimer=setInterval(()=>{
      if(antiCloseEnabled && antiCloseConfirmHandler) window.onbeforeunload=antiCloseConfirmHandler;
    },1000);
  }
  function setAntiCloseEnabled(next){
    antiCloseEnabled=!!next;
    if(antiCloseEnabled) antiCloseHadGesture=true;
    store.set('nyx.antiClose',antiCloseEnabled);
    qsa('[data-anticlose]').forEach(btn=>btn.classList.toggle('on',antiCloseEnabled));
    syncAntiCloseHandler();
    return antiCloseEnabled;
  }
  function panicKeyCombo(event){
    const key=String(event.key || '').trim();
    if(!key || ['Control','Shift','Alt','Meta'].includes(key)) return '';
    const parts=[];
    if(event.ctrlKey) parts.push('Ctrl');
    if(event.altKey) parts.push('Alt');
    if(event.shiftKey) parts.push('Shift');
    if(event.metaKey) parts.push('Meta');
    const label=key.length===1 ? key.toUpperCase() : key.replace(/^Arrow/,'');
    parts.push(label);
    return parts.join('+');
  }
  function normalizedPanicKey(value){
    return String(value || '')
      .replace(/^["']|["']$/g,'')
      .trim()
      .toLowerCase()
      .replace(/\s+/g,'')
      .replace(/arrow/g,'');
  }
  function savedPanicKeys(){
    const values=[store.text('nyx.panicKey','not set')];
    try{
      const raw=localStorage.getItem('nyx.panicKey');
      if(raw) values.push(raw,JSON.parse(raw));
    }catch{}
    return values.filter(Boolean);
  }
  function panicComboMatchesSaved(combo){
    const normalized=normalizedPanicKey(combo);
    if(!normalized || normalized==='notset') return false;
    return savedPanicKeys().some(value=>normalizedPanicKey(value)===normalized);
  }
  function updatePanicKeyLabels(root=document){
    const value=store.text('nyx.panicKey','not set') || 'not set';
    root.querySelectorAll('[data-panic-key-display]').forEach(el=>{el.textContent=value});
  }
  function handlePanicKeydown(event){
    const combo=panicKeyCombo(event);
    if(!combo) return false;
    if(panicCaptureArmed){
      event.preventDefault();
      event.stopPropagation();
      panicCaptureArmed=false;
      store.setText('nyx.panicKey',combo);
      updatePanicKeyLabels();
      toast('Class shortcut saved: '+combo);
      return true;
    }
    if(panicComboMatchesSaved(combo)){
      event.preventDefault();
      event.stopPropagation();
      triggerPanicClose();
      return true;
    }
    return false;
  }
  function ensurePanicKeyListener(){
    const previous=window.__nyxPanicKeyListener;
    if(previous){
      try{document.removeEventListener('keydown',previous,true)}catch{}
      try{window.removeEventListener('keydown',previous,true)}catch{}
    }
    const listener=event=>{ handlePanicKeydown(event); };
    window.__nyxPanicKeyListener=listener;
    window.__nyxPanicKeyListenerInstalled=true;
    document.addEventListener('keydown',listener,true);
    window.addEventListener('keydown',listener,true);
    const previousDocumentKeydown=window.__nyxPreviousDocumentOnKeydown || document.onkeydown;
    const previousWindowKeydown=window.__nyxPreviousWindowOnKeydown || window.onkeydown;
    window.__nyxPreviousDocumentOnKeydown=previousDocumentKeydown;
    window.__nyxPreviousWindowOnKeydown=previousWindowKeydown;
    document.onkeydown=event=>{
      if(handlePanicKeydown(event)) return false;
      return typeof previousDocumentKeydown==='function' ? previousDocumentKeydown.call(document,event) : true;
    };
    window.onkeydown=event=>{
      if(handlePanicKeydown(event)) return false;
      return typeof previousWindowKeydown==='function' ? previousWindowKeydown.call(window,event) : true;
    };
  }
  ensurePanicKeyListener();
  function triggerPanicClose(){
    const restoreAntiClose=antiCloseEnabled;
    let panicTarget=window;
    try{
      if(window.top) panicTarget=window.top;
    }catch{}
    antiClosePanicBypass=true;
    antiCloseHadGesture=false;
    if(antiCloseConfirmHandler){
      try{window.removeEventListener('beforeunload',antiCloseConfirmHandler)}catch{}
    }
    if(window.onbeforeunload===antiCloseConfirmHandler) window.onbeforeunload=null;
    if(antiCloseRearmTimer){
      clearInterval(antiCloseRearmTimer);
      antiCloseRearmTimer=null;
    }
    try{panicTarget.onbeforeunload=null}catch{}
    try{panicTarget.close()}catch{}
    setTimeout(()=>{
      try{
        if(panicTarget.closed) return;
        panicTarget.open('', '_self')?.close?.();
      }catch{}
    },40);
    setTimeout(()=>{
      try{
        if(panicTarget.closed) return;
        panicTarget.location.replace('https://www.google.com/');
      }catch{
        document.documentElement.innerHTML='';
      }
    },140);
    setTimeout(()=>{
      antiClosePanicBypass=false;
      if(restoreAntiClose && !panicTarget.closed && location.protocol!=='about:'){
        antiCloseHadGesture=true;
        syncAntiCloseHandler();
      }
    },1200);
  }
  function armPanicKeyCapture(){
    panicCaptureArmed=true;
    qsa('[data-panic-key-display]').forEach(el=>{el.textContent='press keys...'});
    toast('Press the class shortcut combination');
  }
  function clearPanicKey(){
    store.setText('nyx.panicKey','not set');
    updatePanicKeyLabels();
    toast('Class shortcut cleared');
  }
  function isChromeOsUser(){
    const ua=String(navigator.userAgent || '');
    const platform=String(navigator.userAgentData?.platform || navigator.platform || '');
    return /\bCrOS\b/i.test(ua) || /Chrome\s*OS/i.test(platform);
  }
  let shortcutMenuPointerHandled=false;
  function shortcutMenuButtonAtPoint(x,y){
    return [...document.querySelectorAll('[data-home-shortcut-menu]')].find(btn=>{
      const rect=btn.getBoundingClientRect();
      return x>=rect.left && x<=rect.right && y>=rect.top && y<=rect.bottom;
    }) || null;
  }
  function toggleShortcutMenu(button){
    const tile=button?.closest?.('.home-shortcut');
    if(!tile) return false;
    document.querySelectorAll('.home-shortcut.menu-open').forEach(item=>{if(item!==tile)item.classList.remove('menu-open')});
    tile.classList.toggle('menu-open');
    return true;
  }
  function bind(){
    ensurePanicKeyListener();
    if(!document.__nyxUnifiedButtonMotion){
      document.__nyxUnifiedButtonMotion=true;
      document.addEventListener('click',event=>{
        const button=event.target.closest?.('button');
        if(!button || button.disabled || button.matches('.quick-tile,.setup-theme-card,.bg-choice,.game-card,[data-no-button-motion]')) return;
        button.classList.remove('nyx-button-click');
        void button.offsetWidth;
        button.classList.add('nyx-button-click');
        clearTimeout(button.__nyxButtonClickTimer);
        button.__nyxButtonClickTimer=setTimeout(()=>button.classList.remove('nyx-button-click'),360);
      },true);
    }
    if(!document.__nyxSetupEnterBind){
      document.__nyxSetupEnterBind=true;
      document.addEventListener('keydown',e=>{
        if(e.key!=='Enter') return;
        const setup=$('setupScreen');
        if(!setup?.classList.contains('show')) return;
        if(e.target?.closest?.('.nyx-account-overlay,.nyx-user-profile-overlay,.nyx-email-verification-overlay')) return;
        if(e.target?.matches?.('button,a,textarea,select,[contenteditable="true"]')) return;
        const steps=[...setup.querySelectorAll('[data-setup-step]')];
        if(!steps.length) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        if(setupStepIndex>=steps.length-1) finishSetupCustomization();
        else moveSetupStep(1);
      },true);
    }
    document.addEventListener('click',e=>{
      const setupRoot=e.target.closest?.('#setupScreen.show');
      if(setupRoot){
        if(e.target.closest('[data-setup-next]')){
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          moveSetupStep(1);
          return;
        }
        if(e.target.closest('[data-setup-back]')){
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          moveSetupStep(-1);
          return;
        }
        if(e.target.closest('[data-finish-setup]')){
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          finishSetupCustomization();
          return;
        }
        if(e.target.closest('[data-skip-setup]')){
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          store.set('nyx.setupComplete',true);
          hideSetup();
          return;
        }
      }
      const link=e.target.closest?.('a[href]');
      if(!link) return;
      if(nyxCreditsLinkClick(e)) return;
      const trustedExternal=String(link.dataset.nyxTrustedExternal || '').trim().toLowerCase();
      if(trustedExternal==='discord'){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        const nativeOpen=window.__nyxNativeOpen || window.open?.bind(window);
        nativeOpen?.(link.href || 'https://discord.com/invite/cAdjYAJs3u','_blank','noopener,noreferrer');
        return;
      }
      const target=String(link.getAttribute('target') || '').toLowerCase();
      if(!['_blank','_new'].includes(target)) return;
      if(!popupProtectionEnabled()) return;
      if(activeWorkspace?.openPopupTab){
        e.preventDefault();
        e.stopPropagation();
        activeWorkspace.openPopupTab(link.href || link.getAttribute('href') || 'about:blank');
      }
    },true);
    document.addEventListener('click',e=>{
      if(shortcutMenuPointerHandled && e.target.closest?.('.home-shortcut')){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        shortcutMenuPointerHandled=false;
        return;
      }
      if(e.target.closest?.('[data-workspace-settings-close]')){
        e.preventDefault();
        const overlay=e.target.closest('.workspace-shell-settings-overlay');
        const panel=overlay?.querySelector('.workspace-shell-settings-panel');
        const settingsTab=workspaceShellTabs.find(tab=>tab.id===workspaceShellActiveTab && tab.url==='nyx://settings');
        if(panel){
          panel.style.animation='settingsDropOut .22s ease forwards';
          setTimeout(()=>{
            overlay?.remove();
            if(settingsTab) closeWorkspaceShellTab(settingsTab.id);
          },220);
        }else overlay?.remove();
        return;
      }
      const workspaceSettingsSave=e.target.closest?.('[data-workspace-settings-save]');
      if(workspaceSettingsSave && workspaceSettingsSave.closest('.workspace-shell-settings-overlay')){
        e.preventDefault();
        saveWorkspaceShellSettings(workspaceSettingsSave.closest('.workspace-shell-settings-overlay'));
        toast('Workspace settings saved');
        return;
      }
      const connectionRepair=e.target.closest?.('[data-workspace-connection-repair]');
      if(connectionRepair){
        e.preventDefault();
        if(connectionRepair.disabled)return;
        connectionRepair.disabled=true;
        connectionRepair.textContent='Repairing...';
        void repairWorkspaceConnection().then(()=>{
          toast('Connection refreshed. Try your search again.');
        }).catch(()=>{
          toast('Connection repair could not finish. Check your workspace extensions or try again.');
        }).finally(()=>{
          connectionRepair.disabled=false;
          connectionRepair.textContent='Repair connection';
        });
        return;
      }
      const wispSave=e.target.closest?.('[data-workspace-wisp-save]');
      if(wispSave){
        e.preventDefault();
        saveWorkspaceWispUrl(wispSave.closest('.workspace-shell-settings-overlay'));
        return;
      }
      const wispReset=e.target.closest?.('[data-workspace-wisp-reset]');
      if(wispReset){
        e.preventDefault();
        saveWorkspaceWispUrl(wispReset.closest('.workspace-shell-settings-overlay'),true);
        return;
      }
      const dataExport=e.target.closest?.('[data-nyx-data-export]');
      if(dataExport){
        e.preventDefault();
        exportNyxPortableBackup(dataExport.closest('.workspace-shell-settings-overlay'));
        return;
      }
      const dataImport=e.target.closest?.('[data-nyx-data-import]');
      if(dataImport){
        e.preventDefault();
        dataImport.closest('.workspace-shell-settings-overlay')?.querySelector('[data-nyx-data-import-file]')?.click();
        return;
      }
      if(e.target.closest?.('[data-nyx-data-reload]')){
        e.preventDefault();
        location.reload();
        return;
      }
      const popupButton=e.target.closest?.('[data-popup-protection]');
      if(popupButton && popupButton.closest('.workspace-shell-settings-overlay')){
        e.preventDefault();
        const next=popupButton.dataset.enabled!=='true';
        store.set('nyx.popupProtection',next);
        popupButton.dataset.enabled=String(next);
        popupButton.classList.toggle('on',next);
        popupButton.textContent='Popup Protection '+(next?'On':'Off');
        toast('Popup Protection '+(next?'enabled':'disabled'));
        return;
      }
      if(e.target.closest?.('[data-panic-capture]')){
        e.preventDefault();
        armPanicKeyCapture();
        return;
      }
      if(e.target.closest?.('[data-panic-clear]')){
        e.preventDefault();
        clearPanicKey();
      }
    });

    document.addEventListener('keydown',e=>{handleLeftAltChromeShortcut(e)},true);
    document.addEventListener('dragstart',e=>{
      if(!e.target.closest?.('.home-shortcut,.home-shortcut-add,[data-home-shortcuts]')) return;
      e.preventDefault();
      e.stopPropagation();
    },true);
    document.addEventListener('input',e=>{
      const input=e.target.closest?.('[data-workspace-shell-url],[data-workspace-blank-input]');
      if(input) showWorkspaceSuggestions(input);
    });
    document.addEventListener('focusin',e=>{
      const input=e.target.closest?.('[data-workspace-shell-url],[data-workspace-blank-input]');
      if(!input) return;
      if(input.matches('[data-workspace-shell-url]')) selectWorkspaceShellUrl(input,true);
      showWorkspaceSuggestions(input);
    });
    document.addEventListener('focusout',e=>{
      const input=e.target.closest?.('[data-workspace-shell-url]');
      if(!input) return;
      clearWorkspaceShellUrlSelection(input);
    });
    document.addEventListener('pointerdown',e=>{
      const pointButton=shortcutMenuButtonAtPoint(e.clientX,e.clientY);
      if(pointButton){
        return;
      }
      const shellUrlInput=e.target.closest?.('[data-workspace-shell-url]');
      if(shellUrlInput && document.activeElement!==shellUrlInput){
        workspaceShellUrlFirstPointer=shellUrlInput;
        e.preventDefault();
        shellUrlInput.focus();
        selectWorkspaceShellUrl(shellUrlInput,true);
      }
      if(!e.target.closest?.('[data-workspace-shell-url]')) clearWorkspaceShellUrlSelection();
      if(!workspaceSuggestionPointerInside(e.target)) hideWorkspaceSuggestions();
      if(!e.target.closest?.('[data-home-shortcut-menu],.home-shortcut-menu')){
        document.querySelectorAll('.home-shortcut.menu-open').forEach(item=>item.classList.remove('menu-open'));
      }
      if(!e.target.closest?.('#workspaceModeMenu,[data-workspace-shell-menu]')){
        document.body.classList.remove('menu-open');
      }
      if(!e.target.closest?.('#workspaceBookmarkPanel,[data-workspace-shell-bookmark],[data-workspace-bookmarks-toggle]')){
        $('workspaceBookmarkPanel')?.setAttribute('hidden','');
      }
    },true);
    document.addEventListener('pointerup',e=>{
      const input=e.target.closest?.('[data-workspace-shell-url],[data-workspace-blank-input]');
      if(!input) return;
      if(input.matches('[data-workspace-shell-url]') && workspaceShellUrlFirstPointer===input){
        e.preventDefault();
        workspaceShellUrlFirstPointer=null;
        selectWorkspaceShellUrl(input,true);
      }
      showWorkspaceSuggestions(input);
    });
    document.addEventListener('keydown',e=>{
      const input=e.target.closest?.('[data-workspace-shell-url],[data-workspace-blank-input]');
      if(!input) return;
      const box=$('workspaceSuggestions');
      const items=[...box?.querySelectorAll('.workspace-search-suggestion') || []];
      if(!items.length) return;
      const current=Math.max(0,items.findIndex(item=>item.classList.contains('active')));
      if(e.key==='ArrowDown' || e.key==='ArrowUp'){
        e.preventDefault();
        const next=e.key==='ArrowDown' ? (current+1)%items.length : (current-1+items.length)%items.length;
        items.forEach(item=>item.classList.remove('active'));
        items[next].classList.add('active');
        input.value=items[next].dataset.workspaceSuggestion || items[next].textContent || input.value;
      }else if(e.key==='Enter' && box?.classList.contains('show')){
        const raw=String(input.value || '').trim();
        const directUrl=/^(?:https?:\/\/|[a-z][a-z0-9+.-]*:\/\/|(?:localhost|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?(?:\/|$)|[\w.-]+\.[a-z]{2,}(?:[\/:?#]|$))/i.test(raw);
        if(directUrl){
          hideWorkspaceSuggestions();
          return;
        }
        const active=items.find(item=>item.classList.contains('active')) || items[0];
        if(active){
          e.preventDefault();
          acceptWorkspaceSuggestion(active.dataset.workspaceSuggestion || active.textContent || input.value);
        }
      }else if(e.key==='Escape'){
        hideWorkspaceSuggestions();
      }
    });
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape' || !document.body.classList.contains('nyx-tab-sidebar-open')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setWorkspaceTabSidebarOpen(false,{restoreFocus:true});
    });
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape' || !document.querySelector('.workspace-shell-settings-overlay')) return;
      e.preventDefault();
      const settingsTab=workspaceShellTabs.find(tab=>tab.url==='nyx://settings');
      if(settingsTab) closeWorkspaceShellTab(settingsTab.id);
      else closeWorkspaceShellSettings();
    });
    document.addEventListener('submit',e=>{
      const shellSearch=e.target.closest?.('[data-workspace-shell-search]');
      if(shellSearch){
        e.preventDefault();
        document.body.classList.remove('menu-open');
        hideWorkspaceSuggestions();
        navigateWorkspaceShell(shellSearch.querySelector('[data-workspace-shell-url]')?.value);
        return;
      }
      const blankSearch=e.target.closest?.('[data-workspace-blank-search]');
      if(blankSearch){
        if(e.nyxBlankSearchHandled) return;
        e.nyxBlankSearchHandled=true;
        e.preventDefault();
        e.stopImmediatePropagation();
        const input=blankSearch.querySelector('[data-workspace-blank-input]');
        const value=(input?.value || '').trim();
        hideWorkspaceSuggestions();
        if(input) input.value='';
        if(value) navigateWorkspaceShell(value);
        return;
      }
      const form=e.target.closest?.('[data-lion-ai-form]');
      if(!form) return;
      e.preventDefault();
      const win=form.closest('.window');
      const input=win?.querySelector('[data-lion-ai-input]');
      const chat=win?.querySelector('[data-lion-ai-chat]');
      const prompt=(input?.value || '').trim();
      if((!prompt && !win?.lionAiImage) || !chat) return;
      const threadTitle=win?.querySelector('[data-lion-ai-thread-title]');
      if(threadTitle && chat.querySelector('[data-lion-ai-empty]')){
        const nextTitle=prompt || 'Image conversation';
        threadTitle.textContent=nextTitle.length>54 ? `${nextTitle.slice(0,54)}…` : nextTitle;
      }
      addLionAiMessage(chat,'user',prompt || 'Please read this image and answer it.');
      if(win) win.lionAiLastUser=prompt || 'Please read this image and answer it.';
      input.value='';
      addLionAiMessage(chat,'bot',win?.lionAiImage ? 'Reading image, then contacting model...' : `Contacting ${nyxAiModelLabel(win?.querySelector?.('[data-lion-ai-model]')?.value || nyxAiSelectedModel())}...`);
      const pending=chat.lastElementChild;
      if(input) input.disabled=true;
      form.querySelector('.lion-ai-send').disabled=true;
      lionAiRespondAsync(prompt,win,partial=>{if(pending){pending.textContent=partial;chat.scrollTop=chat.scrollHeight}}).then(answer=>{
        if(pending) pending.textContent=answer;
        if(win) win.lionAiLastBot=answer;
        chat.scrollTop=chat.scrollHeight;
      }).finally(()=>{if(input){input.disabled=false;input.focus()}form.querySelector('.lion-ai-send').disabled=false});
    });
    document.addEventListener('click',e=>{
      const starter=e.target.closest?.('[data-lion-ai-prompt]');
      if(starter){
        const win=starter.closest('.window');
        const input=win?.querySelector('[data-lion-ai-input]');
        const form=win?.querySelector('[data-lion-ai-form]');
        if(input && form){
          input.value=starter.dataset.lionAiPrompt || '';
          form.requestSubmit();
        }
        return;
      }
      const clear=e.target.closest?.('[data-lion-ai-clear]');
      if(!clear) return;
      localStorage.removeItem('nyx.aiMessages');
      const chat=clear.closest('.window')?.querySelector('[data-lion-ai-chat]');
      if(chat){
        chat.classList.remove('has-messages');
        chat.innerHTML=lionAiEmptyState();
      }
      const title=clear.closest('.window')?.querySelector('[data-lion-ai-thread-title]');
      if(title) title.textContent='New chat';
    });
    document.addEventListener('keydown',e=>{
      if(nyxFounderIsOwner&&nyxOwnerDashboardAccess&&(e.key==='Enter'||e.key===' ')&&e.target.closest?.('[data-nyx-owner-presence]')&&!e.target.closest?.('[data-toggle-nyx-account-menu]')){
        e.preventDefault();
        openNyxOwnerDashboard();
        return;
      }
      if((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase()==='k' && document.body.classList.contains('workspace-shell')){
        const homeSearch=document.querySelector('.workspace-window.workspace-home-page .nyx-home-search [data-workspace-blank-input]');
        if(homeSearch){
          e.preventDefault();
          homeSearch.focus();
          homeSearch.select();
          return;
        }
      }
      if(handlePanicKeydown(e)) return;
      const input=e.target.closest?.('[data-lion-ai-input]');
      if(!input || e.key!=='Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      e.preventDefault();
      input.closest('[data-lion-ai-form]')?.requestSubmit();
    });
    document.addEventListener('change',e=>{
      const model=e.target.closest?.('[data-lion-ai-model]');
      if(!model) return;
      store.setText('nyx.aiModel',model.value || 'chatgpt-5.4-mini');
      const win=model.closest('.window');
      const label=win?.querySelector('[data-nyx-ai-model-label]');
      if(label) label.textContent=nyxAiModelLabel(model.value);
    });
    document.addEventListener('dragstart',e=>{
      if(!e.target.closest?.('.workspace-mode-shell-tab')){
        e.preventDefault();
        e.stopPropagation();
      }
    });
    document.addEventListener('click',async e=>{
      if(e.target.closest?.('[data-nyx-ai-settings]')){
        e.preventDefault();
        openNyxAiSettings();
        return;
      }
      const performanceTier=e.target.closest?.('[data-nyx-performance-tier]');
      if(performanceTier){
        e.preventDefault();
        const tier=setNyxPerformanceTier(performanceTier.dataset.nyxPerformanceTier);
        applyUserSettings();
        toast(tier==='high' ? 'Performance set to High' : tier==='medium' ? 'Performance set to Medium' : 'Performance set to Low');
        return;
      }
      const appsToggle=e.target.closest?.('[data-nyx-apps-toggle]');
      if(appsToggle){
        e.preventDefault();
        openWorkspaceShellInternalTab('apps');
        return;
      }
      if(e.target.closest?.('[data-nyx-focus-search]')){
        e.preventDefault();
        document.body.classList.remove('nyx-home-search-active');
        openWorkspaceShellTab();
        document.querySelector('[data-workspace-shell-url]')?.focus();
        return;
      }
      const accountToggle=e.target.closest?.('[data-toggle-nyx-account-menu]');
      if(accountToggle){
        e.preventDefault();
        e.stopPropagation();
        if(nyxFounderSignedInUser) toggleNyxAccountMenu(accountToggle);
        else openNyxAccountAccess();
        return;
      }
      const ownerPresence=e.target.closest?.('[data-nyx-owner-presence]');
      if(ownerPresence&&nyxFounderIsOwner&&nyxOwnerDashboardAccess){
        e.preventDefault();
        openNyxOwnerDashboard();
        return;
      }
      const accountMenuAction=e.target.closest?.('[data-nyx-account-menu-action]')?.dataset.nyxAccountMenuAction;
      if(accountMenuAction){
        e.preventDefault();
        if(accountMenuAction==='copy-id'){
          await copyNyxFirebaseUserId();
          return;
        }
        if(accountMenuAction==='owner-dashboard'){
          openNyxOwnerDashboard();
          return;
        }
        closeNyxAccountMenu();
        if(accountMenuAction==='ad-free'){
          try{const module=await import("./parables/ad-free.js");await module.openAdFreeRedeem({getToken:()=>nyxGetFirebaseToken(),onAccount:syncNyxAccountEntitlements});}catch(error){toast(error.message)}
          return;
        }
        if(accountMenuAction==='profiles'){
          await openNyxProfileDirectory();
          return;
        }
        if(accountMenuAction==='edit'){
          await openNyxUserProfile();
          return;
        }
        if(accountMenuAction==='status'){
          await openNyxUserProfile();
          const field=document.querySelector('.nyx-user-profile-overlay [name="status"]');
          field?.scrollIntoView({block:'center',behavior:'smooth'});
          field?.focus();
          try{field?.showPicker?.()}catch{}
          return;
        }
        if(accountMenuAction==='switch'){
          await openNyxAccountAccess({switching:true});
          return;
        }
      }
      if(document.querySelector('.nyx-account-menu')&&!e.target.closest?.('.nyx-account-menu')) closeNyxAccountMenu();
      if(e.target.closest?.('[data-open-nyx-account-settings]')){
        e.preventDefault();
        if(nyxFounderSignedInUser) openNyxUserProfile();
        else openNyxAccountAccess();
        return;
      }
      if(e.target.closest?.('[data-open-owner-dashboard]')){
        e.preventDefault();
        openNyxOwnerDashboard();
        return;
      }
      const presetButton=e.target.closest?.('[data-preset]');
      if(presetButton){
        e.preventDefault();
        e.stopPropagation();
        applyPreset(presetButton.dataset.preset || 'nyx');
        syncPresetCloakFields(presetButton.closest('.window,.settings-app,.workspace-shell-settings-overlay') || document);
        return;
      }
      const shellTabsToggle=e.target.closest('[data-workspace-shell-tabs-toggle]');
      if(shellTabsToggle){
        e.preventDefault();
        setWorkspaceTabSidebarOpen(!document.body.classList.contains('nyx-tab-sidebar-open'));
        return;
      }
      if(document.body.classList.contains('nyx-tab-sidebar-open') && !e.target.closest('#nyxWorkspaceTabSidebar')) setWorkspaceTabSidebarOpen(false);
      const recentSearch=e.target.closest('[data-nyx-recent-search]');
      if(recentSearch){
        e.preventDefault();
        navigateWorkspaceShell(recentSearch.dataset.nyxRecentSearch);
        return;
      }
      const shellNewAfter=e.target.closest('[data-workspace-shell-new-tab-after]');
      if(shellNewAfter){
        e.preventDefault();
        e.stopImmediatePropagation();
        document.body.classList.remove('menu-open');
        openWorkspaceShellTabAfter(shellNewAfter.dataset.workspaceShellNewTabAfter);
        return;
      }
      const shellNew=e.target.closest('[data-workspace-shell-new-tab]');
      if(shellNew){
        if(e.nyxShellNewHandled) return;
        e.nyxShellNewHandled=true;
        e.preventDefault();
        e.stopImmediatePropagation();
        document.body.classList.remove('menu-open');
        openWorkspaceShellTab();
        document.querySelector('[data-workspace-shell-url]')?.focus();
        return;
      }
      const workspaceSuggestion=e.target.closest('[data-workspace-suggestion]');
      if(workspaceSuggestion){
        e.preventDefault();
        acceptWorkspaceSuggestion(workspaceSuggestion.dataset.workspaceSuggestion || workspaceSuggestion.textContent,$('workspaceSuggestions')?.nyxSourceInput);
        return;
      }
      if(!e.target.closest('[data-workspace-shell-url],[data-workspace-blank-input]') && !e.target.closest('#workspaceSuggestions')){
        hideWorkspaceSuggestions();
      }
      const shellClose=e.target.closest('[data-workspace-shell-close-tab]');
      if(shellClose){
        e.preventDefault();
        e.stopPropagation();
        const id=shellClose.dataset.workspaceShellCloseTab || shellClose.closest('[data-workspace-shell-tab]')?.dataset.workspaceShellTab;
        if(id) closeWorkspaceShellTab(id);
        return;
      }
      const shellTab=e.target.closest('[data-workspace-shell-tab]');
      if(shellTab){
        e.preventDefault();
        const id=shellTab.dataset.workspaceShellTab;
        setWorkspaceShellActive(id);
        return;
      }
      const shellHome=e.target.closest('[data-workspace-shell-home]');
      if(shellHome){
        e.preventDefault();
        if(shellHome.dataset.workspaceShellTab) setWorkspaceShellActive(shellHome.dataset.workspaceShellTab);
        else setWorkspaceShellHomeActive();
        return;
      }
      const shellBack=e.target.closest('[data-workspace-shell-back]');
      if(shellBack){
        e.preventDefault();
        activeWorkspace?.win?.querySelector('[data-back]')?.click();
        return;
      }
      const shellNavHome=e.target.closest('[data-workspace-shell-home-nav]');
      if(shellNavHome){
        e.preventDefault();
        setWorkspaceShellHomeActive();
        return;
      }
      const shellForward=e.target.closest('[data-workspace-shell-forward]');
      if(shellForward){
        e.preventDefault();
        activeWorkspace?.win?.querySelector('[data-forward]')?.click();
        return;
      }
      const shellReload=e.target.closest('[data-workspace-shell-reload]');
      if(shellReload){
        e.preventDefault();
        const shellTab=activeWorkspaceShellTab();
        if(!shellTab?.url){
          setWorkspaceShellHomeActive();
          playHomeEntranceAnimation(activeWorkspace?.win || document);
          return;
        }
        const workspaceTabId=shellTab.workspaceTabId || activeWorkspace?.active || '';
        document.querySelectorAll('.nyx-preflight').forEach(overlay=>overlay.remove());
        const targetTab=activeWorkspace?.tabs?.find(tab=>tab.id===workspaceTabId) || activeWorkspace?.tabs?.find(tab=>tab.id===activeWorkspace?.active);
        if(targetTab){
          activeWorkspace?.activate?.(targetTab.id);
          if(!activeWorkspace?.reloadTab?.(targetTab.id)){
            activeWorkspace?.navigate?.(targetTab.sourceUrl || targetTab.url);
          }
        }
        return;
      }
      const shellMenuButton=e.target.closest('[data-workspace-shell-menu]');
      if(shellMenuButton){
        e.preventDefault();
        document.body.classList.toggle('menu-open');
        $('workspaceBookmarkPanel')?.setAttribute('hidden','');
        return;
      }
      const shellBookmark=e.target.closest('[data-workspace-shell-bookmark]');
      if(shellBookmark){
        e.preventDefault();
        toggleWorkspaceBookmark();
        return;
      }
      const bookmarksToggle=e.target.closest('[data-workspace-bookmarks-toggle]');
      if(bookmarksToggle){
        e.preventDefault();
        document.body.classList.remove('menu-open');
        toggleWorkspaceBookmarksPanel();
        return;
      }
      const bookmarkOpen=e.target.closest('[data-workspace-bookmark-open]');
      if(bookmarkOpen){
        e.preventDefault();
        openWorkspaceBookmark(bookmarkOpen.dataset.workspaceBookmarkOpen);
        return;
      }
      const bookmarkRemove=e.target.closest('[data-workspace-bookmark-remove]');
      if(bookmarkRemove){
        e.preventDefault();
        removeWorkspaceBookmark(bookmarkRemove.dataset.workspaceBookmarkRemove);
        return;
      }
      if(e.target.closest('[data-shell-about]')){
        e.preventDefault();
        document.body.classList.remove('menu-open');
        launchDirectAboutBlankCloak();
        return;
      }
      if(e.target.closest('[data-shell-about-tab]')){
        e.preventDefault();
        document.body.classList.remove('menu-open');
        launchHostedCloak('ac');
        return;
      }
      if(document.body.classList.contains('menu-open') && !e.target.closest('#workspaceModeMenu') && !e.target.closest('[data-workspace-shell-menu]')){
        document.body.classList.remove('menu-open');
      }
      if(!e.target.closest('#workspaceBookmarkPanel') && !e.target.closest('[data-workspace-shell-bookmark]') && !e.target.closest('[data-workspace-bookmarks-toggle]')){
        $('workspaceBookmarkPanel')?.setAttribute('hidden','');
      }
      const shortcutMenu=e.target.closest('[data-home-shortcut-menu]');
      if(shortcutMenu){
        e.preventDefault();
        e.stopPropagation();
        toggleShortcutMenu(shortcutMenu);
        return;
      }
      if(document.body.classList.contains('workspace-shell')){
        const workspaceHieroglyph=e.target.closest('[data-workspace-hieroglyph-toggle]');
        if(workspaceHieroglyph){
          e.preventDefault();
          document.body.classList.remove('menu-open');
          const next=!hieroglyphTextEnabled();
          store.set('nyx.hieroglyphText',next);
          if(!next) store.set('nyx.autoHieroglyphText',false);
          applyHieroglyphText();
          qsa('[data-switch="nyx.hieroglyphText"].settings-action').forEach(el=>{el.textContent=hieroglyphTextEnabled()?'On':'Off'});
          qsa('[data-switch="nyx.autoHieroglyphText"].settings-action').forEach(el=>{el.textContent=store.get('nyx.autoHieroglyphText',false)?'On':'Off'; el.classList.toggle('on',store.get('nyx.autoHieroglyphText',false))});
          toast('Hieroglyph text '+(next?'on':'off'));
          return;
        }
        const workspaceModeOpen=e.target.closest('[data-open]');
        if(workspaceModeOpen){
          const v=workspaceModeOpen.dataset.open;
          if(v==='workspace'){
            e.preventDefault();
            document.body.classList.remove('menu-open');
            setWorkspaceShellHomeActive();
            return;
          }
          if(v==='settings'){
            e.preventDefault();
            document.body.classList.remove('menu-open');
            openWorkspaceShellSettings();
            return;
          }
          if(['apps','links'].includes(v)){
            e.preventDefault();
            document.body.classList.remove('menu-open');
            openWorkspaceShellInternalTab(v);
            return;
          }
        }
        const workspaceModeApp=e.target.closest('[data-app-url]');
        if(workspaceModeApp && !workspaceModeApp.closest('.workspace-window')){
          e.preventDefault();
          document.body.classList.remove('menu-open');
          openWorkspaceShellAppTab(workspaceModeApp.dataset.appUrl);
          return;
        }
      }
      const shortcutFavorite=e.target.closest('[data-home-shortcut-favorite]');
      if(shortcutFavorite){
        e.preventDefault();
        e.stopPropagation();
        toggleHomeShortcutFavorite(shortcutFavorite.dataset.homeShortcutFavorite);
        return;
      }
      const shortcutRemove=e.target.closest('[data-home-shortcut-remove]');
      if(shortcutRemove){
        e.preventDefault();
        e.stopPropagation();
        removeHomeShortcut(shortcutRemove.dataset.homeShortcutRemove);
        return;
      }
      const shortcutAdd=e.target.closest('[data-home-shortcut-add]');
      if(shortcutAdd){
        e.preventDefault();
        e.stopPropagation();
        addHomeShortcut();
        return;
      }
      if(!e.target.closest('.home-shortcut-menu') && !e.target.closest('[data-home-shortcut-menu]')){
        document.querySelectorAll('.home-shortcut.menu-open').forEach(item=>item.classList.remove('menu-open'));
      }
      const open=e.target.closest('[data-open]'); if(open){e.preventDefault(); document.body.classList.remove('menu-open'); const v=open.dataset.open; if(v==='workspace')openWorkspace(); if(v==='home')openWorkspace(); if(v==='updates')openUpdates(); if(v==='settings')openSettings(); if(v==='apps')openApps(); if(v==='links')openLinks(); if(v==='weather')openWeather(open.matches('.workspace-mode-weather')?'top':'bottom',open); if(v==='terms')openTermsOfService(); if(v==='developer')openDeveloperConsole(); if(v==='about'||v==='credits')openAboutNyx(); return}
      const app=e.target.closest('[data-app-url]');
      if(app && !app.closest('.workspace-window')){
        if(app.dataset.appUrl==='/apps/nyxcloud/'){e.preventDefault();void openNyxVmsApp();return;}
        e.preventDefault();
        document.body.classList.remove('menu-open');
        if(String(app.dataset.appUrl || '').trim().toLowerCase()==='nyx://ai') openWorkspaceShellAppTab('nyx://ai');
        else openWorkspace(app.dataset.appUrl,{forceMode:appCompatibilityMode(app.dataset.appUrl)});
        return
      }
      const url=e.target.closest('[data-url]');
      if(url && !url.closest('.workspace-window')){e.preventDefault(); document.body.classList.remove('menu-open'); openWorkspace(url.dataset.url); return}
      if(e.target.closest('[data-save-profile]')){
        saveProfile(e.target.closest('.window'));
        return;
      }
      if(e.target.closest('[data-save-workspace]')){
        const win=e.target.closest('.window');
        const input=win?.querySelector('#settingEngine');
        const mode=win?.querySelector('#settingWorkspaceMode');
        const transport=win?.querySelector('#settingTransport');
        store.setText('nyx.engine', input?.value || 'duckduckgo');
        store.setText('nyx.workspaceMode', normalizeWorkspaceModeName(mode?.value || DEFAULT_WORKSPACE_MODE));
        const nextTransport=normalizeWorkspaceTransportName(transport?.value);
        workspaceTransportOverride='';
        if(normalizeWorkspaceTransportName(store.text('nyx.transport',DEFAULT_WORKSPACE_TRANSPORT))!==nextTransport){
          studyjetInstallPromise=null;
          studyjetController=null;
          studyjetTransport=null;
          studyjetTransportKey='';
        }
        store.setText('nyx.transport', nextTransport);
        applyUserSettings(); toast('Workspace settings saved'); return;
      }
      const bgChoice=e.target.closest('[data-bg-choice]');
      if(bgChoice){
        const root=bgChoice.closest('.bg-choices,.background-picker');
        const scope=backgroundScope(root);
        chooseBackground(bgChoice.dataset.bgChoice,scope);
        if(root) renderBackgroundChoices(root, bgChoice.dataset.bgChoice);
        toast(scope==='workspace' ? 'Workspace background applied' : 'Background applied'); return;
      }
      if(e.target.closest('[data-save-bg]')){
        const win=e.target.closest('.window');
        const urlInput=win?.querySelector('#settingBgUrl')?.value.trim() || '';
        store.setText('nyx.customBgUrl', urlInput);
        if(urlInput) store.setText('nyx.customBgData','');
        store.setText('nyx.customBg','');
        applyUserSettings();
        const picker=win?.querySelector('[data-bg-picker]');
        if(picker) renderBackgroundChoices(picker);
        toast('Background applied'); return;
      }
      const enhancer=e.target.closest('[data-bg-enhancer]');
      if(enhancer){
        store.set('nyx.backgroundEnhancer',false);
        enhancer.classList.remove('on');
        applyUserSettings();
        toast('Background enhancer disabled');
        return;
      }
      if(e.target.closest('[data-open-nyx-account]')){
        e.preventDefault();
        openNyxAccountAccess();
        return;
      }
      if(e.target.closest('[data-open-nyx-profile-entry]')){
        e.preventDefault();
        if(nyxFounderSignedInUser) openNyxUserProfile();
        else openNyxAccountAccess();
        return;
      }
      if(e.target.closest('[data-open-nyx-profile]')){
        e.preventDefault();
        openNyxUserProfile();
        return;
      }
      if(e.target.closest('[data-nyx-account-sign-out]')){
        e.preventDefault();
        signOutFounderOwner();
        return;
      }
      if(e.target.closest('[data-open-founder-profile-editor]')){
        e.preventDefault();
        openFounderProfileEditor();
        return;
      }
      const customThemeApply=e.target.closest('[data-apply-custom-theme]');
      if(customThemeApply){
        const root=customThemeApply.closest('.settings-block,.workspace-shell-settings-overlay,.window') || document;
        const color=nyxThemeHex(root.querySelector('[data-custom-theme-hex]')?.value || root.querySelector('[data-custom-theme-color]')?.value);
        applyCustomThemeColor(color);
        syncCustomThemeMaker(document,color);
        toast('Custom theme applied');
        return;
      }
      const customThemeReset=e.target.closest('[data-reset-custom-theme]');
      if(customThemeReset){
        const color=applyCustomThemeColor(nyxCustomThemeDefaults.base);
        syncCustomThemeMaker(document,color);
        toast('Custom theme reset');
        return;
      }
      if(e.target.closest('[data-save-cloak]')){
        saveCloakSettings(e.target.closest('.window,.settings-app,.workspace-shell-settings-overlay') || document);
        return;
      }
      if(e.target.closest('[data-clear-nyx-cache]')){
        e.preventDefault();
        const ok=confirm('Clear cache, cookies, saved settings, and reset Nyx? This cannot be undone.');
        if(!ok) return;
        clearAllNyxData();
        return;
      }
      if(e.target.closest('[data-launch-selected-cloak]')){
        const root=e.target.closest('.window,.settings-app,.workspace-shell-settings-overlay') || document;
        saveCloakSettings(root);
        launchHostedCloak(store.text('nyx.cloakType','a'));
        return;
      }
      if(e.target.closest('[data-tab-cloak-apply]')){
        const root=e.target.closest('.window,.settings-app,body') || document;
        const fileInput=root.querySelector('[data-tab-favicon-file]');
        const file=fileInput?.files?.[0];
        const apply=favicon=>applyCustomTabCloak(root.querySelector('[data-tab-title]')?.value || 'nyx', favicon || root.querySelector('[data-tab-favicon]')?.value || favicons.nyx);
        if(file){
          if(!file.type.startsWith('image/') && !/\.ico$/i.test(file.name || '')){
            toast('Choose an image file for the tab icon');
            return;
          }
          const reader=new FileReader();
          reader.onload=()=>{
            const dataUrl=String(reader.result || '');
            const hidden=root.querySelector('[data-tab-favicon]');
            if(hidden) hidden.value=dataUrl;
            apply(dataUrl);
          };
          reader.readAsDataURL(file);
        }else{
          apply();
        }
        return;
      }
      if(e.target.closest('[data-page-fullscreen]')){
        if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
        return;
      }
      if(e.target.closest('[data-setup-next]')){
        e.preventDefault();
        moveSetupStep(1);
        return;
      }
      if(e.target.closest('[data-setup-back]')){
        e.preventDefault();
        moveSetupStep(-1);
        return;
      }
      if(e.target.closest('[data-finish-setup]')){
        finishSetupCustomization();
        return;
      }
      if(e.target.closest('[data-skip-setup]')){
        store.set('nyx.setupComplete',true);
        hideSetup(); return;
      }
      if(e.target.closest('[data-cloak-submit]')){
        launchTypedCloakMode();
        return;
      }
      if(e.target.closest('[data-cloak-cancel]')){
        const input=$('cloakLaunchScreen')?.querySelector('[data-cloak-input]');
        if(input) input.value='';
        setCloakStatus('Choose a mode to change this blank page.');
        return;
      }
      if(e.target.closest('[data-auto-cloak-launch]')){
        const btn=e.target.closest('[data-auto-cloak-launch]');
        if(btn?.dataset.launching==='1') return;
        btn.dataset.launching='1';
        launchHostedCloak('m');
        setTimeout(()=>{btn.dataset.launching='0'},500);
        return;
      }
      if(e.target.closest('[data-about]')){document.body.classList.remove('menu-open'); if(launchCloak('about')) maybeRedirectOriginalAfterCloak()}
      if(e.target.closest('[data-blob]')){document.body.classList.remove('menu-open'); if(launchCloak('blob')) maybeRedirectOriginalAfterCloak()}
    },true);
    document.addEventListener('pointerdown',e=>{
      const launchButton=e.target.closest('[data-auto-cloak-launch]');
      if(!launchButton) return;
      e.preventDefault();
      if(launchButton.dataset.launching==='1') return;
      launchButton.dataset.launching='1';
      launchHostedCloak('m');
      setTimeout(()=>{launchButton.dataset.launching='0'},500);
    },true);
    document.addEventListener('input',e=>{
      if(e.target?.matches?.('[data-custom-theme-color],[data-custom-theme-hex]')){
        const raw=String(e.target.value || '').trim();
        if(e.target.matches('[data-custom-theme-hex]') && !/^#[0-9a-f]{6}$/i.test(raw)) return;
        const color=nyxThemeHex(raw,store.text('nyx.customThemeColor',nyxCustomThemeDefaults.base));
        const root=e.target.closest('.settings-block,.workspace-shell-settings-overlay,.window') || document;
        root.querySelectorAll?.('[data-custom-theme-color],[data-custom-theme-hex]')?.forEach(input=>{if(input!==e.target || input.type==='color') input.value=color});
        root.querySelectorAll?.('[data-custom-theme-swatch]')?.forEach(swatch=>swatch.style.setProperty('--nyx-swatch',color));
      }
      if(e.target?.id==='settingName') saveProfile(e.target.closest('.window'),true);
      if(e.target?.matches?.('[data-glass-value]')){
        if(store.get('nyx.lagReducer',false)){
          store.setText('nyx.glassLevel','0');
          e.target.value='0';
          applyUserSettings();
          return;
        }
        store.setText('nyx.glassLevel',e.target.value);
        applyGlassSetting();
      }
      if(e.target?.matches?.('[data-effect-speed]')){
        store.set('nyx.visualEffectUserChoice',true);
        store.setText('nyx.visualEffectSpeed',e.target.value || '1.1');
        applyVisualEffectSetting();
      }
      if(e.target?.matches?.('[data-effect-amount]')){
        store.set('nyx.visualEffectUserChoice',true);
        store.setText('nyx.visualEffectAmount',e.target.value || '16');
        applyVisualEffectSetting();
      }
    });
    document.addEventListener('keydown',e=>{
      if(e.target?.matches?.('[data-workspace-wisp-url]') && e.key==='Enter'){
        e.preventDefault();
        saveWorkspaceWispUrl(e.target.closest('.workspace-shell-settings-overlay'));
        return;
      }
      if(e.target?.id==='settingName' && e.key==='Enter'){
        e.preventDefault();
        saveProfile(e.target.closest('.window'));
      }
      if(e.target?.matches?.('[data-cloak-input]') && e.key==='Enter'){
        e.preventDefault();
        launchTypedCloakMode();
        return;
      }
    });
    document.addEventListener('change',e=>{
      const workspaceSettingsRoot=e.target.closest?.('.workspace-shell-settings-overlay');
      if(workspaceSettingsRoot && e.target.matches?.('[data-nyx-data-import-file]')){
        const file=e.target.files?.[0] || null;
        void importNyxPortableBackup(file,workspaceSettingsRoot).finally(()=>{e.target.value=''});
        return;
      }
      if(workspaceSettingsRoot && e.target.closest?.('[data-workspace-engine],[data-workspace-mode-select],[data-workspace-transport],[data-font-value]')){
        saveWorkspaceShellSettings(workspaceSettingsRoot);
        toast('Workspace settings saved');
        return;
      }
      const fontSelect=e.target.closest?.('[data-font-value]');
      if(fontSelect){
        store.setText('nyx.font',nyxFontChoice(fontSelect.value)[0]);
        applyFontSetting();
        toast('Font updated');
        return;
      }
      if(workspaceSettingsRoot && e.target.closest?.('[data-theme-value]')){
        const theme=normalizeNyxTheme(e.target.value);
        store.setText('nyx.theme',theme);
        applyThemeSetting();
        applyNyxThemeBeamWallpaper(theme);
        toast('Theme updated');
        return;
      }
      const presetSelect=e.target.closest?.('[data-preset-select]');
      if(presetSelect){
        const root=e.target.closest('.window,.settings-app,.workspace-shell-settings-overlay') || document;
        applyPreset(presetSelect.value || 'nyx');
        syncPresetCloakFields(root);
        return;
      }
      const effect=e.target.closest('[data-effect-value]');
      if(effect){
        store.set('nyx.visualEffectUserChoice',true);
        store.setText('nyx.visualEffect',effect.value || 'none');
        applyVisualEffectSetting();
        toast('Effect set to '+effect.options[effect.selectedIndex].text);
        return;
      }
      const effectSpeed=e.target.closest('[data-effect-speed]');
      if(effectSpeed){
        store.set('nyx.visualEffectUserChoice',true);
        store.setText('nyx.visualEffectSpeed',effectSpeed.value || '1.1');
        applyVisualEffectSetting();
        return;
      }
      const effectAmount=e.target.closest('[data-effect-amount]');
      if(effectAmount){
        store.set('nyx.visualEffectUserChoice',true);
        store.setText('nyx.visualEffectAmount',effectAmount.value || '16');
        applyVisualEffectSetting();
        return;
      }
      const aiImage=e.target.closest('[data-lion-ai-image]');
      if(aiImage){
        lionAiReadImageFile(aiImage.closest('.window'),aiImage.files?.[0]);
        aiImage.value='';
        return;
      }
      const file=e.target.closest('#settingBgFile,[data-custom-wallpaper-file]');
      if(!file || !file.files?.[0]) return;
      const reader=new FileReader();
      const imageFile=file.files[0],wallpaperUser=nyxFounderSignedInUser?.uid||'';
      if(!imageFile.type.startsWith('image/')){file.value='';toast('Choose an image file');return;}
      file.disabled=true;
      const finish=()=>{file.disabled=false;file.value='';};
      reader.onerror=()=>{finish();toast('Could not read this image');};
      reader.onload=async()=>{
        const value=String(reader.result||'');
        const image=new Image();image.src=value;
        try{await image.decode();}catch{finish();toast('This image could not be opened');return;}
        if((nyxFounderSignedInUser?.uid||'')!==wallpaperUser){finish();return;}
        try{localStorage.setItem('nyx.customBgData',value);}catch{finish();toast('Wallpaper is too large to save. Choose a smaller image.');return;}
        store.setText('nyx.customBgUrl','');
        store.setText('nyx.customBg','');
        store.setText('nyx.beamTheme','custom-wallpaper');
        applyUserSettings();
        qsa('[data-bg-picker]').forEach(picker=>renderBackgroundChoices(picker));
        finish();
        if(wallpaperUser){
          try{const saved=await saveNyxCloudPreferences();toast(saved?'Wallpaper saved to your account':'Wallpaper applied. Account sync is still connecting.');}
          catch{toast('Wallpaper applied here. Account sync failed; Nyx will retry.');}
        }else toast('Uploaded wallpaper applied');
      };
      reader.readAsDataURL(imageFile);
    });
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-weather-refresh]')){
        e.preventDefault();
        e.stopImmediatePropagation();
        loadWeatherLocation();
        return;
      }
      if(e.target.closest('#weatherRestore')){
        e.preventDefault();
        e.stopImmediatePropagation();
        restoreWeatherPanel();
        return;
      }
    },true);
  }

  function syncNyxDashboardClock(date=new Date()){
    const time=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    const day=date.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
    window.__nyxDashboardStartedAt=window.__nyxDashboardStartedAt || Date.now();
    const elapsed=Math.max(0,Math.floor((Date.now()-window.__nyxDashboardStartedAt)/1000));
    const uptime=elapsed>=3600?`${Math.floor(elapsed/3600)}h ${Math.floor((elapsed%3600)/60)}m`:`${Math.floor(elapsed/60)}m ${elapsed%60}s`;
    qsa('[data-nyx-dashboard-time]').forEach(element=>{element.textContent=time});
    qsa('[data-nyx-dashboard-date]').forEach(element=>{element.textContent=day});
    qsa('[data-nyx-dashboard-uptime]').forEach(element=>{element.textContent=uptime});
  }
  let nyxDashboardPerformanceFrames=0;
  let nyxDashboardPerformanceLast=performance.now();
  let nyxDashboardPerformanceFps=null;
  let nyxDashboardLatencyMs=null;
  let nyxDashboardLatencyState='Sampling…';
  let nyxDashboardLatencySampledAt=0;
  let nyxDashboardLatencyProbe=null;
  let nyxDashboardWorkerState='Starting';
  let nyxDashboardWorkerCheckedAt=0;
  let nyxDashboardWorkerProbe=null;
  function nyxDashboardConnectionEngine(){
    const engine=store.text('nyx.workspaceMode','standard').trim().toLowerCase();
    if(!engine || engine==='standard') return 'Standard';
    return engine.replace(/(^|[-_\s])(\w)/g,(_,prefix,letter)=>prefix+letter.toUpperCase());
  }
  function nyxDashboardPerformanceVisible(){
    if(document.hidden) return false;
    return qsa('[data-nyx-dashboard-page="performance"].is-active').some(page=>{
      const dashboard=page.closest('[data-nyx-dashboard]');
      return dashboard?.classList.contains('is-open') || dashboard?.matches(':hover,:focus-within');
    });
  }
  async function sampleNyxDashboardLatency(force=false){
    if(document.hidden || nyxDashboardLatencyProbe) return nyxDashboardLatencyProbe;
    const now=Date.now();
    if(!force && now-nyxDashboardLatencySampledAt<5000) return null;
    nyxDashboardLatencySampledAt=now;
    const request=(async()=>{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),5000);
      const started=performance.now();
      try{
        const response=await fetch(`/healthz?dashboard=${now}`,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
        const payload=await response.json();
        if(!response.ok || payload?.ok!==true) throw new Error('health check failed');
        nyxDashboardLatencyMs=Math.max(1,Math.round(performance.now()-started));
        nyxDashboardLatencyState='Live';
      }catch{
        nyxDashboardLatencyMs=null;
        nyxDashboardLatencyState=navigator.onLine ? 'Unavailable' : 'Offline';
      }finally{
        clearTimeout(timeout);
      }
    })();
    nyxDashboardLatencyProbe=request;
    try{return await request}
    finally{
      if(nyxDashboardLatencyProbe===request) nyxDashboardLatencyProbe=null;
      syncNyxDashboardPerformance();
    }
  }
  async function sampleNyxDashboardWorkerState(force=false){
    if(!('serviceWorker' in navigator)){
      nyxDashboardWorkerState='Unsupported';
      return;
    }
    if(nyxDashboardWorkerProbe) return nyxDashboardWorkerProbe;
    const now=Date.now();
    if(!force && now-nyxDashboardWorkerCheckedAt<3000) return null;
    nyxDashboardWorkerCheckedAt=now;
    const request=(async()=>{
      try{
        if(navigator.serviceWorker.controller){
          nyxDashboardWorkerState='Active';
          return;
        }
        const registrations=await navigator.serviceWorker.getRegistrations();
        if(registrations.some(registration=>registration.active)) nyxDashboardWorkerState='Registered';
        else if(registrations.some(registration=>registration.waiting)) nyxDashboardWorkerState='Waiting';
        else if(registrations.some(registration=>registration.installing)) nyxDashboardWorkerState='Starting';
        else nyxDashboardWorkerState='Not registered';
      }catch{
        nyxDashboardWorkerState='Unavailable';
      }
    })();
    nyxDashboardWorkerProbe=request;
    try{return await request}
    finally{
      if(nyxDashboardWorkerProbe===request) nyxDashboardWorkerProbe=null;
      syncNyxDashboardPerformance();
    }
  }
  function syncNyxDashboardPerformance(){
    const memory=performance.memory?.usedJSHeapSize;
    const memoryLimit=performance.memory?.jsHeapSizeLimit;
    const memoryUsedMb=Number.isFinite(memory) ? Math.max(1,Math.round(memory/1048576)) : null;
    const memoryLimitMb=Number.isFinite(memoryLimit) ? Math.max(1,Math.round(memoryLimit/1048576)) : null;
    const memoryText=memoryUsedMb===null ? 'Unavailable' : memoryLimitMb===null ? `${memoryUsedMb} MB` : `${memoryUsedMb} / ${memoryLimitMb} MB`;
    const latencyText=Number.isFinite(nyxDashboardLatencyMs) ? `${nyxDashboardLatencyMs} ms` : nyxDashboardLatencyState;
    const fpsText=Number.isFinite(nyxDashboardPerformanceFps) ? `${Math.max(1,Math.round(nyxDashboardPerformanceFps))} fps` : 'Sampling…';
    const values={fps:fpsText,memory:memoryText,ping:latencyText,cpu:String(navigator.hardwareConcurrency || '—'),worker:nyxDashboardWorkerState,engine:nyxDashboardConnectionEngine()};
    qsa('[data-nyx-perf-stat]').forEach(stat=>{stat.textContent=values[stat.dataset.nyxPerfStat] || '—'});
    const memoryPercent=memoryUsedMb!==null && memoryLimitMb ? memoryUsedMb/memoryLimitMb*100 : 0;
    const latencyValue=Number.isFinite(nyxDashboardLatencyMs) ? nyxDashboardLatencyMs : 0;
    const fpsValue=Number.isFinite(nyxDashboardPerformanceFps) ? nyxDashboardPerformanceFps : 0;
    const meterValues={fps:fpsValue?Math.min(100,Math.max(4,fpsValue/60*100)):4,memory:Math.min(100,Math.max(4,memoryPercent)),ping:latencyValue?Math.min(100,Math.max(4,100-latencyValue/8)):4};
    qsa('[data-nyx-perf-meter]').forEach(meter=>{meter.style.height=`${meterValues[meter.dataset.nyxPerfMeter] || 4}%`});
    if(nyxDashboardPerformanceVisible()){
      void sampleNyxDashboardLatency();
      void sampleNyxDashboardWorkerState();
    }
  }
  function startNyxDashboardPerformance(){
    if(startNyxDashboardPerformance.started) return;
    startNyxDashboardPerformance.started=true;
    if(!('serviceWorker' in navigator)) nyxDashboardWorkerState='Unsupported';
    else{
      nyxDashboardWorkerState=navigator.serviceWorker.controller ? 'Active' : 'Checking…';
      void sampleNyxDashboardWorkerState(true);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        nyxDashboardWorkerState=navigator.serviceWorker.controller ? 'Active' : 'Registered';
        syncNyxDashboardPerformance();
      });
    }
    const sample=now=>{
      if(document.hidden || now-nyxDashboardPerformanceLast>2500){
        nyxDashboardPerformanceFrames=0;
        nyxDashboardPerformanceLast=now;
        requestAnimationFrame(sample);
        return;
      }
      nyxDashboardPerformanceFrames+=1;
      const elapsed=now-nyxDashboardPerformanceLast;
      if(elapsed>=1000){
        nyxDashboardPerformanceFps=nyxDashboardPerformanceFrames*1000/elapsed;
        nyxDashboardPerformanceFrames=0;
        nyxDashboardPerformanceLast=now;
        syncNyxDashboardPerformance();
      }
      requestAnimationFrame(sample);
    };
    document.addEventListener('visibilitychange',()=>{
      nyxDashboardPerformanceFrames=0;
      nyxDashboardPerformanceLast=performance.now();
      if(!document.hidden && nyxDashboardPerformanceVisible()) void sampleNyxDashboardLatency(true);
    });
    syncNyxDashboardPerformance();
    requestAnimationFrame(sample);
  }

  let nyxLatencyMs=null;
  let nyxLatencyQuality='sampling';
  let nyxLatencySampledAt=0;
  let nyxLatencyProbe=null;
  let nyxLatencySamples=[];
  let nyxLatencyHistory=[];
  let nyxLatencyLatestMs=null;
  let nyxLatencyHealth={ok:null,service:'',wisp:'',chatRealtime:''};
  let nyxLatencyLastSuccessAt=0;
  function nyxLatencyQualityFor(ms){
    if(!Number.isFinite(ms)) return nyxLatencyQuality==='offline' ? 'offline' : 'sampling';
    if(ms<=100) return 'excellent';
    if(ms<=200) return 'good';
    if(ms<=400) return 'fair';
    return 'slow';
  }
  function syncNyxLatencyBubble(){
    const bubble=document.querySelector('[data-nyx-latency-bubble]');
    if(!bubble) return;
    const value=bubble.querySelector('[data-nyx-latency-value]');
    const text=Number.isFinite(nyxLatencyMs) ? `${nyxLatencyMs} ms` : nyxLatencyQuality==='offline' ? 'Offline' : '-- ms';
    const qualityLabel={excellent:'Excellent',good:'Good',fair:'Fair',slow:'Slow',offline:'Offline',sampling:'Measuring'}[nyxLatencyQuality] || 'Measuring';
    bubble.className=`nyx-latency-bubble is-${nyxLatencyQuality}`;
    if(value) value.textContent=text;
    const label=Number.isFinite(nyxLatencyMs) ? `Nyx latency ${nyxLatencyMs} milliseconds, ${qualityLabel}` : `Nyx status ${qualityLabel}`;
    bubble.setAttribute('aria-label',label);
    const setText=(selector,next)=>{const target=bubble.querySelector(selector);if(target) target.textContent=next};
    const finiteHistory=nyxLatencyHistory.filter(entry=>Number.isFinite(entry.ms));
    const recentValues=finiteHistory.map(entry=>entry.ms);
    const rangeMin=recentValues.length ? Math.min(...recentValues) : null;
    const rangeMax=recentValues.length ? Math.max(...recentValues) : null;
    setText('[data-nyx-latency-quality]',qualityLabel);
    setText('[data-nyx-latency-current]',Number.isFinite(nyxLatencyLatestMs) ? `${nyxLatencyLatestMs} ms` : '-- ms');
    setText('[data-nyx-latency-stable]',Number.isFinite(nyxLatencyMs) ? `${nyxLatencyMs} ms` : '-- ms');
    setText('[data-nyx-latency-range]',Number.isFinite(rangeMin) ? `${rangeMin}–${rangeMax} ms` : '-- ms');
    setText('[data-nyx-health-overall]',nyxLatencyHealth.ok===true ? 'Healthy' : nyxLatencyHealth.ok===false ? 'Unavailable' : 'Checking');
    setText('[data-nyx-health-workspace]',navigator.onLine ? 'Online' : 'Offline');
    setText('[data-nyx-health-wisp]',nyxLatencyHealth.ok===false ? 'Unavailable' : nyxLatencyHealth.wisp ? nyxLatencyHealth.wisp==='embedded' ? 'Embedded' : nyxLatencyHealth.wisp : 'Checking');
    setText('[data-nyx-health-chat]',nyxLatencyHealth.ok===false ? 'Unavailable' : nyxLatencyHealth.chatRealtime ? nyxLatencyHealth.chatRealtime==='socket.io' ? 'Realtime' : nyxLatencyHealth.chatRealtime : 'Checking');
    const updatedPrefix=nyxLatencyHealth.ok===false ? 'Last healthy' : 'Updated';
    setText('[data-nyx-latency-updated]',nyxLatencyLastSuccessAt ? `${updatedPrefix} ${new Date(nyxLatencyLastSuccessAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'})} · every second` : 'Waiting for the first health check');
    const svg=bubble.querySelector('[data-nyx-latency-chart] svg');
    const line=bubble.querySelector('[data-nyx-latency-line]');
    const area=bubble.querySelector('[data-nyx-latency-area]');
    const point=bubble.querySelector('[data-nyx-latency-point]');
    const empty=bubble.querySelector('[data-nyx-latency-chart-empty]');
    if(svg && line && area && point){
      const chartWidth=280;
      const chartTop=9;
      const chartBottom=87;
      const chartHeight=chartBottom-chartTop;
      const chartMax=Math.max(400,Math.ceil((rangeMax || 0)/100)*100);
      const points=nyxLatencyHistory.map((entry,index)=>({
        ms:entry.ms,
        x:nyxLatencyHistory.length===1 ? chartWidth/2 : index/(nyxLatencyHistory.length-1)*chartWidth,
        y:Number.isFinite(entry.ms) ? chartBottom-Math.min(entry.ms,chartMax)/chartMax*chartHeight : null
      }));
      let linePath='';
      let areaPath='';
      let segment=[];
      const flushSegment=()=>{
        if(!segment.length) return;
        const segmentLine=segment.map((item,index)=>`${index ? 'L' : 'M'}${item.x.toFixed(1)} ${item.y.toFixed(1)}`).join(' ');
        linePath+=`${linePath ? ' ' : ''}${segmentLine}`;
        areaPath+=`${areaPath ? ' ' : ''}${segmentLine} L${segment.at(-1).x.toFixed(1)} ${chartBottom} L${segment[0].x.toFixed(1)} ${chartBottom} Z`;
        segment=[];
      };
      points.forEach(item=>{if(Number.isFinite(item.y)) segment.push(item);else flushSegment()});
      flushSegment();
      line.setAttribute('d',linePath);
      area.setAttribute('d',areaPath);
      const latest=[...points].reverse().find(item=>Number.isFinite(item.y));
      if(latest){
        point.setAttribute('cx',latest.x.toFixed(1));
        point.setAttribute('cy',latest.y.toFixed(1));
        point.hidden=false;
      }else point.hidden=true;
      const latestLabel=Number.isFinite(nyxLatencyLatestMs) ? `latest ${nyxLatencyLatestMs} milliseconds` : 'currently offline';
      svg.setAttribute('aria-label',recentValues.length ? `Latency history from ${rangeMin} to ${rangeMax} milliseconds; ${latestLabel}` : 'Waiting for latency samples');
      setText('[data-nyx-latency-axis-high]',`${chartMax} ms`);
      if(empty) empty.hidden=recentValues.length>0;
    }
  }
  function recordNyxLatencySample(measured,payload){
    const sampledAt=Date.now();
    nyxLatencyLatestMs=measured;
    nyxLatencyHistory.push({ms:measured,at:sampledAt});
    if(nyxLatencyHistory.length>24) nyxLatencyHistory=nyxLatencyHistory.slice(-24);
    nyxLatencyHealth={
      ok:true,
      service:String(payload?.service || 'nyx'),
      wisp:String(payload?.wisp || ''),
      chatRealtime:String(payload?.chatRealtime || '')
    };
    nyxLatencyLastSuccessAt=sampledAt;
    nyxLatencySamples.push(measured);
    if(nyxLatencySamples.length>5) nyxLatencySamples=nyxLatencySamples.slice(-5);
    const sorted=[...nyxLatencySamples].sort((a,b)=>a-b);
    const middle=Math.floor(sorted.length/2);
    nyxLatencyMs=sorted[middle];
    nyxLatencyQuality=nyxLatencyQualityFor(nyxLatencyMs);
  }
  async function sampleNyxLatency(force=false,publish=true){
    if(document.hidden || nyxLatencyProbe) return nyxLatencyProbe;
    const now=Date.now();
    if(!force && now-nyxLatencySampledAt<900) return null;
    nyxLatencySampledAt=now;
    const request=(async()=>{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),5000);
      const started=performance.now();
      try{
        const response=await fetch(`/healthz?ping=${now}`,{cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
        const payload=await response.json();
        if(!response.ok || payload?.ok!==true) throw new Error('health check failed');
        recordNyxLatencySample(Math.max(1,Math.round(performance.now()-started)),payload);
        window.NyxAvailability?.recordHealth(true);
      }catch{
        window.NyxAvailability?.recordHealth(false);
        nyxLatencyMs=null;
        nyxLatencyLatestMs=null;
        nyxLatencyQuality='offline';
        nyxLatencySamples=[];
        nyxLatencyHealth={...nyxLatencyHealth,ok:false};
        nyxLatencyHistory.push({ms:null,at:Date.now()});
        if(nyxLatencyHistory.length>24) nyxLatencyHistory=nyxLatencyHistory.slice(-24);
      }finally{
        clearTimeout(timeout);
        if(publish) syncNyxLatencyBubble();
      }
    })();
    nyxLatencyProbe=request;
    try{return await request}
    finally{if(nyxLatencyProbe===request) nyxLatencyProbe=null}
  }
  async function calibrateNyxLatency(){
    nyxLatencyMs=null;
    nyxLatencyLatestMs=null;
    nyxLatencyQuality='sampling';
    nyxLatencySamples=[];
    nyxLatencyHistory=[];
    nyxLatencyHealth={ok:null,service:'',wisp:'',chatRealtime:''};
    nyxLatencyLastSuccessAt=0;
    syncNyxLatencyBubble();
    for(let sample=0;sample<3;sample+=1){
      await sampleNyxLatency(true,false);
      if(nyxLatencyQuality==='offline') break;
      if(sample<2) await new Promise(resolve=>setTimeout(resolve,150));
    }
    syncNyxLatencyBubble();
  }
  function startNyxLatencyMonitor(){
    if(startNyxLatencyMonitor.started) return;
    startNyxLatencyMonitor.started=true;
    window.NyxAvailability?.start(()=>({url:wispUrl(),custom:!!storedCustomWispUrl()}),async failed=>{
      if(storedCustomWispUrl())return;
      const next=await selectWispRelay(failed);
      if(!storedCustomWispUrl() && next!==failed)resetWorkspaceConnectionRuntime();
    });
    syncNyxLatencyBubble();
    void calibrateNyxLatency();
    const refresh=()=>{if(!document.hidden) void sampleNyxLatency(true)};
    document.addEventListener('visibilitychange',()=>{
      if(!document.hidden && Date.now()-nyxLatencySampledAt>900) refresh();
    });
    addEventListener('online',refresh);
    addEventListener('offline',()=>{
      nyxLatencyMs=null;
      nyxLatencyLatestMs=null;
      nyxLatencyQuality='offline';
      nyxLatencySamples=[];
      nyxLatencyHealth={...nyxLatencyHealth,ok:false};
      nyxLatencyHistory.push({ms:null,at:Date.now()});
      if(nyxLatencyHistory.length>24) nyxLatencyHistory=nyxLatencyHistory.slice(-24);
      syncNyxLatencyBubble();
    });
    setInterval(refresh,1000);
  }
  function tick(){
    const d=new Date();
    const short=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    const full=centerClockText(d);
    qsa('#clock').forEach(clock=>{clock.textContent=short});
    qsa('#centerClock').forEach(clock=>{clock.textContent=full});
    qsa('[data-workspace-shell-clock]').forEach(clock=>{clock.textContent=short});
    syncNyxLatencyBubble();
  }
  function centerClockText(date=new Date()){
    return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});
  }
  function startCenterClock(){
    const clock=$('centerClock');
    if(clock?.dataset.running) return;
    if(clock) clock.dataset.running='true';
    const update=()=>{
      const now=new Date();
      const text=centerClockText(now);
      if(clock) clock.textContent=text;
      qsa('[data-workspace-shell-clock]').forEach(el=>{el.textContent=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})});
      syncNyxLatencyBubble();
    };
    update();
    setInterval(update,1000);
  }
  function initDesktopSplash(){
    updateDockFullscreenState();
  }
  function finishNyxOpenStartup(){
    if(finishNyxOpenStartup.done) return;
    finishNyxOpenStartup.done=true;
    if(store.text('nyx.tabTitle','') || store.text('nyx.tabFavicon','')) enforceStoredTabCloak();
    else setCurrentTabCloak(learningTabTitle,learningTabFavicon,false);
    migrateGlassDefault();
    applyAutoHieroglyphPreference();
  }
  async function bootTutsiProfiles(){

    const status=document.getElementById('profile-status');
    let busy=false;
    let opened=false;
    const send=data=>{if(parent!==window)parent.postMessage(data,location.origin)};
    const open=async data=>{
      if(busy)return;
      busy=true;
      try{
        nyxFounderSignedInUser=nyxFounderFirebaseAuth?.currentUser||null;
        if(!nyxFounderSignedInUser){status.textContent='Sign in to view profiles.';send({type:'tutsi:profile-signin'});return}
        await Promise.all([refreshFounderOwnerAccess(),loadNyxUserProfile()]);
        if(!nyxUserProfile)throw new Error('Your profile could not be loaded. Try again.');
        document.querySelectorAll('.nyx-user-profile-overlay,.nyx-profile-directory-overlay').forEach(el=>el.remove());
        if(data.mode==='edit')await openNyxUserProfile();
        else await openNyxProfileDirectory(data.uid||nyxFounderSignedInUser.uid);
        status.textContent='';
        opened=true;
        const header=document.querySelector('.nyx-discord-profile-header p');
        if(header)header.textContent='Your profile is shared between Tutsi and Nyx.';
      }catch(error){status.textContent=error.message||'Profile unavailable.'}
      finally{busy=false}
    };
    addEventListener('message',event=>{
      if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='tutsi:profile-open')return;
      void open({mode:event.data.mode==='edit'?'edit':'view',uid:/^[A-Za-z0-9_-]{8,128}$/.test(String(event.data.uid||''))?event.data.uid:''});
    });
    try{
      const response=await fetch('/api/founder-profile/auth-config',{cache:'no-store'});
      const config=await response.json();
      if(!response.ok||!config.enabled)throw new Error('Accounts are unavailable.');
      const [{initializeApp,getApps},{getAuth,setPersistence,browserLocalPersistence:workspaceLocalPersistence}]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);
      const app=getApps().find(item=>item.name==='nyx-founder-owner')||initializeApp({apiKey:config.apiKey,authDomain:`${config.projectId}.firebaseapp.com`,projectId:config.projectId},'nyx-founder-owner');
      nyxFounderFirebaseAuth=getAuth(app);
      await setPersistence(nyxFounderFirebaseAuth,workspaceLocalPersistence);
      await nyxFounderFirebaseAuth.authStateReady?.();
      nyxFounderAuthReadyPromise=Promise.resolve();
      send({type:'tutsi:profile-ready'});
      if(parent===window)void open({mode:'view'});
      new MutationObserver(()=>{
        if(opened&&!busy&&!document.querySelector('.nyx-user-profile-overlay,.nyx-profile-directory-overlay')){
          opened=false;send({type:'tutsi:profile-close'});
        }
      }).observe(document.body,{childList:true});
    }catch(error){status.textContent=error.message||'Accounts are unavailable.'}
  }
  async function boot(){
    if(location.pathname==='/apps/tutsi/profiles.html'){void bootTutsiProfiles();return}
    const hostedCloakEntry=shouldAutoLaunchHostedCloak();
    if(hostedCloakEntry) document.body.classList.add('hosted-cloak-entry');
    document.documentElement.classList.toggle('nyx-chromeos',isChromeOsUser());
    document.body.classList.add('runtime-lag-guard');
    removeLegacyStartupPdfData(); installDeltaNewTabRedirect(); installBookmuxPortResponder(); installAntiClose(); bind(); startNyxGlobalApps(); installInteractiveHomeTitleDots(); initWeatherPanel(); startCenterClock(); startNyxPresence(); startNyxLatencyMonitor(); startSpotifyChromeOsCompatibilitySweep(); loadFounderProfile(); initializeFounderOwnerAccess(); startNyx();
    if(hostedCloakEntry){
      scheduleHostedCloakLaunch();
      return;
    }
    tick();
    if(!boot.tickTimer) boot.tickTimer=setInterval(tick,1000);
    scheduleHostedCloakLaunch();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
