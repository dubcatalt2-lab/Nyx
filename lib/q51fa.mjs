const q83b2 = new Map();
export function q64c1(value) {
  const rows=[];
  for(const line of String(value||'').slice(0,100000).split(/\r?\n/)){
    const marks=[...line.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    const text=line.replace(/\[[^\]]*\]/g,'').trim();
    for(const m of marks)rows.push({at:Number(m[1])*60+Number(m[2])+Number('0.'+(m[3]||'0')),text});
  }
  return rows.sort((a,b)=>a.at-b.at).slice(0,2000);
}
export async function q51fa(input,fetcher=fetch){
  const clean=value=>typeof value==='string'?value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,200):'';
  const title=clean(input.title),artist=clean(input.artist),album=clean(input.album),duration=Number(input.duration);
  if(!title||!artist)throw Object.assign(Error('Track title and artist are required.'),{status:400});
  const query=new URLSearchParams({track_name:title,artist_name:artist});
  if(album)query.set('album_name',album);
  if(Number.isFinite(duration)&&duration>0&&duration<86400)query.set('duration',String(Math.round(duration)));
  const key=query.toString(),old=q83b2.get(key);if(old&&old.until>Date.now())return old.value;
  const response=await fetcher('https://lrclib.net/api/get?'+key,{signal:AbortSignal.timeout(10000),redirect:'error',headers:{Accept:'application/json','User-Agent':'N7X/1.0 (https://nyxlearning.org)'}});
  let result={lines:[],plain:'',instrumental:false};
  if(response.status!==404){
    if(!response.ok)throw Error('Lyrics provider unavailable');
    const reader=response.body.getReader();let size=0;const chunks=[];
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>200000)throw Error('Lyrics response too large');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    result={lines:q64c1(data.syncedLyrics),plain:String(data.plainLyrics||'').slice(0,100000),instrumental:data.instrumental===true};
  }
  q83b2.set(key,{value:result,until:Date.now()+(result.lines.length||result.plain?3600000:300000)});
  while(q83b2.size>200)q83b2.delete(q83b2.keys().next().value);
  return result;
}
