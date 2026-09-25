// Streaming progress extends the idle deadline, never the total request budget.
export function createAiDeadline(controller, {idleMs, totalMs, setTimer=setTimeout, clearTimer=clearTimeout}) {
  let idle, disposed=false;
  const abort=()=>{dispose();controller.abort();};
  const total=setTimer(abort,totalMs);
  function touch(){if(disposed||controller.signal.aborted)return;clearTimer(idle);idle=setTimer(abort,idleMs);}
  function dispose(){disposed=true;clearTimer(idle);clearTimer(total);}
  controller.signal.addEventListener('abort',dispose,{once:true});
  touch();
  return {touch,dispose(){dispose();controller.signal.removeEventListener('abort',dispose);}};
}
