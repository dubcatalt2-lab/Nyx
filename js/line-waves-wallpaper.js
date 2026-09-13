/*
 * Framework-free port of React Bits Line Waves.
 * Source: https://reactbits.dev/backgrounds/line-waves
 * Repository: https://github.com/DavidHDev/react-bits
 * Copyright (c) 2026 David Haz. MIT + Commons Clause; see THIRD_PARTY_NOTICES.md.
 */
(function(){
  'use strict';

  const vertexShader=`
attribute vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
  // This fragment shader preserves the Line Waves field, displacement, ridge,
  // edge fade, and colour-cycle math from the React Bits component. OGL's
  // small wrapper is replaced with WebGL calls so Nyx can remain dependency-free.
  const fragmentShader=`
precision highp float;
uniform float uTime;uniform vec3 uResolution;uniform float uSpeed;uniform float uInnerLines;uniform float uOuterLines;uniform float uWarpIntensity;uniform float uRotation;uniform float uEdgeFadeWidth;uniform float uColorCycleSpeed;uniform float uBrightness;uniform vec3 uColor1;uniform vec3 uColor2;uniform vec3 uColor3;uniform vec2 uMouse;uniform float uMouseInfluence;uniform bool uEnableMouse;uniform float uLightMode;
#define HALF_PI 1.5707963
float hashF(float n){return fract(sin(n*127.1)*43758.5453123);}float smoothNoise(float x){float i=floor(x);float f=fract(x);float u=f*f*(3.0-2.0*f);return mix(hashF(i),hashF(i+1.0),u);}float displaceA(float coord,float t){float r=sin(coord*2.123)*0.2;r+=sin(coord*3.234+t*4.345)*0.1;r+=sin(coord*0.589+t*0.934)*0.5;return r;}float displaceB(float coord,float t){float r=sin(coord*1.345)*0.3;r+=sin(coord*2.734+t*3.345)*0.2;r+=sin(coord*0.189+t*0.934)*0.3;return r;}vec2 rotate2D(vec2 p,float a){float c=cos(a);float s=sin(a);return vec2(p.x*c-p.y*s,p.x*s+p.y*c);}
void main(){vec2 coords=gl_FragCoord.xy/uResolution.xy;coords=coords*2.0-1.0;coords=rotate2D(coords,uRotation);float halfT=uTime*uSpeed*0.5;float fullT=uTime*uSpeed;float mouseWarp=0.0;if(uEnableMouse){vec2 mPos=rotate2D(uMouse*2.0-1.0,uRotation);float mDist=length(coords-mPos);mouseWarp=uMouseInfluence*exp(-mDist*mDist*4.0);}float warpAx=coords.x+displaceA(coords.y,halfT)*uWarpIntensity+mouseWarp;float warpAy=coords.y-displaceA(coords.x*cos(fullT)*1.235,halfT)*uWarpIntensity;float warpBx=coords.x+displaceB(coords.y,halfT)*uWarpIntensity+mouseWarp;float warpBy=coords.y-displaceB(coords.x*sin(fullT)*1.235,halfT)*uWarpIntensity;vec2 fieldA=vec2(warpAx,warpAy);vec2 fieldB=vec2(warpBx,warpBy);vec2 blended=mix(fieldA,fieldB,mix(fieldA,fieldB,0.5));float fadeTop=smoothstep(uEdgeFadeWidth,uEdgeFadeWidth+0.4,blended.y);float fadeBottom=smoothstep(-uEdgeFadeWidth,-(uEdgeFadeWidth+0.4),blended.y);float vMask=1.0-max(fadeTop,fadeBottom);float tileCount=mix(uOuterLines,uInnerLines,vMask);float scaledY=blended.y*tileCount;float nY=smoothNoise(abs(scaledY));float ridge=pow(step(abs(nY-blended.x)*2.0,HALF_PI)*cos(2.0*(nY-blended.x)),5.0);float lines=0.0;for(float i=1.0;i<3.0;i+=1.0){lines+=pow(max(fract(scaledY),fract(-scaledY)),i*2.0);}float pattern=vMask*lines;float cycleT=fullT*uColorCycleSpeed;float rChannel=(pattern+lines*ridge)*(cos(blended.y+cycleT*0.234)*0.5+1.0);float gChannel=(pattern+vMask*ridge)*(sin(blended.x+cycleT*1.745)*0.5+1.0);float bChannel=(pattern+lines*ridge)*(cos(blended.x+cycleT*0.534)*0.5+1.0);vec3 col=(rChannel*uColor1+gChannel*uColor2+bChannel*uColor3)*uBrightness;float alpha=clamp(length(col),0.0,1.0);if(uLightMode>0.5){vec3 weights=pow(max(vec3(rChannel,gChannel,bChannel),vec3(0.0)),vec3(3.0));float weightSum=max(weights.r+weights.g+weights.b,0.0001);vec3 chroma=(weights.r*uColor1+weights.g*uColor2+weights.b*uColor3)/weightSum;float neutral=min(chroma.r,min(chroma.g,chroma.b));chroma=max(chroma-vec3(neutral*0.92),vec3(0.0));float peak=max(chroma.r,max(chroma.g,chroma.b));chroma=pow(clamp(chroma/max(peak,0.0001),0.0,1.0),vec3(1.08));float ink=clamp(max(rChannel,max(gChannel,bChannel))*uBrightness*1.15,0.0,0.92);gl_FragColor=vec4(mix(vec3(1.0),chroma,ink),1.0);}else{gl_FragColor=vec4(col,alpha);}}
`;

  const palettes=Object.freeze({
    frost:[[1,1,1],[.84,.9,1],[.62,.74,.9]],
    arctic:[[.43,.74,1],[.64,.86,1],[.22,.5,.88]],
    violet:[[.68,.55,1],[.82,.72,1],[.4,.26,.72]],
    mint:[[.38,.88,.68],[.62,1,.8],[.13,.55,.37]],
    rose:[[1,.55,.72],[1,.74,.84],[.78,.28,.48]],
    ember:[[1,.62,.36],[1,.78,.52],[.72,.28,.12]]
  });
  const defaults=Object.freeze({speed:.3,innerLineCount:32,outerLineCount:36,warpIntensity:1,rotation:-45,edgeFadeWidth:.6,colorCycleSpeed:1,brightness:.12,enableMouseInteraction:true,mouseInfluence:2,colorVariant:'frost'});
  let options={...defaults};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let canvas=null,renderer=null;

  function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Shader compile failed');return shader;}
  function themeColors(){
    const theme=document.documentElement.dataset.nyxTheme||'default';
    if(theme==='ruby')return [[1,.58,.66],[1,.78,.82],[.92,.28,.40]];
    if(theme==='emerald'||theme==='fresh')return [[.58,1,.78],[.74,1,.86],[.21,.76,.51]];
    if(theme==='sakura')return [[1,.68,.84],[1,.85,.93],[.91,.39,.66]];
    if(theme==='midnight')return [[.67,.82,1],[.85,.93,1],[.34,.62,1]];
    return [[1,1,1],[1,1,1],[1,1,1]];
  }
  function colorsFor(options){return palettes[options.colorVariant] || themeColors();}
  function makeRenderer(target,preview=false,rendererOptions=options){
    let activeOptions={...defaults,...rendererOptions};
    const gl=target.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,powerPreference:'high-performance'});
    if(!gl)throw new Error('WebGL unavailable');
    const program=gl.createProgram();gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertexShader));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragmentShader));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Program link failed');
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'position');const uniforms={};['uTime','uResolution','uSpeed','uInnerLines','uOuterLines','uWarpIntensity','uRotation','uEdgeFadeWidth','uColorCycleSpeed','uBrightness','uColor1','uColor2','uColor3','uMouse','uMouseInfluence','uEnableMouse','uLightMode'].forEach(key=>uniforms[key]=gl.getUniformLocation(program,key));
    let frame=0,running=false;
    let currentMouse=[.5,.5],targetMouse=[.5,.5];
    const setPointer=(clientX,clientY)=>{const rect=target.getBoundingClientRect();if(!rect.width||!rect.height)return;targetMouse=[Math.max(0,Math.min(1,(clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,1-(clientY-rect.top)/rect.height))];};
    const resetPointer=()=>{targetMouse=[.5,.5];};
    const draw=(milliseconds=0)=>{const rect=target.getBoundingClientRect();const width=Math.max(1,Math.round(rect.width||target.width||1));const height=Math.max(1,Math.round(rect.height||target.height||1));const budget=document.body?.classList.contains('performance-lite')?550000:850000;const scale=preview?1:Math.max(.42,Math.min(.85,Math.sqrt(budget/(width*height))));const renderWidth=Math.max(1,Math.round(width*scale));const renderHeight=Math.max(1,Math.round(height*scale));if(target.width!==renderWidth||target.height!==renderHeight){target.width=renderWidth;target.height=renderHeight;}gl.viewport(0,0,renderWidth,renderHeight);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);const colors=colorsFor(activeOptions);currentMouse[0]+=.05*(targetMouse[0]-currentMouse[0]);currentMouse[1]+=.05*(targetMouse[1]-currentMouse[1]);gl.uniform1f(uniforms.uTime,milliseconds*.001);gl.uniform3f(uniforms.uResolution,renderWidth,renderHeight,renderWidth/renderHeight);gl.uniform1f(uniforms.uSpeed,activeOptions.speed);gl.uniform1f(uniforms.uInnerLines,activeOptions.innerLineCount);gl.uniform1f(uniforms.uOuterLines,activeOptions.outerLineCount);gl.uniform1f(uniforms.uWarpIntensity,activeOptions.warpIntensity);gl.uniform1f(uniforms.uRotation,activeOptions.rotation*Math.PI/180);gl.uniform1f(uniforms.uEdgeFadeWidth,activeOptions.edgeFadeWidth);gl.uniform1f(uniforms.uColorCycleSpeed,activeOptions.colorCycleSpeed);gl.uniform1f(uniforms.uBrightness,activeOptions.brightness);gl.uniform3fv(uniforms.uColor1,colors[0]);gl.uniform3fv(uniforms.uColor2,colors[1]);gl.uniform3fv(uniforms.uColor3,colors[2]);gl.uniform2f(uniforms.uMouse,currentMouse[0],currentMouse[1]);gl.uniform1f(uniforms.uMouseInfluence,activeOptions.mouseInfluence);gl.uniform1i(uniforms.uEnableMouse,preview||!activeOptions.enableMouseInteraction?0:1);gl.uniform1f(uniforms.uLightMode,0);gl.drawArrays(gl.TRIANGLES,0,3);};
    const tick=time=>{frame=0;if(!running)return;draw(time);frame=requestAnimationFrame(tick);};
    return {draw,setPointer,resetPointer,update(nextOptions){activeOptions={...defaults,...nextOptions};},start(){if(running)return;running=true;frame=requestAnimationFrame(tick);},stop(){running=false;if(frame)cancelAnimationFrame(frame);frame=0;},dispose(loseContext=true){this.stop();gl.deleteBuffer(buffer);gl.deleteProgram(program);if(loseContext)gl.getExtension('WEBGL_lose_context')?.loseContext();}};
  }
  function shouldShow(){const external=document.body?.classList.contains('browser-content-active')&&!document.body?.classList.contains('nyx-built-in-content-active');return document.documentElement.dataset.nyxBeamWallpaper==='lineWaves'&&!document.body?.classList.contains('custom-bg-active')&&!document.body?.classList.contains('three-d-backgrounds')&&!external;}
  function shouldAnimate(){return shouldShow()&&!document.hidden&&!reducedMotion.matches&&!document.body?.classList.contains('lag-reducer');}
  function syncVisibility(){
    canvas=document.getElementById('nyxLineWavesBg')||canvas;if(!canvas)return;
    const show=shouldShow();canvas.hidden=!show;if(!show){renderer?.stop();return;}
    try{renderer||=(makeRenderer(canvas));renderer.draw(performance.now());if(shouldAnimate())renderer.start();else renderer.stop();canvas.dataset.renderer='react-bits-line-waves';}catch(error){canvas.hidden=true;console.warn('Nyx Line Waves renderer unavailable',error);}
  }
  function apply(_selected,nextOptions={}){options={...defaults,...nextOptions};renderer?.update(options);syncVisibility();}
  function renderPreview(target,colorVariant){
    if(!target)return;
    try{const preview=makeRenderer(target,true,{...options,colorVariant});preview.draw(860);preview.dispose(false);}catch(error){console.warn('Nyx Line Waves preview unavailable',error);const context=target.getContext('2d');if(context){context.fillStyle='#080c13';context.fillRect(0,0,target.width,target.height);}}
  }
  function init(){
    canvas=document.getElementById('nyxLineWavesBg');if(!canvas)return;
    new MutationObserver(syncVisibility).observe(document.documentElement,{attributes:true,attributeFilter:['data-nyx-beam-wallpaper','data-nyx-theme']});
    new MutationObserver(syncVisibility).observe(document.body,{attributes:true,attributeFilter:['class']});
    addEventListener('resize',()=>{if(shouldShow()){renderer?.draw(performance.now());}},{passive:true});
    // The source component is mouse-reactive. Listen at window level so the
    // full-screen canvas can remain pointer-events:none and never block Nyx.
    addEventListener('pointermove',event=>{if(shouldShow())renderer?.setPointer(event.clientX,event.clientY);},{passive:true});
    addEventListener('blur',()=>renderer?.resetPointer(),{passive:true});
    document.addEventListener('visibilitychange',syncVisibility);reducedMotion.addEventListener?.('change',syncVisibility);canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer?.stop();});canvas.addEventListener('webglcontextrestored',()=>{renderer?.dispose();renderer=null;syncVisibility();});syncVisibility();
  }
  window.NyxLineWavesWallpaper=Object.freeze({palettes,apply,syncVisibility,renderPreview,source:'React Bits Line Waves'});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
