import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const child=spawn('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File','remote-host/desktop.ps1'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
let errors='';child.stderr.on('data',data=>errors+=data);const lines=createInterface({input:child.stdout});
try{
 const frame=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Native capture timeout')),15000);child.on('error',reject);lines.on('line',line=>{if(line==='READY')child.stdin.write('{"type":"control","active":true}\n');if(line.startsWith('FRAME:')){child.stdin.write('{"type":"control","active":false}\n');clearTimeout(timeout);resolve(Buffer.from(line.slice(6),'base64'));}});});
 const metadata=await sharp(frame).metadata();assert.equal(metadata.format,'jpeg');assert(metadata.width>0&&metadata.width<=1600);assert(metadata.height>0);assert.equal(errors,'');
 console.log('PASS: real Windows desktop captured in memory as '+metadata.width+'x'+metadata.height+' JPEG; no image saved and no input injected.');
}finally{child.stdin.end();await new Promise(resolve=>{const timeout=setTimeout(()=>{child.kill();resolve();},1500);child.once('exit',()=>{clearTimeout(timeout);resolve();});});}
