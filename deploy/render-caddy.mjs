import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const valid=value=>/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
export function renderCaddy(template,domain,{turnDomain='',shared443=false}={}) {
  if(!valid(domain)||turnDomain&&!valid(turnDomain)||shared443&&!turnDomain)throw new Error('Invalid Caddy domain configuration.');
  let result=template.replaceAll('__NYX_DOMAIN__',domain);
  if(shared443){
    result=result.replace('{','{\n\thttps_port 8443');
    result=result.replace('\tservers {',`\tservers {
        protocols h1 h2
        listener_wrappers {
            proxy_protocol {
                timeout 2s
                allow 127.0.0.1/32 ::1/128
                fallback_policy reject
            }
            tls
        }`);
    result=result.replace(`${domain} {`,`${domain} {\n\tbind 127.0.0.1`);
    result=result.replace('https:// {','https:// {\n\tbind 127.0.0.1');
  }
  if(turnDomain)result+=`\nhttp://${turnDomain} {
    handle /.well-known/acme-challenge/* {
        root * /var/lib/nyx-turn-acme
        file_server
    }
    respond 404
}\n`;
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [domain,target]=process.argv.slice(2);
  if(!target)throw new Error('Usage: node deploy/render-caddy.mjs DOMAIN OUTPUT');
  const turnDomain=await readFile('/etc/nyx/turn-domain','utf8').then(s=>s.trim()).catch(e=>{if(e.code==='ENOENT')return '';throw e;});
  const shared443=await readFile('/etc/nyx/turn-shared-443','utf8').then(s=>s.trim()==='1').catch(e=>{if(e.code==='ENOENT')return false;throw e;});
  const template=await readFile(new URL('./caddy/nyx.Caddyfile.template',import.meta.url),'utf8');
  await writeFile(target,renderCaddy(template,domain,{turnDomain,shared443}));
}
