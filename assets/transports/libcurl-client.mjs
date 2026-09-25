import LibcurlClient from '/libcurl/index.mjs';
import {preserveTransferErrors,requestWithTransferRetry} from './libcurl-response.mjs';
import {headerEntries} from './header-utils.mjs';

export default class NyxLibcurlClient extends LibcurlClient {
  async init(){
    await super.init();
    preserveTransferErrors(this.session);
    this.responseBudget={bytes:0};
  }
  request(remote,method,body,headers,signal){
    return requestWithTransferRetry(async()=>{
      const response=await super.request(remote,method,body,headers,signal);
      return {...response,headers:headerEntries(response.headers)};
    },{method,body,signal,budget:this.responseBudget});
  }
}
