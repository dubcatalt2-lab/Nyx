import {minify} from 'terser';

function checkConnection(origin, backend) {
  if(location.origin!==origin){location.replace(origin+'/connection-check.html');return;}
  const output=document.querySelector('pre'),button=document.querySelector('button');
  const result={site:location.origin,secure:window.isSecureContext,cookiesEnabled:navigator.cookieEnabled,userAgent:navigator.userAgent,checks:[]};
  const render=()=>{output.textContent=JSON.stringify(result,null,2);};
  button.onclick=async()=>{try{await navigator.clipboard.writeText(output.textContent);button.textContent='Copied';}catch{const range=document.createRange();range.selectNodeContents(output);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);button.textContent='Select and copy the results below';}};
  const run=async(label,url,options={})=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000),start=performance.now();
    try{
      const response=await fetch(url,{cache:'no-store',credentials:'omit',...options,signal:controller.signal});
      const check={label,status:response.status,type:response.type,elapsedMs:Math.round(performance.now()-start)};
      if(url.endsWith('/api/static-host/check')&&response.ok){const body=await response.json();check.sessionProbe={supported:body.supported,cookies:body.cookies};}
      result.checks.push(check);
    }catch(error){result.checks.push({label,error:error.name,message:error.message,elapsedMs:Math.round(performance.now()-start)});}
    finally{clearTimeout(timer);render();}
  };
  (async()=>{
    render();
    await run('S3 configuration',origin+'/direct-s3-config.json');
    await run('Backend connection without CORS',backend+'/healthz',{mode:'no-cors'});
    await run('Backend health with CORS',backend+'/healthz');
    await run('Session endpoint without cookies',backend+'/api/static-host/check');
    await run('Session endpoint with cookies',backend+'/api/static-host/check',{credentials:'include'});
    await run('Session cookie retained',backend+'/api/static-host/check',{credentials:'include'});
    result.complete=true;render();document.querySelector('[role=status]').textContent='Checks finished. Copy the results.';
  })();
}

export async function connectionCheckPage(origin,backend){
  const script=await minify('('+checkConnection.toString()+')('+JSON.stringify(origin)+','+JSON.stringify(backend)+');',{mangle:{toplevel:true},compress:true,format:{comments:false}});
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connection check</title><style>body{margin:0;background:#000;color:#eee;font:16px system-ui}main{max-width:760px;padding:24px;margin:auto}h1{font-size:24px}p{color:#aaa;line-height:1.5}button{font:inherit;border:0;border-radius:10px;padding:12px 18px;background:#bda9ff;color:#120c20}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px monospace;line-height:1.6;background:#101014;padding:18px;border-radius:12px}</style><main><h1>Connection check</h1><p>This checks the website connection. It does not read passwords, messages, or account details.</p><p role="status">Checking…</p><button type="button">Copy results</button><pre aria-label="Connection results"></pre></main><script>'+script.code+'</script></html>';
}
