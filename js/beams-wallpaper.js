(function(){
  'use strict';

  // Framework-free port of React Bits Beams:
  // https://reactbits.dev/backgrounds/beams
  // Copyright (c) 2026 David Haz. See THIRD_PARTY_NOTICES.md.
  const presets=Object.freeze({
    frost:{label:'Frost',summary:'Soft white light',lightColor:'#ffffff'},
    arctic:{label:'Arctic',summary:'Cool blue beams',lightColor:'#73c9ff'},
    violet:{label:'Violet',summary:'Muted violet light',lightColor:'#a98cff'},
    mint:{label:'Mint',summary:'Quiet green light',lightColor:'#75e7be'},
    rose:{label:'Rose',summary:'Soft rose light',lightColor:'#f5a0c8'},
    ember:{label:'Ember',summary:'Warm amber light',lightColor:'#ffad73'},
    lineWaves:{label:'Waves',summary:'Flowing contour lines',lightColor:'#9ec8ff'}
  });
  // Match the React Bits showcase configuration. Keeping the source geometry
  // proportions is important: oversized, overlapping planes expose their
  // independently displaced edges as the stepped bands seen in the regression.
  const defaults=Object.freeze({beamWidth:3,beamHeight:30,beamNumber:20,lightColor:'#ffffff',speed:2,noiseIntensity:1.75,scale:.2,rotation:30});

  const coherentNoise=`
float random (in vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}
float noise (in vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy,Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x,Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);
  float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);
  return 2.2 * n_xyz;
}`;

  function extendMaterial(THREE,BaseMaterial,config){
    const physical=THREE.ShaderLib.physical;
    const uniforms=THREE.UniformsUtils.clone(physical.uniforms);
    const materialDefaults=new BaseMaterial(config.material || {});
    if(materialDefaults.color) uniforms.diffuse.value=materialDefaults.color;
    if('roughness' in materialDefaults) uniforms.roughness.value=materialDefaults.roughness;
    if('metalness' in materialDefaults) uniforms.metalness.value=materialDefaults.metalness;
    if('envMap' in materialDefaults) uniforms.envMap.value=materialDefaults.envMap;
    if('envMapIntensity' in materialDefaults) uniforms.envMapIntensity.value=materialDefaults.envMapIntensity;
    Object.entries(config.uniforms || {}).forEach(([key,uniform])=>{
      uniforms[key]=uniform && typeof uniform==='object' && 'value' in uniform ? uniform : {value:uniform};
    });
    let vertexShader=`${config.header}\n${config.vertexHeader || ''}\n${physical.vertexShader}`;
    let fragmentShader=`${config.header}\n${config.fragmentHeader || ''}\n${physical.fragmentShader}`;
    Object.entries(config.vertex || {}).forEach(([include,code])=>{vertexShader=vertexShader.replace(include,`${include}\n${code}`)});
    Object.entries(config.fragment || {}).forEach(([include,code])=>{fragmentShader=fragmentShader.replace(include,`${include}\n${code}`)});
    materialDefaults.dispose();
    return new THREE.ShaderMaterial({defines:{...(physical.defines || {})},uniforms,vertexShader,fragmentShader,lights:true,fog:Boolean(config.material?.fog)});
  }

  function createStackedPlanesGeometry(THREE,count,width,height,spacing=0,heightSegments=100){
    const geometry=new THREE.BufferGeometry();
    const numVertices=count*(heightSegments+1)*2;
    const numFaces=count*heightSegments*2;
    const positions=new Float32Array(numVertices*3);
    const indices=new Uint32Array(numFaces*3);
    const uvs=new Float32Array(numVertices*2);
    let vertexOffset=0;
    let indexOffset=0;
    let uvOffset=0;
    const totalWidth=count*width+(count-1)*spacing;
    const xOffsetBase=-totalWidth/2;
    for(let index=0;index<count;index++){
      const xOffset=xOffsetBase+index*(width+spacing);
      const uvXOffset=Math.random()*300;
      const uvYOffset=Math.random()*300;
      for(let segment=0;segment<=heightSegments;segment++){
        const y=height*(segment/heightSegments-.5);
        positions.set([xOffset,y,0,xOffset+width,y,0],vertexOffset*3);
        const uvY=segment/heightSegments;
        uvs.set([uvXOffset,uvY+uvYOffset,uvXOffset+1,uvY+uvYOffset],uvOffset);
        if(segment<heightSegments){
          const a=vertexOffset;
          const b=vertexOffset+1;
          const c=vertexOffset+2;
          const d=vertexOffset+3;
          indices.set([a,b,c,c,b,d],indexOffset);
          indexOffset+=6;
        }
        vertexOffset+=2;
        uvOffset+=4;
      }
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
    geometry.setIndex(new THREE.BufferAttribute(indices,1));
    geometry.computeVertexNormals();
    return geometry;
  }

  function createBeamMaterial(THREE,options){
    return extendMaterial(THREE,THREE.MeshStandardMaterial,{
      header:`
varying vec3 vEye;
varying float vNoise;
varying vec2 vUv;
varying vec3 vPosition;
uniform float time;
uniform float uSpeed;
uniform float uNoiseIntensity;
uniform float uScale;
${coherentNoise}`,
      vertexHeader:`
float getPos(vec3 pos) {
  vec3 noisePos = vec3(pos.x * 0., pos.y - uv.y, pos.z + time * uSpeed * 3.) * uScale;
  return cnoise(noisePos);
}
vec3 getCurrentPos(vec3 pos) {
  vec3 newpos = pos;
  newpos.z += getPos(pos);
  return newpos;
}
vec3 getNormal(vec3 pos) {
  vec3 curpos = getCurrentPos(pos);
  vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0));
  vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0));
  vec3 tangentX = normalize(nextposX - curpos);
  vec3 tangentZ = normalize(nextposZ - curpos);
  return normalize(cross(tangentZ, tangentX));
}`,
      vertex:{
        '#include <begin_vertex>':'transformed.z += getPos(transformed.xyz);',
        '#include <beginnormal_vertex>':'objectNormal = getNormal(position.xyz);'
      },
      fragment:{
        '#include <dithering_fragment>':`float randomNoise = noise(gl_FragCoord.xy);
gl_FragColor.rgb -= randomNoise / 15. * uNoiseIntensity;`
      },
      material:{fog:true},
      uniforms:{
        diffuse:new THREE.Color(0,0,0),
        time:{value:0},
        roughness:.3,
        metalness:.3,
        uSpeed:{value:options.speed},
        envMapIntensity:10,
        uNoiseIntensity:options.noiseIntensity,
        uScale:options.scale
      }
    });
  }

  class BeamsRenderer{
    constructor(canvas,options={},preview=false){
      if(!window.THREE) throw new Error('Three.js is unavailable');
      this.THREE=window.THREE;
      this.canvas=canvas;
      this.preview=preview;
      this.options={...defaults,...options};
      this.time=0;
      this.lastFrame=0;
      this.frame=0;
      this.running=false;
      // The full-screen shader already adds soft noise, so multisample
      // antialiasing only increases GPU work without a visible benefit.
      this.renderer=new this.THREE.WebGLRenderer({canvas,antialias:preview,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:preview});
      this.renderer.setClearColor(0x000000,1);
      this.renderer.outputEncoding=this.THREE.sRGBEncoding;
      this.renderer.toneMapping=this.THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure=1;
      this.scene=new this.THREE.Scene();
      this.scene.background=new this.THREE.Color(0x000000);
      // Match the 30°/20-unit React Bits framing with an orthographic
      // projection. Its independently flexing strips keep their shared screen
      // edge instead of drifting apart and exposing animated cracks.
      this.camera=new this.THREE.OrthographicCamera(-1,1,1,-1,.1,1000);
      this.camera.position.set(0,0,20);
      this.group=new this.THREE.Group();
      this.scene.add(this.group);
      this.ambient=new this.THREE.AmbientLight(0xffffff,1);
      this.scene.add(this.ambient);
      this.directional=new this.THREE.DirectionalLight(this.options.lightColor,1);
      this.directional.position.set(0,3,10);
      this.scene.add(this.directional);
      this.rebuildMesh();
      this.resize();
    }
    rebuildMesh(){
      if(this.mesh){
        this.group.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
      }
      const options=this.options;
      const geometry=createStackedPlanesGeometry(this.THREE,options.beamNumber,options.beamWidth,options.beamHeight,0,100);
      const material=createBeamMaterial(this.THREE,options);
      this.mesh=new this.THREE.Mesh(geometry,material);
      this.mesh.frustumCulled=false;
      this.group.rotation.set(0,0,this.THREE.MathUtils.degToRad(options.rotation));
      this.group.add(this.mesh);
      this.directional.color.set(options.lightColor);
    }
    resize(){
      const rect=this.canvas.getBoundingClientRect();
      const width=Math.max(1,Math.round(rect.width || this.canvas.width || 1));
      const height=Math.max(1,Math.round(rect.height || this.canvas.height || 1));
      // A full-screen physically lit shader becomes fill-rate bound on wide
      // and high-resolution displays. Keep a fixed pixel budget and upscale
      // the deliberately noisy image; motion stays at full speed while the
      // GPU shades far fewer pixels on 1440p-class screens.
      const pixelBudget=1400000;
      const renderScale=Math.max(.58,Math.min(1,Math.sqrt(pixelBudget/(width*height))));
      this.renderScale=renderScale;
      this.canvas.dataset.renderScale=renderScale.toFixed(3);
      this.renderer.setPixelRatio(renderScale);
      this.renderer.setSize(width,height,false);
      const aspect=width/height;
      const viewHeight=2*20*Math.tan(this.THREE.MathUtils.degToRad(15));
      const viewWidth=viewHeight*aspect;
      this.camera.left=-viewWidth/2;
      this.camera.right=viewWidth/2;
      this.camera.top=viewHeight/2;
      this.camera.bottom=-viewHeight/2;
      this.camera.updateProjectionMatrix();
    }
    update(options){
      this.options={...this.options,...options};
      this.rebuildMesh();
      this.renderOnce();
    }
    renderOnce(time=this.time){
      if(this.mesh?.material?.uniforms?.time) this.mesh.material.uniforms.time.value=time;
      this.renderer.render(this.scene,this.camera);
    }
    tick=timestamp=>{
      this.frame=0;
      if(!this.running) return;
      const delta=this.lastFrame ? Math.min(.1,(timestamp-this.lastFrame)/1000) : 0;
      this.lastFrame=timestamp;
      this.time+=.1*delta;
      this.renderOnce();
      this.frame=requestAnimationFrame(this.tick);
    };
    start(){
      if(this.running) return;
      this.running=true;
      this.lastFrame=0;
      this.frame=requestAnimationFrame(this.tick);
    }
    stop(){
      this.running=false;
      if(this.frame) cancelAnimationFrame(this.frame);
      this.frame=0;
      this.lastFrame=0;
    }
    dispose(){
      this.stop();
      this.mesh?.geometry?.dispose();
      this.mesh?.material?.dispose();
      this.renderer?.dispose();
    }
  }

  let canvas=null;
  let instance=null;
  let selected='frost';
  let options={...defaults};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');

  function shouldAnimate(){
    if(!instance || !canvas || canvas.hidden || document.hidden || reducedMotion.matches) return false;
    return !document.body?.classList.contains('lag-reducer');
  }
  function ensureInstance(){
    if(instance || !canvas || !window.THREE) return instance;
    try{
      instance=new BeamsRenderer(canvas,options);
      canvas.dataset.renderer='react-bits';
    }catch(error){
      canvas.dataset.renderer='fallback';
      console.warn('Nyx Beams renderer unavailable',error);
    }
    return instance;
  }
  function syncVisibility(){
    if(!canvas) return;
    const body=document.body;
    const externalContent=body?.classList.contains('browser-content-active') && !body.classList.contains('nyx-built-in-content-active');
    const lineWaves=document.documentElement?.dataset.nyxBeamWallpaper==='lineWaves';
    const hidden=!body || lineWaves || body.classList.contains('custom-bg-active') || body.classList.contains('three-d-backgrounds') || externalContent;
    canvas.hidden=hidden;
    if(hidden){instance?.stop(); return}
    const renderer=ensureInstance();
    renderer?.resize();
    renderer?.renderOnce();
    if(shouldAnimate()) renderer?.start();
    else renderer?.stop();
  }
  function apply(name='frost',nextOptions={}){
    selected=presets[name] ? name : 'frost';
    options={...defaults,...options,...nextOptions,lightColor:presets[selected].lightColor};
    canvas=document.getElementById('nyxBeamsBg') || canvas;
    if(canvas) canvas.dataset.preset=selected;
    if(instance) instance.update(options);
    syncVisibility();
  }
  function renderPreview(target,name){
    if(!target || !window.THREE) return;
    const preset=presets[name] || presets.frost;
    const offscreen=document.createElement('canvas');
    offscreen.style.width='240px';
    offscreen.style.height='135px';
    offscreen.width=240;
    offscreen.height=135;
    let preview;
    try{
      preview=new BeamsRenderer(offscreen,{...defaults,lightColor:preset.lightColor,speed:0},true);
      preview.time=.56;
      preview.renderOnce();
      const image=new Image();
      image.onload=()=>target.getContext('2d')?.drawImage(image,0,0,target.width,target.height);
      image.src=offscreen.toDataURL('image/png');
    }catch(error){
      const context=target.getContext('2d');
      if(context){context.fillStyle='#000';context.fillRect(0,0,target.width,target.height)}
    }finally{
      preview?.dispose();
    }
  }
  function init(){
    canvas=document.getElementById('nyxBeamsBg');
    if(!canvas) return;
    apply(localStorage.getItem('nyx.beamWallpaper') || 'frost');
    new MutationObserver(syncVisibility).observe(document.body,{attributes:true,attributeFilter:['class']});
    const resizeObserver=new ResizeObserver(()=>{
      if(!canvas.hidden){instance?.resize();instance?.renderOnce()}
    });
    resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange',()=>document.hidden ? instance?.stop() : syncVisibility());
    reducedMotion.addEventListener?.('change',syncVisibility);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();instance?.stop()});
    canvas.addEventListener('webglcontextrestored',()=>{
      instance?.dispose();
      instance=null;
      syncVisibility();
    });
  }

  window.NyxBeamsWallpaper=Object.freeze({presets,apply,renderPreview,syncVisibility,source:'React Bits Beams'});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
