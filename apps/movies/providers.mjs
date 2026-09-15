// Public embed endpoints, using canonical TMDB coordinates. Names identify the
// actual services; inclusion is not a claim of availability or ad-free playback.
export const providerDefinitions = Object.freeze([
  ['vidy', 'Vidy', 'https://www.vidy.st', ''],
  ['videasy', 'Videasy', 'https://player.videasy.net', ''],
  ['vidfast', 'VidFast', 'https://vidfast.pro', ''],
  ['vidlink', 'VidLink', 'https://vidlink.pro', ''],
  ['spencerdevs', 'SpencerDevs', 'https://spencerdevs.xyz', ''],
  ['vidking', 'VidKing', 'https://www.vidking.net', '/embed'],
  ['vidsrc-su', 'VidSrc.su', 'https://vidsrc.su', '/embed'],
  ['vidrock', 'VidRock', 'https://vidrock.net', ''],
  ['vidsrc-cc', 'VidSrc.cc', 'https://vidsrc.cc', '/v2/embed'],
  ['embed-su', 'Embed.su', 'https://embed.su', '/embed']
].map(Object.freeze));

export function additionalSources(type, id, season, episode) {
  if (!['movie', 'tv'].includes(type) || !/^[1-9]\d{0,9}$/.test(String(id))) return [];
  if (type === 'tv' && (!/^\d{1,3}$/.test(String(season)) || !/^[1-9]\d{0,3}$/.test(String(episode)))) return [];
  const suffix = type === 'movie' ? `/movie/${id}` : `/tv/${id}/${season}/${episode}`;
  return providerDefinitions.map(([id, name, origin, prefix]) => ({id, name, url: origin + prefix + suffix, proxy: true}));
}

export function additionalSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    for (const [, , origin, prefix] of providerDefinitions) {
      if (url.origin !== origin || !url.pathname.startsWith(prefix + '/')) continue;
      if (/^\/(movie\/[1-9]\d{0,9}|tv\/[1-9]\d{0,9}\/\d{1,3}\/[1-9]\d{0,3})$/.test(url.pathname.slice(prefix.length))) return url.href;
    }
  } catch {}
  return null;
}

export function movieSourceUrl(value){
 const extra=additionalSourceUrl(value);if(extra)return extra;
 try{const url=new URL(value);if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash)return null;
 if(url.hostname==='watch.rivestream.app'&&url.pathname==='/embed'){
  const q=url.searchParams,type=q.get('type'),id=q.get('id'),keys=[...q.keys()];
  if(!/^[1-9]\d{0,9}$/.test(id||'')||new Set(keys).size!==keys.length)return null;
  if(type==='movie'&&keys.length===2&&keys.every(k=>['type','id'].includes(k)))return url.href;
  if(type==='tv'&&keys.length===4&&keys.every(k=>['type','id','season','episode'].includes(k))&&/^\d{1,3}$/.test(q.get('season')||'')&&/^[1-9]\d{0,3}$/.test(q.get('episode')||''))return url.href;
  return null;
 }
 if(url.hostname==='plyr.animex.one'){
  const q=url.searchParams,keys=[...q.keys()];
  if(!/^\/e\/[a-z0-9]+(?:-[a-z0-9]+)*\/[1-9]\d{0,3}$/.test(url.pathname)||keys.length!==5||new Set(keys).size!==5||!keys.every(k=>['lang','autoplay','t','hasPrev','hasNext'].includes(k)))return null;
  return q.get('lang')==='sub'&&q.get('autoplay')==='1'&&q.get('t')==='0'&&/^[01]$/.test(q.get('hasPrev')||'')&&/^[01]$/.test(q.get('hasNext')||'')?url.href:null;
 }
 if(url.search)return null;
 if(url.hostname==='framextv.tech'&&/^\/embed\/[1-9]\d{0,9}(\/\d{1,3}\/[1-9]\d{0,3})?$/.test(url.pathname))return url.href;
 if(url.hostname==='nhdapi.com'&&/^\/(movie\/\d{1,10}|tv\/\d{1,10}\/\d{1,3}\/\d{1,4}|anime\/\d{1,10}\/\d{1,4})$/.test(url.pathname))return url.href;
 if(url.hostname==='supaplay.fun'&&(/^\/mw\/([a-zA-Z0-9]+-)+[a-zA-Z0-9]{5,30}(\/\d{1,3}\/\d{1,4})?$/.test(url.pathname)||/^\/stream\/ani\/\d{1,8}\/\d{1,4}\/(sub|dub)$/.test(url.pathname)))return url.href;
 if(url.hostname==='ani.megaplay.su'&&/^\/kisskh\/\d{1,10}$/.test(url.pathname))return url.href;
 }catch{}return null;
}
