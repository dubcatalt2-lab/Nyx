import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/studies/slope-practice.js',import.meta.url),'utf8');
const functionSource=source.slice(source.indexOf('function planSlopeRoute('),source.indexOf('  select.disabled=true'));
const plan=vm.runInNewContext('('+functionSource.trim()+')');
const w=256,h=144;
function scene(obstacle){const data=new Uint8ClampedArray(w*h*4);for(let y=60;y<100;y++)for(let x=30;x<226;x++){const i=(y*w+x)*4;data[i+1]=180;data[i+3]=255;}if(obstacle)for(let y=65;y<92;y++)for(let x=obstacle[0];x<=obstacle[1];x++){const i=(y*w+x)*4;data[i]=255;data[i+1]=0;}return data;}
assert.equal(plan(new Uint8ClampedArray(w*h*4),w,h),null,'blank frames must release steering');
assert(Math.abs(plan(scene(),w,h).target)<.05,'center a clear track');
assert(plan(scene([115,155]),w,h).target<-.1,'steer left of a center/right hazard');
assert(plan(scene([100,140]),w,h).target>.1,'steer right of a center/left hazard');
console.log('PASS Slope vision: empty frames, clear track, left/right obstacle avoidance');
