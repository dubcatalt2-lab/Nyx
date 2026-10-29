import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile('js/direct-s3-cover.js','utf8');
for(const [search,expected] of [['','/studies.html'],['?returnTo=%2Fai.html','/ai.html'],['?returnTo=https://example.org/','/studies.html'],['?returnTo=%2Findex.html','/studies.html']]){
 let timer,delay,result;const origin='https://history-classroom.s3.us-east-1.amazonaws.com';
 vm.runInNewContext(source,{URL,URLSearchParams,location:{origin,search,hash:'#saved',replace:value=>{result=value;}},setTimeout:(callback,ms)=>{timer=callback;delay=ms;}});
 assert.equal(delay,1012);assert.equal(result,undefined);timer();assert.equal(result,origin+expected+'#saved');
}
console.log('PASS S3 cover delay, same-origin return destination, root-loop rejection and fragment retention.');
