/* Sequential relay selection. Only configured endpoints can be remembered. */
(()=>{
  let signature='', selected='', pending=null, generation=0;
  const key='nyx.lastWorkingRelay';
  function probe(url){
    return new Promise(resolve=>{
      let socket, timer, done=false;
      const finish=ok=>{
        if(done)return;
        done=true;clearTimeout(timer);
        if(socket){socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close()}catch{}}
        resolve(ok);
      };
      timer=setTimeout(()=>finish(false),10000);
      try{
        socket=new WebSocket(url);socket.binaryType='arraybuffer';
        // WISP sends an initial CONTINUE packet for stream zero. An HTTP
        // upgrade alone also succeeds on endpoints that are not WISP relays.
        socket.onmessage=event=>{
          if(!(event.data instanceof ArrayBuffer))return;
          const bytes=new Uint8Array(event.data);
          if(bytes.length>=9 && bytes[0]===3 && new DataView(event.data).getUint32(1,true)===0)finish(true);
        };
        socket.onerror=socket.onclose=()=>finish(false);
      }catch{finish(false)}
    });
  }
  function configure(urls){
    const next=JSON.stringify(urls);
    if(next!==signature){signature=next;selected='';pending=null;generation++}
  }
  function current(urls){configure(urls);return selected || urls[0] || ''}
  async function choose(urls,failed=''){
    configure(urls);
    if(pending)return pending;
    if(selected && !failed)return selected;
    const version=generation;
    let remembered='';try{remembered=localStorage.getItem(key)||''}catch{}
    const order=[...new Set([selected,remembered,...urls])].filter(url=>urls.includes(url) && url!==failed);
    if(urls.includes(failed))order.push(failed);
    pending=(async()=>{
      for(const url of order){
        const ok=await probe(url);
        if(version!==generation)return '';
        if(ok){selected=url;try{localStorage.setItem(key,url)}catch{}return url}
      }
      selected='';
      try{localStorage.removeItem(key)}catch{}
      return '';
    })();
    try{return await pending}finally{if(version===generation)pending=null}
  }
  window.NyxRelaySelection={current,choose,probe};
})();
