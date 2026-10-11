import {CookieJar} from 'tough-cookie';

export class Cookies{
  constructor(saved){
    this.jar=saved?CookieJar.deserializeSync(saved):new CookieJar(undefined,{prefixSecurity:'strict',allowSpecialUseDomain:true});
  }
  receive(url,headers,options={}){
    let changed=false;
    for(const [name,value] of headers){
      if(name.toLowerCase()!=='set-cookie'||value.length>4096)continue;
      if(this.jar.setCookieSync(value,url,{http:true,ignoreError:true,...options}))changed=true;
    }
    return changed;
  }
  set(url,value){
    if(typeof value==='string'&&value.length<=4096)this.jar.setCookieSync(value,url,{http:false,ignoreError:true});
  }
  header(url,context='strict'){
    return this.jar.getCookieStringSync(url,{http:true,sameSiteContext:context});
  }
  visible(url){return this.jar.getCookieStringSync(url,{http:false});}
  snapshot(url){
    const result=new CookieJar(undefined,{prefixSecurity:'strict',allowSpecialUseDomain:true}).serializeSync();
    result.cookies=this.jar.getCookiesSync(url,{http:false,allPaths:true}).map(cookie=>cookie.toJSON());
    return result;
  }
  export(){return this.jar.serializeSync();}
}

export async function cookieStore(storage=globalThis.indexedDB){
  const database=await new Promise((resolve,reject)=>{
    const request=storage.open('document-state',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('cookies');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  async function transaction(mode,action){
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction('cookies',mode);
      const request=action(transaction.objectStore('cookies'));
      transaction.oncomplete=()=>resolve(request.result);
      transaction.onabort=()=>reject(transaction.error||new Error('Cookie storage failed'));
      transaction.onerror=()=>reject(transaction.error||new Error('Cookie storage failed'));
    });
  }
  return {
    async load(profile){return new Cookies(await transaction('readonly',store=>store.get(profile)));},
    save(profile,cookies){return transaction('readwrite',store=>store.put(cookies.export(),profile));},
    close(){database.close();}
  };
}
