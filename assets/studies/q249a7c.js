/* Local single-player credit control, using the runtime's own variable map. */
(() => {
  'use strict';
  if (window.__q249a7c) return;
  window.__q249a7c = true;
  const label = text => text.replace(/[A-Za-z]/g, c => String.fromCodePoint((c <= 'Z' ? 0x1d5a0 : 0x1d5ba) + c.toLowerCase().charCodeAt(0) - 97));
  let enabled = false, targets = [], lastScan = 0, host, status, timer;
  function values(object) {
    try { return Object.values(Object.getOwnPropertyDescriptors(object)).filter(d => 'value' in d).map(d => d.value); } catch { return []; }
  }
  function discover() {
    const globals = values(window);
    const map = globals.find(value => value && typeof value === 'object' && typeof value.coach_credit === 'string');
    const field = map?.coach_credit || 'coach_credit';
    const queue = globals.filter(value => value && typeof value === 'object' && !(value instanceof Node) && value !== window && !ArrayBuffer.isView(value));
    const seen = new WeakSet(), found = [];
    for (let i = 0; i < queue.length && i < 12000; i++) {
      const value = queue[i];
      if (!value || typeof value !== 'object' || seen.has(value) || value instanceof Node || value instanceof Window || ArrayBuffer.isView(value)) continue;
      seen.add(value);
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      if (descriptor?.writable && Number.isFinite(descriptor.value)) found.push({value, field});
      if (queue.length < 12000) for (const child of values(value)) if (child && typeof child === 'object') queue.push(child);
    }
    targets = found;
  }
  function mount() {
    host = document.createElement('aside');
    host.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483646;color-scheme:dark;max-width:calc(100vw - 24px)';
    const root = host.attachShadow({mode:'open'});
    root.innerHTML = '<style>details{width:245px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:14px;border:1px solid #ffffff30;border-radius:18px;background:#111318ed;color:#eee;font:13px system-ui}summary{cursor:grab;touch-action:none;user-select:none;font-weight:600}label{display:flex;justify-content:space-between;gap:12px;margin:18px 0}p{line-height:1.5;color:#bbc0c9}</style><details><summary></summary><label><span></span><input type="checkbox" aria-label="Infinite credits"></label><p role="status"></p></details>';
    const summary = root.querySelector('summary'); summary.textContent = label('_@$)%(249'); summary.setAttribute('aria-label','_@$)%(249');
    root.querySelector('span').textContent = label('Infinite credits');
    status = root.querySelector('p');
    root.querySelector('input').addEventListener('change', event => { enabled = event.target.checked; tick(); });
    for (const name of ['pointerdown','pointerup','keydown','keyup','wheel']) host.addEventListener(name,event=>event.stopPropagation());
    let drag, moved = false;
    summary.addEventListener('pointerdown', event => { if(event.button!==0)return;const b=host.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:b.left,top:b.top};moved=false;summary.setPointerCapture(event.pointerId); });
    summary.addEventListener('pointermove', event => { if(!drag||drag.id!==event.pointerId)return;const x=event.clientX-drag.x,y=event.clientY-drag.y;if(Math.hypot(x,y)<5&&!moved)return;moved=true;host.style.right='auto';host.style.left=Math.max(8,Math.min(innerWidth-host.offsetWidth-8,drag.left+x))+'px';host.style.top=Math.max(8,Math.min(innerHeight-host.offsetHeight-8,drag.top+y))+'px'; });
    summary.addEventListener('pointerup',()=>{drag=null;});
    summary.addEventListener('pointercancel',()=>{drag=null;});
    summary.addEventListener('click',event=>{if(moved){event.preventDefault();moved=false;}});
    (document.body || document.documentElement).append(host);
  }
  function tick() {
    if (Date.now()-lastScan>3000) { lastScan=Date.now();discover(); }
    if (!targets.length) { if(status)status.textContent=label('Start a career to connect credits.'); return; }
    if (!host) mount();
    if (enabled) for (const {value,field} of targets) if (Number.isFinite(value[field])) value[field]=999999;
    status.textContent=label(enabled?'Credits refill while enabled. The study saves normally.':'Enable to keep coaching credits at 999999.');
  }
  timer=setInterval(tick,250);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();
