// Per-account launch reservations. Rejections never move the retry deadline.
export function createCloudLaunchLimit({windowMs=600000,maxAttempts=3,failureCooldownMs=10000,now=Date.now}={}) {
  const entries=new Map();
  function prune(uid,time=now()){
    const recent=(entries.get(uid)||[]).filter(item=>item.until>time);
    if(recent.length)entries.set(uid,recent);else entries.delete(uid);
    return recent;
  }
  return {
    reserve(uid){
      const time=now(),recent=prune(uid,time);
      const cooldown=recent.filter(item=>item.failed).reduce((value,item)=>Math.max(value,item.until),0);
      const full=recent.length>=maxAttempts?Math.min(...recent.map(item=>item.until)):0;
      const until=Math.max(cooldown,full);
      if(until>time)return {allowed:false,retryAfter:Math.max(1,Math.ceil((until-time)/1000))};
      const ticket={until:time+windowMs,failed:false};recent.push(ticket);entries.set(uid,recent);
      let settled=false;
      return {allowed:true,finish(success){if(settled)return;settled=true;if(!success){ticket.failed=true;ticket.until=now()+failureCooldownMs;}}};
    },
    cleanup(){for(const uid of entries.keys())prune(uid);}
  };
}
