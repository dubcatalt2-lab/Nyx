// Apply TCP/WebSocket backpressure without dropping any bytes from an RFB stream.
export function desktopFlow(source, send, fail, {highWater=256*1024, stallMs=45000}={}) {
  let pending=0, paused=false, closed=false, timer;
  const resume=()=>{clearTimeout(timer);if(paused){paused=false;source.desktopBackpressured=false;source.resume();}};
  return {
    write(data){
      if(closed)return;
      pending+=data.length;
      if(pending>=highWater&&!paused){
        paused=true;source.desktopBackpressured=true;source.pause();
        timer=setTimeout(()=>{if(!closed)fail('Desktop transport stalled');},stallMs);timer.unref?.();
      }
      try{send(data,error=>{pending-=data.length;if(closed)return;if(error){fail('Desktop transport failed');return;}if(pending<highWater/2)resume();});}
      catch{fail('Desktop transport failed');}
    },
    close(){closed=true;resume();},
  };
}

export const transientDesktopAuth=error=>['auth/internal-error','auth/network-request-failed','app/network-error','app/network-timeout'].includes(error?.code);
export const desktopAuthClose=error=>transientDesktopAuth(error)?1013:error?.code==='auth/id-token-expired'?4001:4003;
