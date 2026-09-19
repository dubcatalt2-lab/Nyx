export const storageNames={'$scramjet':'@d7a6431b92e','__scramjet_controller':'@d941bc65af3'};
export function rewriteStorageNames(source){for(const [name,alias] of Object.entries(storageNames))for(const quote of ['"',"'",'`'])source=source.split(quote+name+quote).join(quote+alias+quote);return source;}
// This function is serialized into the entry loader; keep it self-contained.
export async function migrateStorage(names) {
  if(!globalThis.indexedDB?.databases)return;
  const migrate=async()=>{
    const existing=await indexedDB.databases();
    for(const [name,alias] of Object.entries(names)) {
      if(!existing.some(db=>db.name===name)||existing.some(db=>db.name===alias))continue;
      const open=(name,version,upgrade)=>new Promise((resolve,reject)=>{const r=version?indexedDB.open(name,version):indexedDB.open(name);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Close other site tabs and reload to update saved browser data.'));r.onupgradeneeded=()=>upgrade?.(r.result);r.onsuccess=()=>resolve(r.result);});
      const old=await open(name);const stores=[...old.objectStoreNames];
      let snapshots;
      try {snapshots=await new Promise((resolve,reject)=>{
        if(!stores.length)return resolve([]);
        const tx=old.transaction(stores,'readonly'),result=[];
        for(const name of stores){const store=tx.objectStore(name),entry={name,keyPath:store.keyPath,autoIncrement:store.autoIncrement,indexes:[...store.indexNames].map(n=>{const x=store.index(n);return{name:n,keyPath:x.keyPath,unique:x.unique,multiEntry:x.multiEntry}}),rows:[]};result.push(entry);const r=store.openCursor();r.onsuccess=()=>{const cursor=r.result;if(cursor){entry.rows.push({key:cursor.primaryKey,value:cursor.value});cursor.continue();}};}
        tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage copy interrupted.'));
      });}finally{old.close();}
      const target=await open(alias,old.version,db=>{for(const item of snapshots){const store=db.createObjectStore(item.name,{keyPath:item.keyPath,autoIncrement:item.autoIncrement});for(const x of item.indexes)store.createIndex(x.name,x.keyPath,{unique:x.unique,multiEntry:x.multiEntry});}});
      try {await new Promise((resolve,reject)=>{
        if(!stores.length)return resolve();
        const tx=target.transaction(stores,'readwrite');
        for(const item of snapshots){const store=tx.objectStore(item.name);for(const row of item.rows)item.keyPath===null?store.put(row.value,row.key):store.put(row.value);}
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage copy interrupted.'));
      });}catch(error){target.close();await new Promise(resolve=>{const r=indexedDB.deleteDatabase(alias);r.onsuccess=r.onerror=r.onblocked=resolve;});throw error;}finally{target.close();}
    }
  };
  if(navigator.locks)await navigator.locks.request('saved-data-update',migrate);else await migrate();
}
