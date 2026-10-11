export function activeWorker(registration,{timeout=15000}={}){
  return new Promise((resolve,reject)=>{
    const watched=new Set();
    const finish=(error,worker)=>{
      clearTimeout(timer);
      registration.removeEventListener('updatefound',check);
      for(const item of watched)item.removeEventListener('statechange',check);
      error?reject(error):resolve(worker);
    };
    const check=()=>{
      const workers=[registration.installing,registration.waiting,registration.active].filter(Boolean);
      for(const worker of workers)if(!watched.has(worker)){watched.add(worker);worker.addEventListener('statechange',check);}
      const pending=workers.find(worker=>['installing','installed','activating'].includes(worker.state));
      if(pending)return;
      const worker=workers.find(worker=>worker.state==='activated');
      if(worker)finish(null,worker);
    };
    const timer=setTimeout(()=>finish(new Error('Document handler did not start')),timeout);
    registration.addEventListener('updatefound',check);
    check();
  });
}
