import assert from 'node:assert/strict';
import {arithmetic} from '../scripture/expression.mjs';
for(const [input,expected,x]of [['2+3*4',14],['(2+3)*4',20],['2^3^2',512],['-2^2',-4],['2**-2',0.25],['2x+3',11,4],['sqrt(16)+abs(-2)',6],['2(3+4)',14],['3%2',1],['sin(pi/2)',1],['2e3+1',2001],['.5+.25',0.75]])assert.equal(arithmetic(input,x),expected,input);
for(const input of ['globalThis.x=1','constructor(1)','1;2','Math.random()','(1+2','1 2','sqrt(1,2)',''])assert.throws(()=>arithmetic(input),undefined,input);
console.log('PASS arithmetic without code execution: precedence, powers, signed values, implicit multiplication, functions, variables and rejected JavaScript');
