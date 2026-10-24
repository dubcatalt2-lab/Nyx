import assert from 'node:assert/strict';
import vm from 'node:vm';
import {parse} from 'acorn';
import {readFileSync} from 'node:fs';
const source=readFileSync('apps/chat/app.js','utf8'),ast=parse(source,{ecmaVersion:'latest',sourceType:'module'}),functions=new Map();
function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration')functions.set(node.id.name,source.slice(node.start,node.end));for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}walk(ast);
let now=100000,settings={},sent=[];const storage=new Map();
const context=vm.createContext({Date:{now:()=>now},localStorage:{getItem:key=>storage.get(key)},social:{muted:uid=>uid==='ignored'},state:{me:{uid:'alice'},notifiedDm:new Set(),lastRead:{}},window:{parent:{postMessage:value=>sent.push(value)}},location:{origin:'https://fixture.invalid'},renderChannels(){}});
vm.runInContext('const q63a9=new Map();let lastNotificationAt=0;'+functions.get('notificationPreferences')+functions.get('playChatPing'),context);
function prefs(value){settings={...value};storage.set('nyx-chat-notifications-v1:alice',JSON.stringify(value));}
let count=0;function ping(kind='chat',uid='bob',scope='general'){context.playChatPing(`${kind==='dm'?'dm':'message'}:${scope}:${++count}`,kind,{uid});}
prefs({interval:0});ping();assert.equal(sent.length,1);ping('mention','ignored');assert.equal(sent.length,1);
prefs({interval:0,people:{bob:'Blank name'}});ping('mention');ping('dm');assert.equal(sent.length,1);
prefs({interval:0,scopes:{'channel:general':true}});ping('mention');assert.equal(sent.length,1);ping('mention','bob','other');assert.equal(sent.length,2);
prefs({interval:0,mode:'mentions'});ping();assert.equal(sent.length,2);ping('mention');ping('dm');assert.equal(sent.length,4);
prefs({mode:'off'});ping('mention');ping('dm');assert.equal(sent.length,4);
prefs({interval:5});now+=5000;ping();ping();ping('mention');assert.equal(sent.length,5);now+=5000;ping('dm');assert.equal(sent.length,6);
context.state.me.uid='different-account';now+=5000;ping();assert.equal(sent.length,7);
console.log('PASS actual notification gating: ignored/muted IDs, scopes, mention/DM mode, off, spam spacing, account isolation');
