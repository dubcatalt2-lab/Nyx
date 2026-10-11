import {application} from './connection/app.mjs';

const server=application();
server.listen(Number(process.env.DOCUMENT_PORT||8082),process.env.DOCUMENT_HOST||'127.0.0.1');
let stopping=false;
function stop(){
  if(stopping)return;
  stopping=true;
  server.close(()=>process.exit(0));
  server.closeAllConnections();
  setTimeout(()=>process.exit(1),5000).unref();
}
process.once('SIGTERM',stop);
process.once('SIGINT',stop);
if(process.channel)process.once('disconnect',stop);
