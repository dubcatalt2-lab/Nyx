/* Local practice controls for the pinned Web Dashers runtime. */
(() => {
  'use strict';
  const options = {noclip:false, hitboxes:false, autoplay:false, coins:true, learn:true, speed:1};
  let activeScene, installed=false;
  const host=document.createElement('aside');
  host.style.cssText='position:fixed;right:12px;top:12px;z-index:2147483646;max-width:calc(100vw - 24px);color-scheme:dark';
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

  const panel=document.createElement('details');
  panel.style.cssText='width:245px;max-width:calc(100vw - 24px);box-sizing:border-box;background:rgba(16,18,24,.92);border:1px solid #ffffff30;border-radius:18px;padding:12px;color:#f0f1f5;font:13px system-ui;backdrop-filter:blur(18px);box-shadow:0 8px 30px #0005';
  const title=document.createElement('summary');title.textContent='Practice tools';title.style.cssText='cursor:pointer;font-weight:600;padding:3px';panel.append(title);
  const status=document.createElement('p');status.textContent='Waiting for game engine…';status.setAttribute('role','status');status.style.cssText='color:#bfc3ce;font-size:12px;line-height:1.4';panel.append(status);
  const controls=[];
  function toggle(label,key){
    const row=document.createElement('label');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0';
    const input=document.createElement('input');input.type='checkbox';input.checked=Boolean(options[key]);input.disabled=true;input.addEventListener('change',()=>{options[key]=input.checked;apply();});
    row.append(document.createTextNode(label),input);panel.append(row);controls.push(input);return input;
  }
  toggle('Noclip','noclip');toggle('Hitboxes','hitboxes');toggle('Autoplay (assisted)','autoplay');toggle('Collect coins','coins');toggle('Learn from retries','learn');
  const hint=document.createElement('p');hint.textContent='Predicts up to 100 blocks ahead and plans jump sequences with normal collisions. Replans at portals. Custom levels and dual routes may need manual input.';hint.style.cssText='font-size:11px;color:#aeb4c0;line-height:1.4';panel.append(hint);
  const speedLabel=document.createElement('label');speedLabel.textContent='Speed ';const speed=document.createElement('select');
  for(const value of [.25,.5,.75,1,1.5,2]){const item=document.createElement('option');item.value=value;item.textContent=value+'×';item.selected=value===1;speed.append(item);}
  speed.disabled=true;speed.setAttribute('aria-label','Speed');speed.addEventListener('change',()=>{options.speed=Number(speed.value);apply();});speedLabel.append(speed);panel.append(speedLabel);controls.push(speed);
  function button(label,action){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=true;button.style.cssText='border:1px solid #ffffff25;background:#ffffff10;color:inherit;border-radius:12px;padding:7px 9px;margin:8px 5px 0 0;font:inherit;cursor:pointer';button.addEventListener('click',()=>{if(activeScene)action(activeScene);});panel.append(button);controls.push(button);return button;}
  function practice(scene){if(!scene._practicedMode.practiceMode)scene._practiceKey.emit('down');return scene._practicedMode.practiceMode;}
  button('Set checkpoint',scene=>{if(playable(scene)&&practice(scene)){scene._practicedMode.saveCheckpoint(scene._state,scene._playerWorldX,scene._cameraX,scene);status.textContent='Checkpoint saved.';}});
  button('Restore',scene=>{if(playable(scene)&&scene._practicedMode.loadLastCheckpoint()){scene._respawnFromCheckpoint();status.textContent='Checkpoint restored.';}});
  button('Undo checkpoint',scene=>{scene._practicedMode.deleteLastCheckpoint();status.textContent='Last checkpoint removed.';});
  button('Exit practice',scene=>{if(playable(scene)&&scene._practicedMode.practiceMode)scene._practiceKey.emit('down');});
  root.append(panel);
  // Keep menu input out of the canvas, without interfering with normal game input.
  for(const name of ['pointerdown','pointerup','keydown','keyup','wheel'])host.addEventListener(name,event=>event.stopPropagation());
  (document.body||document.documentElement).append(host);
  const dragStyle=document.createElement('style');
  dragStyle.textContent='details{max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box}summary{cursor:grab;touch-action:none;user-select:none}summary:active{cursor:grabbing}';
  root.append(dragStyle);
  const handle=root.querySelector('summary');
  handle.title='Drag to move · click to expand or collapse';
  let drag=null,suppressClick=false;
  function placeMenu(left,top){
    const bounds=host.getBoundingClientRect();
    host.style.right='auto';
    host.style.left=Math.max(8,Math.min(left,innerWidth-bounds.width-8))+'px';
    host.style.top=Math.max(8,Math.min(top,innerHeight-bounds.height-8))+'px';
  }
  function containMenu(){const bounds=host.getBoundingClientRect();placeMenu(bounds.left,bounds.top);}
  handle.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    const bounds=host.getBoundingClientRect();
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:bounds.left,top:bounds.top,moved:false};
    suppressClick=false;handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<5)return;
    drag.moved=true;event.preventDefault();
    placeMenu(drag.left+dx,drag.top+dy);
  });
  handle.addEventListener('pointerup',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    suppressClick=drag.moved;drag=null;
    if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
  });
  for(const event of ['pointercancel','lostpointercapture'])handle.addEventListener(event,()=>{drag=null;});
  handle.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;}},true);
  const menuObserver=new ResizeObserver(containMenu);menuObserver.observe(host);
  window.addEventListener('resize',containMenu);

  function playable(scene){return scene?._state&&!scene._menuActive&&!scene._paused&&!scene._slideIn&&!scene._levelWon&&!window.isEditor;}
  function apply(){window.noClip=options.noclip;window.showHitboxes=options.hitboxes;window.speedHack=options.speed;}
  const levelIndexes=new WeakMap();
  function levelObjects(level){
    const arrays=[...(Array.isArray(level.objects)?level.objects:[]),...(Array.isArray(level._collisionSections)?level._collisionSections.flat():[])];
    // Keep object references so moving objects and activation changes remain live.
    if(!arrays.length)return [];
    const cached=levelIndexes.get(level);
    if(cached&&cached.length===arrays.length)return cached.objects;
    const objects=[...new Set(arrays)].filter(o=>o&&Number.isFinite(o.x)&&Number.isFinite(o.y));
    levelIndexes.set(level,{length:arrays.length,objects,routes:new Map()});return objects;
  }
  function secretFlightTarget(level,player,x){
    const index=levelIndexes.get(level);if(!index||!player)return null;
    const coin=index.objects.filter(o=>o.type==='coin'&&o.x>x-30&&!player._isObjectActivated?.(o)).sort((a,b)=>a.x-b.x)[0];
    if(!coin)return null;
    const ceiling=level.getCeilingY();
    // Ordinary in-corridor coins use local steering. A distant ordinary coin
    // must not override obstacle avoidance as though it needed a hidden entrance.
    if(Number.isFinite(ceiling)&&coin.y<ceiling-30&&coin.y>(level.getFloorY?.()??0)+30&&!index.routes.has(coin))return null;
    const portals=index.objects.filter(o=>o.type==='portal_fly'&&o.x>coin.x-6000&&o.x<coin.x&&Math.abs(o.y-coin.y)<240);
    if(!portals.length)return null;
    let route=index.routes.get(coin);
    if(!route){
      const step=30,dy=15,start=coin.x-6000,cols=201,rows=Math.min(140,Math.ceil(Math.max(coin.y+150,900)/dy));
      const relevant=index.objects.filter(o=>['solid','hazard','slope'].includes(o.type)&&o.x>=start-100&&o.x<=coin.x+100);
      const costs=Array.from({length:cols},()=>new Float64Array(rows).fill(Infinity));
      const free=Array.from({length:cols},(_,col)=>{
        const px=start+col*step,near=relevant.filter(o=>Math.abs(px-o.x)<(o.w||30)/2+32);
        return Array.from({length:rows},(_,row)=>{const y=(row+1)*dy;return y>=30&&!near.some(o=>{const margin=o.type==='hazard'?31:10;return Math.abs(px-o.x)<(o.w||30)/2+margin&&Math.abs(y-o.y)<(o.h||30)/2+margin;});});
      });
      for(let r=0;r<rows;r++)if(free[cols-1][r]&&Math.abs((r+1)*dy-coin.y)<45)costs[cols-1][r]=Math.abs((r+1)*dy-coin.y);
      const mids=Array.from({length:cols-1},(_,col)=>{
        const mx=start+(col+.5)*step,near=relevant.filter(o=>Math.abs(mx-o.x)<(o.w||30)/2+32);
        return Array.from({length:rows*2},(_,r)=>!near.some(o=>{const margin=o.type==='hazard'?31:10;return Math.abs(mx-o.x)<(o.w||30)/2+margin&&Math.abs((r/2+1)*dy-o.y)<(o.h||30)/2+margin;}));
      });
      for(let col=cols-2;col>=0;col--)for(let r=0;r<rows;r++)if(free[col][r]){
        for(let nr=Math.max(0,r-2);nr<=Math.min(rows-1,r+2);nr++){
          if(!mids[col][r+nr])continue;
          costs[col][r]=Math.min(costs[col][r],costs[col+1][nr]+1+Math.abs(nr-r)*2);
        }
      }
      route={start,step,dy,rows,costs};index.routes.set(coin,route);
    }
    const col=Math.max(0,Math.min(route.costs.length-1,Math.floor((x-route.start)/route.step)+(ceiling>coin.y?9:6)));
    if(x<route.start-200)return null;
    let best=null,score=Infinity;
    for(let r=0;r<route.rows;r++){
      const y=(r+1)*route.dy,cost=route.costs[col][r]+Math.abs(y-player.p.y)*.8;
      if(cost<score){score=cost;best=y;}
    }
    const entrance=portals.find(o=>o.x>x-40&&o.x<x+650&&o.y>(ceiling??600)-60);
    if(entrance&&Number.isFinite(best))best=Math.max(best,entrance.y-60);
    if(Number.isFinite(best)&&(ceiling??600)>coin.y&&portals.some(o=>x>o.x-80&&x<o.x+250))best=Math.max(best,coin.y);
    return best;
  }
  const learning=new Map();
  function learningFor(scene){
    const key=String(window.levelID||window.currentlevel?.[2]||'default');
    if(!learning.has(key)){
      let failures=[];try{const data=JSON.parse(localStorage.getItem('nyx.gd.retry.'+key)||'[]');if(Array.isArray(data))failures=data.filter(f=>Number.isFinite(f.launch)&&Number.isFinite(f.death)).slice(-24);}catch{}
      learning.set(key,{key,failures,wasDead:false,lastLaunch:null});
      if(learning.size>12)learning.delete(learning.keys().next().value);
    }
    return learning.get(key);
  }
  function observeAttempt(scene,pressed){
    const memory=learningFor(scene),state=scene._state;if(!state)return;
    if(state.isDead&&!memory.wasDead&&options.autoplay&&options.learn&&!options.noclip){
      const death=scene._playerWorldX,launch=Number.isFinite(memory.lastLaunch)&&Math.abs(death-memory.lastLaunch)<700?memory.lastLaunch:death-120;
      if(Number.isFinite(launch)&&Math.abs(death-launch)<700){
        memory.failures.push({launch,death,y:state.y,flying:Boolean(state.isFlying||state.isWave),missed:!Number.isFinite(memory.lastLaunch)||Math.abs(death-memory.lastLaunch)>=700});memory.failures=memory.failures.slice(-24);
        try{localStorage.setItem('nyx.gd.retry.'+memory.key,JSON.stringify(memory.failures));}catch{}
        status.textContent='Adjusted timing from '+memory.failures.length+' failed approach'+(memory.failures.length===1?'':'es')+'.';
      }
      memory.lastLaunch=null;
    }
    if(pressed&&!scene._spaceWasDown&&!state.isDead)memory.lastLaunch=scene._playerWorldX;
    memory.wasDead=Boolean(state.isDead);
  }
  function steer(scene){
    const p=scene._state,level=scene._level,x=scene._playerWorldX;
    const floor=level.getFloorY(),ceiling=level.getCeilingY();
    const speed=typeof playerSpeed==='number'?Math.abs(playerSpeed):11.54;
    const direction=p.mirrored?-1:1, gravity=p.gravityFlipped?-1:1;
    const size=p.isMini?18:30;
    // Work in gravity-relative coordinates so the same landing logic handles inverted cube sections.
    const lookahead=100*60;
    const full=levelObjects(level);
    const objects=[...new Set([...full.filter(o=>Math.abs(o.x-x)<=lookahead+100),...Array.from({length:31},(_,i)=>[...(level.getNearbySectionObjects(x+i*200*direction)||[])]).flat()])]
      .filter(o=>!o.disabled&&!o.noTouch&&(['hazard','solid','slope','jump_ring','jump_pad','speed','coin'].includes(o.type)||o.type.startsWith('portal_')))
      .map(o=>{const angle=(o.rotationDegrees||0)*Math.PI/180;
        const w=Math.abs((o.w||30)*Math.cos(angle))+Math.abs((o.h||30)*Math.sin(angle));
        const h=Math.abs((o.h||30)*Math.cos(angle))+Math.abs((o.w||30)*Math.sin(angle));
        return {type:o.type,active:scene._player?._isObjectActivated?.(o)||false,x:(o.x-x)*direction,y:o.y*gravity,w,h,orbId:o.orbId,padId:o.padId,radius:o.hitbox_radius||0};})
      .filter(o=>o.x+o.w/2>-40&&o.x-o.w/2<lookahead);
    const learned=options.learn?learningFor(scene).failures:[];
    const dangerMargin=learned.some(f=>Math.abs(f.death-x)<240)?4:1;
    const threats=objects.filter(o=>['hazard','solid','slope'].includes(o.type));
    if(p.isDashing){
      // Keep the native jump input held throughout a dash; release before a blocked route.
      const blocked=threats.some(o=>o.x>-size&&o.x<speed*6+o.w/2&&Math.abs(o.y-(p.y+(p.dashYVelocity||0)*Math.max(0,o.x)/speed)*gravity)<o.h/2+size+dangerMargin);
      return !blocked;
    }
    // Orbs consume one input edge in every mode, including ship and UFO.
    // Release the previous edge before chaining another native orb activation.
    const orb=objects.find(o=>o.type==='jump_ring'&&!o.active&&
      Math.abs(o.x)<Math.min(30,o.w/2+size-4)&&Math.abs(o.y-p.y*gravity)<o.h/2+size-4);
    const cube=!(p.isFlying||p.isShip||p.isWave||p.isUfo||p.isBird||p.isDart||p.isSwing||p.isJetpack||p.isBall||p.isSpider||p.isRobot);
    if(orb&&(!cube||![36,141,1333,1330,84,1022,1594].includes(orb.orbId)))return !(p.upKeyDown||p.wasUpKeyDown||p._orbActivationConsumedForPress||scene._spaceWasDown);
    if(p.isFlying||p.isShip||p.isWave||p.isUfo||p.isBird||p.isDart||p.isSwing||p.isJetpack){
      const top=Number.isFinite(ceiling)&&ceiling>floor+90?ceiling:floor+600;
      let target=(floor+top)/2;
      const secret=options.coins&&direction===1?secretFlightTarget(level,scene._player,x):null;
      if(Number.isFinite(secret))target=Math.max(floor+size+8,Math.min(top-size-8,secret));
      const coin=options.coins?objects.filter(o=>o.type==='coin'&&!o.active&&o.x>-size&&o.x<420).sort((a,b)=>a.x-b.x)[0]:null;
      if(coin&&!Number.isFinite(secret))target=Math.max(floor+size+8,Math.min(top-size-8,coin.y*gravity));
      const near=threats.filter(o=>o.x>-size&&o.x<speed*(Number.isFinite(secret)?(top>700?30:12):36)+o.w/2);
      const safe=[];for(let y=floor+size+8;y<top-size-8;y+=5){if(!learned.some(f=>f.flying&&Number.isFinite(f.y)&&Math.abs(f.death-x)<160&&Math.abs(y-f.y)<20)&&!near.some(o=>Math.abs(y-o.y*gravity)<o.h/2+(Number.isFinite(secret)&&o.type==='solid'?10:size)+dangerMargin))safe.push(y);}
      if(safe.length&&!Number.isFinite(secret))target=safe.reduce((a,b)=>Math.abs(a-target)<Math.abs(b-target)?a:b);
      if(Number.isFinite(secret)&&top>700){
        const blocking=threats.filter(o=>o.x>30&&o.x<360&&Math.abs(target-o.y*gravity)<o.h/2+(o.type==='hazard'?32:14)).sort((a,b)=>a.x-b.x)[0];
        if(blocking){
          const column=threats.filter(o=>Math.abs(o.x-blocking.x)<o.w/2+32),heights=[];
          for(let y=floor+38;y<top-38;y+=5)if(!column.some(o=>Math.abs(y-o.y*gravity)<o.h/2+(o.type==='hazard'?32:14)))heights.push(y);
          if(heights.length)target=heights.reduce((a,b)=>Math.abs(a-target)<Math.abs(b-target)?a:b);
        }
      }
      if(Number.isFinite(secret))for(const o of threats){
        if(!['solid','hazard'].includes(o.type)||(o.x< -o.w/2-(o.type==='hazard'?32:14)||o.x>o.w/2+(o.type==='hazard'?100:14)))continue;
        const low=o.y*gravity-o.h/2,high=o.y*gravity+o.h/2;
        const margin=o.type==='hazard'?38:14;
        if(p.y<low)target=Math.min(target,low-margin);else if(p.y>high)target=Math.max(target,high+margin);
      }
      // A boundary portal can touch the flight ceiling. Keep native thrust held
      // into its trigger instead of braking below the boundary before activation.
      if(Number.isFinite(secret)&&objects.some(o=>o.type==='portal_fly'&&!o.active&&o.x>-100&&o.x<220&&o.y*gravity>=top-60))target=top+size;
      // Brake for upcoming geometry using the pinned engine's ship acceleration,
      // rather than waiting until a wall enters the immediate steering column.
      if(!Number.isFinite(secret)&&(p.isFlying||p.isShip||p.isWave||p.isDart)&&threats.some(o=>o.x>0&&o.x<800)&&target<=top){
        const mini=p.isMini?1.176470588:1;
        const hitSize=(p.isWave||p.isDart)?(p.isMini?6:9):size;
        const flightBuckets=Array.from({length:70},(_,i)=>threats.filter(o=>Math.abs(o.x-(i+.5)*speed*.9)<o.w/2+size+speed));
        let flights=[{y:p.y,v:p.yVelocity||0,first:false,cost:0}];
        for(let frame=0;frame<70;frame++){
          const next=[];
          for(const path of flights)for(const press of [false,true]){
            const n={...path,first:frame?path.first:press};let dead=false;
            for(let sub=0;sub<2;sub++){
              if(p.isWave||p.isDart){
                n.v=(press?1:-1)*gravity*(p.isMini?22.7700072:11.3850036)*(speed/11.540004);
              }else{
                const falling=n.v*gravity < -1.916398;
                n.v+=1.916398*.45*gravity*(press?(falling?.5:.4):-(falling?.8:1.2)*.4)*mini;
                n.v=Math.max((gravity===1?-12.8:-16)*mini,Math.min((gravity===1?16:12.8)*mini,n.v));
              }
              n.y+=n.v*.45;
              if(n.y<floor+size){n.y=floor+size;n.v=0;}if(n.y>top-size){n.y=top-size;n.v=0;}
              const px=(frame+sub/2)*speed*.9;
              if(flightBuckets[frame].some(o=>o.radius?Math.hypot(px-o.x,n.y-o.y*gravity)<o.radius+hitSize+2:Math.abs(px-o.x)<o.w/2+hitSize+2&&Math.abs(n.y-o.y*gravity)<o.h/2+hitSize+2)){dead=true;break;}
            }
            n.cost+=Math.abs(n.y-target)*.01;
            if(!dead)next.push(n);
          }
          if(!next.length)break;
          next.sort((a,b)=>(a.cost+Math.abs(a.y-target))-(b.cost+Math.abs(b.y-target)));
          const seen=new Set();flights=[];
          for(const n of next){const key=[Math.round(n.y/6),Math.round(n.v/.5),n.first].join(':');if(seen.has(key))continue;seen.add(key);flights.push(n);if(flights.length===96)break;}
        }
        flights.sort((a,b)=>(a.cost+Math.abs(a.y-target))-(b.cost+Math.abs(b.y-target)));
        if(flights.length)return flights[0].first;
      }
      const rise=p.y+(p.yVelocity||0)*5<target;
      const hold=p.gravityFlipped?!rise:rise;
      return (p.isUfo||p.isSwing)?hold&&!scene._spaceWasDown:hold;
    }
    if(p.isBall||p.isSpider)return objects.some(o=>o.type==='hazard'&&o.x>0&&o.x<speed*6&&Math.abs(o.y-p.y*gravity)<55)&&!scene._spaceWasDown;
    if(!(p.onGround||p.onCeiling||p.canJump)&&(!cube||!orb))return p.isRobot&&p.isJumping;
    const base=gravity===1?floor:(Number.isFinite(ceiling)?-ceiling:-100000);
    // Stop an individual forecast only when its trajectory actually touches a
    // transition. Passing its X coordinate above/below it does not change modes.
    const transitions=objects.filter(o=>!o.active&&((o.type.startsWith('portal_')&&!o.type.startsWith('portal_gravity_'))||o.type==='speed'||(o.type==='jump_pad'&&![35,140,1332,67].includes(o.padId))));
    const acceleration=1.916398*(p.isMini?.975:1),dt=.225;
    const steps=Math.min(800,Math.max(1,Math.ceil(lookahead/(speed*.9))));
    const gravityPortals=objects.filter(o=>o.type.startsWith('portal_gravity_')&&!o.active).slice(0,30).map((o,i)=>({...o,bit:1<<i}));
    const rings=objects.filter(o=>o.type==='jump_ring'&&!o.active&&[36,141,1333,1330,84,1022,1594].includes(o.orbId)).slice(0,30).map((o,i)=>({...o,bit:1<<i}));
    const pads=objects.filter(o=>o.type==='jump_pad'&&!o.active&&[35,140,1332,67].includes(o.padId)).slice(0,30).map((o,i)=>({...o,bit:1<<i}));
    const coins=options.coins?objects.filter(o=>o.type==='coin'&&!o.active).slice(0,24).map((o,i)=>({...o,bit:1<<i})):[];
    const buckets=Array.from({length:steps},(_,i)=>objects.filter(o=>['solid','hazard','slope'].includes(o.type)&&Math.abs(o.x-(i+.5)*speed*.9)<o.w/2+size+speed));
    let paths=[{y:p.y*gravity,v:(p.yVelocity||0)*gravity,ground:Boolean(p.onGround||p.onCeiling||p.canJump),held:Boolean(p.upKeyDown||p.wasUpKeyDown||p._orbActivationConsumedForPress||scene._spaceWasDown),jumps:0,first:false,margin:40,coins:0,mask:0,rings:0,pads:0,portals:0,sign:1,risk:0}];
    const rank=n=>n.jumps*30+n.risk-n.coins*10000-Math.min(30,n.margin);
    for(let frame=0;frame<steps;frame++){
      const next=[];
      for(const path of paths)for(const jump of (path.ground||(!path.held&&rings.some(o=>!(path.rings&o.bit)&&Math.abs(frame*speed*.9-o.x)<Math.min(30,o.w/2+size-4)&&Math.abs(path.y-o.y)<o.h/2+size-4)))?[false,true]:[false]){
        if(path.done){if(!jump)next.push(path);continue;}
        const n={...path,held:jump};if(frame===0)n.first=jump;
        if(!jump&&path.ground&&threats.some(o=>o.type==='hazard'&&Math.abs(o.x-frame*speed*.9)<180))n.risk+=Math.min(3,learned.filter(f=>f.missed&&Math.abs(f.death-(x+frame*speed*.9*direction))<140).length)*180;
        if(jump){if(path.ground){n.v=22.360064*(p.isMini?.8:1)*n.sign;n.ground=false;}n.jumps++;n.risk+=learned.filter(f=>!f.missed&&Math.abs(f.launch-(x+frame*speed*.9*direction))<28).length*600;}
        let dead=false,orbConsumed=false;
        for(let sub=0;sub<4&&!dead;sub++){
          const old=n.y,px=(frame*4+sub)*speed*dt;
          if(!n.ground&&!(jump&&sub===0))n.v=Math.max(-30,n.v*n.sign-acceleration*dt)*n.sign;
          n.y+=n.v*dt;let surface=n.sign===1?base:(gravity===1?-(Number.isFinite(ceiling)?ceiling:100000):floor);
          for(const o of buckets[frame]){
            const dx=Math.abs(px-o.x),top=o.y*n.sign+o.h/2;
            if(o.type==='solid'||o.type==='slope'){
              if(dx<o.w/2+size-5&&old*n.sign>=top+size-2&&n.y*n.sign<=top+size&&n.v*n.sign<=0)surface=Math.max(surface,top);
              if(dx<o.w/2+10&&n.y*n.sign+10>o.y*n.sign-o.h/2&&n.y*n.sign-10<top&&old*n.sign<top+size-2){dead=true;break;}
            }else{
              const gap=o.radius?Math.hypot(px-o.x,n.y-o.y)-o.radius-size-dangerMargin:Math.abs(n.y-o.y)-o.h/2-size-dangerMargin;
              if(o.radius||dx<o.w/2+size+dangerMargin){n.margin=Math.min(n.margin,gap);if(gap<0){dead=true;break;}}
            }
          }
          if(n.y*n.sign<=surface+size&&n.v*n.sign<=0){n.y=(surface+size)*n.sign;n.v=0;n.ground=true;}else n.ground=false;
          for(const pad of pads)if(!(n.pads&pad.bit)&&Math.abs(px-pad.x)<pad.w/2+size&&Math.abs(n.y-pad.y)<pad.h/2+size){
            n.pads|=pad.bit;n.ground=false;n.v=(pad.padId===140?20.8:pad.padId===1332?40:pad.padId===67?30:32)*(p.isMini?.8:1)*n.sign;
            if(pad.padId===67){n.sign*=-1;n.v*=.5;}
          }
          for(const ring of rings)if(jump&&!path.held&&!orbConsumed&&!(n.rings&ring.bit)&&Math.abs(px-ring.x)<Math.min(30,ring.w/2+size-4)&&Math.abs(n.y-ring.y)<ring.h/2+size-4){
            orbConsumed=true;n.rings|=ring.bit;n.ground=false;
            if(ring.orbId===1594){n.sign*=-1;n.v*=.5;}
            else{
              if(ring.orbId===1022)n.sign*=-1;
              n.v=(ring.orbId===1330?-18:22.360064*(p.isMini?.8:1)*(ring.orbId===141?.72:ring.orbId===1333?1.38:1))*n.sign;
              if(ring.orbId===84){n.sign*=-1;n.v*=.5;}
            }
          }
          for(const coin of coins)if(!(n.mask&coin.bit)&&Math.abs(px-coin.x)<coin.w/2+size-2&&Math.abs(n.y-coin.y)<coin.h/2+size-2){n.mask|=coin.bit;n.coins++;}
          for(const portal of gravityPortals)if(!(n.portals&portal.bit)&&Math.abs(px-portal.x)<portal.w/2+size&&Math.abs(n.y-portal.y)<portal.h/2+size){
            n.portals|=portal.bit;const sign=portal.type==='portal_gravity_up'?-gravity:portal.type==='portal_gravity_down'?gravity:-n.sign;
            if(sign!==n.sign){n.sign=sign;n.v*=.5;n.ground=false;}
          }
          if(transitions.some(o=>Math.abs(px-o.x)<o.w/2+size&&Math.abs(n.y-o.y)<o.h/2+size)){n.done=true;break;}
        }
        if(!dead)next.push(n);
      }
      if(!next.length)break;
      // Deduplicate equivalent futures, keeping distinct launch times and both first inputs.
      next.sort((a,b)=>rank(a)-rank(b));const seen=new Set();paths=[];
      for(const n of next){const key=[Math.round(n.y/3),Math.round(n.v),n.ground,n.first,n.mask,n.rings,n.pads,n.portals,n.sign,n.held,n.done].join(':');if(seen.has(key))continue;seen.add(key);paths.push(n);if(paths.length===16)break;}
      if(paths.every(n=>n.done))break;
    }
    paths.sort((a,b)=>rank(a)-rank(b));
    return paths[0]?.first||false;

  }
  let timer;
  function install(){
    if(installed)return;
    if(typeof GameScene==='undefined'||typeof GameScene.prototype.update!=='function')return;
    installed=true;clearInterval(timer);
    const original=GameScene.prototype.update;
    GameScene.prototype.update=function(time,delta){
      activeScene=this;
      apply();
      let key,held;
      if(options.autoplay&&playable(this)&&!this._state.isDead){key=this._spaceKey;held=key.isDown;key.isDown=steer(this);}
      observeAttempt(this,key?.isDown);
      try{return original.call(this,time,delta);}finally{if(key)key.isDown=held;}
    };
    controls.forEach(control=>control.disabled=false);
    status.textContent='Select a level. Checkpoints use the game’s practice mode.';
  }
  install();
  if(!installed)timer=setInterval(install,250);
  window.addEventListener('pagehide',()=>{clearInterval(timer);},{once:true});
  setTimeout(()=>{if(!installed)status.textContent='Waiting for the supported game engine. Reload if loading has stopped.';},20000);
})();
