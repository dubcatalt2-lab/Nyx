// Narrow corrections for verified typos in publicly mirrored game loaders.
// Other scripts and binary resources are passed through byte for byte.
import {createBrotliDecompress} from 'node:zlib';

function resourceUrl(url) {
  if(['raw.githubusercontent.com','rawcdn.githack.com','raw.githack.com'].includes(url.hostname) && url.pathname.startsWith('/genizy/assets/main/papery-planes/'))
    return new URL('https://cdn.jsdelivr.net/gh/genizy/assets@main/papery-planes/'+url.pathname.split('/papery-planes/')[1]+url.search);
  return url;
}

export function gameResourceEdit(url, prefix) {
  url=resourceUrl(url);
  if (url.hostname !== 'cdn.jsdelivr.net') return null;
  if (/^\/gh\/genizy\/assets@[^/]+\/papery-planes\/(?:master-loader|UnityLoader\.2019\.1)\.js$/.test(url.pathname)) return body=>repairGameResource(url,body);
  if (/^\/gh\/(?:bubbls\/fnf-mods@[^/]+\/alternated\/PsychEngine\.js|waycrosspublicmedia\/fnf(?:@[^/]+)?\/qt\/QT\.js)$/.test(url.pathname)) return body=>repairGameResource(url,body);
  if (/^\/gh\/freebuisness\/assets@[^/]+\/116\/Build\/bike\.[\w.]+\.unityweb$/.test(url.pathname)
    && prefix.subarray(0,64).includes(Buffer.from('UnityWeb Compressed Content (brotli)')))
    return {stream: () => createBrotliDecompress()};
  if (/^\/gh\/(?:bubbls\/youtube-playables@[^/]+\/aquapark-io\/main\.js|bubbls\/dosbox(?:@[^/]+)?\/js\/loader\.js|bubbls\/fnf-mods@[^/]+\/(?:rev-mixed\/PsychEngine\.js|imposter-v4(?:%20| )copy\/VSImpostor\.js)|freebuisness\/assets@[^/]+\/116\/Build\/bike1\.loader\.js)$/.test(url.pathname))
    return body => repairGameResource(url, body);
  return null;
}

export function repairGameResource(url, body) {
  url=resourceUrl(url);
  if(url.hostname!=='cdn.jsdelivr.net')return body;
  if(/^\/gh\/genizy\/assets@[^/]+\/papery-planes\/master-loader\.js$/.test(url.pathname))return Buffer.from(body.toString('utf8').replace(';poki-sdk-core.js',';'));
  if(/^\/gh\/genizy\/assets@[^/]+\/papery-planes\/UnityLoader\.2019\.1\.js$/.test(url.pathname))return Buffer.from(body.toString('utf8').replace('o=n.split("/Build/")[1];o=o.split("?")[0]','o=n.split("/Build/")[1]||n.split("/").pop();o=o.split("?")[0]'));
  if(/^\/gh\/(?:bubbls\/fnf-mods@[^/]+\/alternated\/PsychEngine\.js|waycrosspublicmedia\/fnf(?:@[^/]+)?\/qt\/QT\.js)$/.test(url.pathname))return Buffer.from(body.toString('utf8').replace(/this\[(_0x[0-9A-Fa-f]+)\[7\]\]\[\1\[6\]\]/g,'(location.protocol==="about:"?document.baseURI:location.href)'));
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
  // Marked bike Unity binaries are decoded by gameResourceEdit's async stream.
  if(/^\/gh\/freebuisness\/assets@[^/]+\/116\/Build\/bike1\.loader\.js$/.test(url.pathname)) {
    return Buffer.from(body.toString('utf8')
      .replace(/(["']) +(\.{1,2}\/[^"'\r\n]+|decompress\.js)\1/g,'$1$2$1')
      .replaceAll('document.create("script")','document.createElement("script")'));
  }
  return body;
}
