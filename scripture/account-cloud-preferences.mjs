import {createHash} from 'node:crypto';

const imageKey='nyx.customBgData',chunkSize=450_000,maxImageSize=6_000_000;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(value).digest('hex');
const count=value=>Number.isInteger(value)&&value>=0&&value<=Math.ceil(maxImageSize/chunkSize)?value:0;

// Private account data, split below Firestore's per-document limit. Fixed chunk
// names and one transaction keep replacement/removal atomic and storage bounded.
export function createAccountCloudPreferences({db,normalize,collection='nyxCloudSaves',now=Date.now}){
  const reference=uid=>db.collection(collection).doc(uid);
  const part=(ref,index)=>ref.collection('wallpaper').doc(`part-${index}`);
  async function read(uid){
    return db.runTransaction(async tx=>{
      const ref=reference(uid),data=(await tx.get(ref)).data()||{};
      const preferences=normalize(data.preferences);
      if(data.wallpaper!==undefined){
        const size=count(data.wallpaper?.chunks);
        const chunks=await Promise.all(Array.from({length:size},(_,i)=>tx.get(part(ref,i))));
        const image=chunks.map((snapshot,i)=>snapshot.data()?.index===i?String(snapshot.data()?.data||''):'').join('');
        if(size&&(!image||image.length>maxImageSize||hash(image)!==data.wallpaper.sha256))throw fail('Your saved wallpaper could not be loaded. Please try again.',503);
        preferences[imageKey]=image;
      }
      return {preferences,updatedAt:Number(data.preferencesUpdatedAt||0)};
    });
  }
  async function write(uid,value){
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    const { [imageKey]:image,...settings}=source;
    const replace=Object.hasOwn(source,imageKey);
    if(replace&&(typeof image!=='string'||(image&&!/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/i.test(image))))throw fail('Choose a valid image for your wallpaper.');
    if(replace&&image.length>maxImageSize)throw fail('This wallpaper is too large for account storage. Choose an image under 4 MB.',413);
    const preferences=normalize(settings);
    const updatedAt=now();
    await db.runTransaction(async tx=>{
      const ref=reference(uid),previous=(await tx.get(ref)).data()||{};
      const total=replace?Math.ceil(image.length/chunkSize):count(previous.wallpaper?.chunks);
      if(replace){
        for(let i=0;i<total;i++)tx.set(part(ref,i),{index:i,data:image.slice(i*chunkSize,(i+1)*chunkSize)});
        for(let i=total;i<count(previous.wallpaper?.chunks);i++)tx.delete(part(ref,i));
      }
      const update={preferences,preferencesUpdatedAt:updatedAt,preferencesUpdatedAtIso:new Date(updatedAt).toISOString()};
      if(replace)update.wallpaper={chunks:total,sha256:image?hash(image):''};
      tx.set(ref,update,{mergeFields:Object.keys(update)});
    });
    return {saved:true,updatedAt};
  }
  return {read,write};
}
