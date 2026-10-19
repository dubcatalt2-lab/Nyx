import {readFileSync} from 'node:fs';
const failure=()=>Object.assign(new Error('Tidal catalog is temporarily unavailable.'),{status:502});
export function q94d6({file=process.env.NYX_TIDAL_CREDENTIALS_FILE,fetchImpl=fetch}={}){
  let credentials=null,token=null,pending=null;
  if(file){try{const value=JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));if(typeof value.clientId==='string'&&typeof value.clientSecret==='string'&&value.clientId&&value.clientSecret)credentials=value;}catch{}}
  async function json(response){
    if(!response.ok){await response.body?.cancel();throw failure();}
    let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>2*1024*1024)throw failure();chunks.push(chunk);}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw failure();}
  }
  async function access(){
    if(!credentials)throw failure();if(token?.until>Date.now())return token.value;if(pending)return pending;
    pending=(async()=>{
      const result=await json(await fetchImpl('https://auth.tidal.com/v1/oauth2/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Basic '+Buffer.from(credentials.clientId+':'+credentials.clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'}));
      if(typeof result.access_token!=='string'||!result.access_token)throw failure();token={value:result.access_token,until:Date.now()+Math.max(0,(Number(result.expires_in)||300)-30)*1000};return token.value;
    })().finally(()=>{pending=null;});return pending;
  }
  async function api(path,include,params={}){
    const url=new URL('https://openapi.tidal.com/v2'+path);for(const [key,value]of Object.entries({countryCode:'US',include,...params}))url.searchParams.set(key,value);
    for(let attempt=0;attempt<2;attempt++){
      const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/vnd.api+json',Authorization:'Bearer '+await access()}});
      if(response.status===401&&attempt===0){await response.body?.cancel();token=null;continue;}return json(response);
    }
  }
  function view(payload){
    const rows=[...(Array.isArray(payload.data)?payload.data:[payload.data]),...(payload.included||[])].filter(x=>x?.attributes),index=new Map(rows.map(x=>[x.type+':'+x.id,x]));
    const related=(r,key)=>(r?.relationships?.[key]?.data||[]).map(x=>index.get(x.type+':'+x.id)).filter(Boolean);
    function cover(r){const art=related(r,'coverArt')[0]||related(r,'profileArt')[0];const file=(art?.attributes?.files||[]).find(x=>x.meta?.width===320);try{const u=new URL(file.href);return u.protocol==='https:'&&['resources.tidal.com','resources.wimpmusic.com'].includes(u.hostname)?'/api/nyxify/cover?tidal='+encodeURIComponent(u.pathname):'';}catch{return '';}}
    const album=r=>({id:'tidal:'+r.id,title:r.attributes.title,name:r.attributes.title,cover:cover(r),artist:related(r,'artists')[0]?.attributes?.name||'',count:r.attributes.numberOfItems||0});
    const track=r=>{const a=related(r,'artists')[0],b=related(r,'albums')[0],d=String(r.attributes.duration).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);return {id:'tidal:'+r.id,title:[r.attributes.title,r.attributes.version].filter(Boolean).join(' - '),artist:a?.attributes?.name||'Unknown artist',artistId:a?'tidal:'+a.id:'',album:b?.attributes?.title||'',albumId:b?'tidal:'+b.id:'',cover:cover(b),duration:d?Number(d[1]||0)*3600+Number(d[2]||0)*60+Number(d[3]||0):0,catalog:'tidal'};};
    return {rows,related,cover,album,tracks:rows.filter(r=>r.type==='tracks'&&/^\d{1,20}$/.test(r.id)).map(track)};
  }
  async function search(query){if(!credentials)return [];return view(await api('/searchResults','tracks.artists,tracks.albums.coverArt',{'filter[query]':String(query).slice(0,100)})).tracks;}
  async function detail(type,id){
    if(!['artist','album'].includes(type)||!/^\d{1,20}$/.test(id))throw failure();
    const root='/'+type+'s/'+id;
    const [meta,items]=await Promise.all([api(root,type==='artist'?'profileArt,albums.coverArt':'artists,coverArt'),api(root+'/relationships/'+(type==='artist'?'tracks':'items'),type==='artist'?'tracks.artists,tracks.albums.coverArt':'items.artists,items.albums.coverArt',type==='artist'?{collapseBy:'FINGERPRINT'}:{})]);
    const v=view(meta),r=Array.isArray(meta.data)?meta.data[0]:meta.data;return {name:r.attributes.name||r.attributes.title,cover:v.cover(r),artist:v.related(r,'artists')[0]?.attributes?.name||'',artistId:v.related(r,'artists')[0]?'tidal:'+v.related(r,'artists')[0].id:'',tracks:view(items).tracks,albums:v.rows.filter(x=>x.type==='albums').map(v.album)};
  }
  return {configured:!!credentials,search,detail};
}
