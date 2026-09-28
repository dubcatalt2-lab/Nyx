import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
export async function companionZip(root,{localOrigin}={}){
  if(localOrigin&&!/^http:\/\/localhost:\d{2,5}$/.test(localOrigin))throw new Error('Invalid local preview origin.');
  const parts=[],directory=[];let offset=0;
  for(const file of ['Start-Nyx-Agents.cmd','start.mjs','core.mjs','README.txt']){
    let body=await readFile(join(root,'companion',file));
    if(localOrigin&&file==='start.mjs')body=Buffer.from(body.toString().replace("process.env.NYX_AGENTS_ORIGIN||'https://nook.nyxlearning.org'",'process.env.NYX_AGENTS_ORIGIN||'+JSON.stringify(localOrigin)));
    const name=Buffer.from('Nyx-Agents/'+file),crc=crc32(body),local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);local.writeUInt16LE(name.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    parts.push(local,name,body);directory.push(central,name);offset+=local.length+name.length+body.length;
  }
  const index=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(4,8);end.writeUInt16LE(4,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...parts,index,end]);
}
