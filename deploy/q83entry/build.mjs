import obfuscator from 'javascript-obfuscator';
import {readFileSync, writeFileSync} from 'node:fs';
const source = readFileSync(new URL('client.js', import.meta.url), 'utf8');
const result = obfuscator.obfuscate(source, {
  compact: false,
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 1,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: true,
  splitStringsChunkLength: 6,
  sourceMap: false
});
writeFileSync(new URL('q19.js', import.meta.url), result.getObfuscatedCode());
