import {createServer as createHttpServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createServer} from './server.mjs';
import {assets} from './assets.mjs';

export function application(options = {}) {
  const network = createServer(options);
  const serve = assets(options.assetDirectory);
  const server = createHttpServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if(url.pathname==='/healthz'){
      response.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'});
      response.end(JSON.stringify({ok:true,service:'document'}));
      return;
    }
    try {
      await serve(request,response,url.pathname);
    } catch { response.writeHead(503); response.end('Build the document application first'); }
  });
  server.on('upgrade', (request, socket, head) => { void network.upgrade(request, socket, head); });
  server.on('close', () => network.close());
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = application();
  server.listen(Number(process.env.PORT || 8082), '127.0.0.1', () => console.log('Document window: http://localhost:' + server.address().port));
}

