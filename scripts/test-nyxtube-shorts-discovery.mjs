import assert from 'node:assert/strict';
import {createTubeCatalog} from '../lib/nyxtube-catalog.mjs';
import {createInvidiousFallback} from '../lib/nyxtube-invidious.mjs';
import {SHORTS_TOPICS} from '../lib/nyxtube-shorts.mjs';

const sources = Object.values(SHORTS_TOPICS).flat();
let channelCalls = 0, searchCalls = 0;
const entry = (id, source = sources[0], extra = {}) => ({id, channel_id:source, title:id, duration:30, availability:'public', ...extra});
const catalog = createTubeCatalog({env:{}, fallback:{enabled:true, close(){},
  channelShorts:async (source, continuation) => {
    channelCalls++;
    const index = sources.indexOf(source), start = continuation ? 2 : 0;
    assert.ok(index >= 0); assert.ok(['','next'].includes(continuation));
    return {entries:[0,1].map(i=>entry(`SRC${index}${String(start+i).padStart(7,'0')}`,source)), continuation: continuation ? '' : 'next'};
  },
  searchShorts:async (query,page)=>{
    searchCalls++; assert.equal(query,'cats');
    return {entries:page===1?[entry('catShort001'),entry('catShort001'),entry('catShort002',sources[0],{duration:300}),entry('catShort003',sources[0],{age_limit:18}),entry('catShort004',sources[0],{is_live:true})]:[],hasMore:page===1};
  }
}});
try {
  const initial = await Promise.all(Array.from({length:20},()=>catalog.shortsPage(1,4,{topic:'discover'})));
  assert.equal(channelCalls,4,'20 simultaneous discovery requests share provider calls');
  assert.equal(initial[0].videos.length,4);
  assert.deepEqual(initial[0].videos.map(v=>v.channelId),sources,'creators interleave');
  const ids=new Set(initial[0].videos.map(v=>v.id));let cursor=initial[0].nextCursor;
  for(let page=2;cursor;page++){
    assert.ok(page<=4);
    const result=await catalog.shortsPage(1,4,{topic:'discover',cursor});
    for(const v of result.videos){assert.ok(!ids.has(v.id),'continuation does not repeat or skip entries');ids.add(v.id);}
    cursor=result.nextCursor;
    if(page===2)assert.equal(channelCalls,4,'unused provider entries come from shared cache');
  }
  assert.equal(ids.size,16);assert.equal(channelCalls,8);
  const gaming=await catalog.shortsPage(1,24,{topic:'gaming'});
  assert.ok(gaming.videos.every(v=>v.channelId===SHORTS_TOPICS.gaming[0]));
  const personalized=await catalog.shortsPage(1,4,{topic:'discover',creators:sources[2]});
  assert.equal(personalized.videos.filter(v=>v.channelId===sources[2]).length,2,'liked creators receive additional feed slots');
  assert.ok(personalized.videos.some(v=>v.channelId!==sources[2]),'personalized feeds keep variety');
  assert.throws(()=>catalog.shortsPage(1,4,{topic:'discover',cursor:personalized.nextCursor}),e=>e.status===400,'cursors belong to their preference set');
  for(const creators of ['https://example.com',sources.join(','),`${sources[0]},${sources[0]}`,['bad']])assert.throws(()=>catalog.shortsPage(1,24,{topic:'discover',creators}),e=>e.status===400);
  const searches=await Promise.all(Array.from({length:12},()=>catalog.shortsPage(1,24,{query:'cats'})));
  assert.equal(searchCalls,1);assert.deepEqual(searches[0].videos.map(v=>v.id),['catShort001']);assert.equal(searches[0].nextPage,2);
  assert.deepEqual(await catalog.shortsPage(2,24,{query:'cats'}),{videos:[],nextPage:null});
  for(const options of [{topic:'unknown'},{topic:'__proto__'},{topic:['gaming']},{query:['cats']},{query:'a'},{topic:'gaming',cursor:initial[0].nextCursor},{cursor:'bad'},{cursor:'x'.repeat(12001)},{query:'cats',cursor:initial[0].nextCursor}])assert.throws(()=>catalog.shortsPage(1,24,options),e=>e.status===400);
}finally{await catalog.close();}

let lastUrl;
const adapter=createInvidiousFallback({env:{NYX_INVIDIOUS_ORIGINS:'https://fixture.example'},fetch:async url=>{
  lastUrl=url;
  const video={type:'video',videoId:'catShort001',author:'Creator',authorId:sources[0],lengthSeconds:30};
  return Response.json(url.pathname.endsWith('/shorts')?{videos:[video,{...video,authorId:sources[1]}],continuation:'next'}:[video]);
}});
try{
  await adapter.searchShorts('cats',2);
  assert.equal(lastUrl.searchParams.get('q'),'cats #shorts');assert.equal(lastUrl.searchParams.get('page'),'2');assert.equal(lastUrl.searchParams.get('duration'),'short');
  const batch=await adapter.channelShorts(sources[0],'next');
  assert.equal(lastUrl.pathname,`/api/v1/channels/${sources[0]}/shorts`);assert.equal(lastUrl.searchParams.get('continuation'),'next');
  assert.equal(batch.entries.length,1,'wrong-channel results do not enter curated discovery');
}finally{adapter.close();}
console.log('PASS Shorts search/filtering, curated interleaving, lossless continuation/exhaustion, cache coalescing, topic isolation and cursor validation');
