// Narrow corrections for verified typos in publicly mirrored game loaders.
// Other scripts and binary resources are passed through byte for byte.
import {brotliDecompressSync} from 'node:zlib';

export function repairGameResource(url, body) {
  if(url.hostname!=='cdn.jsdelivr.net')return body;
  // This mirror serves Brotli Unity files without content encoding, and its
  // copied JS decompressor returns corrupt output. Decode the marked files here.
  if(/^\/gh\/freebuisness\/assets@[^/]+\/116\/Build\/bike\.[\w.]+\.unityweb$/.test(url.pathname)
    && body.subarray(0,64).includes(Buffer.from('UnityWeb Compressed Content (brotli)')))return brotliDecompressSync(body);
  if(/^\/gh\/freebuisness\/assets@[^/]+\/116\/Build\/bike1\.loader\.js$/.test(url.pathname)) {
    return Buffer.from(body.toString('utf8')
      .replace(/(["']) +(\.{1,2}\/[^"'\r\n]+|decompress\.js)\1/g,'$1$2$1')
      .replaceAll('document.create("script")','document.createElement("script")'));
  }
  return body;
}
