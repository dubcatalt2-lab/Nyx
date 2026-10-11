import {documentOrigin,openDocument} from '/js/document-window.mjs';
let settings={};
export function updateProtectionPolicy(value){settings={...value};}
export async function explore(url,value,element){updateProtectionPolicy(value);return openDocument(element,url);}
export function currentWebsiteUrl(element){return element?.dataset.documentSource||'';}
export function closeWorkspace(element){if(element){element.src='about:blank';delete element.dataset.documentSource;}}
export function reloadWorkspace(element,value){const url=currentWebsiteUrl(element);return url?explore(url,value,element):Promise.resolve();}
export function control(action,element){
 if(!element||!['back','forward','reload'].includes(action))return;
 element.contentWindow?.postMessage({type:'document-control',action},documentOrigin());
}
export async function testRelay(){const origin=documentOrigin();const result=await fetch(origin+'/healthz',{signal:AbortSignal.timeout(5000),credentials:'omit'});if(!result.ok)throw Error('Document service unavailable.');return 'Document service is ready. Press Open to load a document.';}
export function warmWorkspace(){return Promise.resolve(false);}
