import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const scope={};vm.runInNewContext(readFileSync('js/ai-model-search.js','utf8'),scope);
const models=[
 {id:'openai/best',label:'Best text',text:true,vision:true,catalogRank:0,codingRank:1},
 {id:'vendor/coder',label:'Coder',text:true,reasoning:true,catalogRank:9,codingRank:0},
 {id:'google/image',label:'Image model',text:false,imageGeneration:true,outputModalities:['image'],catalogRank:4},
 {id:'vendor/video',label:'Movie',text:false,outputModalities:['video'],catalogRank:6},
 {id:'vendor/voice',label:'Speech',text:false,outputModalities:['speech'],catalogRank:8},
 {id:'vendor/embed',label:'Embeddings',text:false,outputModalities:['embeddings']}
];
const search=query=>Array.from(scope.NyxModelSearch.search(models,query,x=>({label:x.id.split('/')[0]})),x=>x.id);
assert.deepEqual(search('generate images'),['google/image']);
assert.deepEqual(search('image generator'),['google/image']);
assert.deepEqual(search('generate video'),['vendor/video']);
assert.deepEqual(search('analyze image'),['openai/best']);
assert.deepEqual(search('best for coding'),['vendor/coder','openai/best']);
assert.deepEqual(search('google image'),['google/image']);
assert.deepEqual(search('audio'),['vendor/voice']);
assert.deepEqual(search('embeddings'),['vendor/embed']);
assert.deepEqual(search('math'),['vendor/coder']);
assert.deepEqual(search('no-match'),[]);
console.log('PASS capability keywords, combined company queries, generation versus vision, and ranking');
