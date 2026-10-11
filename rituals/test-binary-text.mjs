import assert from 'node:assert/strict';
import {binaryText} from '../scripture/binary-text.mjs';
import {replaceBinaryCalls} from './build-native-values.mjs';
import {randomBytes} from 'node:crypto';
for(let length=0;length<200;length++){
  const data=randomBytes(length),text=data.toString('base64');
  for(const input of [text,text.replace(/=+$/,''),text.replace(/.{1,13}/g,'$&\n')])assert.equal(binaryText(input),atob(input));
}
assert.equal(binaryText(randomBytes(50000).toString('base64')).length,50000);
for(const input of ['A','A=','A===','A!==','AAAA=','é','AA\u00a0AA'])assert.throws(()=>binaryText(input),{name:'InvalidCharacterError'});
assert.equal(replaceBinaryCalls('atob(x);window.atob(y);self["atob"](z);other.atob(x)','script').count,3);
assert.equal(replaceBinaryCalls('function f(atob){atob(x)}function g(window){window.atob(x)};atob(x)','script').count,1);
assert.equal(replaceBinaryCalls('function f(){atob(x);var atob=custom} {let atob=custom;atob(x)};atob(x)','script').count,1);
console.log('PASS binary decoding: padded/unpadded data, ASCII whitespace, invalid input and 50 KB payload; AST replacement preserves unrelated methods');
