import {minify} from 'terser';

function checkConnection(origin, backend) {
  if(location.origin!==origin){location.replace(origin+'/connection-check.html');return;}
  const output=document.querySelector('pre'),button=document.querySelector('button');
  const result={site:location.origin,secure:window.isSecureContext,cookiesEnabled:navigator.cookieEnabled,userAgent:navigator.userAgent,checks:[],diagnosticVersion:4,generatedAt:new Date().toISOString(),complete:false};button.disabled=true;
  const render=()=>{output.textContent=JSON.stringify(result,null,2);};
  button.onclick=async()=>{try{await navigator.clipboard.writeText(output.textContent);button.textContent='Copied';}catch{const range=document.createRange();range.selectNodeContents(output);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);button.textContent='Select and copy the results below';}};
  const bounded=async(task,ms=12000)=>{let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Connection setup timed out.')),ms)})]);}finally{clearTimeout(timer);}};
  const run=async(label,url,options={})=>{
    let deadline;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000),start=performance.now();
    try{
      const response=await Promise.race([fetch(url,{cache:'no-store',credentials:'omit',...options,signal:controller.signal}),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Connection check timed out.')),11000)})]);
      const check={label,status:response.status,type:response.type,elapsedMs:Math.round(performance.now()-start)};
      if(url.includes('/gms-studies-fetch?')){check.expectedStatus=400;check.contentType=response.headers.get('content-type')||'';const text=await response.clone().text();check.responseKind=/AccessDenied|<Error>/i.test(text)?'object-storage':/Invalid GMS path/.test(text)?'backend-validation':/Automated access/.test(text)?'automated-access-policy':'other';check.routeReached=check.status===400&&check.responseKind==='backend-validation';}
      if(url.endsWith('/api/static-host/check')&&response.ok){const body=await response.json();check.sessionProbe={supported:body.supported,cookies:body.cookies};}
      result.checks.push(check);
    }catch(error){result.checks.push({label,error:error.name,message:error.message,elapsedMs:Math.round(performance.now()-start)});}
    finally{clearTimeout(timer);clearTimeout(deadline);render();}
  };
  (async()=>{
    render();
    await Promise.all([run('S3 configuration',origin+'/direct-s3-config.json'),run('Backend connection without CORS',backend+'/healthz',{mode:'no-cors'}),run('Backend pre-session response with CORS',backend+'/healthz')]);
    await run('Session endpoint without cookies',backend+'/api/static-host/check');
    await run('Session endpoint with cookies',backend+'/api/static-host/check',{credentials:'include'});
    await run('Session cookie retained',backend+'/api/static-host/check',{credentials:'include'});
    try{const registration=await bounded(navigator.serviceWorker.register('/direct-s3-worker.js',{scope:'/',updateViaCache:'none'}));const pending=registration.installing||registration.waiting;if(pending&&pending.state!=='activated')await bounded(new Promise((resolve,reject)=>{const changed=()=>{if(['activated','redundant'].includes(pending.state)){pending.removeEventListener('statechange',changed);pending.state==='activated'?resolve():reject(Error('The site worker update did not activate.'));}};pending.addEventListener('statechange',changed);changed();}));await bounded(navigator.serviceWorker.ready);const start=Date.now();while((!navigator.serviceWorker.controller||navigator.serviceWorker.controller!==registration.active)&&Date.now()-start<5000)await new Promise(r=>setTimeout(r,50));if(!navigator.serviceWorker.controller||navigator.serviceWorker.controller!==registration.active)throw Error('The updated site worker is not controlling this page.');await run('Workspace backend through site worker',origin+'/healthz');await run('Game route through site worker',origin+'/gms-studies-fetch?url=invalid');}catch(error){result.checks.push({label:'Site worker',error:error.name,message:error.message});}
    result.complete=true;button.disabled=false;render();document.querySelector('[role=status]').textContent='Checks finished. Copy the results.';
  })();
}

export async function connectionCheckPage(origin,backend){
  const script=await minify('('+checkConnection.toString()+')('+JSON.stringify(origin)+','+JSON.stringify(backend)+');',{mangle:{toplevel:true},compress:true,format:{comments:false}});
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connection check</title><style>body{margin:0;background:#000;color:#eee;font:16px system-ui}main{max-width:760px;padding:24px;margin:auto}h1{font-size:24px}p{color:#aaa;line-height:1.5}button{font:inherit;border:0;border-radius:10px;padding:12px 18px;background:#bda9ff;color:#120c20}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px monospace;line-height:1.6;background:#101014;padding:18px;border-radius:12px}</style><main><h1>Connection check</h1><p>This checks the website connection. It does not read passwords, messages, or account details.</p><p role="status">Checking…</p><button type="button">Copy results</button><pre aria-label="Connection results"></pre></main><script>'+script.code+'</script></html>';
}
