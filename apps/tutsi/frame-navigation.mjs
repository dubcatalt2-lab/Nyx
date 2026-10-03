// A frame load event alone is not evidence that a usable website rendered.
export function watchWebsiteFrame(frame,{previousDocument=null,onReady,onError,reload,maxRetries=2,timeoutMs=25000,intervalMs=400}={}){
 let stopped=false,timer,recovering=false,attempts=0,started=Date.now();
 const stop=()=>{stopped=true;clearTimeout(timer);};
 const fail=async message=>{
  if(stopped||recovering)return;clearTimeout(timer);
  if(reload&&attempts<maxRetries){
   recovering=true;attempts++;
   try{previousDocument=frame.contentDocument}catch{}
   try{await reload(attempts);}catch(error){message=error.message||message;}
   recovering=false;if(stopped)return;
   started=Date.now();timer=setTimeout(check,intervalMs);return;
  }
  stop();onError(message);
 };
 stop.failed=fail;
 const check=()=>{
  if(stopped)return;
  if(!frame.isConnected){stop();return;}
  let message='The page took too long to respond. Try again.';
  try{
   const doc=frame.contentDocument;
   const href=frame.contentWindow?.location.href||'';
   if(doc&&doc!==previousDocument&&href!=='about:blank'){
    const text=(doc.body?.innerText||'').trim();
    const engineError=/^(?:Internal Service Worker Error:|Error (?:processing|fetching) your request|Reconnecting (?:Scramjet|Studyjet))/i.test(text);
    if(engineError){void fail('The browsing connection was interrupted.');return;}
    const media=doc.body?.querySelector('img,svg,canvas,video,iframe,input,button');
    if((text||media)&&doc.readyState!=='loading'){stop();onReady();return;}
    if(!text&&!media)message='The website did not display any content. Try again.';
   }
  }catch{}
  if(Date.now()-started>=timeoutMs){void fail(message);return;}
  timer=setTimeout(check,intervalMs);
 };
 timer=setTimeout(check,0);return stop;
}
