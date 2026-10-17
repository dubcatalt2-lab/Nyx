import {readFile,writeFile} from 'node:fs/promises';

// Keep source artwork intact. Only change APNG playback metadata in runtime copies.
export function loopingApng(original){
  const bytes=Buffer.from(original);
  for(let offset=8;offset+12<=bytes.length;){
    const length=bytes.readUInt32BE(offset),end=offset+12+length;
    if(end>bytes.length)throw Error('Invalid PNG chunk');
    if(bytes.toString('ascii',offset+4,offset+8)==='acTL'){
      if(length!==8)throw Error('Invalid APNG animation control');
      if(bytes.readUInt32BE(offset+12)===0)return null;
      bytes.writeUInt32BE(0,offset+12);
      let crc=0xffffffff;
      for(const value of bytes.subarray(offset+4,offset+8+length)){
        crc^=value;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
      }
      bytes.writeUInt32BE((crc^0xffffffff)>>>0,offset+8+length);
      return bytes;
    }
    offset=end;
  }
  return null;
}

const path='assets/profile/effects/catalog.json';
const items=JSON.parse(await readFile(path,'utf8'));
let css=await readFile('css/profile-effects.css','utf8'),count=0;
for(const item of items){
  const loop=loopingApng(await readFile('.'+item.path));
  if(!loop)continue;
  item.loopPath=item.path.replace(/\.png$/,'-loop.png');
  await writeFile('.'+item.loopPath,loop);
  css=css.replace(`url("${item.path}")`,`url("${item.loopPath}")`);
  count++;
}
await writeFile(path,JSON.stringify(items,null,2)+'\n');
await writeFile('css/profile-effects.css',css);
console.log(`Prepared ${count} looping APNG copies; original frames and source files preserved.`);
