import assert from 'node:assert/strict';
import {createAiDeadline} from '../lib/ai-deadline.mjs';
let now=0,id=0;const timers=new Map();
const setTimer=(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id};
const clearTimer=id=>timers.delete(id);
function advance(ms){const end=now+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
let controller=new AbortController();let deadline=createAiDeadline(controller,{idleMs:45,totalMs:120,setTimer,clearTimer});
advance(40);deadline.touch();advance(40);assert(!controller.signal.aborted,'Healthy stream cut off by initial deadline');deadline.touch();advance(39);assert(!controller.signal.aborted);advance(1);assert(controller.signal.aborted,'Total deadline not enforced');assert.equal(timers.size,0);
controller=new AbortController();deadline=createAiDeadline(controller,{idleMs:45,totalMs:120,setTimer,clearTimer});advance(45);assert(controller.signal.aborted,'Stalled stream not stopped');
controller=new AbortController();deadline=createAiDeadline(controller,{idleMs:45,totalMs:120,setTimer,clearTimer});deadline.dispose();advance(150);assert(!controller.signal.aborted);assert.equal(timers.size,0);
controller=new AbortController();deadline=createAiDeadline(controller,{idleMs:45,totalMs:120,setTimer,clearTimer});controller.abort();deadline.touch();assert.equal(timers.size,0);
console.log('AI deadline: streaming progress, stall, total cap, cleanup and cancellation passed');
