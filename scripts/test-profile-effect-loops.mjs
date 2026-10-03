import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import sharp from 'sharp';
const catalog=JSON.parse(readFileSync('assets/profile/effects/catalog.json','utf8'));
function chunks(bytes){const result=[];for(let offset=8;offset<bytes.length;){const n=bytes.readUInt32BE(offset);result.push({type:bytes.toString('ascii',offset+4,offset+8),data:bytes.subarray(offset,offset+n+12)});offset+=n+12;}return result;}
const looping=catalog.filter(item=>item.loopPath);assert.equal(looping.length,13);
for(const item of looping){
 const original=chunks(readFileSync('.'+item.path)),loop=chunks(readFileSync('.'+item.loopPath));assert.equal(original.length,loop.length);
 original.forEach((chunk,i)=>{if(chunk.type==='acTL'){assert.equal(loop[i].data.readUInt32BE(12),0);assert.equal(loop[i].data.readUInt32BE(8),chunk.data.readUInt32BE(8));}else assert.deepEqual(loop[i].data,chunk.data,'Frame data/timing must be unchanged');});
}
const base=process.env.NYX_TEST_BASE_URL||'http://127.0.0.1:8199',browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:650,height:660}});
 await page.goto(base+'/apps/chat/');
 await page.setContent(`<style>body{margin:0;display:flex;background:#101010}.art{width:300px;height:587px;background:#101010 center/contain no-repeat}</style><div class="art" id="once" style="background-image:url('${base}/assets/profile/effects/fx-hyper-aura.png')"></div><div class="art" id="loop" style="background-image:url('${base}/assets/profile/effects/fx-hyper-aura-loop.png')"></div>`);
 await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.art')].map(e=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=getComputedStyle(e).backgroundImage.slice(5,-2);})));});
 await page.waitForTimeout(7100);
 const original=await sharp(await page.locator('#once').screenshot()).stats(),loop=await sharp(await page.locator('#loop').screenshot()).stats();
 assert(original.channels.slice(0,3).every(c=>c.stdev<1),'Original one-shot should finish transparent');
 assert(loop.channels.slice(0,3).some(c=>c.stdev>10),'Loop must still show artwork after the original stops');
 await page.screenshot({path:'.codex-artifacts/profile-loop-after-seven-seconds.png'});
 console.log('PASS 13 infinite-loop copies preserve every frame/timing chunk; owl remains visible beyond original one-shot duration');
}finally{await browser.close();}
