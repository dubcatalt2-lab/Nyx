(async()=>{
 const status=document.querySelector('[role="status"]');
 try{
  const config=await fetch('./direct-s3-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Hosting configuration could not be loaded.');return r.json();});
  if(location.origin!==config.origin)throw Error('Open the bucket-specific address listed in START-HERE.txt.');
  let result;
  for(let i=0;i<2;i++){const response=await fetch(config.backend+'/api/static-host/check',{credentials:'include',cache:'no-store'});if(!response.ok)throw Error('This S3 address is not enabled on the Nyx backend yet.');result=await response.json();}
  if(!result.supported||!result.cookies)throw Error('This br00ser did not retain the required session cookie.');
  await navigator.serviceWorker.register('/direct-s3-worker.js',{scope:'/',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('The site worker could not start.')),15000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});});
  const target=new URL(new URLSearchParams(location.search).get('returnTo')||'/studies.html',location.origin);
  location.replace(target.origin===location.origin&&target.pathname!=='/index.html'?target.href:'/studies.html');
 }catch(error){status.textContent=error.message||'Nyx could not connect to its backend.';}
})();
