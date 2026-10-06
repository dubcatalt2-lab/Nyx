import {mkdir, open, readFile, rename, unlink} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {homedir} from 'node:os';

export const cloudStatePath = () => process.env.NYXCLOUD_STATE_FILE || (process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA || homedir(), 'NyxLocal', 'nyxcloud-state.json')
  : '/var/lib/nyx/nyxcloud-state.json');

// One service host, shared durable file. A process lock also protects overlapping
// service restarts. Never recover an uncertain allocation by giving it to a stranger.
export function cloudStateStore(file = cloudStatePath()) {
  let tail = Promise.resolve();
  let pending = 0;
  return task => {
    if(pending >= 256) return Promise.reject(Object.assign(Error('The desktop queue is busy. Try again shortly.'), {status:503, code:'queue_busy'}));
    pending++;
    const run = tail.then(async () => {
      await mkdir(dirname(file), {recursive:true, mode:0o700});
      const lockPath = file + '.lock';
      let lock;
      try { lock = await open(lockPath, 'wx', 0o600); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const pid = Number(await readFile(lockPath, 'utf8').catch(() => ''));
        let alive = true;
        if (Number.isInteger(pid) && pid > 0) {
          try { process.kill(pid, 0); } catch (e) { if(e.code === 'ESRCH') alive = false; }
        }
        if (alive) throw Object.assign(Error('The desktop queue is busy. Try again shortly.'), {status:503, code:'queue_busy'});
        await unlink(lockPath);
        lock = await open(lockPath, 'wx', 0o600);
      }
      try {
        await lock.writeFile(String(process.pid));
        let state;
        try { state = JSON.parse(await readFile(file, 'utf8')); }
        catch (error) { if(error.code !== 'ENOENT') throw error; state = {version:1, entries:[], syncedAt:0}; }
        if(state.version !== 1 || !Array.isArray(state.entries)) throw Error('Invalid desktop state');
        const save = async () => {
          const tmp = file + '.' + process.pid + '.tmp';
          const output = await open(tmp, 'w', 0o600);
          try { await output.writeFile(JSON.stringify(state)); await output.sync(); } finally { await output.close(); }
          await rename(tmp, file);
        };
        try { return await task(state, save); } finally { await save(); }
      } finally { await lock.close(); await unlink(lockPath); }
    });
    const finished=run.finally(()=>{pending--;});
    tail = finished.catch(() => {});
    return finished;
  };
}
