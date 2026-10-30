import {privateSourcePath} from './public-assets.mjs';
export const resourcePaths=['/assets/*','/reading-*','/math-*','/gn-math-*','/gms-studies-*','/reds-misc-*','/zengs-assets/*','/api/nyxify/cover'];
export const resourceAliasPattern='^/(?:[^/]+/)*@r[0-9a-f]+![.](?:js|mjs|css|wasm|json|svg|webp)$';
export const resourceExcludedPrefixes=['/apps/chat/','/api/','/socket.io/','/resources/','/cloud/','/download/','/p8d31e6/','/4otig/','/~/','/service/','/proxy/'];
const alias=new RegExp(resourceAliasPattern);
export function isResourceRequest(req){
 if(!['GET','HEAD','OPTIONS'].includes(req.method))return false;
 let path;try{path=new URL(req.url,'http://localhost').pathname;}catch{return false;}
 if(privateSourcePath(path))return false;
 if(resourcePaths.some(pattern=>pattern.endsWith('*')?path.startsWith(pattern.slice(0,-1)):path===pattern))return true;
 return !resourceExcludedPrefixes.some(prefix=>path.startsWith(prefix))&&alias.test(path);
}
