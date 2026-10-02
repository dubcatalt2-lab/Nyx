// Narrow corrections for verified typos in publicly mirrored game loaders.
// Other scripts and binary resources are passed through byte for byte.
import {brotliDecompressSync} from 'node:zlib';

export function repairGameResource(url, body) {
  if(url.hostname!=='cdn.jsdelivr.net')return body;
  // The Playables export reads this flag before the first click but declares it
  // under a different, unused name. Keep the original start-button behavior.
  if(/^\/gh\/bubbls\/youtube-playables@[^/]+\/aquapark-io\/main\.js$/.test(url.pathname))
    return Buffer.from(body.toString('utf8').replace('var clickedFake = false;','var playBtnClicked = false;'));
  // This DOS loader never initializes its in-memory fallback when IndexedDB is
  // unavailable, so its promise chain silently stops before loading the emulator.
  if(/^\/gh\/bubbls\/dosbox(?:@[^/]+)?\/js\/loader\.js$/.test(url.pathname))
    return Buffer.from(body.toString('utf8').replace('var inMemoryFS = new BrowserFS.FileSystem.InMemory();','var inMemoryFS = new BrowserFS.FileSystem.InMemory(), deltaFS = inMemoryFS;'));
  // These Lime exports parse location.href as an HTTP URL, which throws for
  // about:srcdoc. Resolve their URL inspection against the actual asset base.
  if(/^\/gh\/bubbls\/fnf-mods@[^/]+\/rev-mixed\/PsychEngine\.js$/.test(url.pathname))
    return Buffer.from(body.toString('utf8').replace(/this\[(_0x[0-9A-Fa-f]+)\[7\]\]\[\1\[6\]\]/g,'(location.protocol==="about:"?document.baseURI:location.href)'));
  if(/^\/gh\/bubbls\/fnf-mods@[^/]+\/imposter-v4(?:%20| )copy\/VSImpostor\.js$/.test(url.pathname))
    return Buffer.from(body.toString('utf8').replaceAll('this[a[7]][a[6]]','(location.protocol==="about:"?document.baseURI:location.href)'));
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
