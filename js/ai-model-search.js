(()=>{
  const terms={
    image:['image','images','picture','pictures','photo','photos','art','draw','drawing','generate','generation','generator'],
    vision:['vision','see','analyze','analyse','describe','recognize','ocr','screenshot','screenshots'],
    video:['video','videos','movie','movies','animation','animate'],
    audio:['audio','speech','voice','sound','speak','tts'],
    transcription:['transcribe','transcription','stt'],
    coding:['code','coding','coder','programming','debug','debugging','developer'],
    reasoning:['reason','reasoning','think','thinking','math','mathematics','logic'],
    embeddings:['embedding','embeddings'],rerank:['rerank','ranking'],
    free:['free'],text:['text','write','writing','chat','conversation','summarize','summary']
  };
  const stop=new Set(['a','an','the','for','to','that','can','do','make','create','best','model','models','and','with','of','me','i','want','some','please']);
  function search(models,query,company){
    const words=String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
    const intents=new Set(),remaining=[];
    for(const word of words){const kind=Object.keys(terms).find(key=>terms[key].includes(word));if(kind)intents.add(kind);else if(!stop.has(word))remaining.push(word);}
    if(intents.has('video')||intents.has('audio')||intents.has('vision')||intents.has('transcription'))intents.delete('image');
    const modalities=item=>item.outputModalities||[...(item.text!==false?['text']:[]),...(item.imageGeneration?['image']:[])];
    const supports=(item,kind)=>kind==='image'?item.imageGeneration:kind==='vision'?item.vision:kind==='coding'?item.text!==false:kind==='reasoning'?item.reasoning:kind==='free'?item.free||item.id.endsWith(':free')||item.id==='openrouter/free':kind==='audio'?modalities(item).some(x=>x==='speech'||x==='audio'):modalities(item).includes(kind);
    const score=item=>{
      const name=`${item.id} ${item.label}`.toLowerCase();
      const exact=name===query||item.id.toLowerCase()===query||item.label.toLowerCase()===query?100000:0;
      const specialist=intents.has('coding')&&!Number.isFinite(item.codingRank)&&/codex|coder|code|devstral|programming/.test(name)?1000:0;
      const rank=intents.has('coding')?(item.codingRank??item.catalogRank):(item.catalogRank);
      return exact+specialist+(Number.isFinite(rank)?Math.max(0,900-rank):0);
    };
    return models.filter(item=>[...intents].every(kind=>supports(item,kind))&&remaining.every(word=>`${item.label} ${item.id} ${company(item).label}`.toLowerCase().includes(word)))
      .sort((a,b)=>score(b)-score(a)||a.label.localeCompare(b.label));
  }
  globalThis.NyxModelSearch={search};
})();
