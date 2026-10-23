(() => {
  'use strict';
  const realNow=performance.now.bind(performance), raf=requestAnimationFrame.bind(window);
  let speed=1,paused=false,real=realNow(),virtual=real;
  function now(){const next=realNow();virtual+=(next-real)*(paused?0:speed);real=next;return virtual;}
  // Unity reads this monotonic clock; changing rates preserves continuity.
  Object.defineProperty(performance,'now',{configurable:true,value:now});
  window.requestAnimationFrame=callback=>raf(()=>{callback(now());observeTrack();});
  const host=document.createElement('aside');host.style.cssText='position:fixed;right:16px;top:16px;z-index:2147483646;color-scheme:dark';
  const root=host.attachShadow({mode:'open'});
  // Presentation is confined to this owned menu; engine and save data stay unchanged.
  queueMicrotask(() => {
    const convert = text => text.replace(/\bgames\b/gi,'studies').replace(/\bgame\b/gi,'study').replace(/(?:Slope practice|Practice tools)/g,'Study tools').replace(/\b[A-Za-z]{4,}\b/g,word=>/e/i.test(word)?word.replace(/e/i,'3'):word.replace(/o/i,'0')).replace(/[A-Za-z]/g,c=>String.fromCodePoint((c<='Z'?0x1d5a0:0x1d5ba)+c.toLowerCase().charCodeAt(0)-97));
    const scan = () => {
      for(const el of root.querySelectorAll('button,summary,label,option')) {
        const plain=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
        if(plain && /[A-Za-z]/.test(plain) && !el.hasAttribute('aria-label')) el.setAttribute('aria-label',plain.replace(/(?:Slope practice|Practice tools)/g,'Study tools'));
        if(el.tagName==='OPTION'&&!el.hasAttribute('value')) el.setAttribute('value',el.textContent);
      }
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
      while((node=walker.nextNode())) {
        if(node.parentElement?.closest('style,script,input,textarea'))continue;
        const next=convert(node.data);if(next!==node.data)node.data=next;
      }
    };
    scan();new MutationObserver(scan).observe(root,{childList:true,subtree:true,characterData:true});
  });
root.innerHTML=`<style>:host{font:13px system-ui;color:#eee}details{width:230px;background:#15171a;border:1px solid #ffffff30;border-radius:16px;padding:14px;box-sizing:border-box}summary{cursor:grab;touch-action:none;font-weight:600}label{display:flex;justify-content:space-between;align-items:center;margin:18px 0}button,select{font:inherit;color:inherit;background:#292c32;border:1px solid #ffffff35;border-radius:8px;padding:7px}button{cursor:pointer}p{font-size:12px;line-height:1.5;color:#bfc3ca}</style><details><summary>Slope practice</summary><p>Slow the game to practice steering and difficult turns.</p><label>Game speed<select aria-label="Game speed"><option value="0.25">0.25x</option><option value="0.5">0.5x</option><option value="0.75">0.75x</option><option value="1" selected>1x</option><option value="1.5">1.5x</option><option value="2">2x</option></select></label><button disabled>Pause</button><p role="status">Waiting for the game...</p></details>`;
  (document.body||document.documentElement).append(host);
  const select=root.querySelector('select'),button=root.querySelector('button'),status=root.querySelector('[role=status]');
  const autoLabel=document.createElement('label');autoLabel.innerHTML='Autoplay (assisted)<input type="checkbox" aria-label="Autoplay (assisted)">';button.before(autoLabel);
  const help=document.createElement('p');help.textContent='Press Play in the game. Autoplay reads the visible track and steers around red obstacles. It cannot see beyond the camera or guarantee a run.';autoLabel.after(help);
  const auto=autoLabel.querySelector('input');
  const vision=document.createElement('canvas');vision.width=256;vision.height=144;
  const context=vision.getContext('2d',{willReadFrequently:true});
  let held=0,lastScan=0,lastTarget=0,manualUntil=0,lastReport=0,started=false;
  function steer(direction){
    if(held===direction)return;
    const canvas=window.gameInstance?.Module?.canvas||document.querySelector('canvas');
    function key(type,side){const code=side<0?37:39;const event=new KeyboardEvent(type,{key:side<0?'ArrowLeft':'ArrowRight',code:side<0?'ArrowLeft':'ArrowRight',keyCode:code,which:code,bubbles:true,cancelable:true});canvas?.dispatchEvent(event);}
    if(held)key('keyup',held);held=direction;if(held)key('keydown',held);
  }
  auto.addEventListener('change',()=>{steer(0);lastTarget=0;status.textContent=auto.checked?'Ready - press Play in Slope.':'Autoplay off.';});
  document.addEventListener('pointerdown',e=>{if(e.isTrusted&&e.target.tagName==='CANVAS'){started=true;lastTarget=0;steer(0);}},true);
  addEventListener('keydown',e=>{if(e.isTrusted&&['ArrowLeft','ArrowRight','a','d','q'].includes(e.key)){manualUntil=realNow()+1200;steer(0);}},true);
  addEventListener('blur',()=>steer(0));document.addEventListener('visibilitychange',()=>{if(document.hidden)steer(0);});
  function observeTrack(){
    const time=realNow();if(!auto.checked||!started||paused||document.hidden||time<manualUntil){steer(0);return;}if(time-lastScan<65)return;lastScan=time;
    const canvas=window.gameInstance?.Module?.canvas||document.querySelector('canvas');if(!canvas||!context)return;
    try{context.drawImage(canvas,0,0,256,144);const pixels=context.getImageData(0,0,256,144).data;const plan=planSlopeRoute(pixels,256,144,lastTarget);
      if(!plan){steer(0);return;}const velocity=(plan.target-lastTarget);lastTarget=plan.target;
      const aim=plan.target+velocity*.8;const pulse=time%220<115;steer(Math.abs(aim)<.09||(!pulse&&Math.abs(aim)<.4)?0:Math.sign(aim));
      if(time-lastReport>700){status.textContent=held<0?'Autoplay: steering left':held>0?'Autoplay: steering right':'Autoplay: holding the center';lastReport=time;}
    }catch{steer(0);auto.checked=false;status.textContent='Autoplay could not read this game-s canvas.';}
  }
  function planSlopeRoute(pixels,width,height,previous=0){
    const green=(x,y)=>{const i=(Math.floor(y)*width+Math.floor(x))*4;return pixels[i+1]>65&&pixels[i+1]>pixels[i]*1.65&&pixels[i+1]>pixels[i+2]*1.5;};
    const red=(x,y)=>{const i=(Math.floor(y)*width+Math.floor(x))*4;return pixels[i]>100&&pixels[i]>pixels[i+1]*1.7&&pixels[i]>pixels[i+2]*1.7;};
    let visible=0;for(let y=Math.floor(height*.44);y<height*.68;y+=2)for(let x=Math.floor(width*.2);x<width*.8;x+=2)if(green(x,y)||red(x,y))visible++;
    if(visible<25)return null;
    // Sample wireframe hazards without bridging the safe opening between walls.
    const rows=[];for(let y=Math.floor(height*.43);y<height*.64;y+=2){const spans=[];let start=-1,last=-1;for(let x=1;x<width-1;x++){if(red(x,y)){if(start<0)start=x;if(last>=0&&x-last>2){spans.push([start,last]);start=x;}last=x;}}if(start>=0)spans.push([start,last]);rows.push({y,spans});}
    const bars=[];for(let y=Math.floor(height*.46);y<height*.63;y++){let start=-1;for(let x=Math.floor(width*.12);x<width*.88;x++){const i=(y*width+x)*4;const lit=green(x,y)&&pixels[i+1]>90;if(lit&&start<0)start=x;if((!lit||x>=width*.88-1)&&start>=0){const length=x-start,mid=(x+start)/2;if(length>width*.045&&length<width*.6&&Math.abs(mid-width/2)<width*.28){bars.push({left:start,right:x,mid,y,weight:length*(y/height-.4)});}start=-1;}}}
    // Broad horizontal rungs belong to the running surface; thin distant city
    // outlines are not reliable support. Use the strongest nearby rung.
    const tunnel=rows.filter(row=>row.spans.some(([a,b])=>b<width*.4)&&row.spans.some(([a])=>a>width*.6)).length>4;
    const rung=tunnel?null:bars.sort((a,b)=>b.weight-a.weight)[0];
    let best=null;for(let lane=-.65;lane<=.651;lane+=.05){let cost=Math.abs(lane)*8+Math.abs(lane-previous)*.35,support=0;
      if(rung){const depth=(rung.y/height-.38)/.26,x=width*(.5+lane*depth*.42);cost+=Math.abs(x-rung.mid)/width*80;if(x<rung.left+3||x>rung.right-3)cost+=12;}
      for(const {y,spans}of rows){const depth=(y/height-.38)/.26,x=width*(.5+lane*depth*.42),radius=width*(.012+depth*.018);
        for(const [left,right]of spans){if(x+radius>=left&&x-radius<=right)cost+=2+depth*4;}
        let nearby=0;for(let dx=-radius;dx<=radius;dx+=2)if(green(Math.max(0,Math.min(width-1,x+dx)),y))nearby++;
        if(nearby)support+=Math.min(nearby,3)*(.3+depth);
      }
      cost-=support*.035;if(!best||cost<best.cost)best={target:lane,cost};
    }return best;
  }
  select.disabled=true;select.addEventListener('change',()=>{now();speed=Number(select.value);status.textContent='Game speed: '+speed+'x';});
  button.addEventListener('click',()=>{const module=window.gameInstance?.Module;if(!module)return;now();paused=!paused;if(paused)module.pauseMainLoop();else module.resumeMainLoop();button.textContent=paused?'Resume':'Pause';status.textContent=paused?'Paused.':'Ready.';});
  const timer=setInterval(()=>{const m=window.gameInstance?.Module;if(typeof m?.pauseMainLoop==='function'&&typeof m?.resumeMainLoop==='function'){select.disabled=false;button.disabled=false;status.textContent='Ready.';clearInterval(timer);}},300);
  const handle=root.querySelector('summary');let drag,moved=false;
  handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=host.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};moved=false;handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!moved&&Math.hypot(dx,dy)<5)return;moved=true;host.style.right='auto';host.style.left=Math.max(8,Math.min(innerWidth-host.offsetWidth-8,drag.left+dx))+'px';host.style.top=Math.max(8,Math.min(innerHeight-host.offsetHeight-8,drag.top+dy))+'px';});
  handle.addEventListener('pointerup',()=>drag=null);handle.addEventListener('pointercancel',()=>drag=null);
  handle.addEventListener('click',e=>{if(moved){e.preventDefault();moved=false;}});
  for(const event of ['pointerdown','pointerup','keydown','keyup','wheel'])host.addEventListener(event,e=>e.stopPropagation());
  addEventListener('pagehide',()=>{steer(0);clearInterval(timer);},{once:true});
})();
