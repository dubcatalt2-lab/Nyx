export function startMemoryMonitor({memory=()=>process.memoryUsage(),warn=console.warn,interval=60000,threshold=1536*1024**2}={}) {
  const check=()=>{const m=memory();if(m.rss>=threshold)warn('Memory pressure '+JSON.stringify({rssMiB:Math.round(m.rss/1024**2),heapMiB:Math.round(m.heapUsed/1024**2),externalMiB:Math.round(m.external/1024**2),buffersMiB:Math.round(m.arrayBuffers/1024**2)}));};
  const timer=setInterval(check,interval);timer.unref();
  return {check,stop:()=>clearInterval(timer)};
}
