const byteSize=value=>typeof value==='string'?new TextEncoder().encode(value).byteLength:value?.byteLength??value?.size??0;
export function measureTransport(client,report){
 const emit=(kind,value=0)=>{try{report(kind,value);}catch{}};
 const add=(direction,value)=>{const bytes=byteSize(value);if(bytes)emit(direction,bytes);};
 const request=client.request.bind(client);
 client.request=async(url,method,body,...args)=>{
  emit('start');let ended=false;const finish=()=>{if(!ended){ended=true;emit('end');}};
  try{
   let upload=body;if(body instanceof ReadableStream)upload=body.pipeThrough(new TransformStream({transform(chunk,c){add('up',chunk);c.enqueue(chunk);}}));else add('up',body);
   const response=await request(url,method,upload,...args);
   if(response.body instanceof ReadableStream){const reader=response.body.getReader();return {...response,body:new ReadableStream({async pull(c){try{const {value,done}=await reader.read();if(done){finish();reader.releaseLock();c.close();}else{add('down',value);c.enqueue(value);}}catch(error){finish();c.error(error);}},async cancel(reason){try{await reader.cancel(reason);}finally{finish();reader.releaseLock();}}})};}
   add('down',response.body);finish();return response;
  }catch(error){finish();throw error;}
 };
 const connect=client.connect?.bind(client);if(connect)client.connect=(url,protocols,headers,onopen,onmessage,...rest)=>{const callbacks=connect(url,protocols,headers,onopen,(...args)=>{add('down',args[0]);onmessage?.(...args);},...rest);if(Array.isArray(callbacks)&&typeof callbacks[0]==='function'){const send=callbacks[0];callbacks[0]=(...args)=>{add('up',args[0]);return send(...args);};}return callbacks;};return client;
}
export function measureFetch(fetch,report){
 const client=measureTransport({async request(input,method,body,init){const response=await fetch(input,init);return {response,body:response.body};}},report);
 return async(input,init)=>{const {response,body}=await client.request(input,init?.method,init?.body,init);if(!response.body)return response;return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});};
}
export function trafficMeter({now=()=>performance.now()}={}){
 let down=0,up=0,totalBytes=0,totalRequests=0,requests=0,active=0,busyMs=0,previous=now(),last=previous;
 const history=Object.fromEntries(['traffic','requests','data','processing'].map(key=>[key,Array(45).fill(0)]));
 const tick=time=>{if(active)busyMs+=Math.max(0,time-last);last=time;};
 return {add(kind,bytes=0){tick(now());if(kind==='start'){active++;requests++;totalRequests++;return;}if(kind==='end'){active=Math.max(0,active-1);return;}if(!['up','down'].includes(kind)||!Number.isFinite(bytes)||bytes<0)return;if(kind==='up')up+=bytes;else down+=bytes;totalBytes+=bytes;},sample(){
  const time=now();tick(time);const elapsed=Math.max(1,time-previous),seconds=elapsed/1000,download=down*8/seconds/1e6,upload=up*8/seconds/1e6,mbps=download+upload,processing=Math.min(100,busyMs/elapsed*100),rps=requests/seconds;
  for(const [key,value]of Object.entries({traffic:mbps,requests:rps,data:totalBytes,processing})){history[key].push(value);history[key].shift();}
  previous=time;down=up=requests=busyMs=0;
  return {mbps,download,upload,processing,rps,active,totalBytes,totalRequests,samples:[...history.traffic],history:Object.fromEntries(Object.entries(history).map(([key,values])=>[key,[...values]]))};
 }};
}
