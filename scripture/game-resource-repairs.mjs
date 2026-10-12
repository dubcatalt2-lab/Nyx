// Narrow corrections for verified typos in publicly mirrored game loaders.
// Other scripts and binary resources are passed through byte for byte.
import {createBrotliDecompress} from 'node:zlib';

import {normalizeGameCdnUrl} from '../relics/games/game-cdn.js';

function resourcePath(value) {
  const url=normalizeGameCdnUrl(value);
  if(!url||!['raw.githubusercontent.com','rawcdn.githack.com','raw.githack.com'].includes(url.hostname))return '';
  const match=url.pathname.match(/^\/([^/]+)\/([^/]+)\/([^/]+)(\/.*)$/);
  return match?'/gh/'+match[1]+'/'+match[2]+'@'+match[3]+match[4]:'';
}

export function gameResourceEdit(url, prefix) {
  const path=resourcePath(url);
  if (!path) return null;
  if (/^\/gh\/genizy\/assets@[^/]+\/papery-planes\/(?:master-loader|UnityLoader\.2019\.1)\.js$/.test(path)) return body=>repairGameResource(url,body);
  if (/^\/gh\/(?:bubbls\/fnf-mods@[^/]+\/alternated\/PsychEngine\.js|waycrosspublicmedia\/fnf(?:@[^/]+)?\/qt\/QT\.js)$/.test(path)) return body=>repairGameResource(url,body);
  if (/^\/gh\/freebuisness\/assets@[^/]+\/116\/Build\/bike\.[\w.]+\.unityweb$/.test(path)
    && prefix.subarray(0,64).includes(Buffer.from('UnityWeb Compressed Content (brotli)')))
    return {stream: () => createBrotliDecompress()};
  if (/^\/gh\/(?:bubbls\/youtube-playables@[^/]+\/aquapark-io\/main\.js|bubbls\/dosbox(?:@[^/]+)?\/js\/loader\.js|bubbls\/fnf-mods@[^/]+\/(?:rev-mixed\/PsychEngine\.js|imposter-v4(?:%20| )copy\/VSImpostor\.js)|freebuisness\/assets@[^/]+\/116\/Build\/bike1\.loader\.js)$/.test(path))
    return body => repairGameResource(url, body);
  return null;
}

export function repairGameResource(url, body) {
  const path=resourcePath(url);
  if(!path)return body;
  if(/^\/gh\/genizy\/assets@[^/]+\/papery-planes\/master-loader\.js$/.test(path))return Buffer.from(body.toString('utf8').replace(';poki-sdk-core.js',';'));
  if(/^\/gh\/genizy\/assets@[^/]+\/papery-planes\/UnityLoader\.2019\.1\.js$/.test(path))return Buffer.from(body.toString('utf8').replace('o=n.split("/Build/")[1];o=o.split("?")[0]','o=n.split("/Build/")[1]||n.split("/").pop();o=o.split("?")[0]'));
  if(/^\/gh\/(?:bubbls\/fnf-mods@[^/]+\/alternated\/PsychEngine\.js|waycrosspublicmedia\/fnf(?:@[^/]+)?\/qt\/QT\.js)$/.test(path))return Buffer.from(body.toString('utf8').replace(/this\[(_0x[0-9A-Fa-f]+)\[7\]\]\[\1\[6\]\]/g,'(location.protocol==="about:"?document.baseURI:location.href)'));
  // The Playables export reads this flag before the first click but declares it
  // under a different, unused name. Keep the original start-button behavior.
  if(/^\/gh\/bubbls\/youtube-playables@[^/]+\/aquapark-io\/main\.js$/.test(path))
    return Buffer.from(body.toString('utf8').replace('var clickedFake = false;','var playBtnClicked = false;'));
  // This DOS loader never initializes its in-memory fallback when IndexedDB is
  // unavailable, so its promise chain silently stops before loading the emulator.
  if(/^\/gh\/bubbls\/dosbox(?:@[^/]+)?\/js\/loader\.js$/.test(path))
    return Buffer.from(body.toString('utf8').replace('var inMemoryFS = new BrowserFS.FileSystem.InMemory();','var inMemoryFS = new BrowserFS.FileSystem.InMemory(), deltaFS = inMemoryFS;'));
  // These Lime exports parse location.href as an HTTP URL, which throws for
  // about:srcdoc. Resolve their URL inspection against the actual asset base.
  if(/^\/gh\/bubbls\/fnf-mods@[^/]+\/rev-mixed\/PsychEngine\.js$/.test(path))
    return Buffer.from(body.toString('utf8').replace(/this\[(_0x[0-9A-Fa-f]+)\[7\]\]\[\1\[6\]\]/g,'(location.protocol==="about:"?document.baseURI:location.href)'));
  if(/^\/gh\/bubbls\/fnf-mods@[^/]+\/imposter-v4(?:%20| )copy\/VSImpostor\.js$/.test(path))
    return Buffer.from(body.toString('utf8').replaceAll('this[a[7]][a[6]]','(location.protocol==="about:"?document.baseURI:location.href)'));
  // Marked bike Unity binaries are decoded by gameResourceEdit's async stream.
  if(/^\/gh\/freebuisness\/assets@[^/]+\/116\/Build\/bike1\.loader\.js$/.test(path)) {
    return Buffer.from(body.toString('utf8')
      .replace(/(["']) +(\.{1,2}\/[^"'\r\n]+|decompress\.js)\1/g,'$1$2$1')
      .replaceAll('document.create("script")','document.createElement("script")'));
  }
  return body;
}
