import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, statfs, readFile, writeFile, copyFile, chmod, rename, rm, truncate } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

const MB = 1024 ** 2;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const QUALITY = new Set([360, 480, 720]);
const CACHE_NAME = /^[A-Za-z0-9_-]{11}-(360|480|720)\.mp4$/;
export class TubeError extends Error {
  constructor(code, message, status = 503) { super(message); this.code = code; this.status = status; }
}
export function extractionFailure(stderr = '') {
  if (/not a bot|cookies are no longer valid|cookies.*expired|login required/i.test(stderr)) return new TubeError('authentication', 'YouTube login needs checking.');
  if (/private video|members.only|age.restricted|video unavailable|removed|copyright/i.test(stderr)) return new TubeError('video', 'This video is unavailable for native playback.', 422);
  if (/429|too many requests/i.test(stderr)) return new TubeError('rate', 'YouTube is temporarily limiting requests.', 429);
  return new TubeError('service', 'The video service could not complete this request.');
}
export function publicMediaUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.googlevideo.com') || url.username || url.password || (url.port && url.port !== '443')) throw new TubeError('video', 'Unsupported video stream.', 422);
  return url.href;
}
export function mediaChoices(info) {
  if (info.availability !== 'public' || info.is_live || Number(info.age_limit) > 0 || !Number.isFinite(info.duration) || info.duration <= 0) throw new TubeError('video', 'Native playback supports public, non-live videos with a valid duration.', 422);
  const formats = (info.formats || []).filter(f => f.protocol === 'https' && !f.has_drm);
  const audio = formats.filter(f => f.vcodec === 'none' && /^mp4a/.test(f.acodec || '')).sort((a,b) => (b.abr || 0)-(a.abr || 0))[0];
  return [...QUALITY].flatMap(height => {
    const video = formats.filter(f => f.height === height && /^avc1/.test(f.vcodec || '') && f.ext === 'mp4' && (f.acodec !== 'none' || audio)).sort((a,b) => (b.tbr || 0)-(a.tbr || 0))[0];
    if (!video) return [];
    publicMediaUrl(video.url);
    const sound = video.acodec === 'none' ? audio : null;
    if (sound) publicMediaUrl(sound.url);
    return [{ height, video, audio: sound }];
  });
}

export function executeTubeTool(binary, args, { timeout = 30000, signal, maxBytes = 8 * MB } = {}) {
  return new Promise((resolveResult, reject) => {
    let stdout = [], stderr = [], outputBytes = 0, errorBytes = 0, stopped = false;
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    const stop = () => { stopped = true; child.kill('SIGKILL'); };
    const timer = setTimeout(stop, timeout);
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) stop();
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); };
    child.once('error', () => { cleanup(); reject(new TubeError('setup', 'A required video tool is unavailable.')); });
    child.stdout.on('data', chunk => { outputBytes += chunk.length; if (outputBytes > maxBytes) stop(); else stdout.push(chunk); });
    child.stderr.on('data', chunk => { errorBytes += chunk.length; if (errorBytes > 128000) stop(); else stderr.push(chunk); });
    child.once('close', code => {
      cleanup();
      if (stopped) return reject(new TubeError('service', 'Video processing timed out or was stopped.'));
      if (code !== 0) return reject(extractionFailure(Buffer.concat(stderr).toString('utf8')));
      resolveResult(Buffer.concat(stdout).toString('utf8'));
    });
  });
}

export function createTubeBackend(options = {}) {
  const env = options.env || process.env;
  const enabled = env.NYX_YOUTUBE_NATIVE_ENABLED === '1';
  const root = resolve(env.NYX_YOUTUBE_CACHE_DIR || join(tmpdir(), 'nyx-youtube-cache'));
  const cookieFile = env.NYX_YOUTUBE_COOKIES_FILE || '';
  const binary = env.NYX_YTDLP_BIN || (process.platform === 'win32' ? 'yt-dlp' : '/var/lib/nyx/yt-dlp/venv/bin/yt-dlp');
  const ffmpeg = env.NYX_FFMPEG_BIN || 'ffmpeg';
  const cacheLimit = 5 * 1024 * MB, assetLimit = 512 * MB, reserve = 2 * assetLimit + 16 * MB;
  const run = options.execute || executeTubeTool, request = options.fetch || fetch;
  const now = options.now || Date.now;
  const files = new Map(), jobs = new Map(), inflight = new Map(), metadata = new Map(), leases = new Map();
  const health = { state: 'unchecked', authFailures: 0, lastChecked: null, lastSuccess: null, lastError: null };
  let active = null, checkPromise = null, cooldown = 0, checkAfter = 0, closed = false;
  let writes = Promise.resolve();
  const ready = enabled ? initialize() : Promise.resolve();
  ready.catch(() => {});
  async function initialize() {
    await mkdir(root, { recursive: true, mode: 0o700 });
    for (const name of await readdir(root)) {
      const path = join(root, name);
      if (CACHE_NAME.test(name)) {
        const s = await stat(path);
        if (s.isFile() && s.size <= assetLimit + 8 * MB && s.mtimeMs > now() - 6 * 3600000) files.set(name, { path, size: s.size, touched: s.mtimeMs });
        else await rm(path, { force: true });
      } else if (/^work-[a-f0-9-]{36}$/.test(name)) await rm(path, { recursive: true, force: true });
    }
    try {
      const saved = JSON.parse(await readFile(join(root,'health.json'),'utf8'));
      for (const key of ['lastChecked','lastSuccess']) if (typeof saved[key] === 'string' && Number.isFinite(Date.parse(saved[key]))) health[key] = saved[key];
      if (['authentication','service','setup','rate'].includes(saved.lastError)) health.lastError = saved.lastError;
      // A restart cannot declare a stale session healthy.
    } catch { /* First start. */ }
    await evict(0);
  }
  function persist() {
    const snapshot = JSON.stringify(health);
    writes = writes.catch(() => {}).then(async () => { await writeFile(join(root,'health.json.tmp'),snapshot,{mode:0o600}); await rename(join(root,'health.json.tmp'),join(root,'health.json')); });
    writes.catch(() => {});
  }
  function record(error) {
    if (error?.code === 'video' || error?.code === 'busy') return;
    health.lastChecked = new Date(now()).toISOString();
    if (!error) { health.state='working'; health.authFailures=0; health.lastSuccess=health.lastChecked; health.lastError=null; cooldown=0; }
    else {
      health.authFailures = error.code === 'authentication' ? health.authFailures + 1 : 0;
      health.lastError = error.code || 'service';
      health.state = health.authFailures >= 2 ? 'login_required' : error.code === 'setup' ? 'setup_required' : 'trouble';
      cooldown = now() + (error.code === 'authentication' || error.code === 'rate' ? 5 * 60000 : 30000);
    }
    persist();
  }
  async function status() {
    await ready;
    let sessionPresent = false;
    if (cookieFile) { try { const s=await stat(cookieFile); sessionPresent=s.isFile() && s.size>0; } catch {} }
    return { enabled, ...health, sessionPresent, cacheBytes: [...files.values()].reduce((n,f)=>n+f.size,0), cacheLimitBytes:cacheLimit, cachedVideos:files.size, activeJobs:active?1:0, maxJobs:1, maxHeight:720, checkAvailableAt: new Date(Math.max(checkAfter,cooldown)).toISOString() };
  }
  async function evict(required) {
    let size = [...files.values()].reduce((n,f)=>n+f.size,0);
    for (const [name,f] of [...files].sort((a,b)=>a[1].touched-b[1].touched)) {
      if (leases.get(name)) continue;
      if (size+required<=cacheLimit && f.touched>now()-6*3600000) continue;
      await rm(f.path,{force:true}); files.delete(name); size-=f.size;
    }
    if (size+required>cacheLimit) throw new TubeError('busy','The video cache is busy. Try again shortly.',429);
  }
  async function extract(id, signal) {
    if (!VIDEO_ID.test(id)) throw new TubeError('video','Invalid video ID.',400);
    if (options.videoInfo) {
      const info = await options.videoInfo(id);
      mediaChoices(info);
      metadata.set(id, { info, expires: now() + 5 * 60000 });
      if (metadata.size > 40) metadata.delete(metadata.keys().next().value);
      return info;
    }
    const cached=metadata.get(id); if(cached?.expires>now()) return cached.info;
    if(inflight.has(id)) return inflight.get(id);
    const task=(async()=>{
      const work=join(root,`work-${randomUUID()}`); await mkdir(work,{mode:0o700});
      try {
        const args=['--ignore-config','--no-cache-dir','--js-runtimes',`node:${process.execPath}`,'--no-playlist','--skip-download','--no-warnings','--socket-timeout','8','--retries','0','--extractor-retries','0','--dump-single-json'];
        if(cookieFile) {
          try { await copyFile(cookieFile,join(work,'cookies.txt')); await chmod(join(work,'cookies.txt'),0o600); }
          catch { throw new TubeError('setup','The server login file is missing or unreadable.'); }
          args.push('--cookies',join(work,'cookies.txt'));
        }
        args.push(`https://www.youtube.com/watch?v=${id}`);
        let info;
        try { info=JSON.parse(await run(binary,args,{signal,timeout:35000})); } catch(error) { throw error instanceof TubeError?error:new TubeError('service','Video details could not be read.'); }
        if(info.id!==id) throw new TubeError('video','Unexpected video response.',422);
        mediaChoices(info);
        if(metadata.size>=40) metadata.delete(metadata.keys().next().value);
        metadata.set(id,{info,expires:now()+5*60000}); return info;
      } finally { await rm(work,{recursive:true,force:true}); }
    })().finally(()=>inflight.delete(id));
    inflight.set(id,task); return task;
  }
  function guard() {
    if(!enabled || closed) throw new TubeError('setup','Native playback is not enabled.');
    if(now()<cooldown) throw new TubeError('busy','The video service is resting after a failed request. Try again shortly.',429);
  }
  async function formats(id) {
    await ready;
    if(!enabled || closed) throw new TubeError('setup','Native playback is not enabled.');
    if(!VIDEO_ID.test(id)) throw new TubeError('video','Invalid video ID.',400);
    const cachedHeights=[...QUALITY].filter(height=>files.has(`${id}-${height}.mp4`));
    const details=metadata.get(id);
    if(details?.expires>now()) return mediaChoices(details.info).map(f=>({height:f.height}));
    if(cachedHeights.length) return cachedHeights.map(height=>({height}));
    guard();
    if(active || checkPromise || inflight.size) throw new TubeError('busy','Another video is being prepared. Try again shortly.',429);
    try { return mediaChoices(await extract(id)).map(f=>({height:f.height})); } catch(error) { record(error); throw error; }
  }
  async function mediaResponse(info, format, signal, range) {
    const headers = { 'User-Agent': String(format.http_headers?.['User-Agent'] || info.http_headers?.['User-Agent'] || 'Mozilla/5.0') };
    if(range) headers.Range=range;
    let url=publicMediaUrl(format.url), response;
    for(let redirects=0;redirects<=3;redirects++) {
      response=await request(url,{headers,signal,redirect:'manual'});
      if(![301,302,303,307,308].includes(response.status))break;
      const location=response.headers.get('location');await response.body?.cancel();
      if(redirects===3 || !location)throw new TubeError('service','The video stream redirected too many times.');
      url=publicMediaUrl(new URL(location,url).href);
    }
    if(!response.ok) { await response.body?.cancel(); throw new TubeError(response.status===429?'rate':'service','The video stream is temporarily unavailable.',502); }
    if(!/^(video|audio)\//i.test(response.headers.get('content-type')||'')) { await response.body?.cancel(); throw new TubeError('service','The video service returned an unexpected response.'); }
    return response;
  }
  async function check() {
    await ready; guard();
    if(checkPromise) return checkPromise;
    if(active || inflight.size || now()<checkAfter) throw new TubeError('busy','Wait before checking again.',429);
    checkAfter=now()+60000;
    checkPromise=(async()=>{
      try {
        const id='YE7VzlLtp-4'; metadata.delete(id);
        const info=await extract(id); const format=mediaChoices(info)[0];
        if(!format) throw new TubeError('service','No supported stream was found.');
        const response=await mediaResponse(info,format.video,AbortSignal.timeout(10000),'bytes=0-1023');
        const reader=response.body.getReader(); try { const block=await reader.read(); if(!block.value?.length) throw new TubeError('service','The stream returned no data.'); } finally { await reader.cancel(); }
        record(null);
      } catch(error) { record(error); }
      return status();
    })().finally(()=>{checkPromise=null;});
    return checkPromise;
  }
  async function prepare(id,height) {
    await ready;
    if(!VIDEO_ID.test(id)||!QUALITY.has(height)) throw new TubeError('video','Choose a supported video and quality.',400);
    const name=`${id}-${height}.mp4`, existing=files.get(name);
    if(existing) { existing.touched=now(); return {state:'ready',url:`/api/nyxtube/native/media/${name}`}; }
    const previous=jobs.get(name); if(previous?.state==='preparing') return {state:'preparing'};
    guard(); if(active || checkPromise || inflight.size) throw new TubeError('busy','Another video is being prepared. Try again shortly.',429);
    const job={state:'preparing',controller:new AbortController(),promise:null,created:now()};
    active=job; jobs.set(name,job);
    job.promise=(async()=>{
      const work=join(root,`work-${randomUUID()}`);
      const timer=setTimeout(()=>job.controller.abort(),4*60000);
      try {
        await evict(reserve);
        const disk=await statfs(root); if(disk.bavail*disk.bsize<reserve+2*1024*MB) throw new TubeError('service','The server needs more free space before preparing videos.');
        const info=await extract(id,job.controller.signal), choice=mediaChoices(info).find(f=>f.height===height);
        if(!choice) throw new TubeError('video','That quality is unavailable.',422);
        await mkdir(work,{mode:0o700});
        let received=0;
        async function download(format,name) {
          const size=Number(format.filesize || format.filesize_approx || 0);
          if(size>assetLimit) throw new TubeError('video','This video is too large for the temporary cache.',422);
          // Google video hosts can stall full-file requests; fetch bounded ranges.
          let offset=0,retries=0;
          while(true) {
            const receivedBefore=received;
            try {
            const signal=AbortSignal.any([job.controller.signal,AbortSignal.timeout(30000)]);
            const response=await mediaResponse(info,format,signal,`bytes=${offset}-${offset+4*MB-1}`);
            const partial=response.status===206;
            const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')||'');
            if ((partial && (!range || Number(range[1])!==offset || Number(range[2])<offset || Number(range[2])>=Number(range[3]))) || (!partial && offset!==0)) {
              await response.body?.cancel(); throw new TubeError('service','The video service returned an invalid byte range.');
            }
            const total=partial?Number(range[3]):Number(response.headers.get('content-length')||0);
            if(total>assetLimit) { await response.body?.cancel(); throw new TubeError('video','This video is too large for the temporary cache.',422); }
            let chunkBytes=0;
            const counter=new Transform({transform(chunk,enc,done){received+=chunk.length;chunkBytes+=chunk.length;done(received>assetLimit?new TubeError('video','This video exceeds the temporary cache limit.',422):null,chunk);}});
            await pipeline(Readable.fromWeb(response.body),counter,createWriteStream(join(work,name),{flags:offset?'a':'w',mode:0o600}),{signal});
            if(!chunkBytes || (partial && chunkBytes!==Number(range[2])-offset+1) || (!partial && total && chunkBytes!==total)) throw new TubeError('service','The video download was incomplete.');
            offset+=chunkBytes;retries=0;
            if(!partial || offset===total) break;
            } catch(error) {
              if(job.controller.signal.aborted || retries>=2 || (error instanceof TubeError && ['video','rate'].includes(error.code))) throw error;
              // Retry the same range; remove any partial bytes before appending again.
              received=receivedBefore;
              await truncate(join(work,name),offset).catch(error=>{if(error.code!=='ENOENT')throw error;});
              retries++;
              await new Promise(resolve=>setTimeout(resolve,300*retries));
            }
          }
        }
        await download(choice.video,'video.mp4'); if(choice.audio) await download(choice.audio,'audio.m4a');
        const output=join(work,'ready.mp4');
        const args=['-nostdin','-hide_banner','-loglevel','error','-protocol_whitelist','file,pipe','-i',join(work,'video.mp4')];
        if(choice.audio) args.push('-protocol_whitelist','file,pipe','-i',join(work,'audio.m4a'),'-map','0:v:0','-map','1:a:0');
        else args.push('-map','0:v:0','-map','0:a:0');
        args.push('-c','copy','-threads','1','-movflags','+faststart','-y',output);
        await run(ffmpeg,args,{signal:job.controller.signal,timeout:90000});
        const result=await stat(output); if(result.size<=0 || result.size>assetLimit+8*MB) throw new TubeError('video','The prepared video exceeds the cache limit.',422);
        await rename(output,join(root,name)); files.set(name,{path:join(root,name),size:result.size,touched:now()}); job.state='ready'; record(null);
      } catch(error) { job.state='failed'; job.error=error instanceof TubeError?error:new TubeError('service','Video preparation failed.'); record(job.error); }
      finally { clearTimeout(timer); try { await rm(work,{recursive:true,force:true}); } finally { active=null; } }
    })();
    job.promise.catch(()=>{}); return {state:'preparing'};
  }
  function jobStatus(id,height) {
    const name=`${id}-${height}.mp4`;
    if(!VIDEO_ID.test(id)||!QUALITY.has(height)) throw new TubeError('video','Invalid video request.',400);
    if(files.has(name)) return {state:'ready',url:`/api/nyxtube/native/media/${name}`};
    const job=jobs.get(name); if(job?.state==='failed') throw job.error;
    return {state:job?.state || 'missing'};
  }
  function lease(name) {
    if(!enabled || !CACHE_NAME.test(name)) return null;
    const file=files.get(name); if(!file) return null;
    file.touched=now(); leases.set(name,(leases.get(name)||0)+1);
    let released=false;
    return {path:file.path,release(){if(released)return;released=true;const n=(leases.get(name)||1)-1;if(n)leases.set(name,n);else leases.delete(name);}};
  }
  const timer=enabled?setInterval(()=>{ if(active || closed)return; ready.then(()=>evict(0)).catch(()=>{}); for(const [key,job] of jobs) if(job.state!=='preparing'&&job.created<now()-10*60000)jobs.delete(key); },60000):null;
  timer?.unref();
  async function close() {closed=true;clearInterval(timer);active?.controller.abort();await active?.promise;await checkPromise;await writes.catch(()=>{});}
  return {enabled,formats,prepare,jobStatus,lease,status,check,close};
}
