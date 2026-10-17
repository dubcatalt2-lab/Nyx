import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync('script.js','utf8');
const start=source.indexOf('  const nyxMentionIds=new Set();');
const end=source.indexOf('  setInterval(()=>void pollNyxMentions()',start);
let events=[],revision=1,calls=0;
const notices=[];
const context=vm.createContext({document:{hidden:false},AbortSignal,
  nyxFounderSignedInUser:{uid:'me',getIdToken:async()=>'fixture'},
  fetch:async(_url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer fixture');return {ok:true,json:async()=>({events,revision})};},
  toast:(...args)=>notices.push(args)});
vm.runInContext(source.slice(start,end),context);
const event={kind:'message',scopeType:'channel',scopeId:'general',createdAtMs:10,mentionsViewer:true,lastMessageAuthorUid:'other',lastMessageText:'@me hello'};
events=[event];await context.pollNyxMentions();assert.equal(notices.length,0,'First poll establishes cursor without replaying history');
revision=2;events=[{...event,createdAtMs:20}];await context.pollNyxMentions();assert.equal(notices.length,1);assert.match(notices[0][0],/@me hello/);
context.showNyxMention('message:general:20:mention',{sender:'Alex',preview:'duplicate'});assert.equal(notices.length,1,'Socket and shell polling deduplicate');
events=[{...event,mentionsViewer:false},{...event,lastMessageAuthorUid:'me'}];await context.pollNyxMentions();assert.equal(notices.length,1);
context.document.hidden=true;const before=calls;await context.pollNyxMentions();assert.equal(calls,before);
context.document.hidden=false;context.nyxFounderSignedInUser=null;await context.pollNyxMentions();assert.equal(calls,before);
context.nyxFounderSignedInUser={uid:'new-user',getIdToken:async()=>'fixture'};events=[event];await context.pollNyxMentions();assert.equal(notices.length,1,'Account switch resets cursor');
console.log('Shell mentions: cross-page notification, history baseline, self/non-mention filtering, deduplication, visibility and account reset passed.');
