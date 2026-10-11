export function binaryText(value) {
  let text=String(value).replace(/[\t\n\f\r ]/g,'');
  if(text.length%4===0)text=text.replace(/={1,2}$/,'');
  if(text.length%4===1||/[^A-Za-z0-9+/]/.test(text))throw new DOMException('Invalid base64 data','InvalidCharacterError');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes=new Uint8Array(Math.floor(text.length*6/8));
  let bits=0,valueBits=0,offset=0;
  for(const character of text){
    valueBits=(valueBits<<6)|alphabet.indexOf(character);
    bits+=6;
    if(bits>=8){bits-=8;bytes[offset++]=(valueBits>>bits)&255;}
  }
  let result='';
  for(let start=0;start<bytes.length;start+=8192)result+=String.fromCharCode(...bytes.subarray(start,start+8192));
  return result;
}
