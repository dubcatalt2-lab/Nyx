/* Persist only this game's PlayerPrefs; never export the surrounding browser storage. */
(() => {
  'use strict';
  const host=document.createElement('aside');
  host.style.cssText='position:fixed;bottom:12px;left:12px;z-index:2147483646';
  const ui=host.attachShadow({mode:'open'});
  ui.innerHTML='<style>div{display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:12px;background:#101218ed;color:#ddd;font:12px system-ui}button{border:1px solid #ffffff30;background:transparent;color:inherit;border-radius:8px;padding:5px 9px;cursor:pointer}</style><div><span role="status">Loading save…</span><button type="button">Save now</button></div>';
  document.body.append(host);
  const status=ui.querySelector('span'),button=ui.querySelector('button');
  let sequence=0,pending=new Map(),root,loaded='',last='',busy=false,ready=false,cloud=false;
  function request(action,storage){
    if(parent===window)return Promise.reject(new Error('Open this game from the Nyx library to sync saves.'));
    const requestId='unity-'+(++sequence)+'-'+Date.now();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Cloud save unavailable.'));},10000);
      pending.set(requestId,{resolve,timer});
      parent.postMessage({type:'nyx:gladi-save',action,requestId,storage},'*');
    });
  }
  addEventListener('message',e=>{
    if(e.source!==parent||e.data?.type!=='nyx:gladi-save-result')return;
    const item=pending.get(e.data.requestId);if(!item)return;
    pending.delete(e.data.requestId);clearTimeout(item.timer);item.resolve(e.data);
  });
  function unpack(storage){
    if(!storage?.unityCount)return '';
    const count=Number(storage.unityCount);if(!Number.isInteger(count)||count<1||count>12)throw Error('Invalid cloud save.');
    let data='';for(let i=0;i<count;i++){const part=storage['unity'+i];if(typeof part!=='string'||part.length>20000)throw Error('Invalid cloud save.');data+=part;}
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error('Invalid cloud save.');
    atob(data);return data;
  }
  function pack(data){const storage={unityCount:String(Math.ceil(data.length/20000))};for(let i=0;i<data.length;i+=20000)storage['unity'+i/20000]=data.slice(i,i+20000);return storage;}
  function snapshot(){
    if(!root)return '';
    for(const [name,dir] of Object.entries(root.contents)){
      if(!/^[a-f0-9]{32}$/.test(name))continue;
      const file=dir.contents?.PlayerPrefs;if(!file?.contents||!file.usedBytes)continue;
      if(file.usedBytes>175000)throw Error('Save is too large to sync.');
      const bytes=file.contents.subarray?file.contents.subarray(0,file.usedBytes):file.contents.slice(0,file.usedBytes);
      // MEMFS may retain a signed HEAP8 view after a game writes its save.
      // Preserve each byte's bits instead of turning negatives into UTF-16.
      let raw='';for(let i=0;i<bytes.length;i++)raw+=String.fromCharCode(bytes[i]&255);return btoa(raw);
    }
    return '';
  }
  async function save(manual=false){
    if(!ready||busy)return;
    busy=true;button.disabled=true;
    try{
      const data=snapshot();if(!data)return;
      if(data===last&&!manual)return;
      const result=await request('save',pack(data));
      if(result.saved){last=data;cloud=result.cloud===true;status.textContent=cloud?'Cloud saved automatically':'Saved on this device automatically · sign in for cloud sync';}
      else throw Error(result.error||'Save failed.');
    }catch(error){status.textContent=error.message;}
    finally{busy=false;button.disabled=false;}
  }
  // Unity listens for pointer input on the document; keep overlay controls local.
  for(const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','keydown','keyup'])host.addEventListener(type,event=>event.stopPropagation());
  button.addEventListener('click',event=>{event.stopPropagation();void save(true);});
  const loading=request('load').then(result=>{
    loaded=unpack(result.storage);last=loaded;cloud=result.cloud===true;
    status.textContent=cloud?(loaded?'Cloud save restored':'Cloud saves ready'):'Device save · sign in for cloud sync';
  }).catch(error=>{status.textContent=error.message;});
  window.NyxGladiSave={
    loading,
    mount(m){
      // The game is deliberately in an opaque sandbox; IDBFS cannot open its
      // IndexedDB there. Use memory FS and the authenticated parent save bridge.
      m.FS_createPath('/','idbfs',true,true);
      root=m.FS_createDataFile('/idbfs','.nyx-save-root',new Uint8Array(),true,true).parent;
      root.contents=new Proxy(root.contents,{set(target,name,value){
        target[name]=value;
        if(loaded&&/^[a-f0-9]{32}$/.test(String(name))){
          const bytes=Uint8Array.from(atob(loaded),c=>c.charCodeAt(0));
          m.FS_createDataFile('/idbfs/'+name,'PlayerPrefs',bytes,true,true);
        }
        return true;
      }});
      ready=true;
    }
  };
  const timer=setInterval(()=>save(),2000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void save();});
  addEventListener('pagehide',()=>{clearInterval(timer);void save();});
})();
