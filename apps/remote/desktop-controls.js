// Adapter for pinned noVNC 1.7.0. Keep coordinate and pointer-lock tests when upgrading.
export function enhanceDesktop(rfb, screen, releaseCapture) {
  const canvas=rfb._canvas, display=rfb._display;
  const originalX=display.absX.bind(display), originalY=display.absY.bind(display);
  const clamp=(value,max)=>Math.max(0,Math.min(max-1,value));
  display.absX=x=>document.fullscreenElement===screen?Math.floor(clamp(x/canvas.getBoundingClientRect().width*canvas.width,canvas.width)):originalX(x);
  display.absY=y=>document.fullscreenElement===screen?Math.floor(clamp(y/canvas.getBoundingClientRect().height*canvas.height,canvas.height)):originalY(y);
  let x=0,y=0,mask=0;
  const marker=document.createElement('span');marker.className='locked-pointer';marker.hidden=true;screen.append(marker);
  const locked=()=>document.pointerLockElement===canvas;
  const release=()=>{rfb._handleMouseButton(x,y,0);rfb._keyboard._allKeysUp();mask=0;marker.hidden=true;};
  const position=()=>{const rect=canvas.getBoundingClientRect(),parent=screen.getBoundingClientRect();marker.style.left=(rect.left-parent.left+x)+'px';marker.style.top=(rect.top-parent.top+y)+'px';};
  const changed=()=>{if(locked()){const rect=canvas.getBoundingClientRect();x=rect.width/2;y=rect.height/2;marker.hidden=false;position();rfb.focus();}else release();};
  const mouse=event=>{
    if(!locked())return;
    event.preventDefault();event.stopImmediatePropagation();
    const rect=canvas.getBoundingClientRect();
    if(event.type==='mousemove'){x=clamp(x+event.movementX,rect.width);y=clamp(y+event.movementY,rect.height);rfb._handleMouseMove(x,y);position();}
    else if(event.type==='mousedown'||event.type==='mouseup'){mask=(event.buttons&1)|((event.buttons&2)<<1)|((event.buttons&4)>>1);rfb._handleMouseButton(x,y,mask);}
    else if(event.type==='wheel'){const bit=event.deltaY<0?8:16;rfb._handleMouseButton(x,y,mask|bit);rfb._handleMouseButton(x,y,mask);}
  };
  const endCapture=()=>queueMicrotask(releaseCapture);screen.addEventListener('mouseup',endCapture,true);document.addEventListener('fullscreenchange',releaseCapture);
  const events=['mousemove','mousedown','mouseup','click','contextmenu','wheel'];
  for(const name of events)screen.addEventListener(name,mouse,{capture:true,passive:false});
  document.addEventListener('pointerlockchange',changed);
  const blur=()=>{if(locked())document.exitPointerLock();};window.addEventListener('blur',blur);
  return {
    async lock(){if(!canvas.requestPointerLock)throw Error('Mouse lock is unavailable in this browser.');await canvas.requestPointerLock();},
    destroy(){release();releaseCapture();screen.removeEventListener('mouseup',endCapture,true);document.removeEventListener('fullscreenchange',releaseCapture);if(locked())document.exitPointerLock();for(const name of events)screen.removeEventListener(name,mouse,true);document.removeEventListener('pointerlockchange',changed);window.removeEventListener('blur',blur);marker.remove();display.absX=originalX;display.absY=originalY;}
  };
}
