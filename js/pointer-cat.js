                                                                                   
(() => {
  if (window !== window.top || document.getElementById('q42030cc527a43c03d8')) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(any-pointer: fine)');
  const cat = document.createElement('img');
  cat.id = 'q42030cc527a43c03d8';
  cat.alt = '';
  cat.setAttribute('aria-hidden', 'true');
  cat.setAttribute('data-n7x-owned-overlay', '');
  cat.draggable = false;
  cat.style.cssText = 'position:fixed;left:0;top:0;width:32px;height:32px;pointer-events:none;user-select:none;image-rendering:pixelated;z-index:2147483000;';
  cat.hidden = true;
  let x = 48, y = 120, targetX = x, targetY = y, tick = 0, idle = 0, timer = 0, loaded = false, lastFrame = 0;
  const frames = [];
  function draw(frame) {
    if (frame !== lastFrame) { cat.src = frames[frame].src; lastFrame = frame; }
    cat.style.transform = `translate(${Math.round(x - 16)}px,${Math.round(y - 16)}px)`;
  }
  function enabled() { try { return localStorage.getItem('n7x.pointerCat') !== 'false'; } catch { return true; } }
  function allowed() { return enabled() && loaded && !document.hidden && pointer.matches && !motion.matches; }
  function step() {
    timer = 0;
    if (!allowed()) return;
                                                             
    cat.hidden = document.body.classList.contains('n7x-loading-active') || document.body.classList.contains('n7x-startup-prep') || !!document.fullscreenElement;
    if (!cat.hidden) {
      const maxX = Math.max(16, innerWidth - 16), maxY = Math.max(16, innerHeight - 16);
      targetX = Math.max(16, Math.min(maxX, targetX)); targetY = Math.max(16, Math.min(maxY, targetY));
      x = Math.max(16, Math.min(maxX, x)); y = Math.max(16, Math.min(maxY, y));
      const dx = targetX - x, dy = targetY - y, distance = Math.hypot(dx, dy);
      tick++;
      if (distance > 20) {
        if (idle > 30) { idle = 0; draw(32); }
        else {
          idle = 0;
          const speed = Math.min(12, distance - 18);
          x += dx / distance * speed; y += dy / distance * speed;
          const direction = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
          draw([5, 7, 9, 11, 13, 15, 1, 3][direction] + tick % 2);
        }
      } else {
        idle++;
        draw(idle < 20 ? 25 : idle < 36 ? (tick % 2 ? 25 : 31) : idle < 48 ? (tick % 2 ? 27 : 28) : idle < 54 ? 26 : (Math.floor(tick / 4) % 2 ? 29 : 30));
      }
    }
    timer = setTimeout(step, 120);
  }
  function sync() {
    clearTimeout(timer); timer = 0;
    cat.hidden = true;
    if (allowed()) step();
  }
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    targetX = event.clientX; targetY = event.clientY;
  }, {passive:true});
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('fullscreenchange', sync);
  motion.addEventListener('change', sync); pointer.addEventListener('change', sync);
  window.addEventListener('pagehide', () => {clearTimeout(timer); timer = 0; cat.hidden = true;});
  window.addEventListener('pageshow', sync);
  window.addEventListener('n7x:pointer-cat-change', sync);
  window.addEventListener('storage', event => { if(event.key === 'n7x.pointerCat' || event.key === null) sync(); });
  document.body.append(cat);
  Promise.all(Array.from({length:32}, (_, i) => new Promise((resolve, reject) => {
    const image = new Image(); frames[i + 1] = image;
    image.onload = resolve; image.onerror = reject;
    image.src = `/assets/oneko/${i + 1}.gif`;
  }))).then(() => {loaded = true; sync();}).catch(() => cat.remove());
})();
