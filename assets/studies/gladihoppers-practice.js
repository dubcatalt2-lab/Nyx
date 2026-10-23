/* Single-player tools for the pinned Gladihoppers IL2CPP build. */
(() => {
  'use strict';
  const settings={health:false,damage:1,speed:1,attack:false,weakpoint:true,cooldown:false,regen:0,reach:1,gold:false,points:false};
  const host=document.createElement('aside');
  host.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483646;color-scheme:dark';
  const root=host.attachShadow({mode:'open'});
  // Presentation is confined to this owned menu; engine and save data stay unchanged.
  queueMicrotask(() => {
    const convert = text => text.replace(/\bgames\b/gi,'studies').replace(/\bgame\b/gi,'study').replace(/Practice tools/g,'Study tools').replace(/[A-Za-z]/g,c=>String.fromCodePoint((c<='Z'?0x1d5a0:0x1d5ba)+c.toLowerCase().charCodeAt(0)-97));
    const scan = () => {
      for(const el of root.querySelectorAll('button,summary,label,option')) {
        const plain=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
        if(plain && /[A-Za-z]/.test(plain)) el.setAttribute('aria-label',plain);
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

  root.innerHTML='<style>details{width:240px;max-width:80vw;padding:12px;border:1px solid #ffffff30;border-radius:18px;background:#101218ed;color:#eee;font:13px system-ui;backdrop-filter:blur(18px)}summary{cursor:pointer;font-weight:600}label{display:flex;justify-content:space-between;align-items:center;margin:14px 0;gap:10px}p{font-size:12px;color:#bbc1cc;line-height:1.4}select{border-radius:8px;padding:4px}</style><details><summary>Practice tools</summary><p role="status">Waiting for a single-player fighter...</p></details>';
  const panel=root.querySelector('details'),status=root.querySelector('p');
  function control(label,key,choices,suffix="\u00d7"){
    const row=document.createElement('label'),input=document.createElement(choices?'select':'input');
    if(choices)for(const value of choices){const option=document.createElement('option');option.value=value;option.textContent=value===0?'Off':value+suffix;input.append(option);}else {input.type='checkbox';input.checked=Boolean(settings[key]);}
    input.setAttribute('aria-label',label);
    input.addEventListener('change',()=>{settings[key]=choices?Number(input.value):input.checked;if(key==='attack'&&!settings.attack)release();if(key==='health')tick();if(key==='gold'||key==='points')careerTick();});
    row.append(document.createTextNode(label),input);panel.append(row);
  }
  control('Infinite health','health');control('Melee damage','damage',[1,2,5,10,100,250,500]);control('Movement speed','speed',[1,1.5,2,3,5,10,15,20,25]);control('Weapon reach','reach',[1,1.5,2,3,5,10]);control('Regeneration','regen',[0,1,2,5,10,25,50,100],'% HP/sec');control('No cooldown','cooldown');control('Timed sword attacks','attack');control('Aim for weaker armor','weakpoint');
  const note=document.createElement('p');note.textContent='Single-player only. Sword attacks wait for range and recovery. Weak-point aim favors exposed armor; critical hits are not guaranteed. Regeneration restores a percentage of maximum health each second. No cooldown removes recovery between completed swings.';panel.append(note);
  const careerTitle=document.createElement('p');careerTitle.textContent='Career upgrades';panel.append(careerTitle);
  control('Unlimited gold','gold');control('Unlimited skill points','points');
  const careerStatus=document.createElement('p');careerStatus.setAttribute('role','status');careerStatus.textContent='Career only. Gold and points refill while enabled. Skills cap at level 10.';
  for(const [label,index] of [['Upgrade Charisma',0],['Upgrade Willpower',1],['Upgrade Looting',2],['Max career skills',-1]]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.style.cssText='display:block;width:100%;margin:8px 0;padding:8px;border:1px solid #ffffff30;border-radius:9px;background:#ffffff0b;color:inherit;cursor:pointer';
    button.addEventListener('click',()=>upgradeCareer(index));panel.append(button);
  }
  panel.append(careerStatus);
  document.body.append(host);
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
  for(const event of ['pointerdown','pointerup','keydown','keyup'])host.addEventListener(event,e=>e.stopPropagation());
  let classes,actors=[],scanAt=0,held=null,heldAt=0,nextAttackAt=0,stopped=false;
  let swordMethods=null;
  const originals=new Map();
  const healthOriginals=new Map();
  const regeneration=new Map();
  const reachOriginals=new Map();
  let transformMethods=null;
  function scaleReach(m,a,factor){
    const tip=read(m,a.motor,'CharacterMotor','weaponTip');
    if(!tip||!m.HEAPU32[(tip+8)>>>2])return;
    if(!transformMethods){
      const klass=m.HEAPU32[tip>>>2],table=m.HEAPU32[(klass+76)>>>2],found={};
      if(!table||typeof m.dynCall_iii!=='function')return;
      for(let i=0;i<96;i++){
        const info=m.HEAPU32[(table+i*4)>>>2];if(!info||m.HEAPU32[(info+12)>>>2]!==klass)break;
        const name=textAt(m,m.HEAPU32[(info+8)>>>2]);
        if(['get_parent','get_localScale_Injected','set_localScale_Injected'].includes(name))found[name]={fn:m.HEAPU32[info>>>2],info};
      }
      if(Object.keys(found).length!==3)return;
      transformMethods=found;
    }
    const methods=transformMethods,parent=methods.get_parent;
    const tr=m.dynCall_iii(parent.fn,tip,parent.info);
    if(!tr||!m.HEAPU32[(tr+8)>>>2])return;
    let saved=reachOriginals.get(a.stats);
    if(saved&&(saved.master!==a.master||saved.tr!==tr)){reachOriginals.delete(a.stats);saved=null;}
    if(factor===1&&!saved)return;
    const stack=m.stackSave(),vector=m.stackAlloc(12);
    try{
      if(!saved){
        const get=methods.get_localScale_Injected;m.dynCall_viii(get.fn,tr,vector,get.info);
        saved={actor:a,master:a.master,tr,base:Array.from(m.HEAPF32.subarray(vector>>>2,(vector>>>2)+3))};
        if(!saved.base.every(Number.isFinite))return;
        reachOriginals.set(a.stats,saved);
      }
      // The tip lies on the weapon's local Y axis. Extend the actual weapon,
      // including its child tip/collider, rather than just the assist's distance.
      m.HEAPF32.set([saved.base[0],saved.base[1]*factor,saved.base[2]],vector>>>2);
      const set=methods.set_localScale_Injected;m.dynCall_viii(set.fn,tr,vector,set.info);
      scale(m,a,'motor','CharacterMotor','weaponRange',factor,true);
      if(factor===1)reachOriginals.delete(a.stats);
    }finally{m.stackRestore(stack);}
  }
  function recover(m,a,now){
    const off=classes.CharacterMotor.offsets;
    if(settings.cooldown&&m.HEAPU8[a.input+classes.BattleInput.offsets.actInput]===1&&!m.HEAPU8[a.motor+off.attacking]&&!m.HEAPU8[a.motor+off.prepping]&&!m.HEAPU8[a.motor+off.throwing]){
      m.HEAPF32[(a.motor+off.coolDownTimer)>>>2]=0;
      m.HEAPU8[a.motor+off.coolingDown]=0;
    }
    const previous=regeneration.get(a.stats);
    const saved=previous?.master===a.master?previous:{master:a.master,at:now,fraction:0};
    const elapsed=Math.max(0,Math.min(now-saved.at,250))/1000;saved.at=now;
    regeneration.set(a.stats,saved);
    const hp=(a.stats+classes.CharacterStats.offsets.health)>>>2,cap=(a.stats+classes.CharacterStats.offsets.maxHealth)>>>2;
    if(!settings.regen||settings.health||m.HEAP32[hp]<=0||m.HEAP32[hp]>=m.HEAP32[cap]){saved.fraction=0;return;}
    saved.fraction+=m.HEAP32[cap]*settings.regen/100*elapsed;
    const amount=Math.floor(saved.fraction);saved.fraction-=amount;
    m.HEAP32[hp]=Math.min(m.HEAP32[cap],m.HEAP32[hp]+amount);
  }
  // Refilling ordinary HP on a timer loses to lethal hits inside Unity's frame.
  // Keep a reserve between frames, well below signed-int overflow, and restore
  // the real cap when disabled. Never revive an already-dead ragdoll.
  const healthReserve=1000000;
  function protectHealth(m,a,enabled){
    const hp=(a.stats+classes.CharacterStats.offsets.health)>>>2;
    const cap=(a.stats+classes.CharacterStats.offsets.maxHealth)>>>2;
    const heap=m.HEAP32;
    let saved=healthOriginals.get(a.stats);
    if(saved&&(saved.master!==a.master||heap[cap]!==healthReserve)){
      healthOriginals.delete(a.stats);saved=null;
    }
    if(!enabled){
      if(saved){heap[cap]=saved.max;heap[hp]=Math.min(Math.max(heap[hp],0),saved.max);healthOriginals.delete(a.stats);}
      return;
    }
    if(m.HEAPU8[a.motor+classes.CharacterMotor.offsets.alive]!==1||heap[hp]<=0)return;
    if(!saved){
      if(heap[cap]<=0||heap[cap]>100000)return;
      healthOriginals.set(a.stats,{master:a.master,max:heap[cap],actor:a});
    }
    heap[cap]=healthReserve;heap[hp]=healthReserve;
  }
  function release(){
    if(!held)return;
    const pending=held;held=null;
    const m=window.unityGame?.Module;
    if(m&&valid(m,pending.actor))m.dynCall_vii(swordMethods.attack.fn,pending.actor.master,swordMethods.attack.info);
  }
  function resolveSword(m){
    const u=m.HEAPU32,klass=classes.CharacterMaster.klass,table=u[(klass+76)>>>2],found={};
    if(!table||table+240>=m.HEAPU8.length||typeof m.dynCall_viii!=='function'||typeof m.dynCall_vii!=='function')return null;
    for(let i=0;i<60;i++){
      const info=u[(table+i*4)>>>2];if(!info||info+44>=m.HEAPU8.length||u[(info+12)>>>2]!==klass)break;
      const name=textAt(m,u[(info+8)>>>2]),count=m.HEAPU8[info+42];
      if(name==='PrepareAction'&&count===1)found.prepare={info,fn:u[info>>>2]};
      if(name==='Attack'&&count===0)found.attack={info,fn:u[info>>>2]};
    }
    return found.prepare&&found.attack?found:null;
  }
  function textAt(m,p){if(!p||p>=m.HEAPU8.length)return '';let s='';for(let j=0;j<64&&m.HEAPU8[p+j];j++)s+=String.fromCharCode(m.HEAPU8[p+j]);return s;}
  function resolve(m){
    const u=m.HEAPU32,b=m.HEAPU8,result={};
    const required={CharacterStats:['cMaster','health','maxHealth','melee','headArmor','torsoArmor','legArmor'],CharacterMaster:['isMultiplayer','enemy','cStats','cMotor','battleInput'],BattleInput:['cMaster','isP1','actInput'],CharacterMotor:['cMaster','alive','maxVel','attacking','prepping','coolingDown','throwing','distToEnemy','weaponRange','weaponTip','dir','coolDownTimer']};
    for(let i=2;i<u.length-32;i++){
      const p=u[i];if(p>=b.length||(b[p]!==67&&b[p]!==66))continue;
      const name=textAt(m,p);if(!required[name]||result[name])continue;
      const klass=i*4-8,fields=u[(klass+64)>>>2],offsets={};
      if(!fields||fields>b.length-20)continue;
      for(let j=0;j<100;j++){const f=fields+j*20;if(f+20>b.length||u[(f+8)>>>2]!==klass)break;const offset=u[(f+12)>>>2];if(offset<4096)offsets[textAt(m,u[f>>>2])]=offset;}
      if(required[name].every(field=>Object.hasOwn(offsets,field)))result[name]={klass,offsets};
      if(Object.keys(result).length===4)return result;
    }
    return null;
  }
  function ref(m,address,type){return address>0&&address+4096<m.HEAPU8.length&&address%4===0&&m.HEAPU32[address>>>2]===classes[type].klass;}
  function read(m,address,type,field){return m.HEAPU32[(address+classes[type].offsets[field])>>>2];}
  function valid(m,a){
    if(!m.HEAPU32[(a.master+8)>>>2]||!m.HEAPU32[(a.motor+8)>>>2]||!m.HEAPU32[(a.input+8)>>>2])return false;
    if(!ref(m,a.stats,'CharacterStats')||!ref(m,a.master,'CharacterMaster')||!ref(m,a.input,'BattleInput')||!ref(m,a.motor,'CharacterMotor'))return false;
    return read(m,a.stats,'CharacterStats','cMaster')===a.master&&read(m,a.master,'CharacterMaster','cStats')===a.stats&&read(m,a.master,'CharacterMaster','battleInput')===a.input&&read(m,a.input,'BattleInput','cMaster')===a.master&&read(m,a.master,'CharacterMaster','cMotor')===a.motor&&read(m,a.motor,'CharacterMotor','cMaster')===a.master&&!m.HEAPU8[a.master+classes.CharacterMaster.offsets.isMultiplayer]&&m.HEAPU8[a.input+classes.BattleInput.offsets.isP1]===1;
  }
  function discover(m){
    const found=[],u=m.HEAPU32;
    for(let i=0;i<u.length;i++)if(u[i]===classes.CharacterStats.klass){
      const stats=i*4,master=read(m,stats,'CharacterStats','cMaster');if(!ref(m,master,'CharacterMaster'))continue;
      const a={stats,master,input:read(m,master,'CharacterMaster','battleInput'),motor:read(m,master,'CharacterMaster','cMotor')};if(valid(m,a))found.push(a);
    }
    return found;
  }
  function scale(m,a,key,type,field,factor,float){
    const address=a[key]+classes[type].offsets[field],heap=float?m.HEAPF32:m.HEAP32,index=address>>>2;
    let saved=originals.get(address);
    if(saved&&(saved.actor.stats!==a.stats||heap[index]!==saved.last)){originals.delete(address);saved=null;}
    if(factor===1){if(saved){heap[index]=saved.base;originals.delete(address);}return;}
    const base=saved?.base??heap[index];if(!Number.isFinite(base)||base<=0||base>10000)return;
    heap[index]=float?base*factor:Math.round(base*factor);
    originals.set(address,{actor:a,base,last:heap[index],float});
  }
  function restore(m){for(const saved of reachOriginals.values())if(valid(m,saved.actor))scaleReach(m,saved.actor,1);reachOriginals.clear();for(const saved of healthOriginals.values())if(valid(m,saved.actor))protectHealth(m,saved.actor,false);healthOriginals.clear();for(const [address,saved] of originals){const heap=saved.float?m.HEAPF32:m.HEAP32;if(valid(m,saved.actor)&&heap[address>>>2]===saved.last)heap[address>>>2]=saved.base;}originals.clear();}
  function sword(m,a,now){
    const flag=(ptr,type,field)=>m.HEAPU8[ptr+classes[type].offsets[field]]===1;
    if(!flag(a.input,'BattleInput','actInput')){release();return 'Waiting for combat controls.';}
    // Finish an accepted preparation even if the opponent moves during the swing.
    if(held){if(now-heldAt>=100||flag(a.motor,'CharacterMotor','attacking')||flag(a.motor,'CharacterMotor','coolingDown'))release();return 'Timing the sword swing.';}
    const enemy=read(m,a.master,'CharacterMaster','enemy');
    if(!ref(m,enemy,'CharacterMaster')||!m.HEAPU32[(enemy+8)>>>2]||flag(enemy,'CharacterMaster','isMultiplayer')){release();return 'Waiting for an opponent.';}
    const motor=read(m,enemy,'CharacterMaster','cMotor'),stats=read(m,enemy,'CharacterMaster','cStats');
    if(!ref(m,motor,'CharacterMotor')||!ref(m,stats,'CharacterStats')||read(m,motor,'CharacterMotor','cMaster')!==enemy||read(m,stats,'CharacterStats','cMaster')!==enemy||!flag(motor,'CharacterMotor','alive')){release();return 'Waiting for an opponent.';}
    const ownDistance=Math.abs(m.HEAPF32[(a.motor+classes.CharacterMotor.offsets.distToEnemy)>>>2]);
    const opponentDistance=Math.abs(m.HEAPF32[(motor+classes.CharacterMotor.offsets.distToEnemy)>>>2]);
    const distance=Math.max(ownDistance,opponentDistance);
    // Center separation includes the arm/body reach, not just the weapon length.
    const range=m.HEAPF32[(a.motor+classes.CharacterMotor.offsets.weaponRange)>>>2];
    if(!Number.isFinite(distance)||!Number.isFinite(range)||range<=0||distance>range+1.5){release();return 'Move into sword range.';}
    if(now<nextAttackAt||['attacking','prepping','coolingDown','throwing'].some(field=>flag(a.motor,'CharacterMotor',field)))return 'Waiting for sword recovery.';
    let code=m.HEAP32[(a.motor+classes.CharacterMotor.offsets.dir)>>>2]<0?'ArrowLeft':'ArrowRight';
    if(settings.weakpoint){
      const armor=field=>m.HEAP32[(stats+classes.CharacterStats.offsets[field])>>>2];
      const head=armor('headArmor'),torso=armor('torsoArmor'),legs=armor('legArmor');
      if(head>=0&&head<torso&&head<=legs)code='ArrowUp';
      else if(legs>=0&&legs<torso&&legs<head)code='ArrowDown';
    }
    swordMethods=swordMethods||resolveSword(m);
    if(!swordMethods)return 'Sword controls unavailable for this build.';
    const stack=m.stackSave(),vector=m.stackAlloc(8);
    try{
      m.HEAPF32[vector>>>2]=code==='ArrowLeft'?-1:code==='ArrowRight'?1:0;
      m.HEAPF32[(vector+4)>>>2]=code==='ArrowUp'?1:code==='ArrowDown'?-1:0;
      m.dynCall_viii(swordMethods.prepare.fn,a.master,vector,swordMethods.prepare.info);
    }finally{m.stackRestore(stack);}
    if(!flag(a.motor,'CharacterMotor','prepping'))return 'Waiting for sword recovery.';
    held={actor:a};heldAt=now;nextAttackAt=now+250;
    return settings.weakpoint?'Sword attack aimed at weaker armor.':'Sword attack timed to the opening.';
  }
  let careerMeta=null,careerRetryAt=0,careerHome=0;
  function resolveCareer(m){
    const required={GameMaster:['gold','gameMode','cSkill','cSkillPoints','cPlayerStats'],CMHome:['careerMenus'],CareerMenus:['cmHome','cGold'],Int32:['m_value']};
    const u=m.HEAPU32,b=m.HEAPU8,found={};
    for(let i=2;i<u.length-32;i++){
      const p=u[i];if(p>=b.length||(b[p]!==71&&b[p]!==67&&b[p]!==73))continue;
      const name=textAt(m,p);if(!required[name]||found[name])continue;
      const klass=i*4-8,fields=u[(klass+64)>>>2],offsets={},methods={};if(!fields||fields>b.length-20)continue;
      for(let j=0;j<100;j++){const f=fields+j*20;if(f+20>b.length||u[(f+8)>>>2]!==klass)break;const offset=u[(f+12)>>>2];if(offset<4096)offsets[textAt(m,u[f>>>2])]=offset;}
      if(!required[name].every(field=>Object.hasOwn(offsets,field)))continue;
      const table=u[(klass+76)>>>2];
      for(let j=0;table&&j<150;j++){const info=u[(table+j*4)>>>2];if(!info||info+44>=b.length||u[(info+12)>>>2]!==klass)break;const methodName=textAt(m,u[(info+8)>>>2]);if(methodName!=='ToString'||b[info+42]===0)methods[methodName]={fn:u[info>>>2],info,count:b[info+42]};}
      found[name]={klass,offsets,methods};if(Object.keys(found).length===4)return found;
    }
    return null;
  }
  function careerContext(){
    const m=window.unityGame?.Module;if(!m?.HEAPU32)return null;
    if(!careerMeta&&Date.now()>=careerRetryAt){careerRetryAt=Date.now()+3000;careerMeta=resolveCareer(m);}
    if(!careerMeta)return null;
    const g=careerMeta.GameMaster,u=m.HEAPU32,statics=u[(g.klass+92)>>>2],master=u[statics>>>2];
    if(!master||master+320>=m.HEAPU8.length||u[master>>>2]!==g.klass||!u[(master+8)>>>2]||m.HEAP32[(master+g.offsets.gameMode)>>>2]!==0)return null;
    const skills=u[(master+g.offsets.cSkill)>>>2];
    if(!skills||skills+28>=m.HEAPU8.length||u[(skills+12)>>>2]!==3)return null;
    return {m,g,master,skills};
  }
  function currentCareerHome(m){
    const u=m.HEAPU32,h=careerMeta.CMHome,c=careerMeta.CareerMenus;
    const validHome=p=>{
      if(!p||u[p>>>2]!==h.klass||!u[(p+8)>>>2])return false;
      const parent=u[(p+h.offsets.careerMenus)>>>2];
      return parent&&u[parent>>>2]===c.klass&&u[(parent+8)>>>2]&&u[(parent+c.offsets.cmHome)>>>2]===p;
    };
    if(validHome(careerHome))return careerHome;
    careerHome=0;for(let i=0;i<u.length;i++)if(u[i]===h.klass&&validHome(i*4)){careerHome=i*4;break;}
    return careerHome;
  }
  function callCareer(m,type,name,ptr,value){
    const method=careerMeta[type].methods[name];
    if(!method||method.count!==(value===undefined?0:1))return false;
    if(value===undefined)m.dynCall_vii(method.fn,ptr,method.info);else m.dynCall_viii(method.fn,ptr,value,method.info);
    return true;
  }
  function refreshCareerGold(m,home,master,g){
    const u=m.HEAPU32,parent=u[(home+careerMeta.CMHome.offsets.careerMenus)>>>2];
    const text=u[(parent+careerMeta.CareerMenus.offsets.cGold)>>>2];if(!text||!u[(text+8)>>>2])return;
    const klass=u[text>>>2],table=u[(klass+76)>>>2];let setter;
    for(let i=0;table&&i<64;i++){const info=u[(table+i*4)>>>2];if(!info||u[(info+12)>>>2]!==klass)break;if(textAt(m,u[(info+8)>>>2])==='set_text'&&m.HEAPU8[info+42]===1){setter={fn:u[info>>>2],info};break;}}
    const integer=careerMeta.Int32,toString=integer.methods.ToString;if(!setter||!toString)return;
    const stack=m.stackSave(),box=m.stackAlloc(16);
    try{u[box>>>2]=integer.klass;u[(box+4)>>>2]=0;m.HEAP32[(box+integer.offsets.m_value)>>>2]=m.HEAP32[(master+g.offsets.gold)>>>2];
      const value=m.dynCall_iii(toString.fn,box,toString.info);m.dynCall_viii(setter.fn,text,value,setter.info);
    }finally{m.stackRestore(stack);}
  }
  function careerTick(){
    if(!settings.gold&&!settings.points)return;
    const context=careerContext();if(!context){careerStatus.textContent='Open single-player Career to use gold and skill points.';return;}
    const {m,g,master}=context;
    let changed=false;
    for(const [setting,field,amount,saveMethod] of [['gold','gold',1000000,'SaveGold'],['points','cSkillPoints',9999,'SaveCurrentCareer']]){
      if(!settings[setting])continue;
      if(setting==='points'&&!m.HEAPU32[(master+g.offsets.cPlayerStats)>>>2])continue;
      const address=(master+g.offsets[field])>>>2;
      if(m.HEAP32[address]<amount){m.HEAP32[address]=amount;callCareer(m,'GameMaster',saveMethod,master);changed=true;}
    }
    if(changed){const home=currentCareerHome(m);if(home){callCareer(m,'CMHome','UpdateSkillButtons',home);refreshCareerGold(m,home,master,g);}}
    careerStatus.textContent='Career resources ready. Gold refills to 1,000,000; skill points to 9,999 when enabled.';
  }
  function upgradeCareer(index){
    const context=careerContext();if(!context){careerStatus.textContent='Open your Career character first.';return;}
    const {m,g,master,skills}=context,home=currentCareerHome(m);
    if(!home||!m.HEAPU32[(master+g.offsets.cPlayerStats)>>>2]){careerStatus.textContent='Open the Career character skills page first.';return;}
    const indexes=index<0?[0,1,2]:[index];
    for(const i of indexes){
      const address=((skills+16)>>>2)+i,level=m.HEAP32[address];
      if(level<0||level>10){careerStatus.textContent='Unsupported career skill value.';return;}
      const steps=index<0?10-level:Math.min(1,10-level);
      for(let n=0;n<steps;n++){
        const points=(master+g.offsets.cSkillPoints)>>>2;
        if(m.HEAP32[points]<1)m.HEAP32[points]=1;
        if(!callCareer(m,'CMHome','SkillUpgrade',home,i)){careerStatus.textContent='Upgrade controls unavailable for this build.';return;}
      }
    }
    callCareer(m,'GameMaster','SaveCurrentCareer',master);
    careerTick();callCareer(m,'CMHome','UpdateSkillButtons',home);
    careerStatus.textContent='Career skills upgraded and saved. Maximum level: 10.';
  }
  function tick(){
    if(stopped)return;
    careerTick();
    const m=window.unityGame?.Module;if(!m?.HEAPU32)return;
    const now=Date.now();
    if(now>=scanAt){scanAt=now+3000;classes=classes||resolve(m);if(classes)actors=discover(m);}
    if(!classes)return;
    for(const a of actors)if(valid(m,a))protectHealth(m,a,settings.health);
    const live=actors.filter(a=>valid(m,a)&&m.HEAPU8[a.motor+classes.CharacterMotor.offsets.alive]===1);
    status.textContent=live.length?'Single-player fighter connected.':'Start a single-player fight to use these controls.';
    for(const a of live){
      if(document.hasFocus()&&!document.hidden)recover(m,a,now);
      scaleReach(m,a,settings.reach);
      scale(m,a,'stats','CharacterStats','melee',settings.damage,false);
      scale(m,a,'motor','CharacterMotor','maxVel',settings.speed,true);
    }
    if(settings.attack&&live.length&&document.hasFocus()&&!document.hidden)status.textContent=sword(m,live[0],now);else release();
  }
  const timer=setInterval(tick,100);
  // Combat timing runs at display cadence rather than missing short windows
  // between the slower health/stat updates.
  let attackFrame=0;
  function combatFrame(){
    if(stopped)return;
    const m=window.unityGame?.Module;
    const a=classes&&m&&actors.find(a=>valid(m,a)&&m.HEAPU8[a.motor+classes.CharacterMotor.offsets.alive]===1);
    if(a&&document.hasFocus()&&!document.hidden)recover(m,a,Date.now());
    if(settings.attack&&a&&document.hasFocus()&&!document.hidden)status.textContent=sword(m,a,Date.now());
    else release();
    attackFrame=requestAnimationFrame(combatFrame);
  }
  attackFrame=requestAnimationFrame(combatFrame);
  window.addEventListener('blur',release);document.addEventListener('visibilitychange',release);
  window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);cancelAnimationFrame(attackFrame);release();const m=window.unityGame?.Module;if(m&&classes)restore(m);},{once:true});
})();
