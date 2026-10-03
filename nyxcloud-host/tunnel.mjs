import {spawn} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {join} from 'node:path';

// The dedicated SSH identity can only listen on the VPS loopback VM port.
// No remote shell, desktop-input injection, ngrok, or public VNC listener.
export function startCloudTunnel(root,config){
  let child,timer,stopped=false,attempt=0;
  const log=text=>appendFileSync(join(root,'cloud-tunnel.log'),new Date().toISOString()+' '+text+'\n');
  const start=()=>{
    if(stopped)return;
    child=spawn('ssh.exe',['-N','-T','-i',join(root,'cloud-tunnel-key'),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ExitOnForwardFailure=yes','-o','ConnectTimeout=10','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3','-R','127.0.0.1:15990:127.0.0.1:5990','nyxcloud-tunnel@'+config.host],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    let error='';child.stderr.on('data',data=>{error=(error+data.toString()).slice(-1500);});
    child.on('error',()=>{log('SSH launch failed.');});
    const stable=setTimeout(()=>{attempt=0;log('Encrypted VM tunnel running.');},30000);
    child.on('close',code=>{clearTimeout(stable);if(stopped)return;log('Tunnel ended ('+code+'). '+error.trim());timer=setTimeout(start,Math.min(30000,1000*2**Math.min(attempt++,5)));});
  };
  start();return {close(){stopped=true;clearTimeout(timer);child?.kill();}};
}
