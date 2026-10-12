import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {gameSourceStream} from '../scripture/game-intercession-stream.mjs';
const input=Buffer.from('/*音楽*/'+'.'.repeat(8190)+'fetch(`https://cdn.jsdelivr.net/gh/owner/repo@abc/assets/${name}.wasm`);importScripts("https://cdn.jsdelivr.net/npm/@scope/pkg@2/worker.js");'+'.'.repeat(9000));
for(const size of [1,7,4096,8192]){
 const chunks=[];for(let i=0;i<input.length;i+=size)chunks.push(input.subarray(i,i+size));
 const output=[];for await(const bytes of Readable.from(chunks).pipe(gameSourceStream('https://games.test/gn-math-resource')))output.push(bytes);
 const text=Buffer.concat(output).toString('utf8');
 assert(text.startsWith('/*音楽*/'));assert(!text.includes('jsdelivr'));
 assert(text.includes('fetch(`https://games.test/gn-math-resource/https/raw.githack.com/owner/repo/abc/assets/${name}.wasm`)'));
 assert(text.includes('importScripts("https://games.test/gn-math-resource/https/unpkg.com/@scope/pkg@2/worker.js")'));
}
console.log('PASS streamed nested game sources: byte-split URLs and UTF-8, pinned commits/packages, templates and worker imports retained; no CDN target');
