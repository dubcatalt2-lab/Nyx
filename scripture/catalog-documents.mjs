export function catalogDocuments({request=fetch,loadCatalog,owner='freebuisness'}={}){
  let paths,pending,updated=0;
  const requests=new Map();
  const safe=value=>/^[0-9]+[a-z0-9_.-]*\.html(?:-[a-z0-9]+)?$/i.test(value);
  async function refresh(live=false){
    if(!live&&paths)return paths;
    if(pending)return pending;
    pending=(async()=>{
      let items;
      if(live){
        if(paths&&Date.now()-updated<60000)return paths;
        const response=await request(`https://raw.githubusercontent.com/${owner}/assets/main/zones.json`,{signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw Error('Catalog HTTP '+response.status);
        items=(await response.json()).map(x=>({id:String(x.id),path:String(x.url||'').replace(/^\{HTML_URL\}\/?/,'')}));
      }else items=(await loadCatalog()).games;
      paths=new Map(items.filter(x=>safe(x.path)).map(x=>[String(x.id),x.path]));if(live)updated=Date.now();return paths;
    })().finally(()=>{pending=null;});return pending;
  }
  async function read(path){
    if(!safe(path))throw Error('Invalid document path');
    const id=path.match(/^\d+/)[0];let selected=(await refresh()).get(id)||path;
    for(let attempt=0;attempt<2;attempt++){
      const url=`https://raw.githubusercontent.com/${owner}/html/main/${selected}`;
      const response=await request(url,{signal:AbortSignal.timeout(15000)});
      if(response.ok)return {html:await response.text(),path:selected,url};
      await response.body?.cancel();
      if(response.status!==404||attempt)throw Object.assign(Error('Game document HTTP '+response.status),{status:response.status});
      const next=(await refresh(true)).get(id);if(!next||next===selected)throw Object.assign(Error('Game document unavailable'),{status:404});selected=next;
    }
  }
  return path=>{
    if(!requests.has(path))requests.set(path,read(path).finally(()=>requests.delete(path)));
    return requests.get(path);
  };
}
