import {createServer as httpServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {fetch} from 'undici';
import {connections} from './connections.mjs';
import {assets} from './assets.mjs';
import {createServer,destination,requestHeaders} from './server.mjs';
import {partition,partitionSuffix} from './partition.mjs';
import {source} from './address.mjs';
import {content} from './transform.mjs';
import {sessionStore} from './session-store.mjs';
import {limits} from './frames.mjs';
import {compiler} from './compiler.mjs';

export function isolatedApplication({suffix=process.env.DOCUMENT_SUFFIX, directory=process.env.DOCUMENT_STATE_DIR, resolveDestination=destination, assetDirectory,protocol='https:'}={}){
  if(!suffix||!directory||!/^[a-z0-9.-]+$/.test(suffix))throw new Error('Document hosting configuration missing');
  const sessions=sessionStore(directory),known=new Map(),tickets=new Map(),compilation=compiler(),pool=connections();
  const serve=assets(assetDirectory,{isolated:true});
  function hostOf(request){return new URL(protocol+'//'+request.headers.host).hostname;}
  function targetFor(request,value){
    const target=new URL(value);
    if(target.protocol==='ws:')target.protocol='http:';
    if(target.protocol==='wss:')target.protocol='https:';
    const host=hostOf(request);
    if(partition(target.origin,suffix)!==host)throw new Error('Document origin mismatch');
    known.set(host,target.origin);
    if(known.size>10000)known.delete(known.keys().next().value);
    return target;
  }
  function originalOrigin(value){
    if(!value)return '';
    if(value==='null')return 'null';
    const url=new URL(value);
    const prefix=url.pathname.match(/^\/content\/[a-z0-9-]+\//i)?.[0];
    if(prefix){const target=new URL(source(url.href,prefix));if(partition(target.origin,suffix)===url.hostname)return target.origin;}
    return known.get(url.hostname)||'';
  }
  async function prepare(request,metadata){
    const target=targetFor(request,metadata.url);
    const supplied=new Headers(metadata.headers);
    const token=supplied.get('x-document-access');
    let session;
    if(token){
      const ticket=tickets.get(token);tickets.delete(token);
      if(!ticket||ticket.expires<Date.now()||ticket.host!==request.headers.host||request.headers.origin!==protocol+'//'+request.headers.host)throw new Error('Document access expired');
      session=ticket.session;
    }else session=await sessions.get(request.headers.cookie,false);
    const origin=originalOrigin(request.headers.origin)||originalOrigin(request.headers.referer)||target.origin;
    const omit=supplied.get('x-document-credentials')==='omit';
    const headers=[...supplied].filter(([name])=>!['cookie','origin','referer','authorization'].includes(name)&&!name.startsWith('x-document-'));
    if(supplied.has('authorization'))headers.push(['authorization',supplied.get('authorization')]);
    if(request.headers.origin||supplied.has('origin'))headers.push(['origin',origin]);
    const referer=supplied.get('referer');
    if(referer){try{const url=new URL(referer);if(['http:','https:'].includes(url.protocol)&&url.origin===origin)headers.push(['referer',url.href]);}catch{}}
    if(!omit){const value=session.cookies.header(target.href,origin===target.origin?'strict':request.headers['sec-fetch-mode']==='navigate'&&metadata.method==='GET'?'lax':'none');if(value)headers.push(['cookie',value]);}
    return {headers,session,target,async receive(response){
      if(!omit&&session.cookies.receive(target.href,response.headers.getSetCookie().map(value=>['set-cookie',value])))await session.save();
      return [['x-document-cookies',JSON.stringify(session.cookies.snapshot(target.href))]];
    }};
  }
  const network=createServer({resolveDestination,prepare,upstreamConnections:pool,allowed:request=>partitionSuffix(hostOf(request))===suffix&&partitionSuffix(new URL(request.headers.origin).hostname)===suffix,allowCrossOrigin:true,observe(event,value){
    if(event==='failure')console.warn(JSON.stringify({event:'document-transport-error',aborted:value.aborted,kind:/^[A-Z0-9_]{1,64}$/.test(value.code||'')?value.code:'REQUEST_FAILED'}));
  }});
  let active=0;
  const handler=async(request,response)=>{
    if(active>=128){response.writeHead(503,{'retry-after':'2'}).end('Document service busy');return;}
    active++;
    let connection,stage='request';
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),45000);
    response.once('close',()=>controller.abort());
    try{
      const host=hostOf(request),url=new URL(request.url,protocol+'//'+request.headers.host);
      if(host!=='documents.'+suffix&&partitionSuffix(host)!==suffix){response.writeHead(421).end();return;}
      response.setHeader('Origin-Agent-Cluster','?1');
      response.setHeader('Referrer-Policy','unsafe-url');
      if(url.pathname==='/healthz'){response.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'}).end('{"ok":true,"service":"document"}');return;}
      if(url.pathname==='/api/config'){
        response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({suffix}));return;
      }
      if(url.pathname==='/api/ticket'){
        if(request.method!=='POST'||request.headers.origin!==url.origin||partitionSuffix(host)!==suffix){response.writeHead(403).end();return;}
        const session=await sessions.get(request.headers.cookie,false);
        for(const [key,value]of tickets)if(value.expires<Date.now())tickets.delete(key);
        if(tickets.size>=1024){response.writeHead(503,{'retry-after':'2'}).end();return;}
        const token=randomBytes(32).toString('hex');
        tickets.set(token,{session,host:request.headers.host,expires:Date.now()+30000});
        response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({token}));return;
      }
      if(url.pathname==='/api/cookies'){
        if(request.method!=='POST'||request.headers.origin!==url.origin){response.writeHead(403).end();return;}
        const body=await readBody(request,8192),data=JSON.parse(body.toString('utf8'));
        const target=targetFor(request,data.url),session=await sessions.get(request.headers.cookie,false);
        session.cookies.set(target.href,data.value);await session.save();
        response.writeHead(204).end();return;
      }
      const prefix=url.pathname.match(/^\/content\/[a-z0-9-]+\//i)?.[0];
      if(!prefix){
        if(url.pathname==='/'){
          const session=await sessions.get(request.headers.cookie);
          if(session.fresh)response.setHeader('Set-Cookie',sessionCookie(session.id,suffix));
        }
        await serve(request,response,url.pathname);return;
      }
      const workerEntry=url.searchParams.has('document-mode');
      const mode=url.searchParams.get('document-mode')==='module'?'module':'classic';
      url.searchParams.delete('document-mode');url.searchParams.delete('document-ready-at');
      const target=targetFor(request,source(url.href,prefix));
      const session=await sessions.get(request.headers.cookie);
      if(session.fresh){response.setHeader('Set-Cookie',sessionCookie(session.id,suffix));request.headers.cookie=(request.headers.cookie||'')+'; __Secure_document='+session.id;}
      const incoming=[...new Headers(request.headers)].filter(([name])=>!['host','cookie'].includes(name));
      stage='authorization';
      const policy=await prepare(request,{url:target.href,method:request.method,headers:incoming});
      stage='destination';
      const resolved=await resolveDestination(target.href);
      connection=pool.acquire(resolved);
      const body=['GET','HEAD'].includes(request.method)?undefined:await readBody(request,limits.upload);
      stage='upstream';
      const upstream=await fetch(resolved.url,{dispatcher:connection.dispatcher,method:request.method,headers:requestHeaders(policy.headers),body,redirect:'manual',signal:controller.signal});
      await policy.receive(upstream);
      if(/^text\/event-stream(?:;|$)/i.test(upstream.headers.get('content-type')||''))clearTimeout(timeout);
      const destination=request.headers['sec-fetch-dest']||'';
      const broker=new URL(url.origin);broker.hostname='documents.'+suffix;
      let length=0;
      const bounded=upstream.body?.pipeThrough(new TransformStream({transform(bytes,output){length+=bytes.length;if(length>limits.body)throw new Error('Document size limit');output.enqueue(bytes);}}));
      stage='transform';
      const result=await content(new Response(bounded,{status:upstream.status,headers:upstream.headers}),target.href,url.origin+prefix,destination,mode,{isolated:true,workerEntry,broker:broker.origin,readyAt:Date.now(),cookies:JSON.stringify(session.cookies.snapshot(target.href)),compile:compilation.compile});
      for(const [name,value]of result.headers){
        if(['set-cookie','content-encoding','transfer-encoding','connection','x-document-cookies','origin-agent-cluster','referrer-policy'].includes(name))continue;
        response.setHeader(name,value);
      }
      response.statusCode=result.status;
      if(result.body&&request.method!=='HEAD'){
        await new Promise((resolve,reject)=>{const stream=Readable.fromWeb(result.body);stream.on('error',reject);response.on('finish',resolve);response.on('close',resolve);stream.pipe(response);controller.signal.addEventListener('abort',()=>stream.destroy(),{once:true});});
      }else response.end();
    }catch(error){
      const knownErrors=['Document origin mismatch','Document session missing','Document session capacity','Document cookie storage limit','Request limit','Document size limit'];
      console.warn(JSON.stringify({event:'document-request-error',route:request.url?.split('?')[0]==='/api/cookies'?'cookies':'document',kind:knownErrors.includes(error.message)?error.message:error.code||error.name}));
      if(!response.headersSent)response.writeHead(502,{'content-type':'text/plain','cache-control':'no-store','x-document-failure':stage}).end('Document request failed');else response.destroy();
    }
    finally{clearTimeout(timeout);active--;controller.abort();connection?.release();}
  };
  const server=httpServer(handler);
  server.on('upgrade',(request,socket,head)=>void network.upgrade(request,socket,head));
  let closing;
  const close=()=>closing||=Promise.resolve().then(()=>{network.close();return Promise.all([compilation.close(),pool.close()]);});
  server.on('close',()=>void close());
  return {server,handler,upgrade:(...args)=>network.upgrade(...args),close};
}
function sessionCookie(id,suffix){
  // Browsers reject a parent-domain cookie on the reserved localhost suffix.
  return '__Secure_document='+id+(suffix==='localhost'?'':'; Domain='+suffix)+'; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=None; Partitioned';
}
async function readBody(request,limit){const chunks=[];let size=0;for await(const bytes of request){size+=bytes.length;if(size>limit)throw new Error('Request limit');chunks.push(bytes);}return Buffer.concat(chunks);}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  isolatedApplication().server.listen(Number(process.env.PORT||8082),'127.0.0.1',()=>console.log('Document service listening'));
}
