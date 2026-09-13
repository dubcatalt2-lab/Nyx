(()=>{'use strict';

const $=id=>document.getElementById(id);

const embedded=window.parent!==window;
document.querySelector('.home-link').addEventListener('click',event=>{if(!embedded)return;event.preventDefault();parent.postMessage({type:'nyx:close-tab'},location.origin);});

const setting=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};

function syncAppearance(){

  if(embedded){try{document.documentElement.style.setProperty('--nyx-font',getComputedStyle(parent.document.body).fontFamily);}catch{}return;}

  const fonts={outfit:'Outfit',raleway:'Raleway',nunito:'Nunito',inter:'Inter',poppins:'Poppins',quicksand:'Quicksand',lexend:'Lexend',montserrat:'Montserrat',atkinson:'Atkinson Hyperlegible'};

  const family=fonts[setting('nyx.font','outfit')]||'Outfit';document.documentElement.style.setProperty('--nyx-font',`"${family}",Arial,sans-serif`);

  let fontLink=document.getElementById('nyx-movies-font');if(!fontLink){fontLink=document.createElement('link');fontLink.id='nyx-movies-font';fontLink.rel='stylesheet';document.head.append(fontLink);}const fontUrl=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll('%20','+')}:wght@400;500;600;700&display=swap`;if(fontLink.href!==fontUrl)fontLink.href=fontUrl;

  const preset=setting('nyx.beamWallpaper','frost');document.documentElement.dataset.nyxBeamWallpaper=preset;

  const color=setting('nyx.customThemeColor','');const options=setting('nyx.theme','default')==='custom'&&/^#[a-f0-9]{6}$/i.test(color)?{lightColor:color}:{};

  window.NyxBeamsWallpaper?.apply(preset,options);window.NyxLineWavesWallpaper?.apply(preset,{colorVariant:setting('nyx.lineWaves.colorVariant','frost')});

}

if(!embedded){document.documentElement.classList.add('nyx-movies-standalone');for(const id of ['nyxBeamsBg','nyxLineWavesBg']){const canvas=document.createElement('canvas');canvas.id=id;canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);}void(async()=>{for(const src of ['/assets/vendor/three.r134.min.js','/js/beams-wallpaper.js','/js/line-waves-wallpaper.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});syncAppearance();})().catch(()=>{});}

syncAppearance();addEventListener('storage',syncAppearance);addEventListener('message',event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.type==='nyx:theme-sync')syncAppearance();});



let query='',page=1,totalPages=1,searchController,detailController,selected=null,playerTimer;

async function api(path,signal,retries=0){
 for(let attempt=0;;attempt++){
  try{
   const response=await fetch('/api/movies/'+path,{signal,cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Object.assign(Error(data.error||'Movies could not be loaded.'),{retryable:[502,503,504].includes(response.status)});
   return data;
  }catch(error){
   if(signal?.aborted||attempt>=retries||!(error.retryable||error instanceof TypeError))throw error;
   await new Promise((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},400*(attempt+1));
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
   });
  }
 }
}

function poster(url,alt=''){const img=document.createElement('img');img.alt=alt;img.loading='lazy';let retried=false;const fallback=()=>{img.onerror=null;img.classList.add('poster-fallback');img.src='/assets/icons/nyx-monogram.png';};img.onerror=()=>{if(!retried&&url?.startsWith('https://image.tmdb.org/t/p/')){retried=true;img.src=url.replace(/\/w\d+\//,'/w185/');}else fallback();};if(url)img.src=url;else fallback();return img;}

const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const backdropLayer=document.createElement('div');backdropLayer.id='movie-backdrop';backdropLayer.setAttribute('aria-hidden','true');document.body.prepend(backdropLayer);let backdropGeneration=0,backdropUrl='';
function updateBackdrop(movie){
 const url=movie?.backdrop;if(!url||$('featured').hidden){backdropLayer.hidden=true;document.body.classList.remove('movie-backdrop-active');return;}
 backdropLayer.hidden=false;document.body.classList.add('movie-backdrop-active');if(url===backdropUrl)return;const generation=++backdropGeneration;backdropUrl=url;const img=new Image();img.alt='';img.onload=()=>{if(generation!==backdropGeneration)return;const old=[...backdropLayer.children];backdropLayer.append(img);img.animate([{opacity:0},{opacity:1}],{duration:reducedMotion.matches?0:650}).finished.then(()=>old.forEach(e=>e.remove())).catch(()=>{});};img.onerror=()=>{if(generation===backdropGeneration)backdropUrl='';};img.src=url;
}
let featuredMovies=[],featuredIndex=0,rotationTimer,rotationPaused=reducedMotion.matches,heroHovered=false,heroFocused=false,heroVisible=true,galleryInitialized=false;
function scheduleRotation(){
 clearTimeout(rotationTimer);
 if(featuredMovies.length<2||rotationPaused||reducedMotion.matches||heroFocused||!heroVisible||document.hidden||$('featured').hidden||$('detail').open||!$('watch-area').hidden)return;
 rotationTimer=setTimeout(()=>showSlide(featuredIndex+1),8000);
}
function showSlide(index,{recenter=true}={}){
 if(!featuredMovies.length)return;
 const nextIndex=(index+featuredMovies.length)%featuredMovies.length;
 const moving=galleryInitialized&&nextIndex!==featuredIndex;
 const direction=index>=featuredIndex?1:-1;
 const oldRects=new Map([...$('accordion-gallery').children].map(panel=>[panel,panel.getBoundingClientRect()]));
 for(const panel of oldRects.keys())panel.getAnimations().forEach(animation=>animation.cancel());
 featuredIndex=(index+featuredMovies.length)%featuredMovies.length;
 const movie=featuredMovies[featuredIndex];
 updateBackdrop(movie);
 $('featured-title').textContent=movie.title;
 $('featured-overview').textContent=movie.overview||'';
 $('featured-meta').textContent=[movie.releaseDate?.slice(0,4),movie.rating>0?movie.rating.toFixed(1)+' / 10':''].filter(Boolean).join(' \u00b7 ');
 const panels=[...$('accordion-gallery').children].sort((a,b)=>Number(a.dataset.index)-Number(b.dataset.index));
 panels.forEach((panel,i)=>{const active=i===featuredIndex;panel.classList.toggle('ag-panel--active',active);panel.style.setProperty('--ag-grow',active?String((.6*(panels.length-1))/(1-.6)||1):'1');panel.style.setProperty('--ag-tilt',active?'0deg':i<featuredIndex?'5deg':'-5deg');panel.style.setProperty('--ag-shift',active?'0px':Math.max(-1.5,Math.min(1.5,featuredIndex-i))*10+'px');panel.querySelector('.ag-panel-trigger').setAttribute('aria-expanded',String(active));});
 if(panels[featuredIndex])panels[featuredIndex].append(document.querySelector('.featured-copy'));
 const half=Math.floor(panels.length/2);
 // Keep the expanded movie centered; advancing the index shifts titles right.
 for(let position=0;recenter&&position<panels.length;position++){
  const index=(featuredIndex+half-position+panels.length)%panels.length;
  const panel=panels[index];panel.style.setProperty('--ag-tilt',position<half?'5deg':position>half?'-5deg':'0deg');
  $('accordion-gallery').append(panel);
 }
 if(moving&&!reducedMotion.matches){
  const galleryRect=$('accordion-gallery').getBoundingClientRect();const vertical=matchMedia('(max-width:600px)').matches;
  for(const panel of panels){
   const before=oldRects.get(panel),after=panel.getBoundingClientRect();if(!before||!after.width||!after.height)continue;
   let dx=before.left-after.left,dy=before.top-after.top;
   // The card wrapping around enters from the edge instead of crossing over its neighbors.
   if(!vertical&&Math.abs(dx)>galleryRect.width*.65)dx=-direction*(after.width+12);
   if(vertical&&Math.abs(dy)>galleryRect.height*.65)dy=-direction*(after.height+7);
   panel.animate([{transform:`translate(${dx}px,${dy}px) scale(${before.width/after.width},${before.height/after.height})`},{transform:'none'}],{duration:recenter?500:450,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  const copy=document.querySelector('.featured-copy');copy.getAnimations().forEach(a=>a.cancel());copy.animate([{opacity:0},{opacity:1}],{duration:recenter?350:280});
 }
 galleryInitialized=true;
 $('featured-open').onclick=()=>location.hash='movie='+movie.id;
 $('slide-count').textContent=`${featuredIndex+1} / ${featuredMovies.length}`;
 [...$('slide-dots').children].forEach((dot,i)=>dot.setAttribute('aria-current',String(i===featuredIndex)));
 scheduleRotation();
}
function feature(movies){
 clearTimeout(rotationTimer);
 galleryInitialized=false;
 featuredMovies=[...new Map(movies.filter(movie=>movie.backdrop&&!/^coyote\s+vs\.?\s+acme$/i.test(movie.title)).map(movie=>[movie.id,movie])).values()].slice(0,5);
 if(featuredMovies.length>1&&featuredMovies.length%2===0)featuredMovies.pop();
 if(!featuredMovies.length){const fallback=movies.find(movie=>!/^coyote\s+vs\.?\s+acme$/i.test(movie.title));if(fallback)featuredMovies=[fallback];}
 $('featured').hidden=!featuredMovies.length||!!query||page!==1;
 $('gallery-controls').hidden=featuredMovies.length<2;
 // React Bits Accordion Gallery adapted to DOM/CSS. See REACT_BITS_LICENSE.txt.
 const copy=document.querySelector('.featured-copy');$('featured').append(copy);
 $('accordion-gallery').replaceChildren(...featuredMovies.map((movie,index)=>{
  const panel=document.createElement('article');panel.className='ag-panel';panel.dataset.index=String(index);
  const media=document.createElement('div');media.className='ag-panel__media';const img=document.createElement('img');img.alt='';img.draggable=false;img.src=movie.backdrop||movie.poster||'';img.onerror=()=>img.hidden=true;media.append(img);
  const overlay=document.createElement('span');overlay.className='ag-panel__overlay';overlay.setAttribute('aria-hidden','true');
  const trigger=document.createElement('button');trigger.type='button';trigger.className='ag-panel-trigger';trigger.setAttribute('aria-label','Feature '+movie.title);trigger.title='Feature '+movie.title;trigger.setAttribute('aria-expanded','false');trigger.onclick=()=>{showSlide(index);};
  const label=document.createElement('span');label.className='ag-panel__label';label.textContent=movie.title;label.setAttribute('aria-hidden','true');
  panel.append(media,overlay,trigger,label);return panel;
 }));
 $('slide-dots').replaceChildren();
 featuredMovies.forEach((movie,index)=>{const dot=document.createElement('button');dot.type='button';dot.setAttribute('aria-label',`Show ${movie.title}`);dot.title=`Show ${movie.title}`;dot.onclick=()=>showSlide(index);$('slide-dots').append(dot);});
 if(featuredMovies.length)showSlide(0);else updateBackdrop(null);
}
$('slide-previous').onclick=()=>showSlide(featuredIndex-1);
$('slide-next').onclick=()=>showSlide(featuredIndex+1);
let lastHoverPoint='';
$('accordion-gallery').addEventListener('pointermove',event=>{if(event.pointerType!=='mouse')return;const point=event.clientX+','+event.clientY;if(point===lastHoverPoint)return;lastHoverPoint=point;const panel=event.target.closest('.ag-panel');if(panel){const index=Number(panel.dataset.index);if(index!==featuredIndex)showSlide(index,{recenter:false});}});
$('accordion-gallery').addEventListener('pointerleave',()=>{lastHoverPoint='';});
$('featured').addEventListener('focusin',()=>{heroFocused=document.activeElement.matches(':focus-visible');scheduleRotation();});
$('featured').addEventListener('focusout',()=>{queueMicrotask(()=>{heroFocused=$('featured').contains(document.activeElement)&&document.activeElement.matches(':focus-visible');scheduleRotation();});});
$('featured').addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();showSlide(featuredIndex+(event.key==='ArrowRight'?1:-1));}});
let swipeStart;
$('featured').addEventListener('pointerdown',event=>{if(event.pointerType==='touch'&&!event.target.closest('button,a'))swipeStart={x:event.clientX,y:event.clientY};});
$('featured').addEventListener('pointerup',event=>{if(!swipeStart)return;const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)showSlide(featuredIndex+(dx<0?1:-1));});
$('featured').addEventListener('pointercancel',()=>{swipeStart=null;});
addEventListener('visibilitychange',scheduleRotation);
addEventListener('pageshow',scheduleRotation);
reducedMotion.addEventListener('change',()=>{rotationPaused=reducedMotion.matches;scheduleRotation();});
if('IntersectionObserver' in window)new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;scheduleRotation();},{threshold:.1}).observe($('featured'));

async function search(){

 clearTimeout(rotationTimer);searchController?.abort();const controller=searchController=new AbortController();$('notice').textContent='Loading movies...';$('retry-search').hidden=true;$('clear-search').hidden=!query;$('featured').hidden=true;updateBackdrop(null);$('grid').setAttribute('aria-busy','true');$('result-page').textContent='';$('grid').replaceChildren();$('previous').disabled=$('next').disabled=true;

 try{const data=await api('search?'+new URLSearchParams({q:query,page}),controller.signal,2);if(controller!==searchController)return;totalPages=data.totalPages;feature(data.featured||data.results);

 $('results-title').textContent=query?'Results for '+query:'Popular movies';$('result-page').textContent=`Page ${page} of ${totalPages}`;

 for(const movie of data.results){const card=document.createElement('button');card.type='button';card.className='movie-card';const art=document.createElement('div');art.className='poster';art.append(poster(movie.poster,movie.title+' poster'));const copy=document.createElement('div');copy.className='card-copy';const title=document.createElement('strong');title.textContent=movie.title;const year=document.createElement('span');year.textContent=[movie.kind==='tv'?'Series':'Movie',movie.releaseDate?.slice(0,4)||'Date unavailable',movie.rating>0?'\u2605 '+movie.rating.toFixed(1):''].filter(Boolean).join(' · ');copy.append(title,year);card.append(art,copy);card.onclick=()=>location.hash=(movie.kind==='tv'?'tv=':'movie=')+movie.id;$('grid').append(card);}

 $('notice').textContent=data.results.length?'':'No movies or series found. Try another title.';$('previous').disabled=page<=1;$('next').disabled=page>=totalPages;

 }catch(e){if(controller===searchController&&!controller.signal.aborted){$('notice').textContent=e.message;$('retry-search').hidden=false;}}finally{if(controller===searchController)$('grid').setAttribute('aria-busy','false');}

}

let providers=[{id:'vixsrc',name:'VixSrc'}],episodeCatalog=[];
function externalUrl(value){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash)return null;
 if(url.search)return null;
 if(url.hostname==='nhdapi.com'&&/^\/(movie\/\d{1,10}|tv\/\d{1,10}\/\d{1,3}\/\d{1,4}|anime\/\d{1,10}\/\d{1,4})$/.test(url.pathname))return url.href;
 if(url.hostname==='supaplay.fun'&&(/^\/mw\/([a-zA-Z0-9]+-)+[a-zA-Z0-9]{5,30}(\/\d{1,3}\/\d{1,4})?$/.test(url.pathname)||/^\/stream\/ani\/\d{1,8}\/\d{1,4}\/(sub|dub)$/.test(url.pathname)))return url.href;
 if(url.hostname==='ani.megaplay.su'&&/^\/kisskh\/\d{1,10}$/.test(url.pathname))return url.href;
 }catch{}return null;
}
function sourcesFor(movie){
 if(movie.kind==='tv')return [];
 if(movie.sources)return movie.sources.map(s=>({...s,url:externalUrl(s.url)})).filter(s=>s.url);
 if(movie.kind==='episode'){const url=externalUrl(movie.embedUrl);return url?[{id:movie.provider,name:movie.providerName,url}]:[];}
 const mapped=(movie.providerMappings||[]).filter(x=>x.provider==='supaplay').map(x=>externalUrl('https://supaplay.fun/mw/'+x.detailPath)).filter(Boolean);
 return [{id:'vixsrc',name:'VixSrc'},...(mapped.length?[{id:'supaplay',name:'SupaPlay · MovieBox',url:mapped[0]}]:[]),{id:'nhd',name:'NHD',url:'https://nhdapi.com/movie/'+movie.id}];
}
let providerStates={},currentProvider='',watchGeneration=0;
// Measurements stay in this tab and apply only to this exact movie/episode.
const sourceHistory=new Map();
const sourceKey=movie=>(movie.kind||'movie')+':'+movie.id;
function sourceEvidence(movie,id){const entry=sourceHistory.get(sourceKey(movie))?.[id];return entry&&Date.now()-entry.updated<30*60*1000?entry:{};}
function recordSource(movie,id,patch){
 const key=sourceKey(movie);if(!sourceHistory.has(key)&&sourceHistory.size>=100)sourceHistory.delete(sourceHistory.keys().next().value);
 const entries=sourceHistory.get(key)||{};entries[id]={...sourceEvidence(movie,id),...patch,updated:Date.now()};sourceHistory.set(key,entries);
}
function rankSources(movie,list){
 const tier=e=>e.failed?3:e.played?(e.stalls>=3?1:0):2;
 return [...list].sort((a,b)=>{const x=sourceEvidence(movie,a.id),y=sourceEvidence(movie,b.id);return tier(x)-tier(y)||(x.played&&y.played?(y.width||0)*(y.height||0)-(x.width||0)*(x.height||0):0);});
}
function sourcePanel(open){$('sources-panel').hidden=!open;$('choose-source').setAttribute('aria-expanded',String(open));if(open){$('episode-picker').hidden=true;$('choose-episodes').setAttribute('aria-expanded','false');}}
function renderSources(){
 $('source-list').replaceChildren(...providers.map(source=>{const row=document.createElement('li'),button=document.createElement('button'),mark=document.createElement('span'),copy=document.createElement('span'),name=document.createElement('strong'),status=document.createElement('small');
 const evidence=sourceEvidence(selected,source.id),state=providerStates[source.id]||(evidence.failed?'Recently unavailable':evidence.played?'Previously played':'Waiting');row.dataset.state=state;button.type='button';button.dataset.provider=source.id;button.setAttribute('aria-current',String(source.id===currentProvider));mark.className='source-mark';mark.setAttribute('aria-hidden','true');name.textContent=source.name;status.textContent=state+' · '+(evidence.width&&evidence.height?evidence.width+' × '+evidence.height:'Quality unknown');copy.append(name,status);button.append(mark,copy);button.onclick=()=>watch(source.id);row.append(button);return row;}));
}
let movieHls=null,playbackRequest=null,playbackSession='',playbackVideo=null;
function closePlayer(){
 watchGeneration++;sourcePanel(false);
 $('episode-picker').hidden=true;$('choose-episodes').setAttribute('aria-expanded','false');
 document.getElementById('watch-area').classList.remove('external-playback');
 $('watch-area').insertBefore(document.querySelector('.playback-controls'),$('episode-picker'));
 clearTimeout(playerTimer);playbackRequest?.abort();playbackRequest=null;movieHls?.destroy();movieHls=null;
 if(playbackVideo){playbackVideo.pause();playbackVideo.removeAttribute('src');playbackVideo.load();playbackVideo=null;}
 if(playbackSession){fetch('/api/movies/playback/'+encodeURIComponent(playbackSession),{method:'DELETE',keepalive:true}).catch(()=>{});playbackSession='';}
 $('player').replaceChildren();$('watch-area').hidden=true;$('settings-panel').hidden=true;$('player-settings').setAttribute('aria-expanded','false');document.body.classList.remove('movie-playing');document.querySelectorAll('main>header,main>#browse,main>footer').forEach(e=>e.inert=false);if(document.fullscreenElement=== $('watch-area'))document.exitFullscreen().catch(()=>{});
}

let detailOpener=null;
function showDetails(){if(!$('detail').open){if(!document.body.classList.contains('movie-overlay'))detailOpener=document.activeElement;$('detail').showModal();}document.body.classList.add('movie-overlay');scheduleRotation();}
function leaveDetails(){if($('detail').open)$('detail').close();document.body.classList.remove('movie-overlay');detailOpener?.focus();scheduleRotation();}
async function route(){
 closePlayer();detailController?.abort();$('retry-detail').hidden=true;selected=null;$('watch').hidden=false;$('series-episodes').replaceChildren();$('series-note').textContent='';
 const episodeHash=location.hash;
 const watchParts=location.hash.match(/^#watch=([1-9]\d{0,9})\/(\d{1,3})\/([1-9]\d{0,3})$/);
 if(watchParts){showDetails();$('detail-content').hidden=true;$('detail-notice').textContent='Loading episode…';try{const data=await api(`tv/${watchParts[1]}/season/${watchParts[2]}/episode/${watchParts[3]}`);if(location.hash!==episodeHash)return;selected=data;await watch();}catch(error){if(location.hash===episodeHash)$('detail-notice').textContent=error.message;}return;}
 const episodeId=location.hash.match(/^#episode=([a-z0-9-]+)$/)?.[1];
 if(episodeId){if(!episodeCatalog.length)try{episodeCatalog=(await api('episodes')).results||[];}catch{}if(location.hash!==episodeHash)return;const episode=episodeCatalog.find(x=>x.id===episodeId);if(episode){selected={...episode,kind:'episode',genres:[],cast:[]};$('movie-title').textContent=episode.title;$('movie-meta').textContent=episode.episodeLabel;$('movie-overview').textContent='';$('movie-facts').replaceChildren();$('movie-genres').replaceChildren();$('cast-section').hidden=true;$('detail-backdrop').hidden=true;$('detail-content').hidden=false;$('detail-notice').textContent='';showDetails();return;}leaveDetails();return;}
 const series=location.hash.startsWith('#tv=');const id=location.hash.match(/^#(?:movie|tv)=([1-9]\d{0,9})$/)?.[1];if(!id){leaveDetails();return;}
 showDetails();const controller=detailController=new AbortController();$('detail-content').hidden=true;$('detail-notice').textContent='Loading movie details...';
 try{const movie=await api((series?'tv/':'')+id,controller.signal);if(controller!==detailController)return;selected=movie;
 const backdrop=$('detail-backdrop');backdrop.hidden=!movie.backdrop;backdrop.onerror=()=>backdrop.hidden=true;if(movie.backdrop)backdrop.src=movie.backdrop;
 $('movie-title').textContent=movie.title;$('movie-meta').textContent=[movie.rating>0?'TMDB '+movie.rating.toFixed(1)+' / 10'+(movie.votes?' ('+movie.votes.toLocaleString()+')':''):'',movie.releaseDate?.slice(0,4)].filter(Boolean).join(' \u00b7 ');
 $('movie-overview').textContent=movie.overview||'No description available.';$('movie-genres').replaceChildren();for(const genre of movie.genres){const chip=document.createElement('span');chip.textContent=genre;$('movie-genres').append(chip);}
 $('movie-facts').replaceChildren();for(const [label,value] of [['Runtime',movie.runtime?Math.floor(movie.runtime/60)+'h '+movie.runtime%60+'m':null],['Language',movie.language?.toUpperCase()],['Release date',movie.releaseDate]]){if(!value)continue;const term=document.createElement('dt'),definition=document.createElement('dd');term.textContent=label;definition.textContent=value;$('movie-facts').append(term,definition);}
 $('movie-cast').replaceChildren();$('cast-section').hidden=!movie.cast?.length;for(const person of movie.cast||[]){const card=document.createElement('div');card.className='cast-person';const art=document.createElement('div');art.className='cast-photo';if(person.photo)art.append(poster(person.photo,person.name));else art.textContent=person.name.split(' ').map(n=>n[0]).slice(0,2).join('');const name=document.createElement('strong'),role=document.createElement('span');name.textContent=person.name;role.textContent=person.role;card.append(art,name,role);$('movie-cast').append(card);}
 if(movie.kind==='tv'){$('watch').hidden=true;$('series-note').textContent='Seasons & episodes';void episodePicker($('series-episodes'),movie);}
 $('detail-notice').textContent='';$('detail-content').hidden=false;$('movie-title').focus();
 }catch(e){if(!controller.signal.aborted){$('detail-notice').textContent=e.message;$('retry-detail').hidden=false;}}
}
$('detail').addEventListener('cancel',event=>{event.preventDefault();location.hash='';});
$('detail').addEventListener('click',event=>{if(event.target===$('detail')){const rect=$('detail').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)location.hash='';}});

async function watch(preferred){
 if(!selected)return;
 const movie=selected;
 $('choose-episodes').hidden=!movie.tmdbSeriesId;
 providers=rankSources(movie,sourcesFor(movie));
 let resume=playbackVideo?{time:playbackVideo.currentTime,volume:playbackVideo.volume,muted:playbackVideo.muted}:null;
 closePlayer();const generation=watchGeneration;providerStates={};currentProvider='';renderSources();sourcePanel(true);
 $('detail').close();$('watch-area').hidden=false;document.body.classList.add('movie-playing');document.querySelectorAll('main>header,main>#browse,main>footer').forEach(e=>e.inert=true);$('watch-title').textContent=movie.title;$('watch-area').focus();scheduleRotation();
 const order=providers.some(p=>p.id===preferred)?providers.filter(p=>p.id===preferred).concat(providers.filter(p=>p.id!==preferred)):providers;
 async function attempt(index){
  if(generation!==watchGeneration)return;
  clearTimeout(playerTimer);playbackRequest?.abort();movieHls?.destroy();movieHls=null;
  if(playbackVideo){playbackVideo.pause();playbackVideo.removeAttribute('src');playbackVideo.load();}
  if(playbackSession){fetch('/api/movies/playback/'+encodeURIComponent(playbackSession),{method:'DELETE',keepalive:true}).catch(()=>{});playbackSession='';}
  $('player').replaceChildren();
  playbackVideo=null;$('watch-area').classList.remove('external-playback');$('watch-area').insertBefore(document.querySelector('.playback-controls'),$('episode-picker'));
  if(index>=order.length){playbackVideo=null;currentProvider='';renderSources();sourcePanel(true);$('player-status').textContent='No source could start this movie. Try again shortly.';$('retry-player').hidden=false;return;}
  const source=order[index];currentProvider=source.id;providerStates[source.id]='Checking';renderSources();
  const controller=playbackRequest=new AbortController();let failed=false,started=false;
  const active=()=>generation===watchGeneration&&playbackRequest===controller&&!controller.signal.aborted;
  if(source.url){
   const frame=document.createElement('iframe');frame.title=movie.title+' — '+source.name;frame.sandbox='allow-scripts allow-same-origin allow-forms allow-presentation';frame.allow='autoplay; fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;
   $('watch-area').classList.add('external-playback');document.querySelector('.watch-header').insertBefore(document.querySelector('.playback-controls'),document.querySelector('.watch-brand'));$('player').append(frame);$('player-status').textContent='Loading player…';$('retry-player').hidden=true;sourcePanel(false);
   let lastTime=null;
   const unavailable=()=>{if(!active()||failed)return;failed=true;recordSource(movie,source.id,{failed:true});providerStates[source.id]='Unavailable';renderSources();void attempt(index+1);};
   const progress=time=>{if(!Number.isFinite(time)||time<0)return;if(lastTime!==null&&time>lastTime+.1){const changed=providerStates[source.id]!=='Playing';started=true;recordSource(movie,source.id,{played:true,failed:false});clearTimeout(playerTimer);providerStates[source.id]='Playing';$('player-status').textContent='';if(changed)renderSources();}lastTime=time;};
   const receive=event=>{
    if(!active()||event.source!==frame.contentWindow||event.origin!==new URL(source.url).origin)return;
    let data=event.data;if(typeof data==='string'){if(data.length>10000)return;try{data=JSON.parse(data);}catch{return;}}
    if(!data||typeof data!=='object')return;
    if(data.type==='timeUpdate'||data.type==='watching-log')progress(data.currentTime);
    if(['kisskh','megacloud'].includes(data.channel)&&data.event==='time')progress(data.currentTime??data.time);
    if(data.type==='pause'&&started){providerStates[source.id]='Paused';renderSources();}
    if(data.type==='error'||['kisskh','megacloud'].includes(data.channel)&&data.event==='error')unavailable();
   };
   addEventListener('message',receive);controller.signal.addEventListener('abort',()=>removeEventListener('message',receive),{once:true});
   frame.addEventListener('load',()=>{if(!active()||started)return;providerStates[source.id]='Player loaded';renderSources();$('player-status').textContent='';});
   frame.addEventListener('error',unavailable);frame.src=source.url;
   playerTimer=setTimeout(()=>{if(active()&&!started){$('player-status').textContent='Use the player’s Play button. If it cannot start, choose another source or reload.';$('retry-player').hidden=false;}},45000);
   return;
  }
  const video=playbackVideo=document.createElement('video');video.controls=false;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-label',movie.title+' video player');
  const loading=document.createElement('div');loading.className='player-loading';loading.setAttribute('aria-hidden','true');const spinner=document.createElement('span');spinner.className='spinner';loading.append(spinner);
  $('player').append(video,loading);$('player-status').textContent='';$('retry-player').hidden=true;bindControls(video);
  const failure=()=>{if(!active()||failed)return;failed=true;recordSource(movie,source.id,{failed:true});if(started)resume={time:video.currentTime,volume:video.volume,muted:video.muted};clearTimeout(playerTimer);providerStates[source.id]='Unavailable';renderSources();sourcePanel(true);void attempt(index+1);};
  let bufferingSince=0;
  const buffering=()=>{if(active()&&!video.paused){if(started&&!video.seeking&&!bufferingSince)bufferingSince=performance.now();loading.hidden=false;$('player-status').textContent='Buffering...';}};
  video.addEventListener('waiting',buffering);video.addEventListener('stalled',buffering);
  video.addEventListener('playing',()=>{if(active()){if(bufferingSince&&performance.now()-bufferingSince>1500)recordSource(movie,source.id,{stalls:(sourceEvidence(movie,source.id).stalls||0)+1});bufferingSince=0;clearTimeout(playerTimer);loading.hidden=true;$('player-status').textContent='';}});
  let previousTime=resume?.time||0;
  video.addEventListener('timeupdate',()=>{if(active()&&!video.paused&&!video.seeking&&video.videoWidth>0&&video.currentTime>previousTime+.2){const old=sourceEvidence(movie,source.id);recordSource(movie,source.id,{played:true,failed:false,width:video.videoWidth,height:video.videoHeight});const changed=old.width!==video.videoWidth||old.height!==video.videoHeight;if(!started){started=true;providerStates[source.id]='Playing';renderSources();sourcePanel(false);}else if(changed)renderSources();previousTime=video.currentTime;}});
  video.addEventListener('pause',()=>{if(active()){loading.hidden=true;if(started){providerStates[source.id]='Paused';renderSources();}}});
  video.addEventListener('play',()=>{if(active()&&started){providerStates[source.id]='Playing';renderSources();}});
  video.addEventListener('error',failure);
  try{
   const response=await fetch('/api/movies/'+movie.id+'/playback?provider='+source.id,{method:'POST',signal:controller.signal});
   const data=await response.json();if(!response.ok)throw Error('Source unavailable');
   if(!/^\/api\/movies\/media\/[A-Za-z0-9_-]+\/\d+$/.test(data.url))throw Error('Invalid source');
   if(!active()){fetch('/api/movies/playback/'+data.url.split('/')[4],{method:'DELETE',keepalive:true}).catch(()=>{});return;}
   playbackSession=data.url.split('/')[4];providerStates[source.id]='Loading video';renderSources();
   const play=()=>{if(!active())return;if(resume){video.currentTime=resume.time||0;video.volume=resume.volume;video.muted=resume.muted;}video.play().catch(()=>{if(active()){clearTimeout(playerTimer);loading.hidden=true;providerStates[source.id]='Ready — press Play';renderSources();sourcePanel(false);$('player-status').textContent='Press Play to start the movie.';}});};
   playerTimer=setTimeout(failure,30000);
   if(window.Hls?.isSupported()){
    const hls=movieHls=new Hls({maxBufferLength:12,maxMaxBufferLength:24,backBufferLength:12,maxBufferSize:24*1024*1024,capLevelToPlayerSize:true,startLevel:-1});
    hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(active()){updateTrackOptions();play();}});
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED,()=>{if(!active())return;const english=hls.audioTracks.findIndex(track=>/^(en|eng)$/i.test(track.lang||'')||/english/i.test(track.name||''));if(english>=0)hls.audioTrack=english;updateTrackOptions();});
    hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,()=>{if(active())updateTrackOptions();});
    hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)failure();});hls.loadSource(data.url);hls.attachMedia(video);
   }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=data.url;video.addEventListener('loadedmetadata',play,{once:true});}
   else{clearTimeout(playerTimer);loading.hidden=true;sourcePanel(false);$('player-status').textContent='This browser does not support this video player.';}
  }catch{if(active())failure();}
 }
 await attempt(0);
}
$('choose-source').onclick=()=>sourcePanel($('sources-panel').hidden);
$('auto-source').onclick=()=>watch();
$('close-sources').onclick=()=>{sourcePanel(false);$('choose-source').focus();};

async function episodePicker(container,series,seasonNumber,episodeNumber){
 const form=document.createElement('form');form.className='episode-form';let request=0;
 const season=document.createElement('select'),episode=document.createElement('select'),submit=document.createElement('button'),status=document.createElement('p');status.setAttribute('role','status');submit.type='submit';submit.className='icon-control';submit.setAttribute('aria-label','Play selected episode');submit.title='Play selected episode';icon(submit,'play');
 for(const [text,select] of [['Season',season],['Episode',episode]]){const label=document.createElement('label');label.textContent=text;label.append(select);form.append(label);}
 form.append(submit,status);container.replaceChildren(form);
 for(const item of series.seasons||[]){const option=document.createElement('option');option.value=item.number;option.textContent=item.name||'Season '+item.number;season.append(option);}
 const preferred=(series.seasons||[]).some(s=>s.number===Number(seasonNumber))?Number(seasonNumber):(series.seasons||[]).find(s=>s.number>0)?.number??series.seasons?.[0]?.number;
 if(preferred===undefined){status.textContent='No episodes are listed yet.';submit.disabled=season.disabled=episode.disabled=true;return;}
 season.value=String(preferred);
 async function load(){const serial=++request;episode.replaceChildren();episode.disabled=submit.disabled=true;status.textContent='Loading episodes…';
 try{const data=await api('tv/'+series.id+'/season/'+season.value);if(serial!==request||!container.contains(form))return;for(const item of data.episodes){const option=document.createElement('option');option.value=item.number;option.textContent=item.number+'. '+item.name;episode.append(option);}if([...episode.options].some(o=>o.value===String(episodeNumber)))episode.value=String(episodeNumber);episodeNumber=null;status.textContent=data.episodes.length?'':'No episodes are listed yet.';submit.disabled=episode.disabled=!data.episodes.length;icon(submit,'play');}
 catch(error){if(serial!==request)return;status.textContent=error.message;submit.disabled=false;icon(submit,'reload');}}
 season.onchange=load;form.onsubmit=event=>{event.preventDefault();if(!episode.value){void load();return;}$('episode-picker').hidden=true;$('choose-episodes').setAttribute('aria-expanded','false');const hash='#watch='+series.id+'/'+season.value+'/'+episode.value;if(location.hash===hash)void watch();else location.hash=hash;};await load();
}
$('choose-episodes').onclick=async()=>{const open=$('episode-picker').hidden;$('episode-picker').hidden=!open;$('choose-episodes').setAttribute('aria-expanded',String(open));if(!open)return;sourcePanel(false);$('settings-panel').hidden=true;const selectedEpisode=selected;$('watch-episode-fields').textContent='Loading seasons…';try{const series=await api('tv/'+selectedEpisode.tmdbSeriesId);if(selected!==selectedEpisode||$('episode-picker').hidden)return;await episodePicker($('watch-episode-fields'),series,selectedEpisode.season,selectedEpisode.episode);}catch(error){$('watch-episode-fields').textContent=error.message;}};
$('close-episodes').onclick=()=>{$('episode-picker').hidden=true;$('choose-episodes').setAttribute('aria-expanded','false');$('choose-episodes').focus();};

const icons={episodes:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M3 9h5M3 15h5m4-6h5m-5 6h5"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',next:'<path d="m9 5 7 7-7 7"/>',previous:'<path d="m15 5-7 7 7 7"/>',reload:'<path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5"/>',sources:'<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z"/>',play:'<path d="m8 5 11 7-11 7Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',back:'<path d="M20 12H4m7-7-7 7 7 7"/>',rewind:'<path d="M4 8a8 8 0 1 1-1 8M4 3v5h5"/><text x="8" y="16" stroke="none" fill="currentColor" font-size="8">10</text>',forward:'<path d="M20 8a8 8 0 1 0 1 8M20 3v5h-5"/><text x="8" y="16" stroke="none" fill="currentColor" font-size="8">10</text>',volume:'<path d="M11 5 6 9H3v6h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',muted:'<path d="M11 5 6 9H3v6h3l5 4Zm5 4 5 6m0-6-5 6"/>',pip:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 12h6v4h-6Z"/>',fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',settings:'<path d="m9 3-.6 3-2.6 1.5L3 7l-1 3 2.2 2L4 15l-1 2 2.5 2 2.5-1 3 1 1 2 3-.5.5-2.5 2.5-2 3 .2.8-3-2-2 .2-3 1-2L18 4l-2.5 1-3-1-1-2Z"/><circle cx="12" cy="12" r="3"/>'};
function icon(element,name){element.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';}
document.querySelectorAll('[data-icon]').forEach(element=>icon(element,element.dataset.icon));
for(const [selector,name,label] of [
 ['#featured-open','info','View movie details'],['#watch','play','Play movie'],['#search button','search','Search movies'],
 ['#clear-search','close','Clear search'],['#retry-search','reload','Retry movie search'],['#retry-detail','reload','Retry movie details'],
 ['#retry-player','reload','Reload player'],['#previous','previous','Previous page'],['#next','next','Next page'],['#choose-source','sources','Video sources'],['.home-link','home','Back to Nyx']
]){const button=document.querySelector(selector);button.classList.add('icon-control');button.setAttribute('aria-label',label);button.title=label;icon(button,name);}
document.querySelectorAll('button[aria-label]').forEach(button=>button.title=button.getAttribute('aria-label'));

const clock=value=>{const seconds=Math.max(0,Math.floor(Number.isFinite(value)?value:0));return (seconds>=3600?Math.floor(seconds/3600)+':':'')+String(Math.floor(seconds/60)%60).padStart(seconds>=3600?2:1,'0')+':'+String(seconds%60).padStart(2,'0');};
function togglePlay(){const v=playbackVideo;if(!v)return;if(v.paused)v.play().catch(()=>{$('player-status').textContent='Unable to start playback. Try reloading the player.';$('retry-player').hidden=false;});else v.pause();}
function seekBy(seconds){const v=playbackVideo;if(v&&Number.isFinite(v.duration))v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+seconds));}
function bindControls(video){
 const update=()=>{if(video!==playbackVideo)return;const duration=Number.isFinite(video.duration)?video.duration:0;$('seek').disabled=!duration;$('seek').max=duration||100;$('seek').value=video.currentTime||0;$('seek').setAttribute('aria-valuetext',clock(video.currentTime)+' of '+clock(duration));let buffered=0;for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=video.currentTime+.5)buffered=Math.max(buffered,video.buffered.end(i));$('seek').style.setProperty('--played',duration?video.currentTime/duration*100+'%':'0%');$('seek').style.setProperty('--buffered',duration?buffered/duration*100+'%':'0%');$('playback-time').textContent=clock(video.currentTime)+' / '+clock(duration);icon($('toggle-play'),video.paused?'play':'pause');$('toggle-play').setAttribute('aria-label',video.paused?'Play':'Pause');icon($('mute'),video.muted||!video.volume?'muted':'volume');$('mute').setAttribute('aria-label',video.muted?'Unmute':'Mute');$('volume').value=video.muted?0:video.volume;};
 for(const event of ['loadedmetadata','durationchange','seeking','seeked','timeupdate','progress','play','pause','ended','volumechange'])video.addEventListener(event,update);
 video.onclick=togglePlay;video.ondblclick=toggleFullscreen;$('playback-speed').value='1';updateTrackOptions();update();
 $('picture-in-picture').hidden=!document.pictureInPictureEnabled||!video.requestPictureInPicture;$('fullscreen').hidden=!document.fullscreenEnabled;
}
function options(id,items,value){const select=$(id);select.replaceChildren(...items.map(([key,label])=>{const option=document.createElement('option');option.value=key;option.textContent=label;return option;}));select.value=String(value);select.disabled=items.length<2;}
function updateTrackOptions(){options('playback-quality',[[-1,'Auto'],...(movieHls?.levels||[]).map((level,i)=>[i,level.height?level.height+'p':Math.round(level.bitrate/1000)+' kbps'])],movieHls?.currentLevel??-1);options('playback-audio',(movieHls?.audioTracks||[]).length?movieHls.audioTracks.map((track,i)=>[i,track.name||track.lang||'Track '+(i+1)]):[[-1,'Default']],movieHls?.audioTrack??-1);options('playback-subtitles',[[-1,'Off'],...(movieHls?.subtitleTracks||[]).map((track,i)=>[i,track.name||track.lang||'Track '+(i+1)])],movieHls?.subtitleTrack??-1);}
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('watch-area').requestFullscreen();}catch{$('player-status').textContent='Fullscreen is unavailable in this browser.';}}
$('toggle-play').onclick=togglePlay;$('skip-back').onclick=()=>seekBy(-10);$('skip-forward').onclick=()=>seekBy(10);
$('seek').oninput=()=>{if(playbackVideo&&Number.isFinite(playbackVideo.duration))playbackVideo.currentTime=Number($('seek').value);};
$('mute').onclick=()=>{if(playbackVideo)playbackVideo.muted=!playbackVideo.muted;};$('volume').oninput=()=>{if(playbackVideo){playbackVideo.volume=Number($('volume').value);playbackVideo.muted=false;}};
$('player-settings').onclick=()=>{$('settings-panel').hidden=!$('settings-panel').hidden;$('player-settings').setAttribute('aria-expanded',String(!$('settings-panel').hidden));};
$('playback-speed').onchange=()=>{if(playbackVideo)playbackVideo.playbackRate=Number($('playback-speed').value);};$('playback-quality').onchange=()=>{if(movieHls)movieHls.currentLevel=Number($('playback-quality').value);};$('playback-audio').onchange=()=>{if(movieHls)movieHls.audioTrack=Number($('playback-audio').value);};$('playback-subtitles').onchange=()=>{if(movieHls){movieHls.subtitleTrack=Number($('playback-subtitles').value);movieHls.subtitleDisplay=movieHls.subtitleTrack>=0;}};
$('fullscreen').onclick=toggleFullscreen;$('picture-in-picture').onclick=async()=>{try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else await playbackVideo?.requestPictureInPicture();}catch{$('player-status').textContent='Picture in picture is unavailable for this video.';}};
$('watch-area').addEventListener('keydown',event=>{if(event.target.closest('input,select')||event.ctrlKey||event.altKey||event.metaKey)return;if(event.key==='Escape'){if(!$('episode-picker').hidden){$('close-episodes').click();}else if(!$('sources-panel').hidden){sourcePanel(false);$('choose-source').focus();}else if(!$('settings-panel').hidden){$('settings-panel').hidden=true;$('player-settings').setAttribute('aria-expanded','false');$('player-settings').focus();}else if(!document.fullscreenElement)$('close-player').click();return;}if(event.target.closest('button,a')&&event.key===' ')return;const action={' ':togglePlay,k:togglePlay,ArrowLeft:()=>seekBy(-10),ArrowRight:()=>seekBy(10),m:()=> $('mute').click(),f:toggleFullscreen}[event.key];if(action){event.preventDefault();action();}});
addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');});

$('retry-detail').onclick=route;$('retry-search').onclick=search;$('clear-search').onclick=()=>{query='';$('query').value='';page=1;search();};

$('search').onsubmit=e=>{e.preventDefault();query=$('query').value.trim();page=1;search();};$('previous').onclick=()=>{page--;search();};$('next').onclick=()=>{page++;search();};$('back').onclick=()=>location.hash='';$('watch').onclick=()=>watch();$('retry-player').onclick=()=>watch();$('close-player').onclick=()=>{const seriesId=selected?.tmdbSeriesId;closePlayer();if(seriesId)location.hash='tv='+seriesId;else{showDetails();$('watch').focus();}};addEventListener('hashchange',route);addEventListener('pagehide',()=>{clearTimeout(rotationTimer);closePlayer();searchController?.abort();detailController?.abort();});search();route();

})();
