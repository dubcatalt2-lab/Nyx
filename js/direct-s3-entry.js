(async()=>{
 const status=document.querySelector('[role="status"]'),progress=document.querySelector('progress');
 const advance=value=>{if(progress)progress.value=value;};
 try{
  const config=await fetch('./direct-s3-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Hosting configuration could not be loaded.');return r.json();});
  if(location.origin!==config.origin)throw Error('Open the bucket-specific address listed in START-HERE.txt.');
  advance(20);
  let result;
  for(let i=0;i<2;i++){const response=await fetch(config.backend+'/api/static-host/check',{credentials:'include',cache:'no-store'});if(!response.ok)throw Error('This S3 address is not enabled on the Nyx backend yet.');result=await response.json();}
  if(!result.supported||!result.cookies)throw Error('This br00ser did not retain the required session cookie.');
  advance(45);
  const registration=await navigator.serviceWorker.register('/direct-s3-worker.js',{scope:'/',updateViaCache:'none'});
  const installing=registration.installing||registration.waiting;
  if(installing&&installing.state!=='activated')await new Promise((resolve,reject)=>{installing.addEventListener('statechange',()=>{if(installing.state==='activated')resolve();if(installing.state==='redundant')reject(Error('The site worker could not update.'));});});
  advance(70);
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('The site worker could not start.')),15000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});});
  await new Promise((resolve,reject)=>{
   const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('The connection check timed out.')),15000);
   channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data.ok?resolve():reject(Error(event.data.error));};
   navigator.serviceWorker.controller.postMessage({type:'nyx:static-session'},[channel.port2]);
  });
  advance(100);
  const target=new URL(new URLSearchParams(location.search).get('returnTo')||'/studies.html',location.origin);
  location.replace(target.origin===location.origin&&target.pathname!=='/index.html'?target.href:'/studies.html');
 }catch(error){status.hidden=false;status.textContent=error.message||'Nyx could not connect to its backend.';}
})();
